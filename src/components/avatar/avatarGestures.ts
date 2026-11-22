import { BRAIN_LOADING, IDLE_VARIATION, REACTIONS, SLEEP } from './avatar.config';
import type { GestureName } from './avatar.types';

/**
 * Procedural performances. Each gesture is a set of keyframed channels sampled
 * by time, so it is pure data: nothing here touches a bone or the mixer.
 * RithAvatar applies the result on top of whatever clip is playing.
 */
const POSE_KEYS = [
  'headPitch',
  'headYaw',
  'headRoll',
  'chestPitch',
  'chestRoll',
  'eyePitch',
  'eyeYaw',
  'arm',
  'rub',
  'thumbsArm',
  'shrugArms',
  'watchArm',
  'shoulderLift',
  'browRaise',
  'mouthOpen',
  'smile',
  'lids',
  'lookMute',
  'expressionMute',
  'idleSpeed',
] as const;

export type GesturePose = Record<(typeof POSE_KEYS)[number], number>;

type Keys = readonly (readonly [number, number])[];
type Sampler = (t: number, reducedMotion: boolean, out: GesturePose) => void;

export const createRestPose = (): GesturePose => ({
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  chestPitch: 0,
  chestRoll: 0,
  eyePitch: 0,
  eyeYaw: 0,
  arm: 0,
  rub: 0,
  thumbsArm: 0,
  shrugArms: 0,
  watchArm: 0,
  shoulderLift: 0,
  browRaise: 0,
  mouthOpen: 0,
  smile: 0,
  lids: 0,
  lookMute: 0,
  expressionMute: 0,
  idleSpeed: 1,
});

