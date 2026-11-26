// ============================================================
//  My Newsletter — Node.js / Express server
//  TI510M-TI610M Advanced Web Programming
//
//  Start:  npm install  then  npm start
//  The API is served at http://localhost:3000/api
// ============================================================
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { checkConnection } = require('./config/database');
const { Account } = require('./models');
const { errorHandler, wrap } = require('./middleware/errors');
const config = require('./config/questions');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
//  1. Basic middleware
// ------------------------------------------------------------

// In development the Vue client runs on another port, so we have
// to allow that origin AND cookies (credentials).
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploaded photos and ad images, served statically.
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/ads',     express.static(path.join(__dirname, 'public', 'ads')));

// ------------------------------------------------------------
//  2. Sessions (lecture CM4)
//     The browser only gets a session id in a cookie; everything
//     else is kept server-side, in MySQL.
// ------------------------------------------------------------
const store = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true
});

app.use(session({
  name: 'newsletter.sid',
  secret: process.env.SESSION_SECRET || 'development-secret',
  store,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                   // page scripts cannot read it
    secure: process.env.NODE_ENV === 'production',    // HTTPS only in production
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000                     // 30 days
  }
}));

// ------------------------------------------------------------
//  3. Load the signed-in account on every request
//     (the CM4 example: "Session: retrieve a user")
// ------------------------------------------------------------
app.use(wrap(async (req, res, next) => {
  if (req.session && req.session.accountId) {
    req.account = await Account.findByPk(req.session.accountId);
    // The account was deleted in the meantime: clear the session.
    if (!req.account) req.session.destroy(() => {});
  }
  next();
}));

// ------------------------------------------------------------
//  4. The API routes
// ------------------------------------------------------------
app.get('/api/config', (req, res) => {
  // The questionnaire settings, read by the Vue client.
  res.json({
    site_name: config.SITE_NAME,
    tagline: config.TAGLINE,
    emoji_palette: config.EMOJI_PALETTE,
    group_emoji_palette: config.GROUP_EMOJI_PALETTE,
    reaction_emojis: config.REACTION_EMOJIS,
    holidays: config.HOLIDAYS,
    express_ids: config.EXPRESS_IDS,
    signed_in: !!req.account
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/profiles',      require('./routes/profiles'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/issues',        require('./routes/issues'));
app.use('/api/entries',       require('./routes/entries'));
app.use('/api/questions',     require('./routes/questions'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/shop',          require('./routes/shop'));
app.use('/api/ads',           require('./routes/ads'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/mails',         require('./routes/mails'));

// An unknown API route answers in JSON, never in HTML.
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown route.' }));

// ------------------------------------------------------------
//  5. The built Vue client.
//     Any unknown address returns index.html: it is Vue Router
//     that decides which page to show. Without this, reloading
//     on /groups/123 would give a 404.
// ------------------------------------------------------------
const clientFolder = path.join(__dirname, '..', 'client', 'dist');
const clientBuilt = fs.existsSync(path.join(clientFolder, 'index.html'));

if (clientBuilt) {
  app.use(express.static(clientFolder));
  app.get(/^\/(?!api|uploads|ads).*/, (req, res) => {
    res.sendFile(path.join(clientFolder, 'index.html'));
  });
} else {
  // Nothing built yet. Rather than a bare 404 that explains
  // nothing, say what to do about it.
  app.get(/^\/(?!api|uploads|ads).*/, (req, res) => {
    res.status(503).type('html').send(`
      <!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
      <title>Client not built</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #FBF2DC;
               color: #3A2E2A; display: grid; place-items: center;
               min-height: 100vh; margin: 0; padding: 24px; }
        div  { max-width: 560px; background: #FFFDF8; padding: 32px;
               border-radius: 18px; box-shadow: 0 2px 14px rgba(0,0,0,.07); }
        h1   { color: #A81B4C; margin-top: 0; }
        code { background: #F4E6C8; padding: 2px 6px; border-radius: 5px; }
        pre  { background: #F4E6C8; padding: 14px; border-radius: 10px;
               overflow-x: auto; }
      </style></head><body><div>
      <h1>The API is running, the site is not built</h1>
      <p>The server is up on port ${PORT}, but there is no built client
         in <code>client/dist</code> to serve.</p>
      <p><strong>To work on the site</strong>, run this in a second terminal
         and open <code>http://localhost:5173</code>:</p>
      <pre>cd client
npm install
npm run dev</pre>
      <p><strong>To serve everything from this one address</strong>, build
         the client first:</p>
      <pre>cd client
npm run build</pre>
      <p>Then reload this page.</p>
      <p style="opacity:.65">Opening <code>client/index.html</code> by
         double-clicking it will not work: that file asks for
         <code>/src/main.js</code>, which only exists while the
         development server is running.</p>
      </div></body></html>`);
  });
}

app.use(errorHandler);

// ------------------------------------------------------------
//  6. Start
// ------------------------------------------------------------
async function start() {
  await checkConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀  API ready at http://localhost:${PORT}/api`);
    if (clientBuilt) {
      console.log(`🌸  Site ready at http://localhost:${PORT}\n`);
    } else {
      console.log(`⚠️   Client not built — run "npm run dev" in client/,`);
      console.log(`    then open http://localhost:5173\n`);
    }
  });
}

if (require.main === module) start();

module.exports = app;
