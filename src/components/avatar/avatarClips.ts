import * as THREE from 'three';
import { WAVE } from './avatar.config';

const HAND_BONES = /^Right(Hand|Thumb|Index|Middle|Ring|Little)/;

const smoothstep = (from: number, to: number, value: number) =>
  THREE.MathUtils.smoothstep(value, from, to);

/** 0 while the arm is rising or lowering, 1 while it is up and waving. */
const waveMask = (t: number) =>
  smoothstep(WAVE.startSec, WAVE.settledSec, t) * (1 - smoothstep(WAVE.endingSec, WAVE.endSec, t));

function readRotations(track: THREE.KeyframeTrack) {
  const rotations: THREE.Quaternion[] = [];
  for (let i = 0; i < track.times.length; i++) {
    const rotation = new THREE.Quaternion().fromArray(track.values, i * 4).normalize();
    // Keep neighbouring keys on the same side, so averaging them is meaningful.
    if (i > 0 && rotation.dot(rotations[i - 1]) < 0) {
      rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
    }
    rotations.push(rotation);
  }
  return rotations;
}

function average(rotations: THREE.Quaternion[], include: (index: number) => boolean) {
  const sum = new THREE.Quaternion(0, 0, 0, 0);
  rotations.forEach((rotation, index) => {
    if (!include(index)) return;
    sum.set(sum.x + rotation.x, sum.y + rotation.y, sum.z + rotation.z, sum.w + rotation.w);
  });
  return sum.normalize();
}

/**
 * Returns a calmer copy of the wave, in memory only. The hand and fingers hold
 * still relative to the forearm, and the forearm keeps a reduced version of its
 * sway. The raise and the return are untouched, so blends into Idle still match.
 */
export function createCalmWave(clip: THREE.AnimationClip) {
  const calm = clip.clone();

  for (const track of calm.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.split('.')[0];
    const isHand = HAND_BONES.test(bone);
    if (!isHand && bone !== 'RightLowerArm') continue;

    const times = track.times;
    const rotations = readRotations(track);
    // The hand holds one pose for the whole wave.
    const heldPose = average(
      rotations,
      (index) => times[index] >= WAVE.settledSec && times[index] <= WAVE.endingSec,
    );

    const output = new THREE.Quaternion();
    rotations.forEach((rotation, index) => {
      const t = times[index];
      const mask = waveMask(t);
      if (mask <= 0) return;
      if (isHand) {
        output.copy(heldPose);
      } else {
        // The arm's resting line through the wave, found by averaging over one full cycle.
        const center = average(
          rotations,
          (other) => Math.abs(times[other] - t) <= WAVE.periodSec / 2,
        );
        output.copy(center).slerp(rotation, WAVE.forearmSway);
      }
      output.copy(rotation.clone().slerp(output, mask));
      output.toArray(track.values, index * 4);
    });
  }

  return calm;
}
