import * as THREE from 'three';
import { SCRATCH_ARM } from './avatar.config';
import type { ArmGoal, Vec3 } from './avatar.types';

const CHAIN = ['RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand'] as const;
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const;

interface Link {
  bone: THREE.Object3D;
  /** Rotation of this bone at the seed moment of the wave clip. */
  seed: THREE.Quaternion;
  start: THREE.Quaternion;
  solved: THREE.Quaternion;
}

export interface ScratchArm {
  links: Link[];
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  fingers: THREE.Object3D[];
}

// Shared scratch values, so the per-frame solve allocates nothing.
const headPosition = new THREE.Vector3();
const headRotation = new THREE.Quaternion();
const target = new THREE.Vector3();
const shoulderAt = new THREE.Vector3();
const elbowAt = new THREE.Vector3();
const wristAt = new THREE.Vector3();
const reach = new THREE.Vector3();
const pole = new THREE.Vector3();
const elbowGoal = new THREE.Vector3();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const axisZ = new THREE.Vector3();
const basis = new THREE.Matrix4();
const worldRotation = new THREE.Quaternion();
const parentRotation = new THREE.Quaternion();
const turn = new THREE.Quaternion();

/** Finds the arm bones and reads the seed pose from the clip. Returns null if any are missing. */
export function createScratchArm(scene: THREE.Object3D, clips: THREE.AnimationClip[]): ScratchArm | null {
  const clip = clips.find((candidate) => candidate.name === SCRATCH_ARM.seedClip);
  if (!clip) return null;

  const links: Link[] = [];
  for (const name of CHAIN) {
    const bone = scene.getObjectByName(name);
    const track = clip.tracks.find((candidate) => candidate.name === `${name}.quaternion`);
    if (!bone || !track) return null;
    const seed = new THREE.Quaternion().fromArray(
      track.createInterpolant().evaluate(SCRATCH_ARM.seedTimeSec) as unknown as number[],
    );
    links.push({ bone, seed: seed.normalize(), start: new THREE.Quaternion(), solved: new THREE.Quaternion() });
  }

  const fingers: THREE.Object3D[] = [];
  for (const finger of FINGERS) {
    for (const joint of ['Proximal', 'Intermediate']) {
      const bone = scene.getObjectByName(`Right${finger}${joint}`);
      if (bone) fingers.push(bone);
    }
  }

  return { links, upper: links[1].bone, lower: links[2].bone, hand: links[3].bone, fingers };
}

export const scratchArmBones = (arm: ScratchArm | null) =>
  arm ? [...arm.links.map((link) => link.bone), ...arm.fingers] : [];

// ---- Posed arms: thumbs-up, shrug and the watch check -----------------------

const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const;
const IDENTITY = new THREE.Quaternion();
const rootRotation = new THREE.Quaternion();
const boneAxis = new THREE.Vector3();

interface PoseLink {
  bone: THREE.Object3D;
  start: THREE.Quaternion;
  solved: THREE.Quaternion;
}

export interface PoseArm {
  links: PoseLink[];
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  /** Proximal to distal, one finger after another. */
  fingers: THREE.Object3D[];
  thumb: THREE.Object3D[];
}

/** Finds one arm's bones. Returns null if the model doesn't have them. */
export function createPoseArm(scene: THREE.Object3D, side: 'Left' | 'Right'): PoseArm | null {
  const links: PoseLink[] = [];
  for (const part of ['UpperArm', 'LowerArm', 'Hand']) {
    const bone = scene.getObjectByName(`${side}${part}`);
    if (!bone) return null;
    links.push({ bone, start: new THREE.Quaternion(), solved: new THREE.Quaternion() });
  }
  const joints = (finger: string) =>
    JOINTS.map((joint) => scene.getObjectByName(`${side}${finger}${joint}`)).filter(
      (bone): bone is THREE.Object3D => Boolean(bone),
    );
  return {
    links,
    upper: links[0].bone,
    lower: links[1].bone,
    hand: links[2].bone,
    fingers: FINGERS.flatMap(joints),
    thumb: joints('Thumb'),
  };
}

export const poseArmBones = (arm: PoseArm | null) =>
  arm ? [...arm.links.map((link) => link.bone), ...arm.fingers, ...arm.thumb] : [];

const mirrorVector = ([x, y, z]: Vec3): Vec3 => [-x, y, z];

