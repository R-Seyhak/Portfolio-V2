import { PORTFOLIO } from '../../data.js';

export type CategoryId = 'frontend' | 'mobile' | 'backend' | 'data' | 'tools';
export type FilterId = CategoryId | 'all';
export type Tier = 'primary' | 'secondary' | 'supporting';

/** Names, counts and category assignments all come from `PORTFOLIO` in data.js. */
export const CATEGORY_LABELS = Object.fromEntries(
  PORTFOLIO.categories.map((category) => [category.id, category.label]),
) as Record<FilterId, string>;

export const CATEGORY_ORDER = PORTFOLIO.categories
  .map((category) => category.id)
  .filter((id): id is CategoryId => id !== 'all');

/**
 * Visual emphasis only, based on what the portfolio features most. This says
 * nothing about proficiency, and is never shown to visitors as a level.
 */
const PRIMARY = ['React', 'Flutter', 'Node.js', 'PostgreSQL', 'Unity'];
const SECONDARY = ['TypeScript', 'JavaScript', 'C#', 'HTML', 'CSS'];
const RADIUS: Record<Tier, number> = { primary: 0.335, secondary: 0.285, supporting: 0.23 };

const tierOf = (name: string): Tier =>
  PRIMARY.includes(name) ? 'primary' : SECONDARY.includes(name) ? 'secondary' : 'supporting';

/** Where each node sits: wide screens (x, y, depth) and phones (x, y). */
const PLACEMENT: Record<string, { at: [number, number, number]; phone: [number, number] }> = {
  HTML: { at: [-1.35, 0.01, 0.1], phone: [1.19, 2.26] },
  CSS: { at: [-2.36, -0.44, 0.4], phone: [1.94, 1.9] },
  JavaScript: { at: [-1.87, 0.99, 0.5], phone: [0.36, 2.4] },
  TypeScript: { at: [-2.51, 1.86, 0.6], phone: [-0.4, 2.02] },
  React: { at: [-3.06, 0.81, 0.95], phone: [-0.6, 2.87] },
  Angular: { at: [-1.6, 2.32, -0.2], phone: [-1.2, 2.11] },
  'Next.js': { at: [-3.95, 0.08, 0.1], phone: [-1.93, 2.37] },
  'Tailwind CSS': { at: [-3.31, -0.83, -0.3], phone: [1.61, 3] },

  Dart: { at: [3.7, -0.68, 0.05], phone: [0.71, -1.13] },
  Flutter: { at: [4.76, -0.52, 0.55], phone: [1.43, -1.55] },

  'Node.js': { at: [0.84, 0.95, 0.85], phone: [-0.15, 0.34] },
  Express: { at: [1.83, 0.34, 0.15], phone: [-0.17, -0.51] },
  NestJS: { at: [0.01, 1.64, 0.2], phone: [-0.75, 0.91] },
  Python: { at: [0.64, 2.39, -0.2], phone: [-1.51, 1.01] },
  Java: { at: [0.1, 0.16, -0.45], phone: [-1.31, 0.28] },
  'C++': { at: [0.94, -0.48, -0.15], phone: [-1.44, -0.44] },
  C: { at: [0, -0.83, -0.45], phone: [-1.03, -1.05] },

  MongoDB: { at: [3.14, 0.78, -0.3], phone: [1.51, -0.32] },
  PostgreSQL: { at: [2.49, 1.65, 0.8], phone: [0.87, 1.09] },
  MySQL: { at: [3.56, 1.71, -0.4], phone: [1.01, 0.27] },

  Unity: { at: [1.94, -1.85, 0.6], phone: [-1.72, -2.85] },
  'C#': { at: [0.78, -2.07, 0.35], phone: [-0.71, -2.84] },
  Git: { at: [-3.89, -2.15, -0.5], phone: [-1.25, -2.17] },
  Docker: { at: [-1.24, -1.51, -0.4], phone: [-0.42, -2.1] },
  Firebase: { at: [4.39, -1.93, -0.3], phone: [0.98, -2.73] },
  Cloudflare: { at: [-0.42, -2.08, -0.7], phone: [0.11, -2.89] },
  Vercel: { at: [-4.61, -1.5, -0.45], phone: [-1.99, -2.06] },
  Postman: { at: [3.08, -2.06, -0.6], phone: [0.33, -2.19] },
  Figma: { at: [-2.45, -2.08, -0.7], phone: [1.98, -2.59] },
};

