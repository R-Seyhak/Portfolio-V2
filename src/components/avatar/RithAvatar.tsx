'use client';

/**
 * Animated portfolio character. Runs its own AnimationMixer and applies, in
 * this order every frame: mixer update, held expressions, posture, head and
 * eye look, then the procedural arms.
 */
import * as THREE from 'three';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { loaderDone, loaderProgress, takeModelDownload } from '../loader/loaderClient';
import {
  ANIMATION,
  ARM_GOALS,
  BLINK,
  GESTURE_HEAD,
  HEAD_ANCHOR,
  HOVER,
  MODEL_URL,
  POINTER,
  READY,
  REACTIONS,
  WAVE,
} from './avatar.config';
import {
  applyArmGoal,
  applyScratchArm,
  createPoseArm,
  createScratchArm,
  mirrorGoal,
  poseArmBones,
  scratchArmBones,
} from './avatarArm';
import { createCalmWave } from './avatarClips';
import { advanceGesture, createGestureState, releaseGesture, startGesture } from './avatarGestures';
import { createGlassesArms } from './avatarGlasses';
import { cloneAvatarScene } from './avatarInstance';
import { whenGpuIdle } from './avatarReady';
import type {
  DragTargetRef,
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
  /** While the visitor is turning the avatar, the head stops following the cursor. */
  drag?: DragTargetRef;
  /** Simplifies procedural gestures for visitors who prefer less motion. */
  reducedMotion?: boolean;
  fade?: number;
  /** Called once the GPU has finished the first posed frame. */
  onReady?: () => void;
  /**
   * Draws a second figure from the same download: its own skeleton and pose,
   * sharing the geometry, materials and textures. The Hero leaves this off.
   */
  asClone?: boolean;
}

const ONE_SHOTS: OneShotClip[] = ['GreetingWave', 'HeadTilt', 'HappyReaction'];
const MORPH_NAMES: MorphName[] = ['smile', 'mouthOpen', 'browRaise', 'blinkLeft', 'blinkRight', 'blinkBoth'];
const MAX_FRAME_DELTA = 1 / 15;
const SHRUG_RIGHT = mirrorGoal(ARM_GOALS.shrug);

// Draco is off because this model uses meshopt, so no decoder is fetched from a CDN.
const USE_DRACO = false;
const USE_MESHOPT = true;

