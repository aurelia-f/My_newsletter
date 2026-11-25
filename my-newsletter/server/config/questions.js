// ============================================================
//  The question bank, and the draw for a given month.
//
//  THIS is the file to edit to change the questionnaire.
//  It lives on the SERVER: it draws the questions when an issue
//  opens, then freezes them as JSON in the "issues" table. The
//  browser decides nothing.
//
//  The client reads these settings through GET /api/config.
// ============================================================

const SITE_NAME = 'My Newsletter';
const TAGLINE = 'News from our lives, once a month.';

// ==========================================================
//  1. THE FIXED SECTIONS — in every issue
// ==========================================================
const SECTIONS = [
  { id: 'mood', type: 'choice', express: true,
    label: 'So, how are you really?',
    choices: ['Great', 'Pretty good', 'Ticking along', 'Surviving',
              'Rough month', "Don't ask"] },

  { id: 'summary', type: 'long', express: true,
    label: 'My month in three lines',
    hint: 'What you would tell someone over a coffee.' },

  { id: 'energy', type: 'slider',
    label: 'My energy level',
    hint: '0 = a wreck, 10 = unstoppable. We will compare in a year.',
    min: 0, max: 10, lowLabel: 'Flat', highLabel: 'Unstoppable' },

  { id: 'mode', type: 'multi',
    label: 'This month I was mostly in',
    hint: 'Tick everything that applies, no shame.',
    choices: ['Swamped', 'In love', 'Productive', 'A mess', 'Sporty',
              'Homebody', 'Party mode', 'Unbearable', 'Zen', 'Deep in thought'] },

  { id: 'gossip', type: 'long', express: true,
    label: 'Gossip of the month',
    hint: 'News, a rumour, an announcement. Anything goes.' },

  { id: 'win', type: 'short',
    label: 'My small win',
    hint: 'However tiny. Especially if it is tiny.' },

  { id: 'laughed', type: 'short', label: 'What made me laugh' },

  { id: 'cried', type: 'short', label: 'What made me cry',
    hint: 'A film, a news story, plain tiredness. Or nothing at all.' },

  { id: 'emojis', type: 'emojis', express: true,
    label: 'My month in three emojis',
    hint: 'Three, no more. It is what we will reread fastest in ten years.' },

  { id: 'song', type: 'music',
    label: 'My song of the moment',
    hint: "It will join the group's playlist for the month." },

  { id: 'watching', type: 'short', label: 'What I am watching or reading' },

  { id: 'purchase', type: 'short', label: 'My purchase of the month',
    hint: 'Proudly owned, or deeply regretted.' },

  { id: 'month_rating', type: 'rating', label: 'My month, out of five stars' },

  { id: 'photos', type: 'photos', express: true,
    label: 'My month in photos',
    hint: 'The babies, the cats, the trips, the brunch that went wrong.' },

  { id: 'next', type: 'short', label: 'Next month, I cannot wait to…' }
];

// ==========================================================
//  2. TICK-BOX QUESTIONS — two drawn per issue
// ==========================================================
const CHOICE_QUESTIONS = [
  { id: 'c_sleep', type: 'choice', label: 'My sleep this month',
    choices: ['Like a baby', 'Decent', 'Chaotic', 'Non-existent'] },

  { id: 'c_social', type: 'choice', label: 'My social life this month',
    choices: ['On fire', 'Balanced', 'Winding down', 'I live under a rock'] },

  { id: 'c_money', type: 'choice', label: 'Me and money this month',
    choices: ['Good as gold', 'Fine', 'I caved once', "Let's not look at the statement"] },

  { id: 'c_sport', type: 'choice', label: 'Exercise and me this month',
    choices: ['Regular', 'Now and then', 'I thought about it', 'Exercise is dead'] },

  { id: 'c_food', type: 'choice', label: 'This month I mostly ate',
    choices: ['Home cooking', 'A bit of both', 'Takeaways', 'Bread and hope'] },

  { id: 'c_screen', type: 'choice', label: 'My screen time',
    choices: ['Under control', 'Reasonable', 'Worrying', 'I refuse to answer'] },

  { id: 'c_discovered', type: 'multi', label: 'This month I discovered',
    choices: ['A series', 'An album', 'A restaurant', 'A book', 'A sport',
              'A recipe', 'A place', 'A person', 'Nothing at all'] },

  { id: 'c_pride', type: 'slider', label: 'How proud I am of this month, out of ten',
    min: 0, max: 10, lowLabel: 'Meh', highLabel: 'Very proud' },

  { id: 'c_stress', type: 'slider', label: 'My stress level',
    min: 0, max: 10, lowLabel: 'Calm', highLabel: 'On the edge' },

  { id: 'c_word', type: 'word', label: 'My month in ONE word',
    hint: "Just one. We will make the group's word cloud out of them." },

  { id: 'c_nextmonth', type: 'choice', label: 'Next month is going to be',
    choices: ['Brilliant', 'Busy', 'Quiet', 'No idea'] },

  { id: 'c_need', type: 'multi', label: 'What I could do with right now',
    choices: ['A holiday', 'Sleep', 'A hug', 'Money', 'Silence',
              'People', 'A project', 'Nothing, I am fine'] }
];

