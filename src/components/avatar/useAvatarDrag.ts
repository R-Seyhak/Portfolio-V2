import { useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { DRAG } from './avatar.config';
import type { DragTarget } from './avatar.types';

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

interface Press {
  id: number;
  x: number;
  y: number;
  fromYaw: number;
  dragging: boolean;
}

/**
 * Drag to turn the avatar. A press only becomes a drag after it has moved a few
 * pixels, so a click stays a click. On touch, CSS (`touch-action: pan-y`) leaves
 * vertical movement to the browser, so the page always keeps scrolling.
 */
export function useAvatarDrag() {
  const drag = useRef<DragTarget>({ yaw: 0, pitch: 0, active: false, currentYaw: 0 });
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const end = useCallback(() => {
    if (press.current?.dragging) {
      drag.current.active = false;
      drag.current.yaw = 0;
      drag.current.pitch = 0;
      setDragging(false);
    }
    press.current = null;
  }, []);

  const handlers = useMemo(
    () => ({
      /** A mouse or touch press doesn't take focus, so only the keyboard shows the focus ring. */
      onMouseDown(event: MouseEvent<HTMLElement>) {
        event.preventDefault();
      },
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        swallowClick.current = false;
        if (event.button !== 0) return;
        press.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          fromYaw: drag.current.currentYaw,
          dragging: false,
        };
      },
      onPointerMove(event: ReactPointerEvent<HTMLElement>) {
        const current = press.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;

        if (!current.dragging) {
          if (Math.hypot(dx, dy) < DRAG.thresholdPx) return;
          // A mostly vertical touch is a scroll, so leave it alone.
          if (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) {
            press.current = null;
            return;
          }
          current.dragging = true;
          swallowClick.current = true;
          drag.current.active = true;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // The pointer is already gone. Its pointerup or cancel still ends the drag.
          }
          setDragging(true);
        }

        drag.current.yaw = clamp(current.fromYaw + dx * DRAG.yawPerPx, DRAG.maxYaw);
        drag.current.pitch =
          event.pointerType === 'mouse' ? clamp(dy * DRAG.pitchPerPx, DRAG.maxPitch) : 0;
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
      /** Runs before the button's own click, and cancels it after a drag. */
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    [end],
  );

  return { drag, dragging, handlers };
}
