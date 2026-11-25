// ============================================================
//  Group icons.
//  Carried over from the original site: same files, same names.
//  A value looks like "icon:fleur-03". Older groups that use an
//  emoji keep working.
// ============================================================
export const PREFIX = 'icon:';

export const ICON_SETS = [
  { theme: 'Newspaper', icons: ['newspaper-00'] },
  { theme: 'Pink flowers', icons: ['flower-00','flower-01','flower-02','flower-03','flower-04','flower-05','flower-06','flower-07'] },
  { theme: 'Coral', icons: ['coral-00','coral-01','coral-02','coral-03','coral-04','coral-05','coral-06','coral-07','coral-08','coral-09','coral-10'] },
  { theme: 'Fruit and cocktails', icons: ['fruit-00','fruit-01','fruit-02','fruit-03','fruit-04','fruit-05','fruit-06','fruit-07','fruit-08','fruit-09','fruit-10','fruit-11','fruit-12','fruit-13','fruit-14','fruit-15','fruit-16','fruit-17','fruit-18'] },
  { theme: 'Turquoise beach', icons: ['beach-00','beach-01','beach-02','beach-03','beach-04','beach-05','beach-06','beach-07','beach-08','beach-09','beach-10','beach-11','beach-12','beach-13','beach-14','beach-15','beach-16'] },
  { theme: 'Pearl', icons: ['pearl-00','pearl-01','pearl-02','pearl-03','pearl-04','pearl-05','pearl-06','pearl-07','pearl-08','pearl-09','pearl-10','pearl-11','pearl-12','pearl-13','pearl-14','pearl-15','pearl-16','pearl-17','pearl-18','pearl-19'] },
  { theme: 'Gold', icons: ['gold-00','gold-01','gold-02','gold-03','gold-04','gold-05','gold-06','gold-07','gold-08','gold-09','gold-10','gold-11','gold-12'] },
  { theme: 'Pale yellow', icons: ['yellow-00','yellow-01','yellow-02','yellow-03','yellow-04','yellow-05','yellow-06','yellow-07','yellow-08','yellow-09','yellow-10','yellow-11','yellow-12','yellow-13','yellow-14','yellow-15','yellow-16'] },
  { theme: 'Midnight blue', icons: ['blue-00','blue-01','blue-02','blue-03','blue-04','blue-05','blue-06','blue-07','blue-08','blue-09','blue-10','blue-11','blue-12'] },
  { theme: 'Vintage', icons: ['vintage-00','vintage-01','vintage-02','vintage-03','vintage-04','vintage-05','vintage-06','vintage-07','vintage-08','vintage-09','vintage-10'] },
  { theme: 'Stamps', icons: ['stamp-00','stamp-01','stamp-02','stamp-03','stamp-04','stamp-05','stamp-06','stamp-07','stamp-08','stamp-09','stamp-10'] }
];

export const ALL_ICONS = ICON_SETS.flatMap(p => p.icons);

export function isIcon(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function iconPath(value) {
  const name = String(value).slice(PREFIX.length);
  // Only known names are served: a dubious value coming out of the
  // database must not turn into a request to just anywhere.
  return ALL_ICONS.includes(name) ? `/icons/${name}.png` : null;
}
