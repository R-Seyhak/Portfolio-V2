'use client';

import * as THREE from 'three';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, Ref, RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import RithAvatar from './RithAvatar';
import { CAMERA_FOV, DRAG, FRAMING, MOBILE_BELOW_PX } from './avatar.config';
import type { DragTargetRef, LookTargetRef, RithAvatarHandle } from './avatar.types';
import { LIGHTING } from '../three/scene.config';
import { SceneView } from '../three/SceneView';

export interface AvatarSceneProps {
  avatarRef: Ref<RithAvatarHandle>;
  /** False while off-screen or in a hidden tab: this View stops drawing. */
  active: boolean;
  lookTarget: LookTargetRef;
  drag: DragTargetRef;
  reducedMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

const framingFor = (width: number) =>
  width < MOBILE_BELOW_PX ? FRAMING.mobile : FRAMING.desktop;

/** This View's camera, reframed whenever the avatar's stage changes size. */
function AvatarCamera({ track }: { track: RefObject<HTMLElement> }) {
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const [camera] = useState(() => new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 20));

  useLayoutEffect(() => {
    const previous = get().camera;
    set({ camera });
    return () => set({ camera: previous });
  }, [camera, get, set]);

  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const frame = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!height) return;
      const { position, target, minAspect } = framingFor(window.innerWidth);
      const pullBack = Math.max(1, minAspect / (width / height));
      camera.position.set(position[0], position[1], position[2] * pullBack);
      camera.lookAt(target[0], target[1], target[2]);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(element);
    return () => observer.disconnect();
  }, [camera, track]);

  return null;
}

/**
 * Turns the avatar while it's dragged and springs it back on release. The shadow
 * sits in the outer group, so it turns with him but doesn't tilt.
 */
function Turntable({
  drag,
  reducedMotion,
  shadow,
  children,
}: {
  drag: DragTargetRef;
  reducedMotion: boolean;
  shadow: ReactNode;
  children: ReactNode;
}) {
  const turn = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const motion = useRef({ yaw: 0, yawSpeed: 0, pitch: 0, pitchSpeed: 0 });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const state = motion.current;
    const input = drag.current;

    if (input.active) {
      state.yaw = THREE.MathUtils.damp(state.yaw, input.yaw, DRAG.followSpeed, delta);
      state.pitch = THREE.MathUtils.damp(state.pitch, input.pitch, DRAG.followSpeed, delta);
      state.yawSpeed = 0;
      state.pitchSpeed = 0;
    } else if (state.yaw || state.pitch || state.yawSpeed || state.pitchSpeed) {
      const damping = reducedMotion ? DRAG.reducedDamping : DRAG.damping;
      state.yawSpeed += (-DRAG.stiffness * state.yaw - damping * state.yawSpeed) * delta;
      state.pitchSpeed += (-DRAG.stiffness * state.pitch - damping * state.pitchSpeed) * delta;
      state.yaw += state.yawSpeed * delta;
      state.pitch += state.pitchSpeed * delta;
      const settled =
        Math.abs(state.yaw) + Math.abs(state.pitch) < 5e-4 &&
        Math.abs(state.yawSpeed) + Math.abs(state.pitchSpeed) < 5e-3;
      if (settled) state.yaw = state.pitch = state.yawSpeed = state.pitchSpeed = 0;
    }

    input.currentYaw = state.yaw;
    if (turn.current) turn.current.rotation.y = state.yaw;
    if (tilt.current) tilt.current.rotation.x = state.pitch;
  });

  return (
    <group ref={turn}>
      <group ref={tilt}>{children}</group>
      {shadow}
    </group>
  );
}

// Memoized so a change of interaction mode never re-renders the 3D scene.
export default memo(function AvatarScene({
  avatarRef,
  active,
  lookTarget,
  drag,
  reducedMotion,
  onReady,
  onError,
}: AvatarSceneProps) {
  const viewRef = useRef<HTMLElement>(null);
  const [scale] = useState(() => framingFor(window.innerWidth).scale);

  return (
    <SceneView ref={viewRef} id="hero-avatar" className="av-view" active={active} onError={onError}>
      <AvatarCamera track={viewRef} />
      <Turntable
        drag={drag}
        reducedMotion={reducedMotion}
        shadow={
          // Must sit below y = 0: drei blurs on a plane at the world origin, and
          // from above that plane is behind the shadow camera and wipes the result.
          <ContactShadows
            position={[0, -0.002, 0]}
            frames={1}
            resolution={256}
            opacity={LIGHTING.shadow.opacity}
            blur={LIGHTING.shadow.blur}
            scale={LIGHTING.shadow.scale}
            far={LIGHTING.shadow.far}
          />
        }
      >
        <RithAvatar
          ref={avatarRef}
          scale={scale}
          active={active}
          lookTarget={lookTarget}
          drag={drag}
          reducedMotion={reducedMotion}
          onReady={onReady}
        />
      </Turntable>
    </SceneView>
  );
});
