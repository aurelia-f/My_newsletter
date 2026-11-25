// ============================================================
//  The ad server.
//
//  An ad is NEVER sent to someone who paid for the "no_ads"
//  add-on: the filter is here, server-side. Hiding ads in CSS
//  would not be a service actually rendered.
// ============================================================
const { Op } = require('sequelize');
const { Ad, AdStat, Subscription } = require('../models');

/**
 * Picks an ad at random for a slot, and counts the impression.
 * Returns null if the person pays for "no ads", or if no ad is
 * active in that slot.
 */
async function forSlot(slot, accountId) {
  if (accountId && await Subscription.hasAddOn(accountId, 'no_ads')) return null;

  const candidates = await Ad.findAll({ where: { slot, active: true } });
  if (candidates.length === 0) return null;

  const ad = candidates[Math.floor(Math.random() * candidates.length)];
  await count(ad.id, 'impression');

  return {
    id: ad.id,
    title: ad.title,
    image_url: ad.image_url,
    link: ad.link,
    slot: ad.slot,
    format: Ad.FORMATS[ad.slot]
  };
}

/** Bumps the overall counter and today's statistic. */
async function count(adId, kind) {
  const field = kind === 'click' ? 'clicks' : 'impressions';
  await Ad.increment(field, { by: 1, where: { id: adId } });

  const day = new Date().toISOString().slice(0, 10);
  const [row] = await AdStat.findOrCreate({
    where: { ad_id: adId, day },
    defaults: { ad_id: adId, day, impressions: 0, clicks: 0 }
  });
  await row.increment(field, { by: 1 });
}

/** The last 30 days, for the admin area. */
async function report() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const ads = await Ad.findAll({ order: [['slot', 'ASC']] });
  const stats = await AdStat.findAll({ where: { day: { [Op.gte]: since } } });

  return ads.map(a => {
    const mine = stats.filter(s => s.ad_id === a.id);
    const impressions = mine.reduce((t, s) => t + s.impressions, 0);
    const clicks = mine.reduce((t, s) => t + s.clicks, 0);
    return {
      id: a.id, title: a.title, slot: a.slot,
      active: a.active, image_url: a.image_url,
      format: Ad.FORMATS[a.slot],
      total: { impressions: a.impressions, clicks: a.clicks },
      month: { impressions, clicks,
               rate: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0 }
    };
  });
}

module.exports = { forSlot, count, report };
