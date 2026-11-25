// ============================================================
//  The ad server, client side.
//  An ad is not returned to "no ads" subscribers: the filter is
//  in services/ads.js, server-side.
// ============================================================
const express = require('express');
const adServer = require('../services/ads');
const { Ad } = require('../models');
const { wrap } = require('../middleware/errors');

const router = express.Router();

// --- GET /api/ads/:slot -------------------------------------
router.get('/:slot', wrap(async (req, res) => {
  if (!Ad.SLOTS.includes(req.params.slot)) {
    return res.status(400).json({ error: 'Unknown slot.' });
  }
  const ad = await adServer.forSlot(req.params.slot, req.session.accountId);
  res.json(ad);   // null = no ad (no-ads subscriber, or none active)
}));

// --- POST /api/ads/:id/click --------------------------------
router.post('/:id/click', wrap(async (req, res) => {
  const ad = await Ad.findByPk(req.params.id);
  if (!ad) return res.status(404).json({ error: 'Ad not found.' });
  await adServer.count(ad.id, 'click');
  res.json({ ok: true, link: ad.link });
}));

module.exports = router;