// ==========================================================
//  3. SEASONAL QUESTIONS — one per calendar month
// ==========================================================
const SEASONAL_QUESTIONS = {
  1:  { id: 's_january', type: 'long',
        label: 'Your January resolution, and your honest forecast for its survival?' },
  2:  { id: 's_february', type: 'long',
        label: 'February, month of love: tell us a love story. Yours, a friend’s, or your grandparents’.' },
  3:  { id: 's_march', type: 'long',
        label: 'What are you picking back up, or putting down, this quarter?' },
  4:  { id: 's_april', type: 'long',
        label: 'The last time you got fooled, or fooled somebody else?' },
  5:  { id: 's_may', type: 'long',
        label: 'Your next day off: what are you doing with it?' },
  6:  { id: 's_june', type: 'long',
        label: 'Half the year is gone: what are you keeping, what are you throwing out?' },
  7:  { id: 's_july', type: 'long',
        label: 'Your plan for the summer, however modest, however shameful?' },
  8:  { id: 's_august', type: 'long',
        label: 'The best summer memory of your life, any year at all?' },
  9:  { id: 's_september', type: 'long',
        label: 'Your new term in one word and one photo. What does your life look like right now?' },
  10: { id: 's_october', type: 'long',
        label: 'What were you afraid of this year, and did it come true?' },
  11: { id: 's_november', type: 'long',
        label: 'Three things you are sincerely grateful for right now?' },
  12: { id: 's_december', type: 'long',
        label: 'Your year in three lines: the best, the worst, the surprise.' }
};

// ==========================================================
//  4. HOLIDAYS — ticked on your profile, asked in the right month
// ==========================================================
const HOLIDAYS = [
  { id: 'christmas', name: 'Christmas', months: [12],
    question: 'Your Christmas: who with, where, and the detail nobody would guess?' },
  { id: 'new_year', name: 'New Year', months: [12, 1],
    question: 'Your turn into the new year: tell us about the evening, or the lack of one.' },
  { id: 'eid', name: 'Eid', months: [3, 4, 5, 6],
    question: 'Your Eid: who with, what you ate, the moment you will remember?' },
  { id: 'ramadan', name: 'Ramadan', months: [2, 3, 4, 5],
    question: 'Your Ramadan this year: how you are finding it, and your best iftar?' },
  { id: 'easter', name: 'Easter', months: [3, 4],
    question: 'Your Easter weekend, somewhere between the solemn and the chocolate?' },
  { id: 'hanukkah', name: 'Hanukkah', months: [11, 12],
    question: 'Your Hanukkah: the evenings, the people, the doughnuts?' },
  { id: 'rosh_hashanah', name: 'Rosh Hashanah', months: [9, 10],
    question: 'Your new year: what you are leaving behind, what you are hoping for?' },
  { id: 'diwali', name: 'Diwali', months: [10, 11],
    question: 'Your Diwali: the lights, the people, what you enjoyed most?' },
  { id: 'lunar_new_year', name: 'Lunar New Year', months: [1, 2],
    question: 'Your New Year: the meal, the family, the feel of it?' },
  { id: 'thanksgiving', name: 'Thanksgiving', months: [11],
    question: 'Your Thanksgiving: the table, the people, the dish everyone fought over?' },
  { id: 'own_birthday', name: 'My birthday', months: [],
    question: 'It is your birthday this month: how did you spend it, and what did you wish for?' }
];

// Asked to everyone; each person's profile makes it specific.
const NEUTRAL_HOLIDAY_QUESTION = {
  id: 'holiday', type: 'long',
  label: 'A celebration, a tradition, an occasion this month?',
  hint: 'However small, however made up. Or nothing at all, which is fine too.'
};

