// ============================================================
//  Demonstration data.
//
//    npm run seed
//
//  Creates a creator account (with access to the admin area), a
//  few friends, two groups, one published issue with filled-in
//  pages, subscriptions, orders and the six adverts. Enough to
//  show the site off without typing anything.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { sequelize, checkConnection } = require('../config/database');
const {
  Account, Group, Member, Issue, Entry, AskedQuestion, Reaction,
  Subscription, Payment, Order, Ad, AdStat
} = require('../models');
const { questionsForMonth } = require('../config/questions');
const { contentForIssue } = require('../services/keys');
const pricing = require('../services/pricing');
const { PACK_CONTENTS } = require('../routes/shop');

const PASSWORD = 'password123';

function shiftedMonth(n) {
  const d = new Date();
  const t = d.getFullYear() * 12 + d.getMonth() + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

const THE_ADS = [
  { title: 'The café that listens',   file: 'home_banner.png',         slot: 'home_banner' },
  { title: 'Socks, sold in threes',   file: 'groups_box.png',          slot: 'groups_box' },
  { title: 'Diary 2027',              file: 'questionnaire_strip.png', slot: 'questionnaire_strip' },
  { title: 'The encyclopaedia of gossip', file: 'paper_full_page.png', slot: 'paper_full_page' },
  { title: 'The print shop round the corner', file: 'paper_footer.png', slot: 'paper_footer' },
  { title: 'Letterbox, extra large',  file: 'issues_square.png',       slot: 'issues_square' }
];

// Stand-in photos, so the newspaper is not bare.
const PHOTOS = {
  'Aurelia': [{ url: '/uploads/demo/aurelia-01.jpg', type: 'image' },
              { url: '/uploads/demo/aurelia-02.jpg', type: 'image' }],
  'Lea':     [{ url: '/uploads/demo/lea-01.jpg', type: 'image' }],
  'Mina':    [{ url: '/uploads/demo/mina-01.jpg', type: 'image' },
              { url: '/uploads/demo/mina-02.jpg', type: 'image' }]
};

async function makeAccount(email, firstName, role = 'member', extras = {}) {
  return Account.create({
    id: uuid(), email, first_name: firstName, site_role: role,
    password: await bcrypt.hash(PASSWORD, 12), holidays: [], ...extras
  });
}

async function seed() {
  await checkConnection();
  console.log('\n🌱  Filling the database…\n');

  // --- The accounts -----------------------------------------
  const aurelia = await makeAccount('aurelia@mynewsletter.app', 'Aurelia', 'admin', {
    occupation: 'Engineering student', city: 'Cape Town',
    motto: 'We shall see.', birthday: '2003-12-26',
    avatar_url: '/uploads/demo/aurelia-02.jpg'
  });
  const lea = await makeAccount('lea@mynewsletter.app', 'Lea', 'member', {
    occupation: 'Architect', city: 'Lyon',
    motto: 'Always late, never absent.',
    avatar_url: '/uploads/demo/lea-01.jpg'
  });
  const mina = await makeAccount('mina@mynewsletter.app', 'Mina', 'member', {
    occupation: 'Nurse', city: 'Paris',
    motto: 'I will sleep when I am old.',
    avatar_url: '/uploads/demo/mina-01.jpg'
  });
  const zoe = await makeAccount('zoe@mynewsletter.app', 'Zoe', 'member', {
    occupation: 'Bookseller', city: 'Nantes'
  });
  console.log('  ✅ 4 accounts (password: ' + PASSWORD + ')');

  // --- The groups -------------------------------------------
  const flat = await Group.create({
    id: uuid(), name: 'The flat', icon: 'icon:beach-00',
    color: '#75A9A9', created_by: aurelia.id
  });
  const school = await Group.create({
    id: uuid(), name: 'The school friends', icon: 'icon:flower-02',
    color: '#DD8FA9', created_by: aurelia.id
  });

  for (const [group, people] of [[flat,   [[aurelia, 'admin'], [lea, 'member'], [mina, 'member']]],
                                 [school, [[aurelia, 'admin'], [zoe, 'admin'], [lea, 'member']]]]) {
    for (const [account, role] of people) {
      await Member.create({
        id: uuid(), group_id: group.id, email: account.email,
        first_name: account.first_name, account_id: account.id, role
      });
    }
  }
  // An invitation still waiting for its account.
  await Member.create({
    id: uuid(), group_id: flat.id, email: 'camille@mynewsletter.app',
    first_name: 'Camille', account_id: null, role: 'member'
  });
  console.log('  ✅ 2 groups, 7 memberships, 1 invitation pending');

  // --- Last month's issue, published ------------------------
  const lastMonth = shiftedMonth(-1);
  const issue1 = await Issue.create({
    id: uuid(), group_id: flat.id, number: 1, month: lastMonth,
    status: 'published', questions: questionsForMonth(lastMonth),
    render: 'duo', color: '#75A9A9',
    rendered_at: new Date(), rendered_by: aurelia.id,
    published_at: new Date()
  });

  const question = await AskedQuestion.create({
    id: uuid(), issue_id: issue1.id, author_id: lea.id,
    target_id: mina.id, text: 'Mina, tell us about that famous weekend.'
  });

  const DRAFTS = [
    [aurelia, {
      'choice__so_how_are_you_really': 'Pretty good',
      'long__my_month_in_three_lines':
        'I finished the semester, slept for three days, and started running along the sea again. Cape Town in November is a good idea.',
      'long__gossip_of_the_month': 'Someone in this flat adopted a cat without telling anyone.',
      'short__my_small_win': 'I finally tidied the hall cupboard.',
      'short__what_made_me_laugh': 'Lea trying to pronounce "Muizenberg".',
      'emojis__my_month_in_three_emojis': ['🌊', '📚', '😮‍💨'],
      'slider__my_energy_level': 7,
      'rating__my_month_out_of_five_stars': 4,
      'word__my_month_in_one_word': 'Dense'
    }],
    [lea, {
      'choice__so_how_are_you_really': 'Surviving',
      'long__my_month_in_three_lines':
        'Site, site, site. I have seen more breeze blocks than human beings. But the building is standing up, so I call it a success.',
      'long__gossip_of_the_month': 'I ran into someone from school in a lift. Thirty floors of silence.',
      'short__my_small_win': 'I said no to a meeting.',
      'emojis__my_month_in_three_emojis': ['🏗️', '☕', '🫠'],
      'slider__my_energy_level': 3,
      'rating__my_month_out_of_five_stars': 3,
      'word__my_month_in_one_word': 'Concrete'
    }],
    [mina, {
      'choice__so_how_are_you_really': 'Great',
      'long__my_month_in_three_lines':
        'Three night shifts, two birthdays, one house move. I no longer know what day it is but I am happy.',
      'long__gossip_of_the_month': 'His name is Thomas. There, I said it.',
      'short__my_small_win': 'I went a whole week without ordering a takeaway.',
      'emojis__my_month_in_three_emojis': ['💖', '🌙', '🥳'],
      'slider__my_energy_level': 8,
      'rating__my_month_out_of_five_stars': 5,
      'word__my_month_in_one_word': 'Alive',
      ['q_' + question.id]: 'Fine. We met at a wedding, he topped up my wine, and we have been writing to each other every day since. That is all you are getting.'
    }]
  ];

  const pages = [];
  for (const [account, draft] of DRAFTS) {
    const content = contentForIssue(issue1.toJSON(), draft, [question.toJSON()]);
    pages.push(await Entry.create({
      id: uuid(), issue_id: issue1.id, account_id: account.id,
      content, media: PHOTOS[account.first_name] || [], sent: true
    }));
  }

  // A few reactions.
  await Reaction.create({ id: uuid(), entry_id: pages[2].id, account_id: lea.id,
    emoji: '😮', word: 'THOMAS?!' });
  await Reaction.create({ id: uuid(), entry_id: pages[2].id, account_id: aurelia.id,
    emoji: '🫶' });
  await Reaction.create({ id: uuid(), entry_id: pages[1].id, account_id: mina.id,
    emoji: '👏', word: 'Saying no is an art.' });
  console.log('  ✅ 1 published issue, 3 pages, 1 question asked, 3 reactions');

  // --- This month's issues, still open ----------------------
  const thisMonth = shiftedMonth(0);
  await Issue.create({
    id: uuid(), group_id: flat.id, number: 2, month: thisMonth,
    status: 'open', questions: questionsForMonth(thisMonth)
  });
  await Issue.create({
    id: uuid(), group_id: school.id, number: 1, month: thisMonth,
    status: 'open', questions: questionsForMonth(thisMonth)
  });
  console.log('  ✅ 2 issues open');

  // --- The subscriptions ------------------------------------
  const SUBS = [
    [aurelia, ['unlimited_groups', 'no_ads', 'by_post']],
    [mina,    ['no_ads', 'by_post']],
    [lea,     ['no_ads']]
  ];
  for (const [account, addOns] of SUBS) {
    const quote = await pricing.quote(addOns);
    const next = new Date();
    next.setMonth(next.getMonth() + 1);

    await Subscription.create({
      id: uuid(), account_id: account.id, add_ons: quote.add_ons,
      monthly_price: quote.price, savings: quote.savings,
      status: 'active', renews_on: next.toISOString().slice(0, 10)
    });
    // Three months of past payments, so the figures have some life.
    for (let i = 0; i < 3; i++) {
      const when = new Date();
      when.setMonth(when.getMonth() - i);
      await Payment.create({
        id: uuid(), account_id: account.id, amount: quote.price,
        purpose: 'Monthly subscription', reference: 'MN-' + uuid().slice(0, 8).toUpperCase(),
        status: 'succeeded', created_at: when
      });
    }
  }
  console.log('  ✅ 3 subscriptions and their payment history');

  // --- The paper orders -------------------------------------
  await Order.create({
    id: uuid(), account_id: lea.id, kind: 'single_issue',
    issue_id: issue1.id, group_id: flat.id, copies: 2,
    pack_contents: [PACK_CONTENTS[0]], amount: 9.00,
    address: { name: 'Lea Marchand', line1: '3 Lilac Street',
               postcode: '69003', city: 'Lyon', country: 'France' },
    status: 'shipped', shipped_at: new Date()
  });
  await Order.create({
    id: uuid(), account_id: aurelia.id, kind: 'group_pack',
    group_id: flat.id, issue_id: issue1.id, copies: 4,
    pack_contents: PACK_CONTENTS, amount: 27.60,
    address: { name: 'Aurelia', line1: "16 St John's Road",
               postcode: '8005', city: 'Cape Town', country: 'South Africa' },
    status: 'paid'
  });
  console.log('  ✅ 2 paper orders (1 to ship)');

  // --- The six adverts --------------------------------------
  for (const a of THE_ADS) {
    const ad = await Ad.create({
      id: uuid(), title: a.title, image_url: '/ads/' + a.file,
      slot: a.slot, link: 'https://example.org/',
      active: true, impressions: 0, clicks: 0
    });
    // A little history, so the charts are not empty.
    let totalViews = 0, totalClicks = 0;
    for (let i = 0; i < 14; i++) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const views = 40 + Math.floor(Math.random() * 120);
      const clicks = Math.floor(views * (0.01 + Math.random() * 0.04));
      await AdStat.create({ ad_id: ad.id, day, impressions: views, clicks });
      totalViews += views; totalClicks += clicks;
    }
    await ad.update({ impressions: totalViews, clicks: totalClicks });
  }
  console.log('  ✅ 6 adverts with 14 days of statistics');

  console.log('\n──────────────────────────────────────────────');
  console.log('  To sign in:');
  console.log('    aurelia@mynewsletter.app  (admin area)');
  console.log('    lea@ · mina@ · zoe@mynewsletter.app');
  console.log('    password: ' + PASSWORD);
  console.log('──────────────────────────────────────────────\n');

  await sequelize.close();
}

seed().catch(e => { console.error('❌', e); process.exit(1); });
