import type { MutableRefObject } from 'react';

export type OneShotClip = 'GreetingWave' | 'HeadTilt' | 'HappyReaction';

export type MorphName =
  | 'smile'
  | 'mouthOpen'
  | 'browRaise'
  | 'blinkLeft'
  | 'blinkRight'
  | 'blinkBoth';

/** The avatar's interaction state. Only one runs at a time. */
export type AvatarMode =
  | 'idle'
  | 'wave'
  | 'thumbsUp'
  | 'shrug'
  | 'brainLoading'
  | 'lookAround'
  | 'checkWatch'
  | 'fallingAsleep'
  | 'sleeping'
  | 'wakingUp';

/** A procedural performance layered over the body clips. The wave is a body clip. */
export type GestureName = Exclude<AvatarMode, 'idle' | 'wave'> | 'proud';

/** What a click can trigger, in the order the clicks cycle through them. */
export type ReactionName = 'thumbsUp' | 'shrug' | 'brainLoading' | 'wave';

/** Where the head sits inside the stage, from 0 to 1 on each axis. */
export interface HeadAnchor {
  x: number;
  right: number;
  top: number;
}

export interface RithAvatarHandle {
  /** Plays a body clip once. Returns false while another one-shot is still playing. */
  play: (clip: OneShotClip, onDone?: () => void) => boolean;
  /** Plays the eyelid clip over whatever the body is doing. */
  blink: () => void;
  /** Eases a held expression (0..1) on top of the current clip. */
  setMorph: (name: MorphName, value: number) => void;
  /** Eases the small head tilt used while the pointer rests on the avatar. */
  setHover: (hovering: boolean) => void;
  /** Starts a gesture. Returns false if a body clip is still playing. */
  perform: (gesture: GestureName, onDone?: () => void) => boolean;
  /** Eases out of the current gesture, back to the normal pose. */
  release: () => void;
  /** The head's position in the stage, for placing the effects around it. */
  headAnchor: () => HeadAnchor;
}

/** Where the character should look: x and y run from -1 to 1, up and right positive. */
export interface LookTarget {
  x: number;
  y: number;
  active: boolean;
}

export type LookTargetRef = MutableRefObject<LookTarget>;

/** Written by the drag handlers and read by the turntable every frame. */
export interface DragTarget {
  yaw: number;
  pitch: number;
  active: boolean;
  /** The rotation on screen right now, so a new drag can pick up mid-spring. */
  currentYaw: number;
}

export type DragTargetRef = MutableRefObject<DragTarget>;

export type Vec3 = readonly [number, number, number];

/** A posed arm, in the model's space: +x is the avatar's left, +y up, +z forward. */
export interface ArmGoal {
  wrist: Vec3;
  /** The direction the elbow bends toward. */
  elbow: Vec3;
  /** Where the fingers point. */
  fingers: Vec3;
  /** Where the back of the hand faces. */
  back: Vec3;
  /** Finger bend per joint, in radians. */
  curl: number;
  /** Where the thumb points. Leave out to keep it relaxed. */
  thumb?: Vec3;
}

export interface CameraFraming {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Below this width-to-height ratio the camera backs up so the arms stay in frame. */
  minAspect: number;
  scale: number;
}
