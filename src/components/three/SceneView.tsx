'use client';

import { Component, Suspense, forwardRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from '@react-three/drei';
import { setViewActive } from './sceneStore';
import { StageLighting } from './StageLighting';

// Lives inside the canvas tree, so one section's failure never takes down the others.
class ViewBoundary extends Component<
  { onError?: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface SceneViewProps {
  /** Unique on the page. */
  id: string;
  /** False while off-screen or in a hidden tab, so this View stops drawing. */
  active: boolean;
  className?: string;
  onError?: () => void;
  children: ReactNode;
}

/**
 * One section's window into the shared canvas. The returned element holds the
 * View's place in the layout, and the children render in the canvas with the
 * shared lighting. Each View needs its own default camera.
 */
export const SceneView = forwardRef<HTMLElement, SceneViewProps>(function SceneView(
  { id, active, className, onError, children },
  ref,
) {
  useEffect(() => {
    setViewActive(id, active);
  }, [id, active]);
  useEffect(() => () => setViewActive(id, false), [id]);

  return (
    <View ref={ref as never} className={className} visible={active}>
      <ViewBoundary onError={onError}>
        <Suspense fallback={null}>
          <StageLighting />
          {children}
        </Suspense>
      </ViewBoundary>
    </View>
  );
});
