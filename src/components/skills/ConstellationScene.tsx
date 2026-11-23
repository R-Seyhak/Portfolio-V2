'use client';

import * as THREE from 'three';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SceneView } from '../three/SceneView';
import { CONSTELLATION_FOV, cameraDistance, nodeRadius } from './constellation.data';
import type { Constellation, FilterId, Tier } from './constellation.data';
import { buildIconAtlas } from './iconAtlas';
import type { IconAtlas } from './iconAtlas';

/** Written by the DOM layer, read here every frame, so hovering never re-renders React. */
export interface ConstellationInput {
  hovered: number;
  selected: number;
  pointerX: number;
  pointerY: number;
  /** The cursor inside the stage, in pixels. Null when it's elsewhere or on touch. */
  pointer: { x: number; y: number } | null;
  /** Which nodes the current filter includes. Null means all of them. */
  mask: boolean[] | null;
  category: FilterId;
  /** Where each node is on screen, relative to the stage. Used for arrow-key moves. */
  screen: { x: number; y: number }[];
  /** When the visitor last did anything here, from performance.now(). */
  lastActivity: number;
}

const MOTION = {
  introSec: 1.5,
  floatAmount: 0.05,
  floatDepth: 0.09,
  driftYaw: 0.03,
  parallaxYaw: 0.075,
  parallaxPitch: 0.045,
  pointerSpeed: 2.4,
  focusSpeed: 6.5,
  /** How far the focused node comes toward the camera. */
  push: 0.5,
  /** How far a filter brings its nodes forward, and sends the others back. */
  filterDepth: 0.17,
  focusScale: 1.2,
  relatedScale: 1.07,
  filterScale: 1.04,
  dimOpacity: 0.34,
  /** The hovered node leans toward the cursor by this share, up to the limit. */
  magnet: 0.2,
  magnetMax: 0.09,
  magnetSpeed: 9,
  /** How long a line takes to draw itself to a related technology. */
  traceSec: 0.42,
  /** The occasional connection that lights up while nobody is interacting. */
  idleAfterSec: 4,
  idleGapMin: 5.5,
  idleGapMax: 9.5,
  idleDraw: 0.9,
  idleHold: 0.5,
  idleFade: 0.9,
  idleStrength: 0.6,
} as const;

const LINE = { rest: 0.34, inFilter: 0.68, touchingFilter: 0.22, quiet: 0.07, filterTint: 0.55 } as const;
const REGION = { rest: 0.024, active: 0.066, other: 0.008, speed: 4 } as const;
const BRAND: Record<Tier, number> = { primary: 0.86, secondary: 0.72, supporting: 0.52 };
const REST_OPACITY: Record<Tier, number> = { primary: 1, secondary: 0.98, supporting: 0.9 };

/** The quad is larger than the bead so the soft shadow and selection ring fit on it. */
const BEAD_QUAD = 1.46;

const beadVertex = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aCell;
  attribute vec4 aLook; // radius, opacity, colour amount, ring
  varying vec2 vPoint;
  varying vec4 vCell;
  varying vec4 vLook;
  void main() {
    vPoint = position.xy * ${BEAD_QUAD.toFixed(2)};
    vCell = aCell;
    vLook = aLook;
    vec4 view = viewMatrix * vec4(aCenter, 1.0);
    view.xy += vPoint * aLook.x;
    gl_Position = projectionMatrix * view;
  }
