'use client';

import type { ReactNode } from 'react';
import { CATEGORY_LABELS } from './constellation.data';
import type { TechNode } from './constellation.data';

/** The note under the constellation. Its height is reserved, so the page never jumps. */
export function TechnologyInfo({
  node,
  icon,
  onPick,
}: {
  node: TechNode | null;
  icon: ReactNode;
  onPick: (name: string) => void;
}) {
  return (
    <div className="kc-info" aria-live="polite">
      {node ? (
        <div key={node.name} className="kc-info-body">
          <div className="kc-info-head">
            <span className="kc-info-logo" aria-hidden="true">
              {icon}
            </span>
            <div>
              <p className="kc-info-group">{CATEGORY_LABELS[node.category]}</p>
              <h3 className="kc-info-name">{node.name}</h3>
            </div>
          </div>
          <div className="kc-info-copy">
            <p className="kc-info-text">{node.about}</p>
            {node.related.length > 0 && (
              <p className="kc-info-meta">
                <span>Related</span>
                {node.related.map((name, index) => (
                  <span key={name} className="kc-info-item">
                    {index > 0 && <i aria-hidden="true">·</i>}
                    <button type="button" onClick={() => onPick(name)}>
                      {name}
                    </button>
                  </span>
                ))}
              </p>
            )}
            {node.projects.length > 0 && (
              <p className="kc-info-meta">
                <span>Seen in</span>
                {node.projects.join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="kc-info-hint">Select a technology to see how it connects.</p>
      )}
    </div>
  );
}