/** Where each category's name sits, close to its group. */
const LABEL_AT: Record<'wide' | 'phone', Record<CategoryId, [number, number]>> = {
  wide: {
    frontend: [-3.75, 1.75],
    backend: [1.45, 2.42],
    data: [4.21, 1.82],
    mobile: [4.25, 0.02],
    tools: [-3.25, -1.55],
  },
  phone: {
    frontend: [0.68, 2.93],
    backend: [-1.32, -1.71],
    data: [1.53, 1.15],
    mobile: [1.58, -0.98],
    tools: [0.92, -3.43],
  },
};

// Says what each tool is for. Project names come from data.js, so nothing here
// states experience the portfolio doesn't already state.
const ABOUT: Record<string, string> = {
  HTML: 'The semantic structure underneath every page.',
  CSS: 'Layout, typography and motion in the browser.',
  JavaScript: 'The language behind interactive behaviour on the web.',
  TypeScript: 'Adds types to JavaScript so larger codebases stay dependable.',
  React: 'Used for building interactive and responsive user interfaces.',
  Angular: 'A structured TypeScript framework for large web applications.',
  'Next.js': 'A React framework for routing and production builds, and what this site runs on.',
  'Tailwind CSS': 'Utility classes for composing interfaces quickly.',
  'Node.js': 'JavaScript on the server, for APIs and backend services.',
  Express: 'A minimal Node.js framework for building APIs.',
  NestJS: 'A structured Node.js framework for modular backend services.',
  PostgreSQL: 'A relational database for dependable, structured data.',
  MongoDB: 'A document database for flexible data models.',
  MySQL: 'A widely used relational database.',
  Flutter: 'One codebase for polished mobile applications.',
  Dart: 'The language Flutter apps are written in.',
  Firebase: 'Managed backend services for mobile and web apps.',
  Unity: 'A game engine for building interactive 3D worlds.',
  'C#': 'The language behind gameplay scripting in Unity.',
  C: 'A low-level language close to the hardware.',
  'C++': 'A systems language with close control over performance.',
  Java: 'A strongly typed, object-oriented language.',
  Python: 'A general-purpose language for scripting and services.',
  Git: 'Version control for tracking and sharing code.',
  Vercel: 'A platform for deploying web apps.',
  Postman: 'Testing and exploring APIs during development.',
  Docker: 'Packages services into portable containers.',
  Cloudflare: 'DNS, edge delivery and security for the web.',
  Figma: 'Designing and prototyping interfaces before they are built.',
};

/** Kept sparse on purpose: each line is a relationship worth drawing. */
const LINKS: [string, string][] = [
  ['HTML', 'CSS'],
  ['HTML', 'JavaScript'],
  ['CSS', 'Tailwind CSS'],
  ['JavaScript', 'TypeScript'],
  ['JavaScript', 'React'],
  ['TypeScript', 'React'],
  ['React', 'Next.js'],
  ['TypeScript', 'Angular'],
  ['JavaScript', 'Node.js'],
  ['Node.js', 'Express'],
  ['Node.js', 'NestJS'],
  ['TypeScript', 'NestJS'],
  ['Express', 'MongoDB'],
  ['NestJS', 'PostgreSQL'],
  ['Node.js', 'PostgreSQL'],
  ['PostgreSQL', 'MySQL'],
  ['Dart', 'Flutter'],
  ['Flutter', 'Firebase'],
  ['Unity', 'C#'],
  ['C', 'C++'],
  ['C', 'C#'],
  ['C++', 'Java'],
  ['Python', 'NestJS'],
  ['Git', 'Vercel'],
  ['Vercel', 'Next.js'],
  ['Docker', 'NestJS'],
  ['Cloudflare', 'Docker'],
  ['Postman', 'Express'],
  ['Figma', 'CSS'],
];

export interface TechNode {
  name: string;
  category: CategoryId;
  tier: Tier;
  position: [number, number, number];
  about: string;
  related: string[];
  projects: string[];
}

