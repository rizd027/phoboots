// Booth themes, frame layouts and filters

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'tClassic',
    desc: 'tClassicD',
    frameColors: ['#ffffff', '#141418', '#ffd6e3', '#d6e6ff', '#fff4c9'],
    defaultFilter: 'none',
    font: 'Inter',
  },
  party: {
    id: 'party',
    name: 'tParty',
    desc: 'tPartyD',
    frameColors: ['#ffe3f1', '#e7ddff', '#d9f7ee', '#fff1c7', '#ffffff'],
    defaultFilter: 'vivid',
    font: 'Inter',
  },
  vintage: {
    id: 'vintage',
    name: 'tVintage',
    desc: 'tVintageD',
    frameColors: ['#f3ead8', '#2b2119', '#7a1f1f', '#d9c7a3', '#ffffff'],
    defaultFilter: 'mono',
    font: 'Fraunces',
  },
  neon: {
    id: 'neon',
    name: 'tNeon',
    desc: 'tNeonD',
    frameColors: ['#120b25', '#000000', '#2a0f3d', '#0b1d33', '#ffffff'],
    defaultFilter: 'cool',
    font: 'Inter',
  },
};

// Canvas geometry for each frame size
export const LAYOUTS = {
  '4cut': { id: '4cut', cols: 1, rows: 4, width: 600, pad: 36, gap: 18, cellRatio: 4 / 3, footer: 170 },
  '2x2': { id: '2x2', cols: 2, rows: 2, width: 1200, pad: 48, gap: 24, cellRatio: 4 / 3, footer: 180 },
  '2cut': { id: '2cut', cols: 1, rows: 2, width: 900, pad: 48, gap: 24, cellRatio: 4 / 3, footer: 180 },
  polaroid: { id: 'polaroid', cols: 1, rows: 1, width: 900, pad: 54, gap: 0, cellRatio: 1, footer: 250 },
};

export const slotsOf = (layoutId) => LAYOUTS[layoutId].cols * LAYOUTS[layoutId].rows;
// Take a couple of extra shots so people can pick their favourites
export const shotsOf = (layoutId) => slotsOf(layoutId) + 2;

export const FILTERS = [
  { id: 'none', label: 'fNone', css: 'none' },
  { id: 'mono', label: 'fMono', css: 'grayscale(1) contrast(1.15)' },
  { id: 'warm', label: 'fWarm', css: 'sepia(.35) saturate(1.2) brightness(1.03)' },
  { id: 'cool', label: 'fCool', css: 'saturate(1.1) hue-rotate(-12deg) brightness(1.02)' },
  { id: 'film', label: 'fFilm', css: 'sepia(.25) contrast(.9) brightness(1.08) saturate(.85)' },
  { id: 'vivid', label: 'fVivid', css: 'saturate(1.45) contrast(1.08)' },
];

export const MAX_MEMBERS = 4;
