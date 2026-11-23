import * as THREE from 'three';

const CELL = 112;
const PADDING = 8;
/** The beads stay cream in every theme, so icons that follow the text colour use charcoal. */
const INK = '#2b2620';

export interface IconAtlas {
  texture: THREE.CanvasTexture;
  /** For each icon: left, bottom, width and height in texture space. */
  cells: Map<string, [number, number, number, number]>;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load icon: ${src}`));
    image.src = src;
  });
}

/** Turns an icon already on the page into something a canvas can draw. */
function iconSource(glyph: Element) {
  const img = glyph.querySelector('img');
  if (img) return img.currentSrc || img.src;
  const svg = glyph.querySelector('svg');
  if (!svg) return null;
  const copy = svg.cloneNode(true) as SVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(CELL));
  copy.setAttribute('height', String(CELL));
  const color = (svg as SVGElement).style.color;
  copy.style.color = !color || color.includes('var(') ? INK : color;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copy.outerHTML)}`;
}

/**
 * Draws every technology's icon into one texture, reusing the icons the page
 * already renders, so the whole constellation needs no extra requests.
 */
export async function buildIconAtlas(root: HTMLElement, names: string[]): Promise<IconAtlas> {
  const columns = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * CELL;
  canvas.height = rows * CELL;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas available');

  const cells: IconAtlas['cells'] = new Map();
  await Promise.all(
    names.map(async (name, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      cells.set(name, [column / columns, 1 - (row + 1) / rows, 1 / columns, 1 / rows]);

      const glyph = root.querySelector(`[data-tech="${CSS.escape(name)}"] .kc-glyph`);
      const source = glyph && iconSource(glyph);
      if (!source) return;
      const image = await loadImage(source);
      const room = CELL - PADDING * 2;
      const ratio = (image.naturalWidth || 1) / (image.naturalHeight || 1);
      const width = ratio >= 1 ? room : room * ratio;
      const height = ratio >= 1 ? room / ratio : room;
      context.drawImage(
        image,
        column * CELL + (CELL - width) / 2,
        row * CELL + (CELL - height) / 2,
        width,
        height,
      );
    }),
  );

  const texture = new THREE.CanvasTexture(canvas);
  // The bead shader works directly in display colour, so no conversion is wanted.
  texture.colorSpace = THREE.NoColorSpace;
  texture.premultiplyAlpha = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return { texture, cells };
}
