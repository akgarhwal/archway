import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from '@xyflow/react';
import type { PointerEvent } from 'react';
import { useGame } from '../store/gameStore';
import type { RequestKind } from '../types';

function controlOffset(distance: number, curvature = 0.25) {
  if (distance >= 0) return 0.5 * distance;
  return curvature * 25 * Math.sqrt(-distance);
}

/** Same control-point rule React Flow uses in getBezierPath. */
function control(pos: Position, x1: number, y1: number, x2: number, y2: number): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - controlOffset(x1 - x2), y1];
    case Position.Right:
      return [x1 + controlOffset(x2 - x1), y1];
    case Position.Top:
      return [x1, y1 - controlOffset(y1 - y2)];
    case Position.Bottom:
      return [x1, y1 + controlOffset(y2 - y1)];
    default:
      return [x1, y1];
  }
}

function pointOnWire(
  t: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
) {
  const [c1x, c1y] = control(sourcePosition, sourceX, sourceY, targetX, targetY);
  const [c2x, c2y] = control(targetPosition, targetX, targetY, sourceX, sourceY);
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * u * sourceX + 3 * uu * t * c1x + 3 * u * tt * c2x + tt * t * targetX,
    y: uu * u * sourceY + 3 * uu * t * c1y + 3 * u * tt * c2y + tt * t * targetY,
  };
}

export function WireEdge({
  id,
  source,
  target,
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
  const packets = useGame((s) => s.packets);
  const stroke = selected ? '#f5a524' : '#4c627a';
  const onWire = packets.filter((p) => p.path[p.hop] === source && p.path[p.hop + 1] === target);

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
        {onWire.map((p) => {
          const pt = pointOnWire(
            Math.min(1, Math.max(0, p.t)),
            sourceX,
            sourceY,
            targetX,
            targetY,
            sourcePosition,
            targetPosition,
          );
          return (
            <i
              key={p.id}
              className={`pkt pkt-on-wire pkt-${p.kind as RequestKind} nodrag nopan nowheel`}
              style={{
                transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px)`,
              }}
            />
          );
        })}
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
