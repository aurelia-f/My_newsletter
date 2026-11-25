// ============================================================
//  Working out subscription prices.
//
//  The three add-ons STACK, and the more you take the cheaper
//  each one gets:
//    - 1 add-on     : full price
//    - 2 add-ons    : 20 % off the total
//    - all 3        : a flat "Full bundle" price
//
//  This sum is done ONLY here, server-side. The browser displays
//  the result, it never computes it: otherwise anyone could
//  subscribe for £0 by editing the request.
// ============================================================
const { Plan, Setting } = require('../models');

/**
 * @param {string[]} codes  the add-ons chosen
 * @returns {{ add_ons, detail, full, price, savings, full_bundle }}
 */
async function quote(codes) {
  const asked = [...new Set(codes || [])];

  const plans = await Plan.findAll({
    where: { active: true },
    order: [['sort_order', 'ASC']]
  });
  const known = new Map(plans.map(p => [p.code, p]));

  // An unknown code is ignored quietly rather than crashing.
  const addOns = asked.filter(c => known.has(c));
  if (addOns.length === 0) {
    return { add_ons: [], detail: [], full: 0, price: 0, savings: 0,
             full_bundle: false };
  }

  const detail = addOns.map(c => ({
    code: c,
    name: known.get(c).name,
    price_alone: known.get(c).monthly_price
  }));

  const full = round(detail.reduce((t, a) => t + a.price_alone, 0));

  const twoDiscount = await Setting.number('two_add_on_discount', 0.20);
  const bundlePrice = await Setting.number('full_bundle_price', 7.99);
  const planCount = plans.length;

  let price;
  let fullBundle = false;

  if (addOns.length >= planCount) {
    price = bundlePrice;            // everything, at a flat rate
    fullBundle = true;
  } else if (addOns.length === 2) {
    price = round(full * (1 - twoDiscount));
  } else {
    price = full;                   // a single add-on, full price
  }

  return {
    add_ons: addOns,
    detail,
    full,
    price: round(price),
    savings: round(full - price),
    full_bundle: fullBundle
  };
}

/**
 * The grid shown on the plans page: each add-on on its own, then
 * the worthwhile combinations, with the saving each one makes.
 */
async function grid() {
  const plans = await Plan.findAll({
    where: { active: true }, order: [['sort_order', 'ASC']]
  });
  const codes = plans.map(p => p.code);

  const pairs = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      pairs.push([codes[i], codes[j]]);
    }
  }

  return {
    add_ons: plans.map(p => ({
      code: p.code, name: p.name,
      description: p.description, monthly_price: p.monthly_price
    })),
    pairs: await Promise.all(pairs.map(p => quote(p))),
    bundle: await quote(codes)
  };
}

function round(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { quote, grid, round };
