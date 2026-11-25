# My Newsletter — Vue.js / Node.js / MySQL

Coursework for **TI510M-TI610M · Advanced Web Programming**.

A private newsletter: every month each person fills in a
questionnaire, and the group gets a real newspaper back, one page
each.

> **Trying to start it?** See **[START-HERE.md](START-HERE.md)**.
> You cannot open `client/index.html` by double-clicking it.

---

## What the course asks for, and where it is

| Required by the syllabus | Where it lives |
|---|---|
| A web interface with several pages | `client/src/views/` — 11 views, one per screen |
| A Single Page Application | `client/src/router/index.js` — Vue Router, lazy loading |
| Vue components | `client/src/components/` — 8 reusable components |
| A web server with an API | `server/index.js` + `server/routes/` — 10 Express routers |
| SQL persistence | MySQL, through **Sequelize** and the **mysql2** driver |
| Standard authentication | **bcrypt** (cost 12) + **express-session** + an `httpOnly` cookie |
| Client ↔ server communication | A JSON API, `fetch` with `credentials: 'include'` |

Sequelize is the approach shown in lecture CM5 and `express-session`
the one in CM4: that is exactly what is used here.

---

## Architecture

```
my-newsletter/
├── server/                     Node.js + Express + MySQL
│   ├── index.js                the server: session, routes, built client
│   ├── config/
│   │   ├── database.js         the MySQL connection
│   │   └── questions.js        the question bank and the monthly draw
│   ├── models/                 15 Sequelize models + their associations
│   ├── routes/                 10 routers: the JSON API
│   ├── middleware/
│   │   ├── permissions.js      who is allowed to do what  ← the security
│   │   └── errors.js           every error comes out as JSON
│   ├── services/
│   │   ├── pricing.js          working out the tiered prices
│   │   ├── payment.js          the simulated payment
│   │   ├── ads.js              the ad server
│   │   └── keys.js             draft → one issue's entry
│   ├── sql/
│   │   ├── schema.sql          the 16 tables
│   │   └── seed.js             demonstration data
│   └── public/                 uploaded photos, advert images
│
└── client/                     Vue 3 + Vite
    ├── src/
    │   ├── main.js             the entry point
    │   ├── App.vue             the shared header + <RouterView>
    │   ├── router/index.js     the routes and the navigation guard
    │   ├── api/client.js       every call to the API
    │   ├── api/state.js        the shared state (who is signed in)
    │   ├── views/              11 screens
    │   ├── components/         8 components
    │   └── assets/style.css    the stylesheet, class names translated
    └── public/                 the logo and 141 group icons
```

### What changed from the Supabase version

| Before | Now | Why |
|---|---|---|
| Supabase (BaaS) | Node.js + Express + MySQL | the course wants a server of your own |
| Separate HTML pages | A Vue SPA + Vue Router | the course wants an SPA |
| Magic link by e-mail | Password + bcrypt + session | the course wants standard auth |
| PostgreSQL row-level security | Express middleware | MySQL has no RLS |
| Supabase Storage | multer, into `server/public/uploads/` | no outside service any more |
| `pg_cron` | to be written with `node-cron` | the job runs inside the server |

**The design has not moved.** The stylesheet is the original one: the
same rules, the same values, the same 2 310 lines — only the class
names and the comments were translated, and the Vue templates use
those same names. Two small additions are *scoped* to the component
that needs them (the ad server, and two layout fixes); the shared
stylesheet is never patched.

---

## Security

With Supabase, PostgreSQL stopped you reading a group you did not
belong to (row-level security rules). MySQL has no equivalent, so
those rules live in `server/middleware/permissions.js`, and they run
**before** any query reaches the database.

| Guard | What it prevents |
|---|---|
| `requireLogin` | acting without a valid session |
| `requireMember` | reading a group you are not in |
| `requireGroupAdmin` | publishing an issue, inviting, removing someone |
| `requireSiteAdmin` | entering the admin area |
| `groupQuota` | creating a 4th group without a subscription |

A few precautions that matter:

- passwords are **hashed with bcrypt** (cost 12); the database never
  holds a readable password, and the hash is never sent to the
  browser;
- the session is **regenerated on sign-in** (against session
  fixation), and the cookie is `httpOnly`, so page scripts cannot
  read it;
- for an unknown address, sign-in returns **the same message** as for
  a wrong password, and takes the same time: otherwise the site
  becomes a directory of which accounts exist;
- the profile accepts only a **whitelist of fields**: you do not
  promote yourself to "admin" by adding a key to the request;
- **a group's creator is protected in the database**: even by
  tampering with requests you can neither remove her nor take away
  her role;
- when a page is sent, membership is rechecked **for every group**:
  the list the browser sent is never trusted;
- **a subscription price is always recomputed server-side**; the
  client sends the add-ons it wants, never an amount.

The Vue Router guard (`router/index.js`) is only a display
convenience. It is backed up everywhere on the server, and that is
where the real security sits.

---

## Making money

