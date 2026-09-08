import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { PointerEvent } from 'react';
import { useGame } from '../store/gameStore';

export function WireEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const disconnect = useGame((s) => s.disconnect);
  const stroke = selected ? '#f5a524' : '#4c627a';

  const cut = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    disconnect(id);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke, strokeWidth: selected ? 2.8 : 2 }}
        interactionWidth={24}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`wire-x nodrag nopan nowheel ${selected ? 'show' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          title="Remove connection"
          aria-label="Remove connection"
          onPointerDown={cut}
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
