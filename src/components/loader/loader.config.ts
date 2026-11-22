/** Everything the loading screen waits for, and each item's share of the progress bar. */
export const LOADER_WEIGHTS = {
  app: 10,
  fonts: 5,
  code: 15,
  model: 60,
  scene: 10,
} as const;

export type LoaderTask = keyof typeof LOADER_WEIGHTS;

export const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&display=swap';

export const LOADER_CONFIG = {
  weights: LOADER_WEIGHTS,
  fontHref: FONT_STYLESHEET,
  /** The Hero's typefaces. The reveal waits for these, up to fontTimeoutMs. */
  fontFaces: ['400 72px Fraunces', 'italic 400 72px Fraunces', '400 18px Inter', '500 18px Inter'],
  fontTimeoutMs: 3000,
  /** Shows the loader's text in the fallback serif if the web font is slow. */
  typeDelayMs: 450,
  /** Longest a visitor can wait before the portfolio is shown anyway. */
  maxWaitMs: 10000,
  /** Extra time after a background tab becomes visible at the deadline. */
  graceMs: 1500,
  /** Avoids a one-frame flash on fast repeat visits. */
  minVisibleMs: 550,
  /** How long 100% stays on screen. */
  holdMs: 320,
  fadeMs: 650,
  fadeReducedMs: 160,
  modelHref: '/models/rith-avatar.glb',
} as const;
