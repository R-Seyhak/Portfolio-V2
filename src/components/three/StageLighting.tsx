'use client';

import * as THREE from 'three';
import { memo, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { LIGHTING } from './scene.config';

// Holds the one environment map that every View reads from.
const sharedEnvironment = new THREE.Scene();

/** Rendered once by the canvas. Built locally, so no HDR file is fetched from a CDN. */
export const SharedEnvironment = memo(function SharedEnvironment() {
  return (
    <Environment
      scene={sharedEnvironment}
      resolution={64}
      frames={1}
      environmentIntensity={LIGHTING.environment}
    >
      <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[-4, 1, 3]} scale={[4, 6, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[4, 1, 2]} scale={[4, 6, 1]} />
    </Environment>
  );
});

/** The lights for one View. Every 3D element on the page uses this same setup. */
export function StageLighting() {
  const scene = useThree((state) => state.scene);

  useLayoutEffect(() => {
    scene.environment = sharedEnvironment.environment;
    scene.environmentIntensity = sharedEnvironment.environmentIntensity;
    return () => {
      scene.environment = null;
    };
  }, [scene]);

  return (
    <>
      <ambientLight intensity={LIGHTING.ambient} />
      <directionalLight position={[...LIGHTING.key.position]} intensity={LIGHTING.key.intensity} />
      <directionalLight position={[...LIGHTING.rim.position]} intensity={LIGHTING.rim.intensity} />
    </>
  );
}
