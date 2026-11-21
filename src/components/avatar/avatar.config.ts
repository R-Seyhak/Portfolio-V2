import type { CameraFraming } from './avatar.types';

/**
 * Every visual and timing setting for the avatar lives here.
 * To swap the character, replace the file at MODEL_URL and FALLBACK_SRC.
 */
export const MODEL_URL = '/models/rith-avatar.glb';
export const FALLBACK_SRC = '/avatar/rith-avatar-preview.webp';
export const FALLBACK_SIZE = { width: 327, height: 829 } as const;
export const AVATAR_LABEL = '3D avatar of Rith Seyhak';

/** Matches the Hero's stacked layout in globals.css. */
export const MOBILE_BELOW_PX = 900;

export const CAMERA_FOV = 30;

export const FRAMING: { desktop: CameraFraming; mobile: CameraFraming } = {
  desktop: { position: [0, 0.95, 3.1], target: [0, 0.72, 0], minAspect: 0.62, scale: 1 },
  mobile: { position: [0, 0.9, 3.25], target: [0, 0.71, 0], minAspect: 0.7, scale: 1 },
};

export const LIGHTING = {
  /** Overall brightness. Change this first. */
  exposure: 1.5,
  ambient: 0.62,
  key: { position: [-2, 4, 3] as const, intensity: 1.35 },
  rim: { position: [2.5, 2, -2] as const, intensity: 0.55 },
  environment: 0.32,
  shadow: { opacity: 0.26, blur: 2.6, scale: 2.4, far: 1.4 },
} as const;

export const ANIMATION = {
  /** Seconds to blend between body clips. */
  crossfade: 0.3,
  /** Pause between the avatar being on screen and the wave. */
  greetingDelayMs: 650,
  /** How quickly held expressions such as the hover smile ease in and out. */
  expressionSpeed: 7,
  hoverSmile: 0.3,
} as const;

export const BLINK = {
  minMs: 2500,
  maxMs: 5500,
  doubleChance: 0.15,
  doubleGapMs: 380,
} as const;

/** The head on the model, in metres. Places the question marks and Zzz. */
export const HEAD_ANCHOR = { center: [0, 1.22, 0.02], halfWidth: 0.2, top: 1.4 } as const;

export const BRAIN_LOADING = {
  /** Length of the whole reaction. */
  durationSec: 4.4,
  /** Scratches per second. */
  scratchHz: 3.1,
  /** How long the question marks stay up. */
  effectsMs: 3900,
} as const;

export const SLEEP = {
  /** Time without visitor activity before the avatar starts dozing off. */
  idleMs: 30000,
  /** Mouse movement smaller than this does not count as activity. */
  moveThresholdPx: 3,
  /** Length of the nodding-off sequence. */
  fallSec: 8,
  fallReducedSec: 1.6,
  /** Breaths per second while asleep. */
  breathHz: 0.24,
  /** A small head shift happens this often while asleep. */
  stirEverySec: 11,
  wakeSec: 1.9,
} as const;

/**
 * The scratching arm. It starts from the raised arm in GreetingWave, then a
 * two-bone solve places the wrist beside the head. Positions and directions
 * are in the head's space: +x is the avatar's left, +y up, +z forward.
 */
export const SCRATCH_ARM = {
  seedClip: 'GreetingWave',
  seedTimeSec: 1.5,
  wrist: [-0.25, 0.16, 0.025],
  fingers: [0.34, 0.93, -0.06],
  palmAway: [-0.9, 0.1, -0.4],
  /** Up-and-down travel of the wrist while scratching, in metres. */
  rub: 0.011,
  /** Wrist rock while scratching, in radians. */
  wristRock: 0.16,
  fingerCurl: 0.3,
  fingerCurlRub: 0.32,
} as const;

export const POINTER = {
  /** Larger values make the head and eyes respond more slowly. */
  smoothing: 4,
  /** Total turn at full pointer offset, in radians. */
  maxYaw: 0.35,
  maxPitch: 0.18,
  /** How the turn is shared between the bones. */
  neck: 0.35,
  head: 0.65,
  eyes: 0.45,
  /** Height of the face within the stage, from the top (0) to the bottom (1). */
  faceY: 0.2,
  /** How long the avatar keeps looking toward a tap. */
  tapHoldMs: 2200,
} as const;
