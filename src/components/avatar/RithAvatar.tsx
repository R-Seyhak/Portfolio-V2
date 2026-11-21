'use client';

/**
 * Animated portfolio character. Runs its own AnimationMixer and applies, in
 * this order every frame: mixer update, held expressions, head and eye look.
 */
import * as THREE from 'three';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ANIMATION, BLINK, HEAD_ANCHOR, MODEL_URL, POINTER } from './avatar.config';
import { applyScratchArm, createScratchArm, scratchArmBones } from './avatarArm';
import { advanceGesture, createGestureState, releaseGesture, startGesture } from './avatarGestures';
import type {
  GestureName,
  HeadAnchor,
  LookTargetRef,
  MorphName,
  OneShotClip,
  RithAvatarHandle,
} from './avatar.types';

type GroupProps = ThreeElements['group'];

export interface RithAvatarProps extends Omit<GroupProps, 'ref'> {
  autoBlink?: boolean;
  /** False while off-screen, so no blink timers run. */
  active?: boolean;
  lookTarget?: LookTargetRef;
  /** Simplifies procedural gestures for visitors who prefer less motion. */
  reducedMotion?: boolean;
  fade?: number;
  /** Called once the first posed frame has been drawn. */
  onReady?: () => void;
}

const ONE_SHOTS: OneShotClip[] = ['GreetingWave', 'HeadTilt', 'HappyReaction'];
const MORPH_NAMES: MorphName[] = ['smile', 'mouthOpen', 'browRaise', 'blinkLeft', 'blinkRight', 'blinkBoth'];
const MAX_FRAME_DELTA = 1 / 15;

// Draco is off because this model uses meshopt, so no decoder is fetched from a CDN.
const USE_DRACO = false;
const USE_MESHOPT = true;