// ==========================================================
//  5. SURPRISE QUESTIONS — two drawn per issue
// ==========================================================
const ROTATING_QUESTIONS = [
  'Your worst date ever: tell us.',
  'If you moved tomorrow, where would it be?',
  'What would you say to the person you were ten years ago?',
  'The most shameful thing you spent money on this month?',
  'Which habit are you trying to quit and not managing to?',
  'The compliment that touched you most recently?',
  'What did you learn this month, even something completely useless?',
  'Your perfect Sunday, hour by hour.',
  'The most spontaneous thing you did this month?',
  'What do you miss most about our years together?',
  'If we all went away for a weekend tomorrow, where would you take us?',
  'Your biggest secret project right now?',
  'The message you hesitated over and did not send?',
  'What annoyed you far more than it deserved to?',
  'Something everyone loves that you cannot stand?',
  'The last time you laughed until you cried: why?',
  'What have you been putting off for far too long?',
  'The best advice anyone gave you this month?',
  'A place in your town you would recommend to us with your eyes shut?',
  'If your month had a film title, what would it be?',
  'Which song picks you back up every single time?',
  'The best thing you ate this month?',
  'A small thing that made you inexplicably happy?',
  'What would you do this weekend if nobody judged?',
  'Who do you think about often and never write to?',
  'The last photo in your camera roll: what is it?',
  'What do you absolutely want to have done before the year is out?',
  'The worst purchase of your life, any category?',
  'What has genuinely changed about you this year?',
  'A question you wish people asked you more often?'
];

// ==========================================================
//  6. HOW MANY OF EACH
// ==========================================================
const SURPRISE_COUNT = 4;   // surprise questions per issue
const CHOICE_COUNT   = 2;   // tick-box questions per issue
const EXPRESS_COUNT  = 5;   // size of the "5 minutes" mode

// The questions in "5 minutes" mode. Besides the `express: true`
// marker above we keep the list of ids: issues opened before that
// marker existed do not have it, and the mode must work for them too.
const EXPRESS_IDS = ['mood', 'summary', 'gossip', 'emojis', 'photos'];

// ==========================================================
//  7. EMOJI PALETTES
// ==========================================================
const GROUP_EMOJI_PALETTE = [
  '🎀','💌','🫶','💖','✨','🌸','🌷','🌻','🍒','🍓',
  '🏡','🏫','🎓','👯','🧋','☕','🍸','🍕','🎉','🎂',
  '🌊','⛰️','🧗','🏄','✈️','🚐','🏖️','🌍','🗼','🎪',
  '🐱','🐶','🦋','🐝','🦆','🌙','⭐','🔥','🧶','📻'
];

const EMOJI_PALETTE = [
  '😍','🥳','😭','😤','🥱','🤩','😮‍💨','🫠','🥰','😎',
  '✈️','🏡','💼','📚','🏋️','🍜','☕','🎂','💅','🎧',
  '🌞','🌧️','🌊','⛰️','🐱','🐶','💖','💸','🔥','✨'
];

const REACTION_EMOJIS = ['❤️','😂','😮','🥹','👏','🔥','🫶'];

// ==========================================================
//  8. THE MONTHLY DRAW
// ==========================================================

/** Picks `howMany` items at random, without repeats. */
function pick(list, howMany) {
  const copy = [...list];
  const picked = [];
  while (picked.length < howMany && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

/**
 * Builds a month's questionnaire: the fixed skeleton, the seasonal
 * question, the holiday question, then the tick-box and surprise
 * questions drawn at random.
 * @param {string} month  first of the month, 'YYYY-MM-DD'
 */
function questionsForMonth(month) {
  const monthNumber = Number(String(month).slice(5, 7));

  const surprises = pick(ROTATING_QUESTIONS, SURPRISE_COUNT)
    .map((text, i) => ({
      id: 'surprise' + (i + 1),
      type: 'long',
      label: text,
      rotating: true
    }));

  const ticked = pick(CHOICE_QUESTIONS, CHOICE_COUNT)
    .map(q => ({ ...q, rotating: true }));

  const seasonal = SEASONAL_QUESTIONS[monthNumber]
    ? [{ ...SEASONAL_QUESTIONS[monthNumber], seasonal: true }]
    : [];

  // The holiday question is made personal when answering, from
  // whatever each person ticked on their profile.
  const holiday = [{ ...NEUTRAL_HOLIDAY_QUESTION, holiday: true }];

  return [...SECTIONS, ...seasonal, ...holiday, ...ticked, ...surprises];
}

module.exports = {
  SITE_NAME, TAGLINE,
  SECTIONS, ROTATING_QUESTIONS, CHOICE_QUESTIONS, SEASONAL_QUESTIONS,
  HOLIDAYS, NEUTRAL_HOLIDAY_QUESTION,
  SURPRISE_COUNT, CHOICE_COUNT, EXPRESS_COUNT,
  EXPRESS_IDS, GROUP_EMOJI_PALETTE, EMOJI_PALETTE, REACTION_EMOJIS,
  questionsForMonth, pick
};
