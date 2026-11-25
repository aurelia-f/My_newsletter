// ============================================================
//  The profile card, and uploading photos.
// ============================================================
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const { Account, Member } = require('../models');
const { wrap } = require('../middleware/errors');
const { requireLogin } = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin);

// The fields we accept changes to. Everything else is ignored:
// nobody promotes themselves to "admin" by adding a field.
const EDITABLE_FIELDS = [
  'first_name', 'avatar_url', 'birthday', 'bio', 'city',
  'occupation', 'children', 'pets', 'fun_fact', 'motto',
  'holidays', 'tutorial_seen'
];

// --- GET /api/profiles/me -----------------------------------
router.get('/me', wrap(async (req, res) => {
  res.json(req.account.toPublic());
}));

// --- PATCH /api/profiles/me ---------------------------------
router.patch('/me', wrap(async (req, res) => {
  const fields = {};
  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  if (fields.birthday === '') fields.birthday = null;

  await req.account.update(fields);

  // The first name follows the person into all her groups.
  if (fields.first_name) {
    await Member.update(
      { first_name: fields.first_name },
      { where: { account_id: req.account.id } }
    );
  }
  res.json(req.account.toPublic());
}));

// --- GET /api/profiles/:id ----------------------------------
//  You can only read someone's card if you share a group.
router.get('/:id', wrap(async (req, res) => {
  if (req.params.id === req.account.id) return res.json(req.account.toPublic());

  const mine = (await Member.findAll({
    where: { account_id: req.account.id }, attributes: ['group_id']
  })).map(m => m.group_id);

  const shared = await Member.findOne({
    where: { account_id: req.params.id, group_id: mine }
  });
  if (!shared) return res.status(403).json({ error: 'That card is not available to you.' });

  const other = await Account.findByPk(req.params.id);
  if (!other) return res.status(404).json({ error: 'Profile not found.' });
  res.json(other.toPublic());
}));

// ------------------------------------------------------------
//  Uploads (profile photo, photos of the month).
//  Replaces Supabase Storage: files live in
//  server/public/uploads/<account id>/.
// ------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const folder = path.join(__dirname, '..', 'public', 'uploads', req.account.id);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    cb(null, uuid() + ext);
  }
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },   // 15 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('That file type is not accepted.'));
    }
    cb(null, true);
  }
});

// --- POST /api/profiles/media -------------------------------
router.post('/media', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  res.status(201).json({
    url: `/uploads/${req.account.id}/${req.file.filename}`,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
  });
}));

module.exports = router;
