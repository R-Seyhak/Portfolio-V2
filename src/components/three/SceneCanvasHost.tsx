'use client';

import dynamic from 'next/dynamic';
import { Component } from 'react';
import type { ReactNode } from 'react';
import { reportSceneFailure, useSceneCanvas } from './sceneStore';

const SceneCanvas = dynamic(() => import('./SceneCanvas'), { ssr: false });

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    reportSceneFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Loads the 3D canvas only once a section asks for it. */
export function SceneCanvasHost() {
  const { requested, failed } = useSceneCanvas();
  if (!requested || failed) return null;
  return (
    <CanvasBoundary>
      <SceneCanvas />
    </CanvasBoundary>
  );
}