export const RithAvatar = forwardRef<RithAvatarHandle, RithAvatarProps>(function RithAvatar(
  {
    autoBlink = true,
    active = true,
    lookTarget,
    drag,
    reducedMotion = false,
    fade = ANIMATION.crossfade,
    onReady,
    asClone = false,
    ...props
  },
  ref,
) {
  const gltf = useGLTF(MODEL_URL, USE_DRACO, USE_MESHOPT);
  const { animations } = gltf;
  const scene = useMemo(
    () => (asClone ? cloneAvatarScene(gltf.scene, gltf.parser.json.nodes) : gltf.scene),
    [asClone, gltf],
  );
  const root = useRef<THREE.Group>(null);
  const getThree = useThree((state) => state.get);

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const map: Record<string, THREE.AnimationAction | undefined> = {};
    for (const clip of animations) {
      map[clip.name] = mixer.clipAction(clip.name === WAVE.clip ? createCalmWave(clip) : clip);
    }
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
    const body = [
      entry(get('Chest'), POINTER.chest),
      entry(get('UpperChest'), POINTER.upperChest),
      entry(get('Neck'), POINTER.neck),
      entry(get('Head'), POINTER.head),
    ];
    const eyes = [entry(get('LeftEye'), 1), entry(get('RightEye'), 1)];
    return { body, eyes, all: [...body, ...eyes] };
  }, [scene]);

  // Procedural layer: extra bones it writes to, and the arm solvers.
  const gestureRig = useMemo(() => {
    const arm = createScratchArm(scene, animations);
    const left = createPoseArm(scene, 'Left');
    const right = createPoseArm(scene, 'Right');
    const leftShoulder = scene.getObjectByName('LeftShoulder') ?? null;
    const rightShoulder = scene.getObjectByName('RightShoulder') ?? null;
    const extra = new Set<THREE.Object3D>([
      ...scratchArmBones(arm),
      ...poseArmBones(left),
      ...poseArmBones(right),
    ]);
    if (leftShoulder) extra.add(leftShoulder);
    if (rightShoulder) extra.add(rightShoulder);
    return {
      arm,
      left,
      right,
      leftShoulder,
      rightShoulder,
      posed: [...extra].map((bone) => ({ bone, base: bone.quaternion.clone() })),
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
  const clipDone = useRef<(() => void) | null>(null);

  const play = useCallback(
    (name: OneShotClip, onDone?: () => void) => {
      const idle = actions.Idle;
      const next = actions[name];
      if (!idle || !next || gesture.name) return false;
      const from = current.current ?? idle;
      // A one-shot is playing, or still blending back to Idle: let it finish.
      if (from !== idle || mixer.time < settledAt.current) return false;
      next.stopFading().reset().setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.setEffectiveWeight(1).play();
      from.crossFadeTo(next, fade, false);
      current.current = next;
      clipDone.current = onDone ?? null;
      return true;
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

  const hoverTarget = useRef(0);
  const setHover = useCallback((hovering: boolean) => {
    hoverTarget.current = hovering ? 1 : 0;
  }, []);

  useImperativeHandle(
    ref,
    () => ({ play, blink, setMorph, setHover, perform, release, headAnchor }),
    [play, blink, setMorph, setHover, perform, release, headAnchor],
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
      const done = clipDone.current;
      clipDone.current = null;
      done?.();
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

  // Added before the ready gate below, so their shader is compiled with the rest.
  useEffect(() => {
    const head = scene.getObjectByName('Head');
    if (!head) return;
    const arms = createGlassesArms();
    head.add(arms);
    return () => {
      head.remove(arms);
      arms.geometry.dispose();
      (arms.material as THREE.Material).dispose();
    };
  }, [scene]);

  // ---- ready gate ---------------------------------------------------------
  // Shaders and textures are prepared first, then the first posed frame is drawn,
  // and only when the GPU has finished it does the avatar count as visible.
  const readyPhase = useRef<'preparing' | 'drawing' | 'waiting'>('preparing');
  const framesDrawn = useRef(0);
  const cancelGpuWait = useRef<(() => void) | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    const { gl, scene: world, camera } = getThree();
    let timeout = 0;
    const limit = new Promise<void>((resolve) => {
      timeout = window.setTimeout(resolve, READY.compileTimeoutMs);
    });
    Promise.race([gl.compileAsync(world, camera).catch(() => undefined), limit]).then(() => {
      window.clearTimeout(timeout);
      if (!alive) return;
      scene.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!material) return;
        for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
          if (texture) gl.initTexture(texture);
        }
      });
      readyPhase.current = 'drawing';
    });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      cancelGpuWait.current?.();
      cancelGpuWait.current = null;
    };
  }, [getThree, scene]);

  // ---- per-frame update ---------------------------------------------------
  const look = useRef({ x: 0, y: 0, eyeX: 0, eyeY: 0, hover: 0 });
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

  useFrame((state, rawDelta) => {
    // Off-screen figures hold their pose, so only the visible one is animated.
    if (!active) return;
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
    for (const { bone, base } of lookBones.all) bone?.quaternion.copy(base);
    for (const { bone, base } of gestureRig.posed) bone.quaternion.copy(base);

    // 1) Animation
    const finishedGesture = advanceGesture(gesture, delta, reducedMotion);
    const pose = gesture.pose;
    if (actions.Idle) actions.Idle.timeScale = pose.idleSpeed;
    mixer.update(delta);
    for (const { bone, base } of lookBones.all) if (bone) base.copy(bone.quaternion);
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
              : key === 'smile'
                ? pose.smile
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
    const [, upperChest, neckBone, headBone] = lookBones.body;
    const [eyeLeft, eyeRight] = lookBones.eyes;
    const lift = pose.shoulderLift * REACTIONS.shoulderLift;
    turnBone(upperChest.bone, pose.chestPitch, 0, pose.chestRoll);
    turnBone(gestureRig.leftShoulder, 0, 0, lift);
    turnBone(gestureRig.rightShoulder, 0, 0, -lift);
    turnBone(neckBone.bone, pose.headPitch * GESTURE_HEAD.neck, pose.headYaw * GESTURE_HEAD.neck, pose.headRoll * GESTURE_HEAD.neck);
    turnBone(headBone.bone, pose.headPitch * GESTURE_HEAD.head, pose.headYaw * GESTURE_HEAD.head, pose.headRoll * GESTURE_HEAD.head);
    turnBone(eyeLeft.bone, pose.eyePitch, pose.eyeYaw, 0);
    turnBone(eyeRight.bone, pose.eyePitch, pose.eyeYaw, 0);

    const target = lookTarget?.current;
    const following = Boolean(target?.active) && !drag?.current.active;
    const lookShare = 1 - pose.lookMute;
    const targetX = following && target ? target.x * lookShare : 0;
    const targetY = following && target ? target.y * lookShare : 0;
    const eased = look.current;
    eased.x = THREE.MathUtils.damp(eased.x, targetX, POINTER.headSpeed, delta);
    eased.y = THREE.MathUtils.damp(eased.y, targetY, POINTER.headSpeed, delta);
    eased.eyeX = THREE.MathUtils.damp(eased.eyeX, targetX, POINTER.eyeSpeed, delta);
    eased.eyeY = THREE.MathUtils.damp(eased.eyeY, targetY, POINTER.eyeSpeed, delta);
    const yaw = THREE.MathUtils.clamp(eased.x, -1, 1) * POINTER.maxYaw;
    const headY = THREE.MathUtils.clamp(eased.y, -1, 1);
    const pitch = -headY * (headY > 0 ? POINTER.maxPitchUp : POINTER.maxPitchDown);

    if (Math.abs(yaw) > 1e-4 || Math.abs(pitch) > 1e-4) {
      for (const { bone, share } of lookBones.body) turnBone(bone, pitch * share, yaw * share, 0);
    }

    const hoverGoal = reducedMotion ? 0 : hoverTarget.current * lookShare;
    eased.hover = THREE.MathUtils.damp(eased.hover, hoverGoal, HOVER.speed, delta);
    if (eased.hover > 1e-3) turnBone(headBone.bone, 0, 0, eased.hover * HOVER.tilt);

    const eyeYaw = THREE.MathUtils.clamp(eased.eyeX, -1, 1) * POINTER.eyeYaw;
    const eyePitch = -THREE.MathUtils.clamp(eased.eyeY, -1, 1) * POINTER.eyePitch;
    if (Math.abs(eyeYaw) > 1e-4 || Math.abs(eyePitch) > 1e-4) {
      turnBone(eyeLeft.bone, eyePitch, eyeYaw, 0);
      turnBone(eyeRight.bone, eyePitch, eyeYaw, 0);
    }

    // 4) The arms go last so a hand stays put wherever the body ended up
    if (gestureRig.arm && headBone.bone && pose.arm > 0.001) {
      applyScratchArm(gestureRig.arm, headBone.bone, pose.arm, pose.rub);
    }
    if (gestureRig.right && pose.thumbsArm > 0.001) {
      applyArmGoal(gestureRig.right, scene, ARM_GOALS.thumbsUp, pose.thumbsArm);
    }
    if (pose.shrugArms > 0.001) {
      if (gestureRig.left) applyArmGoal(gestureRig.left, scene, ARM_GOALS.shrug, pose.shrugArms);
      if (gestureRig.right) applyArmGoal(gestureRig.right, scene, SHRUG_RIGHT, pose.shrugArms);
    }
    if (gestureRig.left && pose.watchArm > 0.001) {
      applyArmGoal(gestureRig.left, scene, ARM_GOALS.checkWatch, pose.watchArm);
    }
    if (gestureRig.right && pose.presentArm > 0.001) {
      applyArmGoal(gestureRig.right, scene, ARM_GOALS.present, pose.presentArm);
    }

    if (readyPhase.current === 'drawing') {
      framesDrawn.current += 1;
      if (framesDrawn.current === 2) {
        readyPhase.current = 'waiting';
        cancelGpuWait.current = whenGpuIdle(state.gl.getContext() as WebGL2RenderingContext, () => {
          cancelGpuWait.current = null;
          onReadyRef.current?.();
        });
      }
    }
    finishedGesture?.();
  });

  return (
    <group ref={root} {...props} dispose={null}>
      <primitive object={scene} />
    </group>
  );
});

// Uses the download the loading screen already started, so the model is fetched once.
// If there isn't one (a direct link to another section), it loads the normal way.
const useLoaderDownload: NonNullable<Parameters<typeof useGLTF.preload>[3]> = (loader) => {
  const load = loader.load.bind(loader);
  loader.load = (url, onLoad, onProgress, onError) => {
    const finish: typeof onLoad = (gltf) => {
      loaderDone('model');
      onLoad(gltf);
    };
    const download = takeModelDownload();
    if (!download) {
      load(
        url,
        finish,
        (event) => {
          loaderProgress('model', event.total > 0 ? (event.loaded / event.total) * 0.94 : null);
          onProgress?.(event);
        },
        onError,
      );
      return;
    }
    download.then(
      (bytes) => loader.parse(bytes, THREE.LoaderUtils.extractUrlBase(url), finish, onError),
      (error: unknown) => onError?.(error as ErrorEvent),
    );
  };
};

loaderDone('code');
useGLTF.preload(MODEL_URL, USE_DRACO, USE_MESHOPT, useLoaderDownload);

export default RithAvatar;