### Subscriptions — three add-ons that stack and get cheaper

| Add-on | On its own |
|---|---|
| Unlimited groups (past the 3 free ones) | €2.99/mo |
| No advertising | €1.99/mo |
| Newsletter by post | €4.99/mo |

- **two add-ons**: 20 % off the total;
- **all three**: a flat "Full bundle" at **€7.99** instead of €9.97.

The sum lives in `server/services/pricing.js`, and nowhere else.
Prices live **in the database**, not in the code: they are changed
from the admin area, under "Prices".

### The free quota

Three groups are free. The fourth returns a **402 Payment Required**
naming the missing add-on, and the page offers the subscription. It
is locked in the middleware, not in the interface.

### The paper shop

- **a single issue**: €4.50 a copy;
- **the group pack**: €6.90 per person. The newspaper goes straight
  into each person's letterbox, with a business card, the sticker of
  the month and two blank postcards. Admins only, since it commits
  the whole group.

The pack's contents are stored as JSON (`orders.pack_contents`), so a
goodie can be added without touching the schema or the code.

### Payment

**It is simulated.** No bank is contacted, no money is taken, and it
says so on screen. The number is still checked (length, Luhn digit)
and the trace is kept, so the admin figures are real.

- card that works: `4242 4242 4242 4242`
- card that declines: `4000 0000 0000 0002`

To plug in a real Stripe later, replace the body of `charge()` in
`server/services/payment.js`. Nothing else has to change.

---

## The six advertising slots

Six images are needed. The files shipped in `server/public/ads/` are
**parody placeholders**: replace each file with your own, keeping the
same name, and that is it.

| # | File | Where it shows | Size |
|---|---|---|---|
| 1 | `home_banner.png` | Top of "Your groups" | 970 × 250 |
| 2 | `groups_box.png` | Under the list of groups | 300 × 250 |
| 3 | `questionnaire_strip.png` | Inside the questionnaire | 728 × 90 |
| 4 | `paper_full_page.png` | A full page inside the newspaper | 1240 × 1754 (A4) |
| 5 | `paper_footer.png` | Foot of the newspaper | 900 × 150 |
| 6 | `issues_square.png` | The "My newspapers" page | 300 × 300 |

They are served by the API, with impressions and clicks counted. From
the admin area you add them, pause them and delete them, without
touching the code.

**Subscribers to "No advertising" receive none of them**: the filter
is in `server/services/ads.js`, on the server. Hiding ads in CSS
would not be a service actually rendered.

Site adverts disappear when printing; the ones inside the newspaper
stay, which is the whole point of paper.

---

## The admin area

At `/admin`, for accounts whose `site_role = 'admin'`.
To promote someone:

```sql
UPDATE accounts SET site_role = 'admin' WHERE email = 'you@example.com';
```

Five tabs: the **figures** (monthly recurring revenue, subscribers per
add-on, conversion rate, response rate, sign-up chart), the
**members** with their subscription, the **orders** waiting to ship,
the **adverts** and their statistics, and the **prices**, editable.

---

## The newspaper

An issue does not look like a web page: it is a real newspaper, one
A4 sheet per person. The header and the footer are **locked** —
month, group name, first name, issue number — and never change.

What changes is the layout of the body: five templates
(`g-classic`, `g-edit`, `g-dropcap`, `g-retro`, `g-urban`), handed
out so that two neighbours never get the same one, and so they rotate
from month to month.

Three renderings are available: black and white, one colour
(duotone), and full colour. The first person to choose sets it for
the whole group; after that, only an admin can change it.

A heavily filled page **runs onto several sheets**: nothing is shrunk
or cut, the rest appears on the next sheet with the same header, and
a dotted rule shows where each sheet stops. `Issue.vue` measures and
decides, after rendering.

The **Save as PDF** button produces exactly what is on screen, in A4.
In the print dialogue: margins set to "none", and tick background
graphics.

---

## What was not carried over

To be straight about the scope:

- **voice dictation** (`dictee.js`): it relies on the browser's
  speech recognition, it is independent of the server and adds
  nothing to the marking scheme;
- **free arrangement of blocks** (`editeur.js`): the `entries.layout`
  column exists and so does the route that saves it, but the
  drag-and-drop editor is not ported;
- **the welcome tutorial** (`tuto.js`): the `tutorial_seen` column is
  there, the pop-up is not;
- **the job on the 1st of the month**: it used to run inside
  PostgreSQL (`pg_cron`). `node-cron` is installed and ready, the job
  itself remains to be written; in the meantime issues are opened and
  published by hand, which the site already supports.

---

## Tests

`server/` ships no test framework, but the whole journey has been
checked end to end: sign-up, sign-in, the group quota, invitations,
the wall between groups, opening and publishing an issue, the single
draft mapped onto several groups, questions between friends,
reactions, the three rendering modes and who may change them, the
three pricing tiers, a declined card, paper orders, ads filtered for
subscribers, and the admin area refusing an ordinary member.
**51 checks, all passing.**