/** The same pose on the other arm. */
export const mirrorGoal = (goal: ArmGoal): ArmGoal => ({
  ...goal,
  wrist: mirrorVector(goal.wrist),
  elbow: mirrorVector(goal.elbow),
  fingers: mirrorVector(goal.fingers),
  back: mirrorVector(goal.back),
  thumb: goal.thumb ? mirrorVector(goal.thumb) : undefined,
});

/**
 * Moves an arm to a goal pose. `weight` blends from the animated arm (0) to the
 * goal (1). On both hands +Y runs along the fingers and +Z out of the back.
 */
export function applyArmGoal(arm: PoseArm, root: THREE.Object3D, goal: ArmGoal, weight: number) {
  const { links, upper, lower, hand, fingers, thumb } = arm;
  for (const link of links) link.start.copy(link.bone.quaternion);
  upper.updateWorldMatrix(true, true);

  root.getWorldQuaternion(rootRotation);
  target.fromArray(goal.wrist);
  root.localToWorld(target);

  // Two-bone solve, with the elbow bending toward the goal's direction.
  upper.getWorldPosition(shoulderAt);
  lower.getWorldPosition(elbowAt);
  hand.getWorldPosition(wristAt);
  const upperLength = shoulderAt.distanceTo(elbowAt);
  const lowerLength = elbowAt.distanceTo(wristAt);

  reach.subVectors(target, shoulderAt);
  const distance = THREE.MathUtils.clamp(
    reach.length(),
    Math.abs(upperLength - lowerLength) + 0.001,
    upperLength + lowerLength - 0.001,
  );
  reach.normalize();
  pole.fromArray(goal.elbow).applyQuaternion(rootRotation);
  pole.addScaledVector(reach, -pole.dot(reach)).normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const out = Math.sqrt(Math.max(upperLength ** 2 - along ** 2, 0));
  elbowGoal.copy(shoulderAt).addScaledVector(reach, along).addScaledVector(pole, out);

  from.subVectors(elbowAt, shoulderAt).normalize();
  to.subVectors(elbowGoal, shoulderAt).normalize();
  aim(upper, from, to);

  lower.getWorldPosition(elbowAt);
  hand.getWorldPosition(wristAt);
  from.subVectors(wristAt, elbowAt).normalize();
  to.copy(shoulderAt).addScaledVector(reach, distance).sub(elbowAt).normalize();
  aim(lower, from, to);

  axisY.fromArray(goal.fingers).applyQuaternion(rootRotation).normalize();
  axisZ.fromArray(goal.back).applyQuaternion(rootRotation);
  axisX.crossVectors(axisY, axisZ).normalize();
  axisZ.crossVectors(axisX, axisY).normalize();
  worldRotation.setFromRotationMatrix(basis.makeBasis(axisX, axisY, axisZ));
  hand.parent?.getWorldQuaternion(parentRotation).invert();
  hand.quaternion.copy(parentRotation).multiply(worldRotation);

  for (const link of links) {
    link.solved.copy(link.bone.quaternion);
    link.bone.quaternion.copy(link.start).slerp(link.solved, weight);
  }
  upper.updateWorldMatrix(false, true);

  // Curl each joint toward the palm.
  hand.getWorldQuaternion(worldRotation);
  axisX.set(1, 0, 0).applyQuaternion(worldRotation);
  turn.setFromAxisAngle(axisX, -weight * goal.curl);
  for (const finger of fingers) {
    if (!finger.parent) continue;
    finger.parent.getWorldQuaternion(parentRotation);
    worldRotation.copy(parentRotation).invert().multiply(turn).multiply(parentRotation);
    finger.quaternion.premultiply(worldRotation);
    finger.updateWorldMatrix(false, true);
  }

  if (!goal.thumb) return;
  to.fromArray(goal.thumb).applyQuaternion(rootRotation).normalize();
  for (const joint of thumb) {
    if (!joint.parent) continue;
    joint.getWorldQuaternion(worldRotation);
    boneAxis.set(0, 1, 0).applyQuaternion(worldRotation);
    turn.setFromUnitVectors(boneAxis, to).slerp(IDENTITY, 1 - weight);
    worldRotation.premultiply(turn);
    joint.parent.getWorldQuaternion(parentRotation).invert();
    joint.quaternion.copy(parentRotation).multiply(worldRotation);
    joint.updateWorldMatrix(false, true);
  }
}

