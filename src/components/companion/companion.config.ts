/** The small figure beside the Work heading. */
export const COMPANION = {
  /** The short note shown the first time the figure appears. */
  line: "Take a look at what I've built.",
  /** The resting expression, from 0 to 1. */
  smile: 0.26,
  /** Pause after appearing, so the fade-in finishes before anything moves. */
  enterDelayMs: 650,
  /** Quiet time between the occasional repeats of the pose. */
  encoreMinMs: 13000,
  encoreMaxMs: 21000,
  /** How long the note stays up. */
  lineMs: 4200,
  /** Minimum clear space between the figure and the heading text, in pixels. */
  textClearancePx: 28,
  /** Minimum clear space between the note and the heading text, in pixels. */
  noteClearancePx: 12,
  /** Turned slightly toward the page content, in radians. */
  facing: -0.32,
  facingSpeed: 3,
  /** What the camera must keep in frame, in metres. */
  frame: { bottom: -0.04, top: 1.56, halfWidth: 0.5, fov: 26, eyeLift: 0.14 },
  /** Narrower than the View, so the soft shadow fades out before its edge. */
  shadowScale: 0.92,
} as const;
