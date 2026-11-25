// ============================================================
//  SIMULATED payment.
//
//  No real card is charged, no outside service is called. We check
//  the shape of the fields, we decline a couple of test numbers,
//  and we record the trace so the admin area has real figures.
//
//  To plug in a real Stripe later, replace the body of charge():
//  nothing else on the site has to change.
// ============================================================
const { v4: uuid } = require('uuid');
const { Payment } = require('../models');

// Number reserved for demonstrating a decline.
const DECLINED_CARD = '4000000000000002';

function luhn(number) {
  let sum = 0, double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * @param {object} card      { number, expiry, cvc, name }
 * @param {number} amount    in euros
 * @param {string} purpose   what is being paid for, for the history
 * @param {string} accountId
 */
async function charge(card, amount, purpose, accountId) {
  const number = String(card?.number || '').replace(/\s+/g, '');

  if (!/^\d{13,19}$/.test(number) || !luhn(number)) {
    throw Object.assign(new Error('Invalid card number.'), { status: 400 });
  }
  if (!/^\d{2}\/\d{2}$/.test(String(card?.expiry || ''))) {
    throw Object.assign(new Error('Expiry date should be MM/YY.'), { status: 400 });
  }
  if (!/^\d{3,4}$/.test(String(card?.cvc || ''))) {
    throw Object.assign(new Error('Invalid security code.'), { status: 400 });
  }

  const reference = 'MN-' + Date.now().toString(36).toUpperCase();

  if (number === DECLINED_CARD) {
    await Payment.create({
      id: uuid(), account_id: accountId, amount, purpose,
      reference, status: 'declined'
    });
    throw Object.assign(new Error('Payment declined by the bank.'), { status: 402 });
  }

  const payment = await Payment.create({
    id: uuid(), account_id: accountId, amount, purpose,
    reference, status: 'succeeded'
  });

  return { reference, amount, payment_id: payment.id, simulated: true };
}

module.exports = { charge, DECLINED_CARD };
