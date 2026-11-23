import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface GltfNode {
  name?: string;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

/**
 * A second, independently posed figure from the loaded model. Geometry,
 * materials and textures stay shared, so it adds no download and almost no GPU
 * memory. The source may already be mid-animation, so every bone goes back to
 * the rest pose stored in the file, and the expressions go back to neutral.
 */
export function cloneAvatarScene(source: THREE.Object3D, nodes: GltfNode[]) {
  const copy = cloneSkinned(source);

  // The glasses arms are added at runtime, and each figure adds its own.
  copy.getObjectByName('GlassesArms')?.removeFromParent();

  const rest = new Map(nodes.filter((node) => node.name).map((node) => [node.name, node]));
  copy.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.morphTargetInfluences?.fill(0);
    if (!(object as THREE.Bone).isBone) return;
    const node = rest.get(object.name);
    if (!node) return;
    object.position.fromArray(node.translation ?? [0, 0, 0]);
    object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1]);
    object.scale.fromArray(node.scale ?? [1, 1, 1]);
  });
  return copy;
}