/** Turns a bone in world space so that its `from` direction becomes `to`. */
function aim(bone: THREE.Object3D, fromDirection: THREE.Vector3, toDirection: THREE.Vector3) {
  if (!bone.parent) return;
  bone.getWorldQuaternion(worldRotation);
  turn.setFromUnitVectors(fromDirection, toDirection);
  worldRotation.premultiply(turn);
  bone.parent.getWorldQuaternion(parentRotation).invert();
  bone.quaternion.copy(parentRotation).multiply(worldRotation);
  bone.updateWorldMatrix(false, true);
}

/**
 * Brings the hand to the side of the head.
 * `weight` blends from the animated arm (0) to the scratch pose (1).
 * `rub` runs from -1 to 1 and drives the scratching motion.
 */
export function applyScratchArm(arm: ScratchArm, head: THREE.Object3D, weight: number, rub: number) {
  const { links, upper, lower, hand, fingers } = arm;

  for (const link of links) {
    link.start.copy(link.bone.quaternion);
    link.bone.quaternion.copy(link.seed);
  }
  links[0].bone.updateWorldMatrix(true, true);

  // The target lives in head space, so the hand rides along with the tilt.
  head.getWorldPosition(headPosition);
  head.getWorldQuaternion(headRotation);
  target
    .set(SCRATCH_ARM.wrist[0], SCRATCH_ARM.wrist[1] + rub * SCRATCH_ARM.rub, SCRATCH_ARM.wrist[2])
    .applyQuaternion(headRotation)
    .add(headPosition);

  // Two-bone solve. The elbow stays on the side the wave clip placed it.
  upper.getWorldPosition(shoulderAt);
  lower.getWorldPosition(elbowAt);
  hand.getWorldPosition(wristAt);
  const upperLength = shoulderAt.distanceTo(elbowAt);
  const lowerLength = elbowAt.distanceTo(wristAt);

  reach.subVectors(target, shoulderAt);
  const distance = Math.min(reach.length(), upperLength + lowerLength - 0.001);
  reach.normalize();
  pole.subVectors(elbowAt, shoulderAt);
  pole.addScaledVector(reach, -pole.dot(reach)).normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const out = Math.sqrt(Math.max(upperLength ** 2 - along ** 2, 0));
  elbowGoal.copy(shoulderAt).addScaledVector(reach, along).addScaledVector(pole, out);

  from.subVectors(elbowAt, shoulderAt).normalize();
  to.subVectors(elbowGoal, shoulderAt).normalize();
  aim(upper, from, to);

  lower.getWorldPosition(elbowAt);
  hand.getWorldPosition(wristAt);
  from.subVectors(wristAt, elbowAt).normalize();
  to.subVectors(target, elbowAt).normalize();
  aim(lower, from, to);

  // Fingers toward the hair, palm toward the head. The hand's +Y runs along the fingers.
  axisY.fromArray(SCRATCH_ARM.fingers).applyQuaternion(headRotation).normalize();
  axisZ.fromArray(SCRATCH_ARM.palmAway).applyQuaternion(headRotation);
  axisX.crossVectors(axisY, axisZ).normalize();
  axisZ.crossVectors(axisX, axisY).normalize();
  worldRotation.setFromRotationMatrix(basis.makeBasis(axisX, axisY, axisZ));
  turn.setFromAxisAngle(axisX, rub * SCRATCH_ARM.wristRock);
  worldRotation.premultiply(turn);
  hand.parent?.getWorldQuaternion(parentRotation).invert();
  hand.quaternion.copy(parentRotation).multiply(worldRotation);

  for (const link of links) {
    link.solved.copy(link.bone.quaternion);
    link.bone.quaternion.copy(link.start).slerp(link.solved, weight);
  }
  links[0].bone.updateWorldMatrix(false, true);

  // Curl the fingers toward the palm, and flex them with each scratch.
  hand.getWorldQuaternion(worldRotation);
  axisX.set(1, 0, 0).applyQuaternion(worldRotation);
  const curl = -weight * (SCRATCH_ARM.fingerCurl + SCRATCH_ARM.fingerCurlRub * (rub + 1) * 0.5);
  turn.setFromAxisAngle(axisX, curl);
  for (const finger of fingers) {
    if (!finger.parent) continue;
    finger.parent.getWorldQuaternion(parentRotation);
    worldRotation.copy(parentRotation).invert().multiply(turn).multiply(parentRotation);
    finger.quaternion.premultiply(worldRotation);
    finger.updateWorldMatrix(false, true);
  }
}