export interface Constellation {
  nodes: TechNode[];
  /** Index pairs into `nodes`. */
  edges: [number, number][];
  /** Half the width and height the camera must keep in frame. */
  bounds: { x: number; y: number };
  labels: { id: CategoryId; x: number; y: number }[];
  /** The soft wash behind each group. */
  regions: { id: CategoryId; x: number; y: number; rx: number; ry: number }[];
}

const shortTitle = (title: string) => title.replace(' Human Resource Management System', ' HRM');

function projectsUsing(name: string) {
  return PORTFOLIO.projects
    .filter((project) => (project.tech as string[]).includes(name))
    .map((project) => shortTitle(project.title));
}

/** Stops short of the stage edge, so the soft wash always fades out before it. */
function regionFor(id: CategoryId, nodes: TechNode[], bounds: Constellation['bounds']) {
  const members = nodes.filter((node) => node.category === id);
  const xs = members.map((node) => node.position[0]);
  const ys = members.map((node) => node.position[1]);
  const left = Math.max(Math.min(...xs) - 1.05, -bounds.x);
  const right = Math.min(Math.max(...xs) + 1.05, bounds.x);
  const bottom = Math.max(Math.min(...ys) - 0.95, -bounds.y);
  const top = Math.min(Math.max(...ys) + 0.95, bounds.y);
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, rx: (right - left) / 2, ry: (top - bottom) / 2 };
}

function build(kind: 'wide' | 'phone', bounds: Constellation['bounds']): Constellation {
  const nodes = PORTFOLIO.skills.map((skill, index): TechNode => {
    const category = skill.cat as CategoryId;
    const placed = PLACEMENT[skill.name];
    // A technology added to data.js later still appears, near its category's name.
    const [labelX, labelY] = LABEL_AT[kind][category];
    const position: [number, number, number] = placed
      ? kind === 'wide'
        ? placed.at
        : [placed.phone[0], placed.phone[1], placed.at[2] * 0.5]
      : [labelX + Math.cos(index * 2.4) * 0.7, labelY + Math.sin(index * 2.4) * 0.7, 0];
    return {
      name: skill.name,
      category,
      tier: tierOf(skill.name),
      position,
      about: ABOUT[skill.name] ?? '',
      related: LINKS.flatMap(([a, b]) => (a === skill.name ? [b] : b === skill.name ? [a] : [])),
      projects: projectsUsing(skill.name),
    };
  });
  const index = new Map(nodes.map((node, position) => [node.name, position]));
  const edges = LINKS.flatMap(([a, b]) => {
    const from = index.get(a);
    const to = index.get(b);
    return from === undefined || to === undefined ? [] : [[from, to] as [number, number]];
  });
  return {
    nodes,
    edges,
    bounds,
    labels: CATEGORY_ORDER.map((id) => ({ id, x: LABEL_AT[kind][id][0], y: LABEL_AT[kind][id][1] })),
    regions: CATEGORY_ORDER.map((id) => regionFor(id, nodes, bounds)),
  };
}

// Wide enough that a node's soft shadow never reaches the edge of the stage.
export const WIDE = build('wide', { x: 5.42, y: 2.95 });
export const PHONE = build('phone', { x: 2.44, y: 3.62 });

export const CONSTELLATION_FOV = 24;

/** Radius of a node in world units, before perspective. */
export const nodeRadius = (node: TechNode, phone: boolean) => RADIUS[node.tier] * (phone ? 0.93 : 1);

/** Camera distance that keeps the whole constellation in frame at this aspect. */
export function cameraDistance(bounds: Constellation['bounds'], aspect: number) {
  const tan = Math.tan((CONSTELLATION_FOV * Math.PI) / 360);
  return Math.max(bounds.y / tan, bounds.x / (tan * aspect));
}

/** Where a node lands in the stage without any 3D. Used before WebGL and as its fallback. */
export function projectStatic(
  [x, y, z]: readonly [number, number, number],
  bounds: Constellation['bounds'],
  width: number,
  height: number,
) {
  const distance = cameraDistance(bounds, width / height);
  const tan = Math.tan((CONSTELLATION_FOV * Math.PI) / 360);
  const scale = height / (2 * tan * (distance - z));
  return { x: width / 2 + x * scale, y: height / 2 - y * scale, scale };
}
