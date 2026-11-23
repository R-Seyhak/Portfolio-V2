'use client';

import * as THREE from 'three';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import RithAvatar from '../avatar/RithAvatar';
import type { RithAvatarHandle } from '../avatar/avatar.types';
import { LIGHTING } from '../three/scene.config';
import { SceneView } from '../three/SceneView';
import { COMPANION } from './companion.config';

/** This View's camera, keeping the whole figure in frame at any spot size. */
function CompanionCamera({ track }: { track: RefObject<HTMLElement> }) {
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const [camera] = useState(() => new THREE.PerspectiveCamera(COMPANION.frame.fov, 1, 0.1, 30));

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
      if (!width || !height) return;
      const { bottom, top, halfWidth, fov, eyeLift } = COMPANION.frame;
      const aspect = width / height;
      const needed = Math.max(top - bottom, (halfWidth * 2) / aspect);
      const distance = needed / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      const middle = (top + bottom) / 2;
      camera.position.set(0, middle + eyeLift, distance);
      camera.lookAt(0, middle, 0);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    };
    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(element);
    return () => observer.disconnect();
  }, [camera, track]);

  return null;
}

/** Eases the body toward the page content. */
function Facing({ reducedMotion, children }: { reducedMotion: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const turn = group.current;
    if (!turn) return;
    turn.rotation.y = reducedMotion
      ? COMPANION.facing
      : THREE.MathUtils.damp(turn.rotation.y, COMPANION.facing, COMPANION.facingSpeed, Math.min(delta, 1 / 20));
  });
  return <group ref={group}>{children}</group>;
}

export interface CompanionSceneProps {
  avatarRef: RefObject<RithAvatarHandle>;
  active: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

export default memo(function CompanionScene({
  avatarRef,
  active,
  reducedMotion,
  onReady,
  onError,
}: CompanionSceneProps) {
  const viewRef = useRef<HTMLElement>(null);
  // The shadow is drawn once, so it has to wait for the figure's first real pose.
  const [posed, setPosed] = useState(false);
  const markPosed = useCallback(() => {
    setPosed(true);
    onReady();
  }, [onReady]);

  return (
    <SceneView ref={viewRef} id="companion" className="cp-view" active={active} onError={onError}>
      <CompanionCamera track={viewRef} />
      <Facing reducedMotion={reducedMotion}>
        <RithAvatar
          ref={avatarRef}
          asClone
          active={active}
          reducedMotion={reducedMotion}
          onReady={markPosed}
        />
      </Facing>
      {posed && (
        <ContactShadows
          position={[0, -0.002, 0]}
          frames={1}
          resolution={128}
          opacity={LIGHTING.shadow.opacity}
          blur={LIGHTING.shadow.blur}
          scale={COMPANION.shadowScale}
          far={LIGHTING.shadow.far}
        />
      )}
    </SceneView>
  );
});
