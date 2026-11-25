// ============================================================
//  Dates and amounts, formatted for display.
// ============================================================
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function monthInWords(isoDate) {
  if (!isoDate) return '';
  const text = String(isoDate).slice(0, 10);
  const d = new Date(text + 'T12:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The 1st of the current month, as YYYY-MM-01. */
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** The current month and the `howMany` before it, newest first. */
export function recentMonths(howMany = 3) {
  const list = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i <= howMany; i++) {
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    d.setMonth(d.getMonth() - 1);
  }
  return list;
}

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function euros(n) {
  return '€' + Number(n || 0).toFixed(2);
}
