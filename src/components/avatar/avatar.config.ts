import type { ArmGoal, CameraFraming } from './avatar.types';

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
  /** Pause after the avatar is shown, so the wave starts once the fade-in is done. */
  greetingDelayMs: 750,
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

/** Calms the GreetingWave clip in memory. The GLB file itself is not changed. */
export const WAVE = {
  clip: 'GreetingWave',
  /** The stretch of the clip where the arm is up and waving. */
  startSec: 0.62,
  settledSec: 0.92,
  endingSec: 2.18,
  endSec: 2.5,
  /** Length of one wave in the clip. */
  periodSec: 0.53,
  /** How much of the forearm's original sway to keep: 0 is still, 1 is unchanged. */
  forearmSway: 0.6,
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
  /** Larger values respond faster. The eyes lead and the body follows. */
  headSpeed: 5,
  eyeSpeed: 14,
  /** Total turn at full pointer offset, in radians. */
  maxYaw: 0.62,
  maxPitchUp: 0.22,
  maxPitchDown: 0.32,
  /** How the turn is shared between the bones. These add up to 1. */
  chest: 0.06,
  upperChest: 0.12,
  neck: 0.27,
  head: 0.55,
  /** Extra eye turn on top of the head, in radians. */
  eyeYaw: 0.26,
  eyePitch: 0.16,
  /** Height of the face within the stage, from the top (0) to the bottom (1). */
  faceY: 0.2,
} as const;

/** How a gesture's head turn is shared between the neck and the head. */
export const GESTURE_HEAD = { neck: 0.35, head: 0.65 } as const;

export const HOVER = {
  /** Head tilt while the pointer rests on the avatar, in radians. */
  tilt: 0.085,
  speed: 6,
} as const;

export const DRAG = {
  /** Pointer travel that turns a press into a drag instead of a click. */
  thresholdPx: 6,
  yawPerPx: 0.011,
  pitchPerPx: 0.0016,
  maxYaw: 2.6,
  /** Mouse only. On touch, vertical movement always scrolls the page. */
  maxPitch: 0.09,
  followSpeed: 16,
  /** The spring back to facing forward. */
  stiffness: 62,
  damping: 10.5,
  /** Critically damped, so reduced motion gets no overshoot. */
  reducedDamping: 15.7,
} as const;

export const REACTIONS = {
  /** Quiet time after a reaction before the next click counts. */
  cooldownMs: 450,
  thumbsUpSec: 2.8,
  shrugSec: 2.4,
  /** How far the shoulders lift in the shrug, in radians. */
  shoulderLift: 0.15,
} as const;

export const IDLE_VARIATION = {
  /** Quiet time before the first small idle movement. */
  firstMs: 8000,
  /** Random gap between later ones. */
  gapMinMs: 9000,
  gapMaxMs: 14000,
  /** Don't start one this close to dozing off. */
  sleepMarginMs: 5000,
  lookAroundSec: 4.2,
  checkWatchSec: 3.6,
} as const;

/** Poses for the procedural arm. Vectors are in the model's space. */
export const ARM_GOALS = {
  thumbsUp: {
    wrist: [-0.27, 0.84, 0.2],
    elbow: [-0.75, -0.65, -0.1],
    fingers: [0.42, 0.06, 0.9],
    back: [-0.88, 0, 0.45],
    curl: 1.25,
    thumb: [0.02, 1, 0.08],
  },
  /** The left arm. The right arm mirrors it. */
  shrug: {
    // Elbows stay tucked by the ribs, and the forearms come forward with palms up.
    wrist: [0.265, 0.75, 0.16],
    elbow: [0.22, -0.9, -0.38],
    fingers: [0.48, 0.14, 0.86],
    back: [0.08, -1, 0.12],
    curl: 0.07,
  },
  checkWatch: {
    wrist: [0.12, 0.83, 0.25],
    elbow: [0.7, -0.7, -0.1],
    fingers: [-0.82, 0.05, 0.57],
    back: [0.1, 0.95, 0.3],
    curl: 0.45,
  },
} as const satisfies Record<string, ArmGoal>;

/**
 * The arms of the glasses, which the model doesn't include. The path runs from
 * the hinge, over the ear, to a small hook behind it. Positions are in metres on
 * the avatar's left side, and the right arm mirrors them.
 */
export const GLASSES_ARMS = {
  /** Where the Head bone sits in the model's rest pose. */
  headOrigin: [0, 1.035, 0.012],
  path: [
    [0.119, 1.176, 0.152],
    [0.131, 1.181, 0.125],
    [0.145, 1.186, 0.085],
    [0.154, 1.19, 0.045],
    [0.156, 1.192, 0.012],
    [0.151, 1.18, -0.018],
    [0.14, 1.155, -0.038],
  ],
  radius: 0.0034,
  segments: 28,
  color: '#141110',
  roughness: 0.42,
} as const;

/** Waiting for the GPU before the avatar is shown. */
export const READY = {
  /** Show the avatar anyway if shader compilation takes longer than this. */
  compileTimeoutMs: 5000,
  /** The same limit for the GPU finishing its first frame. */
  gpuTimeoutMs: 4000,
} as const;
