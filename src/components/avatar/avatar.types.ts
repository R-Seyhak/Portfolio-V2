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
export type AvatarMode = 'idle' | 'brainLoading' | 'fallingAsleep' | 'sleeping' | 'wakingUp';

/** A procedural performance layered over the body clips. */
export type GestureName = Exclude<AvatarMode, 'idle'>;

/** Where the head sits inside the stage, from 0 to 1 on each axis. */
export interface HeadAnchor {
  x: number;
  right: number;
  top: number;
}

export interface RithAvatarHandle {
  /** Plays a body clip once. Ignored while another one-shot is still playing. */
  play: (clip: OneShotClip) => void;
  /** Plays the eyelid clip over whatever the body is doing. */
  blink: () => void;
  /** Eases a held expression (0..1) on top of the current clip. */
  setMorph: (name: MorphName, value: number) => void;
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

export interface CameraFraming {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Below this width-to-height ratio the camera backs up so the arms stay in frame. */
  minAspect: number;
  scale: number;
}
