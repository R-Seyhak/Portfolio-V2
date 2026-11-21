import * as THREE from 'three';
import { SCRATCH_ARM } from './avatar.config';

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