`;

// A sphere drawn on one quad: it stays perfectly round at any size, in one draw call.
const beadFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform vec3 uBead;
  uniform vec3 uShade;
  uniform vec3 uEdge;
  uniform vec3 uRing;
  uniform float uShadow;
  varying vec2 vPoint;
  varying vec4 vCell;
  varying vec4 vLook;
  void main() {
    float r = length(vPoint);
    float edge = fwidth(r);

    // A soft shadow, falling just below the bead.
    float fall = length((vPoint - vec2(0.05, -0.24)) / vec2(1.02, 0.96));
    float shadow = (1.0 - smoothstep(0.62, 1.38, fall)) * uShadow * vLook.y;
    vec4 result = vec4(vec3(0.0), shadow);

    if (vLook.w > 0.002) {
      float ring = (1.0 - smoothstep(edge * 0.75, edge * 1.6, abs(r - 1.17))) * vLook.w;
      result = vec4(uRing * ring, ring) + result * (1.0 - ring);
    }

    float alpha = 1.0 - smoothstep(1.0 - edge * 1.5, 1.0, r);
    if (alpha > 0.0) {
      vec3 normal = vec3(vPoint, sqrt(max(0.0, 1.0 - r * r)));
      vec3 light = normalize(vec3(-0.5, 0.75, 0.62));
      float wrap = dot(normal, light) * 0.5 + 0.5;
      vec3 color = mix(uShade, uBead, smoothstep(0.16, 0.86, wrap));
      float sheen = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 34.0);
      color += sheen * 0.13;
      color = mix(color, uEdge, smoothstep(0.74, 1.0, r) * 0.55);

      vec2 icon = vPoint / 0.64;
      if (max(abs(icon.x), abs(icon.y)) < 1.0) {
        vec4 logo = texture2D(uAtlas, vCell.xy + (icon * 0.5 + 0.5) * vCell.zw);
        float grey = dot(logo.rgb, vec3(0.3, 0.59, 0.11));
        vec3 tinted = mix(vec3(grey) * vec3(0.84, 0.86, 0.92), logo.rgb, vLook.z);
        color = color * (1.0 - logo.a) + tinted;
      }
      float opacity = alpha * vLook.y;
      result = vec4(color * opacity, opacity) + result * (1.0 - opacity);
    }
    if (result.a <= 0.002) discard;
    gl_FragColor = result;
  }
`;

const lineVertex = /* glsl */ `
  attribute vec4 aState; // resting opacity, accent tint, lit amount, how far it has drawn
  attribute float aAlong;
  varying vec4 vState;
  varying float vAlong;
  void main() {
    vState = aState;
    vAlong = aAlong;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const lineFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uLine;
  uniform vec3 uHot;
  varying vec4 vState;
  varying float vAlong;
  void main() {
    float front = vState.w * 1.06;
    float lit = vState.z * (1.0 - smoothstep(front - 0.06, front, vAlong));
    vec3 color = mix(mix(uLine, uHot, vState.y), uHot, lit);
    float alpha = mix(vState.x, 0.92, lit);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const regionVertex = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aShape; // half width, half height, opacity
  varying vec2 vPoint;
  varying float vAlpha;
  void main() {
    vPoint = position.xy;
    vAlpha = aShape.z;
    vec4 view = viewMatrix * vec4(aCenter, 1.0);
    view.xy += position.xy * aShape.xy;
    gl_Position = projectionMatrix * view;
  }
`;

// Very low opacity bands visibly without a touch of noise.
const regionFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uTint;
  varying vec2 vPoint;
  varying float vAlpha;
  void main() {
    float falloff = 1.0 - smoothstep(0.08, 1.0, length(vPoint));
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float alpha = max(falloff * falloff * vAlpha + (noise - 0.5) / 255.0, 0.0);
    gl_FragColor = vec4(uTint * alpha, alpha);
  }