export const RithAvatar = forwardRef<RithAvatarHandle, RithAvatarProps>(function RithAvatar(
  {
    autoBlink = true,
    active = true,
    lookTarget,
    reducedMotion = false,
    fade = ANIMATION.crossfade,
    onReady,
    ...props
  },
  ref,
) {
  const { scene, animations } = useGLTF(MODEL_URL, USE_DRACO, USE_MESHOPT);
  const root = useRef<THREE.Group>(null);
  const getThree = useThree((state) => state.get);

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const map: Record<string, THREE.AnimationAction | undefined> = {};
    for (const clip of animations) map[clip.name] = mixer.clipAction(clip);
    return map;
  }, [animations, mixer]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    },
    [mixer, scene],
  );

  const lookBones = useMemo(() => {
    const get = (name: string) => scene.getObjectByName(name) ?? null;
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      // Skinned bounds come from the bind pose, and the wave reaches outside them.
      if (mesh.isMesh) mesh.frustumCulled = false;
    });
    // `base` starts at the rest pose: the eye bones are never written by a clip.
    const entry = (bone: THREE.Object3D | null, share: number) => ({
      bone,
      share,
      base: bone ? bone.quaternion.clone() : new THREE.Quaternion(),
    });
    return [
      entry(get('Neck'), POINTER.neck),
      entry(get('Head'), POINTER.head),
      entry(get('LeftEye'), POINTER.eyes),
      entry(get('RightEye'), POINTER.eyes),
    ];
  }, [scene]);

  // Procedural layer: extra bones it writes to, and the arm solver.
  const gestureRig = useMemo(() => {
    const arm = createScratchArm(scene, animations);
    const chest = scene.getObjectByName('UpperChest') ?? null;
    const extra = [chest, ...scratchArmBones(arm)].filter(
      (bone): bone is THREE.Object3D => bone !== null,
    );
    return {
      arm,
      chest,
      posed: extra.map((bone) => ({ bone, base: bone.quaternion.clone() })),
    };
  }, [scene, animations]);
  const gesture = useMemo(createGestureState, []);

  // Found by morphTargetDictionary because the web GLB has generic mesh names.
  const morphMeshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary) list.push(mesh);
    });
    return list;
  }, [scene]);

  // ---- clip control -------------------------------------------------------
  const current = useRef<THREE.AnimationAction | null>(null);
  const settledAt = useRef(0);

  const play = useCallback(
    (name: OneShotClip) => {
      const idle = actions.Idle;
      const next = actions[name];
      if (!idle || !next || gesture.name) return;
      const from = current.current ?? idle;
      // A one-shot is playing, or still blending back to Idle: let it finish.
      if (from !== idle || mixer.time < settledAt.current) return;
      next.stopFading().reset().setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.setEffectiveWeight(1).play();
      from.crossFadeTo(next, fade, false);
      current.current = next;
    },
    [actions, fade, mixer, gesture],
  );

  const perform = useCallback(
    (name: GestureName, onDone?: () => void) => {
      const idle = actions.Idle;
      if (!idle || gesture.name === name) return false;
      // Gestures start from Idle, so a body clip gets to finish first.
      if ((current.current ?? idle) !== idle || mixer.time < settledAt.current) return false;
      startGesture(gesture, name, reducedMotion, onDone);
      return true;
    },
    [actions, gesture, mixer, reducedMotion],
  );

  const release = useCallback(() => releaseGesture(gesture), [gesture]);

  const headAnchor = useCallback((): HeadAnchor => {
    const { camera } = getThree();
    const group = root.current;
    camera.updateMatrixWorld();
    group?.updateWorldMatrix(true, false);
    const toStage = (x: number, y: number) => {
      const point = new THREE.Vector3(x, y, HEAD_ANCHOR.center[2]);
      if (group) point.applyMatrix4(group.matrixWorld);
      point.project(camera);
      return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
    };
    return {
      x: toStage(HEAD_ANCHOR.center[0], HEAD_ANCHOR.center[1]).x,
      right: toStage(HEAD_ANCHOR.center[0] + HEAD_ANCHOR.halfWidth, HEAD_ANCHOR.center[1]).x,
      top: toStage(HEAD_ANCHOR.center[0], HEAD_ANCHOR.top).y,
    };
  }, [getThree]);

  const blink = useCallback(() => {
    const action = actions.Blink;
    if (!action || action.isRunning()) return;
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.play();
  }, [actions]);

  const expressionTargets = useRef<Partial<Record<MorphName, number>>>({});
  const expressions = useRef<Partial<Record<MorphName, number>>>({});
  const setMorph = useCallback((name: MorphName, value: number) => {
    expressionTargets.current[name] = THREE.MathUtils.clamp(value, 0, 1);
  }, []);

  useImperativeHandle(
    ref,
    () => ({ play, blink, setMorph, perform, release, headAnchor }),
    [play, blink, setMorph, perform, release, headAnchor],
  );

  useEffect(() => {
    const idle = actions.Idle;
    if (!idle) return;
    idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    current.current = idle;
    return () => {
      idle.stop();
    };
  }, [actions]);

  // All clips start and end on the same pose, so this blend never snaps.
  useEffect(() => {
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      const idle = actions.Idle;
      if (!idle || !ONE_SHOTS.some((name) => actions[name] === event.action)) return;
      idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      event.action.crossFadeTo(idle, fade, false);
      current.current = idle;
      settledAt.current = mixer.time + fade;
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
  }, [mixer, actions, fade]);

  useEffect(() => {
    if (!autoBlink || !active) return;
    let timer = 0;
    let doubleTimer = 0;
    // The sleep gestures own the eyelids, so the blink schedule just skips its turn.
    const blinkIfAwake = () => {
      if (gesture.name !== 'fallingAsleep' && gesture.name !== 'sleeping') blink();
    };
    const schedule = () => {
      const wait = BLINK.minMs + Math.random() * (BLINK.maxMs - BLINK.minMs);
      timer = window.setTimeout(() => {
        blinkIfAwake();
        if (Math.random() < BLINK.doubleChance) {
          doubleTimer = window.setTimeout(blinkIfAwake, BLINK.doubleGapMs);
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(doubleTimer);
    };
  }, [autoBlink, active, blink, gesture]);

  // ---- per-frame update ---------------------------------------------------
  const look = useRef({ x: 0, y: 0 });
  const added = useMemo(() => new Map<THREE.Mesh, number[]>(), []);
  const scratch = useMemo(
    () => ({
      delta: new THREE.Quaternion(),
      parent: new THREE.Quaternion(),
      parentInverse: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    }),
    [],
  );
  const framesDrawn = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA);

    // Take last frame's offsets back out. The mixer only writes a value when it
    // changes, and the eye bones have no tracks at all, so without this the
    // look rotation would build up frame after frame.
    for (const mesh of morphMeshes) {
      const influences = mesh.morphTargetInfluences;
      const offsets = added.get(mesh);
      if (influences && offsets) {
        for (let i = 0; i < influences.length; i++) influences[i] -= offsets[i];
      }
    }
    for (const { bone, base } of lookBones) bone?.quaternion.copy(base);
    for (const { bone, base } of gestureRig.posed) bone.quaternion.copy(base);

    // 1) Animation
    const finishedGesture = advanceGesture(gesture, delta, reducedMotion);
    const pose = gesture.pose;
    if (actions.Idle) actions.Idle.timeScale = pose.idleSpeed;
    mixer.update(delta);
    for (const { bone, base } of lookBones) if (bone) base.copy(bone.quaternion);
    for (const { bone, base } of gestureRig.posed) base.copy(bone.quaternion);

    // 2) Held expressions, added on top of the clip
    const held = expressions.current;
    for (const key of Object.keys(expressionTargets.current) as MorphName[]) {
      const target = expressionTargets.current[key] ?? 0;
      const value = THREE.MathUtils.damp(held[key] ?? 0, target, ANIMATION.expressionSpeed, delta);
      held[key] = Math.abs(value - target) < 0.001 ? target : value;
    }
    const heldShare = 1 - pose.expressionMute;
    for (const mesh of morphMeshes) {
      const influences = mesh.morphTargetInfluences;
      const dictionary = mesh.morphTargetDictionary;
      if (!influences || !dictionary) continue;
      let offsets = added.get(mesh);
      if (!offsets) {
        offsets = new Array<number>(influences.length).fill(0);
        added.set(mesh, offsets);
      }
      offsets.fill(0);
      for (const key of MORPH_NAMES) {
        const index = dictionary[key];
        if (index === undefined) continue;
        const gestureValue =
          key === 'browRaise'
            ? pose.browRaise
            : key === 'mouthOpen'
              ? pose.mouthOpen
              : key === 'blinkBoth'
                ? pose.lids
                : 0;
        const value = (held[key] ?? 0) * heldShare + gestureValue;
        if (!value) continue;
        const next = Math.min(1, influences[index] + value);
        offsets[index] = next - influences[index];
        influences[index] = next;
      }
    }

    // 3) Gesture posture, then head and eyes eased toward the target and back to neutral
    const { delta: rotation, parent, parentInverse, euler } = scratch;
    const turnBone = (bone: THREE.Object3D | null, pitch: number, yaw: number, roll: number) => {
      if (!bone?.parent || (!pitch && !yaw && !roll)) return;
      bone.parent.getWorldQuaternion(parent);
      parentInverse.copy(parent).invert();
      euler.set(pitch, yaw, roll);
      // World-space turn expressed in the bone's parent space: P^-1 * R * P
      rotation.setFromEuler(euler).premultiply(parentInverse).multiply(parent);
      bone.quaternion.premultiply(rotation);
    };
    const [neckBone, headBone, eyeLeft, eyeRight] = lookBones;
    turnBone(gestureRig.chest, pose.chestPitch, 0, pose.chestRoll);
    turnBone(neckBone.bone, pose.headPitch * POINTER.neck, pose.headYaw * POINTER.neck, pose.headRoll * POINTER.neck);
    turnBone(headBone.bone, pose.headPitch * POINTER.head, pose.headYaw * POINTER.head, pose.headRoll * POINTER.head);
    turnBone(eyeLeft.bone, pose.eyePitch, pose.eyeYaw, 0);
    turnBone(eyeRight.bone, pose.eyePitch, pose.eyeYaw, 0);

    const target = lookTarget?.current;
    const lookShare = 1 - pose.lookMute;
    const targetX = target?.active ? target.x * lookShare : 0;
    const targetY = target?.active ? target.y * lookShare : 0;
    const eased = look.current;
    eased.x = THREE.MathUtils.damp(eased.x, targetX, POINTER.smoothing, delta);
    eased.y = THREE.MathUtils.damp(eased.y, targetY, POINTER.smoothing, delta);
    const yaw = THREE.MathUtils.clamp(eased.x, -1, 1) * POINTER.maxYaw;
    const pitch = THREE.MathUtils.clamp(-eased.y, -1, 1) * POINTER.maxPitch;

    if (Math.abs(yaw) > 1e-4 || Math.abs(pitch) > 1e-4) {
      for (const { bone, share } of lookBones) turnBone(bone, pitch * share, yaw * share, 0);
    }

    // 4) The arm goes last so the hand stays on the head wherever the head ended up
    if (gestureRig.arm && headBone.bone && pose.arm > 0.001) {
      applyScratchArm(gestureRig.arm, headBone.bone, pose.arm, pose.rub);
    }

    if (framesDrawn.current < 2) {
      framesDrawn.current += 1;
      if (framesDrawn.current === 2) onReadyRef.current?.();
    }
    finishedGesture?.();
  });

  return (
    <group ref={root} {...props} dispose={null}>
      <primitive object={scene} />
    </group>
  );
});

useGLTF.preload(MODEL_URL, USE_DRACO, USE_MESHOPT);

export default RithAvatar;
