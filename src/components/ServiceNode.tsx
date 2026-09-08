import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { CATALOG, SIZE_LABEL } from '../data/catalog';
import type { NodeRuntime, NodeSize, ServiceId } from '../types';
import { ServiceIcon } from './icons';

export type SvcData = {
  service: ServiceId;
  size: NodeSize;
  runtime: NodeRuntime;
  degraded: boolean;
  stalled?: boolean;
};

export type SvcNode = Node<SvcData, 'service'>;

function ServiceNodeInner({ data, selected }: NodeProps<SvcNode>) {
  const def = CATALOG[data.service];
  const util = Math.min(1.4, data.runtime.utilization);
  const pct = Math.min(100, util * 100);
  const cls = [
    'svc-node',
    selected ? 'selected' : '',
    data.runtime.status,
    data.degraded ? 'degraded' : '',
    data.stalled ? 'stalled' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const showPorts = def.ports;
  const isSourceOnly = data.service === 'internet';

  return (
    <div className={cls}>
      <i className="bar" style={{ background: def.color }} />
      {showPorts && !isSourceOnly && (
        <Handle type="target" position={Position.Left} className="handle-dot" />
      )}
      {showPorts && (
        <Handle type="source" position={Position.Right} className="handle-dot" />
      )}
      <div className="svc-hd" style={{ color: def.color }}>
        <ServiceIcon id={data.service} />
        <div>
          <b style={{ color: 'var(--text)' }}>{def.short}</b>
          <small>{def.aws}</small>
        </div>
        {def.upgradable && <span className="size-tag">{SIZE_LABEL[data.size]}</span>}
      </div>
      {data.service !== 'cloudwatch' && (
        <>
          <div className={`util ${data.runtime.status}`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="svc-meta">
            <span>{data.runtime.emaRps.toFixed(1)} rps</span>
            <span>
              {data.service === 'sqs'
                ? data.stalled
                  ? `q ${Math.round(data.runtime.queueDepth)} · no worker`
                  : `q ${Math.round(data.runtime.queueDepth)}`
                : data.service === 'cache' || data.service === 'cloudfront'
                  ? `${data.runtime.hits} hit`
                  : `${Math.round(pct)}%`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeInner);