`;

/** Resolves a CSS colour (oklch included) to display-space RGB through a 1px canvas. */
function readColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return new THREE.Vector3(0.5, 0.5, 0.5);
  context.fillStyle = fallback;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return new THREE.Vector3(r / 255, g / 255, b / 255);
}

interface NodeSim {
  focus: number;
  related: number;
  dim: number;
  lift: number;
  ring: number;
  magnetX: number;
  magnetY: number;
  phase: number;
  speed: number;
  swayX: number;
  swayY: number;
  x: number;
  y: number;
  z: number;
}

interface EdgeSim {
  rest: number;
  tint: number;
  lit: number;
  drawn: number;
  /** True when the line draws from its first node toward its second. */
  forward: boolean;
}

const smooth = (from: number, to: number, value: number) => THREE.MathUtils.smoothstep(value, from, to);
const damp = THREE.MathUtils.damp;

function dynamicAttribute(values: number, size: number, instanced = false) {
  const array = new Float32Array(values * size);
  const attribute = instanced
    ? new THREE.InstancedBufferAttribute(array, size)
    : new THREE.BufferAttribute(array, size);
  return attribute.setUsage(THREE.DynamicDrawUsage);
}

function blendedMaterial(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function Stars({
  data,
  phone,
  input,
  stage,
  buttons,
  groupLabels,
  active,
  reducedMotion,
  onReady,
  onError,
}: ConstellationSceneProps) {
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const [camera] = useState(() => new THREE.PerspectiveCamera(CONSTELLATION_FOV, 1, 0.1, 80));
  const [atlas, setAtlas] = useState<IconAtlas | null>(null);

  useLayoutEffect(() => {
    const previous = get().camera;
    set({ camera });
    return () => set({ camera: previous });
  }, [camera, get, set]);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let alive = true;
    let built: IconAtlas | null = null;
    buildIconAtlas(root, data.nodes.map((node) => node.name))
      .then((result) => {
        built = result;
        if (alive) setAtlas(result);
        else result.texture.dispose();
      })
      .catch(() => {
        if (alive) onError();
      });
    return () => {
      alive = false;
      built?.texture.dispose();
    };
  }, [data, stage, onError]);

  const scene = useMemo(() => {
    if (!atlas) return null;
    const count = data.nodes.length;
    const quad = new THREE.PlaneGeometry(2, 2);

    const beads = new THREE.InstancedBufferGeometry();
    beads.index = quad.index;
    beads.setAttribute('position', quad.getAttribute('position'));
    beads.instanceCount = count;
    const center = dynamicAttribute(count, 3, true);
    const cell = dynamicAttribute(count, 4, true);
    const look = dynamicAttribute(count, 4, true);
    beads.setAttribute('aCenter', center);
    beads.setAttribute('aCell', cell);
    beads.setAttribute('aLook', look);
    const beadMaterial = blendedMaterial(beadVertex, beadFragment, {
      uAtlas: { value: atlas.texture },
      uBead: { value: new THREE.Vector3() },
      uShade: { value: new THREE.Vector3() },
      uEdge: { value: new THREE.Vector3() },
      uRing: { value: new THREE.Vector3() },
      uShadow: { value: 0.16 },
    });

    const vertices = data.edges.length * 2;
    const lines = new THREE.BufferGeometry();
    const linePosition = dynamicAttribute(vertices, 3);
    const lineState = dynamicAttribute(vertices, 4);
    const lineAlong = dynamicAttribute(vertices, 1);
    lines.setAttribute('position', linePosition);
    lines.setAttribute('aState', lineState);
    lines.setAttribute('aAlong', lineAlong);
    const lineMaterial = blendedMaterial(lineVertex, lineFragment, {
      uLine: { value: new THREE.Vector3() },
      uHot: { value: new THREE.Vector3() },
    });

    const regions = new THREE.InstancedBufferGeometry();
    regions.index = quad.index;
    regions.setAttribute('position', quad.getAttribute('position'));
    regions.instanceCount = data.regions.length;
    const regionCenter = dynamicAttribute(data.regions.length, 3, true);
    const regionShape = dynamicAttribute(data.regions.length, 3, true);
    regions.setAttribute('aCenter', regionCenter);
    regions.setAttribute('aShape', regionShape);
    const regionMaterial = blendedMaterial(regionVertex, regionFragment, {
      uTint: { value: new THREE.Vector3() },
    });

    const regionMesh = new THREE.Mesh(regions, regionMaterial);
    regionMesh.frustumCulled = false;
    regionMesh.renderOrder = 0;
    const lineMesh = new THREE.LineSegments(lines, lineMaterial);
    lineMesh.frustumCulled = false;
    lineMesh.renderOrder = 1;
    const beadMesh = new THREE.Mesh(beads, beadMaterial);
    beadMesh.frustumCulled = false;
    beadMesh.renderOrder = 2;

    return {
      quad,
      beads,
      center,
      cell,
      look,
      beadMaterial,
      lines,
      linePosition,
      lineState,
      lineAlong,
      lineMaterial,
      regions,
      regionCenter,
      regionShape,
      regionMaterial,
      regionMesh,
      lineMesh,
      beadMesh,
    };
  }, [atlas, data]);

  useEffect(() => {
    if (!scene) return;
    return () => {
      scene.quad.dispose();
      scene.beads.dispose();
      scene.beadMaterial.dispose();
      scene.lines.dispose();
      scene.lineMaterial.dispose();
      scene.regions.dispose();
      scene.regionMaterial.dispose();
    };
  }, [scene]);

  // Follow the site's theme.
  useEffect(() => {
    if (!scene) return;
    const apply = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const bead = scene.beadMaterial.uniforms;
      bead.uBead.value.set(...(dark ? [0.9, 0.88, 0.83] : [0.995, 0.98, 0.95]));
      bead.uShade.value.set(...(dark ? [0.56, 0.55, 0.53] : [0.86, 0.825, 0.76]));
      bead.uEdge.value.set(...(dark ? [0.42, 0.41, 0.4] : [0.74, 0.7, 0.63]));
      bead.uShadow.value = dark ? 0.34 : 0.16;
      const accent = readColor('--c-accent', '#2f7fd8');
      bead.uRing.value.copy(accent);
      scene.lineMaterial.uniforms.uLine.value.copy(readColor('--c-ink-3', '#8a8478'));
      scene.lineMaterial.uniforms.uHot.value.copy(accent);
      scene.regionMaterial.uniforms.uTint.value.copy(accent);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [scene]);

  const neighbours = useMemo(() => {
    const list: Set<number>[] = data.nodes.map(() => new Set<number>());
    for (const [a, b] of data.edges) {
      list[a].add(b);
      list[b].add(a);
    }
    return list;
  }, [data]);

  // Every node gets its own speed and direction, so they never move in step.
  const sim = useMemo<NodeSim[]>(
    () =>
      data.nodes.map((node, index) => {
        const spread = (index * 0.618034) % 1;
        const turn = spread * Math.PI * 2;
        return {
          focus: 0,
          related: 0,
          dim: 0,
          lift: 0,
          ring: 0,
          magnetX: 0,
          magnetY: 0,
          phase: index * 2.399,
          speed: 0.19 + spread * 0.17,
          swayX: 0.7 + 0.3 * Math.cos(turn),
          swayY: 0.7 + 0.3 * Math.sin(turn),
          x: node.position[0],
          y: node.position[1],
          z: node.position[2],
        };
      }),
    [data],
  );
  const edgeSim = useMemo<EdgeSim[]>(
    () => data.edges.map(() => ({ rest: LINE.rest, tint: 0, lit: 0, drawn: 0, forward: true })),
    [data],
  );
  const regionAlpha = useMemo(() => data.regions.map((): number => REGION.rest), [data]);

  const frame = useRef({
    time: 0,
    intro: 0,
    px: 0,
    py: 0,
    width: 0,
    height: 0,
    drawn: 0,
    told: false,
    idleEdge: -1,
    idleT: 0,
    idleNext: MOTION.idleGapMin as number,
  });
  const order = useMemo(() => data.nodes.map((_, index) => index), [data]);
  const tools = useMemo(
    () => ({ rotation: new THREE.Quaternion(), euler: new THREE.Euler(0, 0, 0, 'YXZ'), point: new THREE.Vector3() }),
    [],
  );
  const lastTransforms = useRef<string[]>([]);
  const lastLabels = useRef<string[]>([]);

  useFrame((_, rawDelta) => {
    const root = stage.current;
    if (!scene || !active || !root) return;
    const delta = Math.min(rawDelta, 1 / 20);
    const state = frame.current;
    const shared = input.current;
    state.time += delta;
    state.intro = reducedMotion ? MOTION.introSec + 1 : state.intro + delta;
    // With reduced motion, states still change, but at once and without travel.
    const ease = reducedMotion ? 40 : MOTION.focusSpeed;

    const width = root.clientWidth;
    const height = root.clientHeight;
    if (width !== state.width || height !== state.height) {
      state.width = width;
      state.height = height;
      camera.aspect = width / Math.max(height, 1);
      camera.position.set(0, 0, cameraDistance(data.bounds, camera.aspect));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    const unitPx = height / (2 * Math.tan(THREE.MathUtils.degToRad(CONSTELLATION_FOV / 2)) * camera.position.z);

    // A slow drift and a gentle parallax: the scene never spins.
    const follow = reducedMotion ? 0 : 1;
    state.px = damp(state.px, shared.pointerX * follow, MOTION.pointerSpeed, delta);
    state.py = damp(state.py, shared.pointerY * follow, MOTION.pointerSpeed, delta);
    const drift = reducedMotion ? 0 : Math.sin(state.time * 0.13) * MOTION.driftYaw;
    tools.euler.set(-state.py * MOTION.parallaxPitch, state.px * MOTION.parallaxYaw + drift, 0);
    tools.rotation.setFromEuler(tools.euler);

    const focus = shared.hovered >= 0 ? shared.hovered : shared.selected;
    const links = focus >= 0 ? neighbours[focus] : null;
    const { mask, pointer } = shared;

    data.nodes.forEach((node, index) => {
      const item = sim[index];
      const isFocus = index === focus;
      const isRelated = Boolean(links?.has(index));
      const inFilter = !mask || mask[index];
      const quiet = focus >= 0 ? !isFocus && !isRelated : !inFilter;
      item.focus = damp(item.focus, isFocus ? 1 : 0, ease, delta);
      item.related = damp(item.related, isRelated ? 1 : 0, ease, delta);
      item.dim = damp(item.dim, quiet ? 1 : 0, ease, delta);
      item.lift = damp(item.lift, mask ? (inFilter ? 1 : -1) : 0, ease, delta);
      item.ring = damp(item.ring, index === shared.selected ? 1 : 0, ease * 1.4, delta);

      let magnetX = 0;
      let magnetY = 0;
      if (index === shared.hovered && pointer && !reducedMotion) {
        const spot = shared.screen[index];
        if (spot) {
          const limit = MOTION.magnetMax;
          magnetX = THREE.MathUtils.clamp(((pointer.x - spot.x) / unitPx) * MOTION.magnet, -limit, limit);
          magnetY = THREE.MathUtils.clamp(((spot.y - pointer.y) / unitPx) * MOTION.magnet, -limit, limit);
        }
      }
      item.magnetX = damp(item.magnetX, magnetX, MOTION.magnetSpeed, delta);
      item.magnetY = damp(item.magnetY, magnetY, MOTION.magnetSpeed, delta);

      const calm = reducedMotion ? 0 : (phone ? 0.6 : 1) * (1 - item.focus);
      const t = state.time * item.speed + item.phase;
      const depthShift = reducedMotion ? 0 : item.focus * MOTION.push + item.lift * MOTION.filterDepth;
      tools.point.set(
        node.position[0] + Math.sin(t) * MOTION.floatAmount * item.swayX * calm + item.magnetX,
        node.position[1] + Math.cos(t * 0.83) * MOTION.floatAmount * item.swayY * calm + item.magnetY,
        node.position[2] + Math.sin(t * 0.61) * MOTION.floatDepth * calm + depthShift,
      );
      tools.point.applyQuaternion(tools.rotation);
      item.x = tools.point.x;
      item.y = tools.point.y;
      item.z = tools.point.z;
    });

    // Back to front, because the beads blend at their edges.
    order.sort((a, b) => sim[a].z - sim[b].z);

    const stagger = reducedMotion ? 0 : 0.028;
    order.forEach((index, slot) => {
      const node = data.nodes[index];
      const item = sim[index];
      const appear = smooth(index * stagger, index * stagger + 0.8, state.intro);
      const eased = 1 - (1 - appear) ** 3;
      const inFilter = Math.max(item.lift, 0);
      const scale =
        1 +
        item.focus * (MOTION.focusScale - 1) +
        item.related * (MOTION.relatedScale - 1) +
        inFilter * (1 - item.focus) * (MOTION.filterScale - 1);
      // Nodes further back sit a little deeper in the paper.
      const depthFade = THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(item.z, -1, 1), -1, 1, 0.8, 1);
      const presence = Math.max(REST_OPACITY[node.tier] * depthFade, item.focus, item.related, inFilter);
      const opacity = eased * presence * (1 - item.dim * (1 - MOTION.dimOpacity));
      const brand = BRAND[node.tier] + Math.max(item.focus * 0.4, item.related * 0.26, inFilter * 0.3);

      scene.center.setXYZ(slot, item.x, item.y, item.z);
      const cell = atlas!.cells.get(node.name)!;
      scene.cell.setXYZW(slot, cell[0], cell[1], cell[2], cell[3]);
      scene.look.setXYZW(
        slot,
        nodeRadius(node, phone) * scale * (0.82 + eased * 0.18),
        opacity,
        Math.min(brand, 1),
        item.ring * eased,
      );
    });
    scene.center.needsUpdate = true;
    scene.cell.needsUpdate = true;
    scene.look.needsUpdate = true;

    // Now and then, while nobody is interacting, one connection lights up and fades.
    const idleAllowed =
      !reducedMotion && !phone && focus < 0 && !mask &&
      performance.now() - shared.lastActivity > MOTION.idleAfterSec * 1000;
    if (state.idleEdge >= 0) {
      state.idleT += delta;
      if (!idleAllowed || state.idleT > MOTION.idleDraw + MOTION.idleHold + MOTION.idleFade) state.idleEdge = -1;
    } else if (idleAllowed) {
      state.idleNext -= delta;
      if (state.idleNext <= 0) {
        state.idleEdge = Math.floor(Math.random() * data.edges.length);
        state.idleT = 0;
        state.idleNext = MOTION.idleGapMin + Math.random() * (MOTION.idleGapMax - MOTION.idleGapMin);
        const edge = edgeSim[state.idleEdge];
        edge.forward = Math.random() < 0.5;
        edge.drawn = 0;
      }
    }

    const lineIn = smooth(0.5, MOTION.introSec, state.intro);
    data.edges.forEach(([a, b], index) => {
      const from = sim[a];
      const to = sim[b];
      const edge = edgeSim[index];
      const touches = a === focus || b === focus;
      const aIn = !mask || mask[a];
      const bIn = !mask || mask[b];

      let rest: number = LINE.rest;
      let tint = 0;
      if (mask) {
        rest = aIn && bIn ? LINE.inFilter : aIn || bIn ? LINE.touchingFilter : LINE.quiet;
        tint = aIn && bIn ? LINE.filterTint : 0;
      }
      if (focus >= 0 && !touches) {
        rest = LINE.quiet;
        tint = 0;
      }
      edge.rest = damp(edge.rest, rest, ease, delta);
      edge.tint = damp(edge.tint, tint, ease, delta);

      if (touches) {
        // A new highlight draws outward from the focused node.
        if (edge.lit < 0.02) {
          edge.forward = a === focus;
          edge.drawn = 0;
        }
        edge.drawn = reducedMotion ? 1 : Math.min(1, edge.drawn + delta / MOTION.traceSec);
        edge.lit = damp(edge.lit, 1, ease * 1.6, delta);
      } else if (index === state.idleEdge) {
        const t = state.idleT;
        edge.drawn = Math.min(1, t / MOTION.idleDraw);
        const fade = 1 - smooth(MOTION.idleDraw + MOTION.idleHold, MOTION.idleDraw + MOTION.idleHold + MOTION.idleFade, t);
        edge.lit = MOTION.idleStrength * fade;
      } else {
        edge.lit = damp(edge.lit, 0, ease, delta);
      }

      const first = index * 2;
      const second = first + 1;
      scene.linePosition.setXYZ(first, from.x, from.y, from.z);
      scene.linePosition.setXYZ(second, to.x, to.y, to.z);
      const alpha = edge.rest * lineIn;
      scene.lineState.setXYZW(first, alpha, edge.tint, edge.lit * lineIn, edge.drawn);
      scene.lineState.setXYZW(second, alpha, edge.tint, edge.lit * lineIn, edge.drawn);
      scene.lineAlong.setX(first, edge.forward ? 0 : 1);
      scene.lineAlong.setX(second, edge.forward ? 1 : 0);
    });
    scene.linePosition.needsUpdate = true;
    scene.lineState.needsUpdate = true;
    scene.lineAlong.needsUpdate = true;

    // The soft wash behind each group, stronger behind the one being explored.
    data.regions.forEach((region, index) => {
      const goal =
        shared.category === 'all' ? REGION.rest : shared.category === region.id ? REGION.active : REGION.other;
      regionAlpha[index] = reducedMotion ? goal : damp(regionAlpha[index], goal, REGION.speed, delta);
      tools.point.set(region.x, region.y, -1.1).applyQuaternion(tools.rotation);
      scene.regionCenter.setXYZ(index, tools.point.x, tools.point.y, tools.point.z);
      scene.regionShape.setXYZ(index, region.rx, region.ry, regionAlpha[index] * lineIn);
    });
    scene.regionCenter.needsUpdate = true;
    scene.regionShape.needsUpdate = true;

    // Keep the real buttons exactly over their beads.
    data.nodes.forEach((_node, index) => {
      const item = sim[index];
      tools.point.set(item.x, item.y, item.z).project(camera);
      const x = (tools.point.x + 1) * 0.5 * width;
      const y = (1 - tools.point.y) * 0.5 * height;
      const spot = shared.screen[index] ?? (shared.screen[index] = { x, y });
      spot.x = x;
      spot.y = y;
      const button = buttons.current[index];
      if (!button) return;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (lastTransforms.current[index] !== transform) {
        button.style.transform = transform;
        lastTransforms.current[index] = transform;
      }
    });

    // The category names drift with their groups.
    data.labels.forEach((label, index) => {
      const element = groupLabels.current[index];
      if (!element) return;
      tools.point.set(label.x, label.y, 0).applyQuaternion(tools.rotation).project(camera);
      const x = (tools.point.x + 1) * 0.5 * width;
      const y = (1 - tools.point.y) * 0.5 * height;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (lastLabels.current[index] !== transform) {
        element.style.transform = transform;
        lastLabels.current[index] = transform;
      }
    });

    state.drawn += 1;
    if (!state.told && state.drawn >= 2) {
      state.told = true;
      onReady();
    }
  });

  if (!scene) return null;
  return (
    <>
      <primitive object={scene.regionMesh} />
      <primitive object={scene.lineMesh} />
      <primitive object={scene.beadMesh} />
    </>
  );
}

export interface ConstellationSceneProps {
  data: Constellation;
  phone: boolean;
  input: MutableRefObject<ConstellationInput>;
  stage: RefObject<HTMLElement>;
  buttons: MutableRefObject<(HTMLElement | null)[]>;
  groupLabels: MutableRefObject<(HTMLElement | null)[]>;
  active: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

export default memo(function ConstellationScene(props: ConstellationSceneProps) {
  return (
    <SceneView id="skills-constellation" className="kc-view" active={props.active} onError={props.onError}>
      <Stars key={props.phone ? 'phone' : 'wide'} {...props} />
    </SceneView>
  );
});
