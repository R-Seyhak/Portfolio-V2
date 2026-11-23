'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useInView, usePageVisible } from '../avatar/useInView';
import { usePrefersReducedMotion } from '../avatar/usePrefersReducedMotion';
import {
  onSceneFailure,
  requestSceneCanvas,
  showSceneCanvas,
  supportsWebGL,
} from '../three/sceneStore';
import type { ConstellationInput } from './ConstellationScene';
import { CATEGORY_LABELS, PHONE, WIDE, nodeRadius, projectStatic } from './constellation.data';
import type { FilterId } from './constellation.data';
import { TechnologyInfo } from './TechnologyInfo';
import { TechnologyList } from './TechnologyList';

const ConstellationScene = dynamic(() => import('./ConstellationScene'), { ssr: false });

const PHONE_BELOW_PX = 720;
/** From this stage width up, every name fits without any adjusting. */
const ROOM_FOR_ALL_NAMES_PX = 900;
const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

export const SkillsConstellation = memo(function SkillsConstellation({
  icons,
  category,
  activeTech,
}: {
  icons: Record<string, { icon: ReactNode }>;
  category: FilterId;
  /** Technologies hovered in the Work section, highlighted here for a moment. */
  activeTech: string[] | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const groupLabels = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const input = useRef<ConstellationInput>({
    hovered: -1,
    selected: -1,
    pointerX: 0,
    pointerY: 0,
    pointer: null,
    mask: null,
    category,
    screen: [],
    lastActivity: 0,
  });

  const [phone, setPhone] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [cursor, setCursor] = useState(0);
  const [mount3d, setMount3d] = useState(false);
  const [live, setLive] = useState(false);
  const data = phone ? PHONE : WIDE;

  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const nearView = useInView(stageRef, { rootMargin: '500px', once: true });
  const onScreen = useInView(stageRef);
  const active = onScreen && pageVisible;

  useEffect(() => {
    // A phone held sideways is wide and short, so it uses the wide layout.
    const query = window.matchMedia(`(max-width: ${PHONE_BELOW_PX - 1}px) and (orientation: portrait)`);
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const neighbours = useMemo(() => {
    const list = data.nodes.map(() => new Set<number>());
    for (const [a, b] of data.edges) {
      list[a].add(b);
      list[b].add(a);
    }
    return list;
  }, [data]);

  const mask = useMemo(() => {
    const hoveredInWork = activeTech?.filter((name) => data.nodes.some((node) => node.name === name));
    if (hoveredInWork?.length) return data.nodes.map((node) => hoveredInWork.includes(node.name));
    if (category === 'all') return null;
    return data.nodes.map((node) => node.category === category);
  }, [activeTech, category, data]);

  /**
   * Small screens have room for fewer names than nodes. Names are placed in order
   * of relevance, and any that would touch a node or another name waits for a tap.
   */
  const fitNames = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!phone && stage.clientWidth >= ROOM_FOR_ALL_NAMES_PX) {
      buttons.current.forEach((button) => {
        button?.removeAttribute('data-name-off');
        button?.removeAttribute('data-name-up');
      });
      return;
    }
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    const { hovered, selected: picked, mask: included } = input.current;
    const focus = hovered >= 0 ? hovered : picked;
    const related = focus >= 0 ? neighbours[focus] : null;
    const narrowed = focus >= 0 || Boolean(included);
    const rank = (index: number) => {
      if (index === focus) return 0;
      if (related?.has(index)) return 1;
      if (focus < 0 && included?.[index]) return data.nodes[index].tier === 'primary' ? 2 : 3;
      if (narrowed) return 9;
      const { tier } = data.nodes[index];
      if (tier === 'primary') return 2;
      return !phone && tier === 'secondary' ? 3 : 9;
    };

    const points = data.nodes.map((item) => {
      const point = projectStatic(item.position, data.bounds, width, height);
      const radius = nodeRadius(item, phone) * point.scale + 1;
      return { x: point.x, y: point.y, radius };
    });
    type Box = { left: number; right: number; top: number; bottom: number };
    const overlaps = (a: Box, b: Box) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    // A few pixels of slack, because the nodes float and a filter brings them forward.
    const beads = points.map(({ x, y, radius }): Box => {
      const reach = radius + (narrowed ? 5 : 2);
      return { left: x - reach, right: x + reach, top: y - reach, bottom: y + reach };
    });
    const taken: Box[] = data.labels.flatMap((label, index) => {
      const element = groupLabels.current[index];
      if (!element) return [];
      const point = projectStatic([label.x, label.y, 0], data.bounds, width, height);
      const halfWidth = element.offsetWidth / 2;
      const halfHeight = element.offsetHeight / 2;
      return [{ left: point.x - halfWidth, right: point.x + halfWidth, top: point.y - halfHeight, bottom: point.y + halfHeight }];
    });

    const order = data.nodes.map((_, index) => index).sort((a, b) => rank(a) - rank(b));
    for (const index of order) {
      const button = buttons.current[index];
      const name = button?.querySelector<HTMLElement>('.kc-name');
      if (!button || !name) continue;
      const point = points[index];
      const halfWidth = (name.offsetWidth - 8) / 2 + 2;
      const nameHeight = name.offsetHeight;
      // Clears the larger focused node and its selection ring.
      const gap = point.radius * (index === picked ? 1.62 : index === focus ? 1.36 : 1.08) + 3;
      const boxAt = (top: number): Box => ({
        left: point.x - halfWidth,
        right: point.x + halfWidth,
        top,
        bottom: top + nameHeight,
      });
      const isClear = (box: Box) =>
        box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height &&
        !taken.some((other) => overlaps(box, other)) &&
        !beads.some((bead, other) => other !== index && overlaps(box, bead));
      const below = boxAt(point.y + gap);
      const above = boxAt(point.y - gap - nameHeight);
      let spot: Box | null = null;
      if (rank(index) < 9) {
        if (isClear(below)) spot = below;
        else if (isClear(above)) spot = above;
        else if (index === focus) spot = below;
      }
      button.toggleAttribute('data-name-off', !spot);
      button.toggleAttribute('data-name-up', spot === above);
      if (spot) taken.push(spot);
    }
  }, [data, neighbours, phone]);

  /** Marks the current state in the DOM, so a hover costs no React render. */
  const paintFocus = useCallback(() => {
    const { hovered, selected: picked, mask: included } = input.current;
    const focus = hovered >= 0 ? hovered : picked;
    const related = focus >= 0 ? neighbours[focus] : null;
    input.current.lastActivity = performance.now();
    buttons.current.forEach((button, index) => {
      if (!button) return;
      const inFilter = Boolean(included?.[index]);
      const isFocus = index === focus;
      const isRelated = Boolean(related?.has(index));
      button.toggleAttribute('data-focus', isFocus);
      button.toggleAttribute('data-related', isRelated);
      button.toggleAttribute('data-in', inFilter);
      button.toggleAttribute('data-quiet', focus >= 0 ? !isFocus && !isRelated : Boolean(included) && !inFilter);
    });
    data.edges.forEach(([a, b], index) => {
      const line = lineRefs.current[index];
      if (!line) return;
      const hot = focus >= 0 ? a === focus || b === focus : Boolean(included?.[a] && included?.[b]);
      const touching = focus < 0 && Boolean(included?.[a] || included?.[b]);
      line.toggleAttribute('data-hot', hot);
      line.toggleAttribute('data-quiet', (focus >= 0 || Boolean(included)) && !hot && !touching);
    });
    fitNames();
  }, [data, neighbours, fitNames]);

  const hover = useCallback(
    (index: number) => {
      input.current.hovered = index;
      paintFocus();
    },
    [paintFocus],
  );

  const select = useCallback(
    (index: number) => {
      setSelected(index);
      input.current.selected = index;
      paintFocus();
    },
    [paintFocus],
  );

  // The focus ring is for keyboard users only. The browser's own :focus-visible can
  // stay on after a tap, so this tracks what the visitor is actually using.
  const usingKeyboard = useRef(false);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Home' || event.key === 'End' || event.key.startsWith('Arrow')) {
        usingKeyboard.current = true;
      }
    };
    const onPointer = () => {
      usingKeyboard.current = false;
      const index = buttons.current.findIndex((button) => button?.hasAttribute('data-keyboard'));
      if (index < 0) return;
      buttons.current[index]?.removeAttribute('data-keyboard');
      if (input.current.hovered === index) hover(-1);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [hover]);

  // A different layout has different screen positions, so the selection starts over.
  useEffect(() => {
    input.current.hovered = -1;
    input.current.selected = -1;
    input.current.screen = [];
    setSelected(-1);
    setCursor(0);
  }, [data]);

  useEffect(() => {
    input.current.mask = mask;
    input.current.category = category;
    if (mask) {
      // Keyboard focus and any selection stay inside what the filter shows.
      setCursor((current) => (mask[current] ? current : Math.max(mask.indexOf(true), 0)));
      if (input.current.selected >= 0 && !mask[input.current.selected]) {
        input.current.selected = -1;
        setSelected(-1);
      }
    }
    paintFocus();
  }, [mask, category, paintFocus]);

  // On touch screens the note can start below the fold, so bring it up after a
  // tap, without pushing the chosen node under the top bar.
  useEffect(() => {
    if (selected < 0 || !window.matchMedia('(pointer: coarse)').matches) return;
    const id = requestAnimationFrame(() => {
      const note = rootRef.current?.querySelector('.kc-info');
      const button = buttons.current[selected];
      if (!note || !button) return;
      const bar = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 60;
      const needed = note.getBoundingClientRect().bottom + 12 - window.innerHeight;
      // Leaves the node and its selection ring clear of the bar.
      const room = button.getBoundingClientRect().top - bar - 46;
      const by = Math.min(needed, room);
      if (by > 6) window.scrollBy({ top: by, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [selected, reducedMotion]);

  // Clicking anywhere outside the constellation returns it to its resting state.
  useEffect(() => {
    if (selected < 0) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) select(-1);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selected, select]);

  // Lays everything out without 3D: the first paint, and the fallback.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const place = () => {
      const { clientWidth: width, clientHeight: height } = stage;
      if (!width || !height) return;
      stage.style.setProperty('--kc-unit', `${projectStatic([0, 0, 0], data.bounds, width, height).scale.toFixed(2)}px`);
      const points = data.nodes.map((node) => projectStatic(node.position, data.bounds, width, height));
      points.forEach((point, index) => {
        input.current.screen[index] = { x: point.x, y: point.y };
        const button = buttons.current[index];
        if (button && !live) button.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
      });
      data.edges.forEach(([a, b], index) => {
        const line = lineRefs.current[index];
        if (!line) return;
        line.setAttribute('x1', points[a].x.toFixed(1));
        line.setAttribute('y1', points[a].y.toFixed(1));
        line.setAttribute('x2', points[b].x.toFixed(1));
        line.setAttribute('y2', points[b].y.toFixed(1));
      });
      if (!live) {
        data.labels.forEach((label, index) => {
          const element = groupLabels.current[index];
          if (!element) return;
          const point = projectStatic([label.x, label.y, 0], data.bounds, width, height);
          element.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        });
      }
      stage.setAttribute('data-laid', '');
      fitNames();
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(stage);
    // Names change width when the web font arrives.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) fitNames();
    });
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [data, live, fitNames]);

  useEffect(() => {
    if (mount3d || !nearView || !supportsWebGL()) return;
    requestSceneCanvas();
    setMount3d(true);
  }, [mount3d, nearView]);

  const markReady = useCallback(() => {
    setLive(true);
    showSceneCanvas();
  }, []);
  const markFailed = useCallback(() => {
    setLive(false);
    setMount3d(false);
  }, []);
  useEffect(() => onSceneFailure(markFailed), [markFailed]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const shared = input.current;
    shared.pointerX = (x / box.width) * 2 - 1;
    shared.pointerY = (y / box.height) * 2 - 1;
    shared.lastActivity = performance.now();
    if (shared.pointer) {
      shared.pointer.x = x;
      shared.pointer.y = y;
    } else {
      shared.pointer = { x, y };
    }
  };
  const onPointerLeave = () => {
    input.current.pointerX = 0;
    input.current.pointerY = 0;
    input.current.pointer = null;
    hover(-1);
  };

  const canReach = (index: number) => !input.current.mask || input.current.mask[index];

  const moveFocus = (from: number, [dx, dy]: [number, number]) => {
    const { screen } = input.current;
    const origin = screen[from];
    if (!origin) return;
    let best = -1;
    let bestScore = Infinity;
    screen.forEach((point, index) => {
      if (index === from || !point || !canReach(index)) return;
      const x = point.x - origin.x;
      const y = point.y - origin.y;
      const forward = x * dx + y * dy;
      if (forward <= 4) return;
      const sideways = Math.abs(x * dy) + Math.abs(y * dx);
      const score = forward + sideways * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best >= 0) {
      setCursor(best);
      buttons.current[best]?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      moveFocus(index, arrow);
    } else if (event.key === 'Escape') {
      select(-1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const reachable = data.nodes.map((_, position) => position).filter(canReach);
      const next = event.key === 'Home' ? reachable[0] : reachable[reachable.length - 1];
      setCursor(next);
      buttons.current[next]?.focus();
    }
  };

  const pick = useCallback(
    (name: string) => {
      const next = data.nodes.findIndex((item) => item.name === name);
      if (next < 0) return;
      setCursor(next);
      select(next);
    },
    [data, select],
  );

  const node = selected >= 0 ? data.nodes[selected] ?? null : null;

  return (
    <div
      ref={rootRef}
      className="kc"
      onPointerDown={(event) => {
        // A press on the empty stage clears the selection. Nodes handle their own.
        if (event.target === stageRef.current) select(-1);
      }}
    >
      <div
        ref={stageRef}
        className="kc-stage"
        data-live={live || undefined}
        data-filtered={category !== 'all' || undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <svg className="kc-lines" aria-hidden="true">
          {data.edges.map(([a, b], index) => (
            <line
              key={`${data.nodes[a].name}-${data.nodes[b].name}`}
              ref={(element) => {
                lineRefs.current[index] = element;
              }}
            />
          ))}
        </svg>

        {mount3d && (
          <ConstellationScene
            data={data}
            phone={phone}
            input={input}
            stage={stageRef}
            buttons={buttons}
            groupLabels={groupLabels}
            active={active}
            reducedMotion={reducedMotion}
            onReady={markReady}
            onError={markFailed}
          />
        )}

        {data.labels.map((label, index) => (
          <span
            key={label.id}
            className="kc-group"
            data-active={category === label.id || undefined}
            aria-hidden="true"
            ref={(element) => {
              groupLabels.current[index] = element;
            }}
          >
            {CATEGORY_LABELS[label.id]}
          </span>
        ))}

        <div role="group" aria-label="Technology constellation. Use the arrow keys to move between technologies.">
          {data.nodes.map((item, index) => {
            const links = item.related.join(', ');
            return (
              <button
                key={item.name}
                type="button"
                data-tech={item.name}
                data-tier={item.tier}
                className="kc-node"
                style={{ '--kc-size': nodeRadius(item, phone).toFixed(3) } as CSSProperties}
                tabIndex={index === cursor ? 0 : -1}
                aria-pressed={selected === index}
                aria-label={`${item.name}, ${CATEGORY_LABELS[item.category]}. Related to ${links}.`}
                ref={(element) => {
                  buttons.current[index] = element;
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') hover(index);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') hover(-1);
                }}
                onFocus={(event) => {
                  setCursor(index);
                  if (!usingKeyboard.current) return;
                  event.currentTarget.setAttribute('data-keyboard', '');
                  hover(index);
                }}
                onBlur={(event) => {
                  event.currentTarget.removeAttribute('data-keyboard');
                  hover(-1);
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={() => select(selected === index ? -1 : index)}
              >
                <span className="kc-glyph" aria-hidden="true">
                  {icons[item.name]?.icon}
                </span>
                <span className="kc-ring" aria-hidden="true" />
                <span className="kc-name" aria-hidden="true">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <TechnologyInfo node={node} icon={node ? icons[node.name]?.icon : null} onPick={pick} />
      <TechnologyList nodes={data.nodes} onPick={pick} />
    </div>
  );
});