const REST = createRestPose();

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Reads a channel at time t, easing between neighbouring keys. */
function at(keys: Keys, t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

const BRAIN = {
  headRoll: [[0, 0], [0.6, 0.17], [2, 0.2], [3.45, 0.18], [4.2, 0]],
  headPitch: [[0, 0], [0.6, -0.05], [3.45, -0.03], [4.2, 0]],
  headYaw: [[0, 0], [0.7, 0.07], [2.1, 0.03], [3.45, 0.06], [4.2, 0]],
  chestRoll: [[0, 0], [0.7, 0.035], [3.5, 0.035], [4.25, 0]],
  arm: [[0, 0], [0.72, 1], [3.45, 1], [4.3, 0]],
  rubEnvelope: [[0, 0], [0.75, 0], [1, 1], [3.1, 1], [3.4, 0]],
  browRaise: [[0, 0], [0.5, 0.72], [3.5, 0.72], [4.2, 0]],
  eyePitch: [[0, 0], [0.55, -0.2], [3.5, -0.18], [4.1, 0]],
  // Glances around while thinking, holding briefly on each side.
  eyeYaw: [[0, 0], [0.7, -0.15], [1.15, -0.15], [1.4, 0.16], [1.95, 0.16], [2.2, -0.1], [2.7, -0.1], [2.95, 0.13], [3.4, 0.13], [3.9, 0]],
  lookMute: [[0, 0], [0.35, 1], [3.75, 1], [4.3, 0]],
  idleSpeed: [[0, 1], [0.45, 0.18], [3.7, 0.18], [4.35, 1]],
} as const satisfies Record<string, Keys>;

const sampleBrainLoading: Sampler = (t, reducedMotion, out) => {
  out.headRoll = at(BRAIN.headRoll, t);
  out.headPitch = at(BRAIN.headPitch, t);
  out.headYaw = at(BRAIN.headYaw, t);
  out.chestRoll = at(BRAIN.chestRoll, t);
  out.arm = at(BRAIN.arm, t);
  out.browRaise = at(BRAIN.browRaise, t);
  out.eyePitch = at(BRAIN.eyePitch, t);
  out.lookMute = at(BRAIN.lookMute, t);
  out.idleSpeed = at(BRAIN.idleSpeed, t);
  // Reduced motion holds the thinking pose without the scratch or darting eyes.
  out.eyeYaw = reducedMotion ? 0 : at(BRAIN.eyeYaw, t);
  out.rub = reducedMotion
    ? 0
    : at(BRAIN.rubEnvelope, t) * Math.sin(t * BRAIN_LOADING.scratchHz * Math.PI * 2);
};

// The resting sleep pose. Falling asleep ends here and sleeping starts here.
const ASLEEP = { headPitch: 0.42, headRoll: 0.05, chestPitch: 0.045, eyePitch: 0.1, idleSpeed: 0.4 } as const;

const FALL = {
  // Sinks, small nod, sinks, drops forward, catches itself, sinks, nods off.
  headPitch: [[0, 0], [1.6, 0.14], [1.95, 0.22], [2.4, 0.15], [3.4, 0.26], [3.7, 0.52], [4.7, 0.2], [5.9, 0.36], [6.25, 0.58], [7.4, ASLEEP.headPitch]],
  lids: [[0, 0], [1.6, 0.3], [2, 0.5], [2.4, 0.35], [3.4, 0.62], [3.7, 0.92], [4.2, 0.45], [4.7, 0.38], [5.9, 0.75], [6.2, 1]],
  headRoll: [[0, 0], [3.5, 0.03], [5, -0.02], [6.2, 0.04], [7.4, ASLEEP.headRoll]],
  chestPitch: [[0, 0], [3.7, 0.035], [4.7, 0.015], [6.2, 0.05], [7.4, ASLEEP.chestPitch]],
  // Brows lift for a moment as it tries to stay awake.
  browRaise: [[0, 0], [3.7, 0], [3.95, 0.42], [4.5, 0.12], [5, 0]],
  eyePitch: [[0, 0], [2, ASLEEP.eyePitch]],
  mute: [[0, 0], [1, 1]],
  idleSpeed: [[0, 1], [2, 0.6], [7, ASLEEP.idleSpeed]],
} as const satisfies Record<string, Keys>;

const FALL_REDUCED = {
  headPitch: [[0, 0], [1.5, ASLEEP.headPitch]],
  headRoll: [[0, 0], [1.5, ASLEEP.headRoll]],
  chestPitch: [[0, 0], [1.5, ASLEEP.chestPitch]],
  lids: [[0, 0], [1.2, 1]],
  eyePitch: [[0, 0], [1, ASLEEP.eyePitch]],
  mute: [[0, 0], [0.6, 1]],
  idleSpeed: [[0, 1], [1.5, ASLEEP.idleSpeed]],
} as const satisfies Record<string, Keys>;

const sampleFallingAsleep: Sampler = (t, reducedMotion, out) => {
  const keys = reducedMotion ? FALL_REDUCED : FALL;
  out.headPitch = at(keys.headPitch, t);
  out.headRoll = at(keys.headRoll, t);
  out.chestPitch = at(keys.chestPitch, t);
  out.lids = at(keys.lids, t);
  out.eyePitch = at(keys.eyePitch, t);
  out.lookMute = at(keys.mute, t);
  out.expressionMute = at(keys.mute, t);
  out.idleSpeed = at(keys.idleSpeed, t);
  out.browRaise = reducedMotion ? 0 : at(FALL.browRaise, t);
};

const sampleSleeping: Sampler = (t, reducedMotion, out) => {
  const breath = Math.sin(t * SLEEP.breathHz * Math.PI * 2);
  // A soft head shift every so often, so the pose never looks frozen.
  const phase = (t % SLEEP.stirEverySec) / SLEEP.stirEverySec;
  const stir = phase > 0.9 ? Math.sin(((phase - 0.9) / 0.1) * Math.PI) : 0;
  const drift = reducedMotion ? 0 : 0.012 * Math.sin(t * 0.31) + 0.008 * Math.sin(t * 0.73);

  out.chestPitch = ASLEEP.chestPitch + 0.012 * breath;
  out.headPitch = ASLEEP.headPitch + drift + (reducedMotion ? 0 : 0.012 * breath + 0.035 * stir);
  out.headRoll = ASLEEP.headRoll + (reducedMotion ? 0 : 0.012 * Math.sin(t * 0.23) - 0.025 * stir);
  out.eyePitch = ASLEEP.eyePitch;
  out.lids = 1;
  out.lookMute = 1;
  out.expressionMute = 1;
  out.idleSpeed = ASLEEP.idleSpeed;
};

const WAKE = {
  headPitch: [[0, -0.1], [0.14, -0.2], [0.4, -0.13], [1.05, -0.06], [1.7, 0]],
  headYaw: [[0, 0], [0.2, 0.09], [0.5, -0.08], [0.8, 0.04], [1.25, 0]],
  chestPitch: [[0, -0.03], [0.12, -0.07], [0.38, -0.02], [0.6, -0.035], [1.6, 0]],
  chestRoll: [[0, 0], [0.1, 0.02], [0.25, -0.02], [0.4, 0.012], [0.65, 0]],
  browRaise: [[0, 1], [0.9, 0.9], [1.6, 0]],
  mouthOpen: [[0, 0.82], [0.35, 0.72], [0.75, 0.38], [1.2, 0]],
  // Eyes snap open, then one surprised blink.
  lids: [[0, 0], [0.55, 0], [0.62, 0.9], [0.72, 0]],
  eyeYaw: [[0, 0], [0.15, 0.2], [0.45, -0.18], [0.75, 0.1], [1.1, 0]],
  lookMute: [[0, 1], [1.2, 1], [1.8, 0]],
  expressionMute: [[0, 1], [1, 1], [1.6, 0]],
  idleSpeed: [[0, 0.6], [1.2, 0.8], [1.7, 1]],
} as const satisfies Record<string, Keys>;

const sampleWakingUp: Sampler = (t, reducedMotion, out) => {
  out.headPitch = at(WAKE.headPitch, t);
  out.chestPitch = at(WAKE.chestPitch, t);
  out.browRaise = at(WAKE.browRaise, t);
  out.mouthOpen = at(WAKE.mouthOpen, t);
  out.lookMute = at(WAKE.lookMute, t);
  out.expressionMute = at(WAKE.expressionMute, t);
  out.idleSpeed = at(WAKE.idleSpeed, t);
  // Reduced motion lifts the head without the shake, glances or flutter.
  out.headYaw = reducedMotion ? 0 : at(WAKE.headYaw, t);
  out.chestRoll = reducedMotion ? 0 : at(WAKE.chestRoll, t);
  out.eyeYaw = reducedMotion ? 0 : at(WAKE.eyeYaw, t);
  out.lids = reducedMotion ? 0 : at(WAKE.lids, t);
};

const THUMBS = {
  arm: [[0, 0], [0.5, 1], [2.1, 1], [2.75, 0]],
  headRoll: [[0, 0], [0.5, 0.09], [2.1, 0.07], [2.7, 0]],
  // Two small nods while the thumb is up.
  headPitch: [[0, 0], [0.55, 0], [0.78, 0.08], [1.02, -0.01], [1.26, 0.06], [1.5, 0]],
  chestRoll: [[0, 0], [0.5, 0.025], [2.1, 0.025], [2.7, 0]],
  smile: [[0, 0], [0.45, 0.8], [2.2, 0.8], [2.75, 0]],
  browRaise: [[0, 0], [0.45, 0.25], [2.2, 0.25], [2.7, 0]],
  idleSpeed: [[0, 1], [0.4, 0.5], [2.2, 0.5], [2.75, 1]],
} as const satisfies Record<string, Keys>;

const sampleThumbsUp: Sampler = (t, reducedMotion, out) => {
  out.thumbsArm = at(THUMBS.arm, t);
  out.headRoll = at(THUMBS.headRoll, t);
  out.chestRoll = at(THUMBS.chestRoll, t);
  out.smile = at(THUMBS.smile, t);
  out.browRaise = at(THUMBS.browRaise, t);
  out.idleSpeed = at(THUMBS.idleSpeed, t);
  out.headPitch = reducedMotion ? 0 : at(THUMBS.headPitch, t);
};

const SHRUG = {
  arms: [[0, 0], [0.5, 1], [1.7, 1], [2.35, 0]],
  shoulders: [[0, 0], [0.42, 1], [0.64, 0.84], [1.6, 0.84], [2.25, 0]],
  headRoll: [[0, 0], [0.5, -0.15], [1.7, -0.12], [2.3, 0]],
  headPitch: [[0, 0], [0.5, -0.04], [1.7, -0.03], [2.3, 0]],
  chestPitch: [[0, 0], [0.5, -0.025], [1.7, -0.025], [2.3, 0]],
  browRaise: [[0, 0], [0.42, 0.9], [1.7, 0.85], [2.3, 0]],
  mouthOpen: [[0, 0], [0.5, 0.12], [1.6, 0.1], [2.1, 0]],
  smile: [[0, 0], [0.5, 0.25], [1.7, 0.25], [2.3, 0]],
  lookMute: [[0, 0], [0.4, 0.6], [1.8, 0.6], [2.35, 0]],
  idleSpeed: [[0, 1], [0.4, 0.4], [1.8, 0.4], [2.35, 1]],
} as const satisfies Record<string, Keys>;

const sampleShrug: Sampler = (t, reducedMotion, out) => {
  out.shrugArms = at(SHRUG.arms, t);
  out.shoulderLift = at(SHRUG.shoulders, t);
  out.headRoll = at(SHRUG.headRoll, t);
  out.headPitch = at(SHRUG.headPitch, t);
  out.chestPitch = at(SHRUG.chestPitch, t);
  out.browRaise = at(SHRUG.browRaise, t);
  out.mouthOpen = at(SHRUG.mouthOpen, t);
  out.smile = at(SHRUG.smile, t);
  out.lookMute = at(SHRUG.lookMute, t);
  out.idleSpeed = at(SHRUG.idleSpeed, t);
};

const LOOK_AROUND = {
  headYaw: [[0, 0], [0.75, -0.4], [1.6, -0.4], [2.35, 0.36], [3.2, 0.36], [3.95, 0]],
  headPitch: [[0, 0], [0.75, -0.04], [1.6, -0.03], [2.35, 0.02], [3.2, 0.02], [3.95, 0]],
  // The eyes get there first.
  eyeYaw: [[0, 0], [0.32, -0.22], [1.35, -0.22], [1.75, 0.24], [2.9, 0.24], [3.55, 0]],
  lookMute: [[0, 0], [0.4, 1], [3.55, 1], [4.15, 0]],
} as const satisfies Record<string, Keys>;

const sampleLookAround: Sampler = (t, _reducedMotion, out) => {
  out.headYaw = at(LOOK_AROUND.headYaw, t);
  out.headPitch = at(LOOK_AROUND.headPitch, t);
  out.eyeYaw = at(LOOK_AROUND.eyeYaw, t);
  out.lookMute = at(LOOK_AROUND.lookMute, t);
};

const WATCH = {
  arm: [[0, 0], [0.75, 1], [2.65, 1], [3.5, 0]],
  headPitch: [[0, 0], [0.72, 0.3], [2.65, 0.28], [3.35, 0]],
  headYaw: [[0, 0], [0.72, 0.2], [2.65, 0.2], [3.35, 0]],
  eyePitch: [[0, 0], [0.5, 0.15], [2.65, 0.15], [3.2, 0]],
  browRaise: [[0, 0], [1.3, 0], [1.6, 0.35], [2.4, 0.3], [2.9, 0]],
  lookMute: [[0, 0], [0.4, 1], [2.95, 1], [3.55, 0]],
  idleSpeed: [[0, 1], [0.5, 0.55], [2.8, 0.55], [3.5, 1]],
} as const satisfies Record<string, Keys>;

const sampleCheckWatch: Sampler = (t, _reducedMotion, out) => {
  out.watchArm = at(WATCH.arm, t);
  out.headPitch = at(WATCH.headPitch, t);
  out.headYaw = at(WATCH.headYaw, t);
  out.eyePitch = at(WATCH.eyePitch, t);
  out.browRaise = at(WATCH.browRaise, t);
  out.lookMute = at(WATCH.lookMute, t);
  out.idleSpeed = at(WATCH.idleSpeed, t);
};

interface GestureDefinition {
  duration: number;
  reducedDuration?: number;
  blendIn: number;
  reducedBlendIn?: number;
  sample: Sampler;
}

const GESTURES: Record<GestureName, GestureDefinition> = {
  brainLoading: { duration: BRAIN_LOADING.durationSec, blendIn: 0.2, sample: sampleBrainLoading },
  thumbsUp: { duration: REACTIONS.thumbsUpSec, blendIn: 0.12, sample: sampleThumbsUp },
  shrug: { duration: REACTIONS.shrugSec, blendIn: 0.12, sample: sampleShrug },
  lookAround: { duration: IDLE_VARIATION.lookAroundSec, blendIn: 0.2, sample: sampleLookAround },
  checkWatch: { duration: IDLE_VARIATION.checkWatchSec, blendIn: 0.2, sample: sampleCheckWatch },
  fallingAsleep: { duration: SLEEP.fallSec, reducedDuration: SLEEP.fallReducedSec, blendIn: 0.3, sample: sampleFallingAsleep },
  sleeping: { duration: Infinity, blendIn: 0.5, sample: sampleSleeping },
  wakingUp: { duration: SLEEP.wakeSec, blendIn: 0.13, reducedBlendIn: 0.35, sample: sampleWakingUp },
};

export interface GestureState {
  name: GestureName | null;
  t: number;
  blend: number;
  blendTime: number;
  from: GesturePose;
  target: GesturePose;
  pose: GesturePose;
  onDone: (() => void) | null;
}

export const createGestureState = (): GestureState => ({
  name: null,
  t: 0,
  blend: 1,
  blendTime: 0.3,
  from: createRestPose(),
  target: createRestPose(),
  pose: createRestPose(),
  onDone: null,
});

/** Starts a gesture, blending from wherever the body is right now. */
export function startGesture(
  state: GestureState,
  name: GestureName,
  reducedMotion: boolean,
  onDone?: () => void,
) {
  const gesture = GESTURES[name];
  Object.assign(state.from, state.pose);
  state.name = name;
  state.t = 0;
  state.blend = 0;
  state.blendTime = reducedMotion ? (gesture.reducedBlendIn ?? gesture.blendIn) : gesture.blendIn;
  state.onDone = onDone ?? null;
}

/** Eases out of the current gesture without firing its completion callback. */
export function releaseGesture(state: GestureState, blendTime = 0.4) {
  Object.assign(state.from, state.pose);
  state.name = null;
  state.blend = 0;
  state.blendTime = blendTime;
  state.onDone = null;
}

/**
 * Advances the current gesture and writes the blended result to state.pose.
 * Returns the completion callback when the gesture finishes this frame.
 */
export function advanceGesture(state: GestureState, delta: number, reducedMotion: boolean) {
  let finished: (() => void) | null = null;
  const gesture = state.name ? GESTURES[state.name] : undefined;

  if (gesture) {
    state.t += delta;
    Object.assign(state.target, REST);
    gesture.sample(state.t, reducedMotion, state.target);
    const duration = reducedMotion ? (gesture.reducedDuration ?? gesture.duration) : gesture.duration;
    if (state.t >= duration) {
      finished = state.onDone;
      state.name = null;
      state.onDone = null;
      // Keep the final pose: the next gesture, if any, blends from it this same frame.
      if (!finished) Object.assign(state.target, REST);
    }
  } else if (state.blend >= 1) {
    Object.assign(state.pose, REST);
    return null;
  } else {
    Object.assign(state.target, REST);
  }

  state.blend = Math.min(1, state.blend + delta / state.blendTime);
  const k = smooth(state.blend);
  for (const key of POSE_KEYS) {
    state.pose[key] = state.from[key] + (state.target[key] - state.from[key]) * k;
  }
  return finished;
}
