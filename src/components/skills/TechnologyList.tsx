'use client';

import { memo } from 'react';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './constellation.data';
import type { TechNode } from './constellation.data';

/**
 * Every technology as plain text, closed by default. It is the non-3D way to
 * browse the stack, and choosing a name opens the same note as the node does.
 */
export const TechnologyList = memo(function TechnologyList({
  nodes,
  onPick,
}: {
  nodes: TechNode[];
  onPick: (name: string) => void;
}) {
  return (
    <details className="kc-list">
      <summary>View all {nodes.length} as a list</summary>
      <div className="kc-list-body">
        {CATEGORY_ORDER.map((id) => {
          const items = nodes.filter((node) => node.category === id);
          const headingId = `kc-list-${id}`;
          return (
            <div key={id}>
              <p id={headingId} className="kc-list-title">
                {CATEGORY_LABELS[id]} <span>{items.length}</span>
              </p>
              <ul aria-labelledby={headingId}>
                {items.map((node) => (
                  <li key={node.name}>
                    <button type="button" onClick={() => onPick(node.name)}>
                      {node.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
});
