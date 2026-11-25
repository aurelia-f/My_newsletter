// ============================================================
//  The key of an answer.
//
//  The DRAFT is shared across every group: its keys describe the
//  question itself ("long__my_song_of_the_moment"), so one answer
//  can serve several groups.
//
//  An ENTRY belongs to one issue: its keys are the question ids of
//  THAT issue.
//
//  That is what lets two groups draw different surprise questions
//  without the answers getting mixed up.
// ============================================================

function slug(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 60);
}

/** The key of a question inside the draft. */
function questionKey(q) {
  if (String(q.id).startsWith('q_')) return q.id;   // asked question: already unique
  return q.type + '__' + slug(q.label);
}

/**
 * Translates a draft into the content of a given issue.
 * @param {object}   issue    the issue in question
 * @param {object}   answers  the draft, keyed by question key
 * @param {object[]} asked    the questions put by group members
 */
function contentForIssue(issue, answers, asked) {
  const content = {};
  const questions = issue.questions || [];

  for (const q of questions) {
    const key = questionKey(q);
    if (key in answers) content[q.id] = answers[key];
    if ((key + '_link') in answers) content[q.id + '_link'] = answers[key + '_link'];
    if ((key + '_label') in answers) content[q.id + '_label'] = answers[key + '_label'];
  }

  for (const q of asked || []) {
    if (q.issue_id !== issue.id) continue;
    const key = 'q_' + q.id;
    if (key in answers) content[key] = answers[key];
  }
  return content;
}

module.exports = { slug, questionKey, contentForIssue };
