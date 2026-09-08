import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { CATALOG } from '../data/catalog';
import { useGame } from '../store/gameStore';
import type { RequestKind, ServiceId } from '../types';
import { ServiceNode, type SvcNode } from './ServiceNode';
import { WireEdge } from './WireEdge';
import '@xyflow/react/dist/style.css';

const nodeTypes = { service: ServiceNode };
const edgeTypes = { wire: WireEdge };

function bezier(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - 28;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * mx + t * t * b.x,
    y: u * u * a.y + 2 * u * t * my + t * t * b.y,
  };
}

function PacketLayer() {
  const packets = useGame((s) => s.packets);
  const nodes = useGame((s) => s.nodes);
  const { x, y, zoom } = useViewport();
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) pos[n.id] = { x: n.x + 84, y: n.y + 36 };

  return (
    <div
      className="packets"
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}
    >
      {packets.map((p) => {
        const a = pos[p.path[p.hop]];
        const b = pos[p.path[p.hop + 1]] ?? a;
        if (!a) return null;
        const pt = bezier(a, b, Math.min(1, p.t));
        return <i key={p.id} className={`pkt pkt-${p.kind as RequestKind}`} style={{ left: pt.x, top: pt.y }} />;
      })}
    </div>
  );
}

export function LiveGate() {
  const mode = useGame((s) => s.mode);
  const started = useGame((s) => s.liveStarted);
  const money = useGame((s) => s.money);
  const goLive = useGame((s) => s.goLive);
  if (mode !== 'live' || started) return null;
  return (
    <div
      className="live-gate"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="live-gate-copy">
        <span className="kicker">Staging</span>
        <strong>The wire is closed.</strong>
        <p>
          Build the path first. Grant is {money.toFixed(0)} — ten EC2s is the trap. Edge before
          origin. Two targets. Cache the reads. Queue the writes. You cannot pause after this.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goLive();
        }}
      >
        Go live
      </button>
    </div>
  );
}

function EventBanner() {
  const event = useGame((s) => s.event);
  const toast = useGame((s) => s.toasts[0]);
  if (event) {
    const hot = event.type === 'ddos' || event.type === 'poison';
    return (
      <div className={`event-banner ${hot ? 'bad' : 'warn'}`}>
        <strong>Now · {event.title}</strong>
        <span>{event.detail}</span>
        <em className="mono">{Math.ceil(event.remaining)}s left</em>
      </div>
    );
  }
  if (!toast) return null;
  return (
    <div className={`event-banner ${toast.tone}`}>
      <strong>{toast.text}</strong>
    </div>
  );
}

function FlowInner() {
  const nodes = useGame((s) => s.nodes);
  const edges = useGame((s) => s.edges);
  const runtime = useGame((s) => s.runtime);
  const selectedId = useGame((s) => s.selectedId);
  const placing = useGame((s) => s.placing);
  const event = useGame((s) => s.event);
  const connect = useGame((s) => s.connect);
  const disconnect = useGame((s) => s.disconnect);
  const select = useGame((s) => s.select);
  const move = useGame((s) => s.move);
  const placeAt = useGame((s) => s.placeAt);
  const setPlacing = useGame((s) => s.setPlacing);
  const { screenToFlowPosition } = useReactFlow();

  const rfNodes: SvcNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'service' as const,
        position: { x: n.x, y: n.y },
        selected: n.id === selectedId,
        deletable: n.service !== 'internet',
        data: {
          service: n.service,
          size: n.size,
          runtime: runtime[n.id] ?? {
            emaRps: 0,
            processed: 0,
            dropped: 0,
            blocked: 0,
            hits: 0,
            misses: 0,
            queueDepth: 0,
            utilization: 0,
            latency: 0,
            tokens: 0,
            status: 'idle' as const,
          },
          degraded: n.degraded,
          stalled:
            n.service === 'sqs' &&
            (runtime[n.id]?.queueDepth ?? 0) > 4 &&
            !edges.some((e) => {
              if (e.source !== n.id) return false;
              const t = nodes.find((x) => x.id === e.target);
              return t?.service === 'ec2' || t?.service === 'lambda';
            }),
        },
      })),
    [nodes, runtime, selectedId, edges],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        type: 'wire',
        source: e.source,
        target: e.target,
        selected: e.id === selectedId,
        animated: true,
      })),
    [edges, selectedId],
  );

  const dropAt = useCallback(
    (clientX: number, clientY: number, svc: ServiceId) => {
      const p = screenToFlowPosition({ x: clientX, y: clientY });
      placeAt(svc, p.x - 84, p.y - 36);
      setPlacing(null);
    },
    [placeAt, screenToFlowPosition, setPlacing],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) connect(c.source, c.target);
    },
    [connect],
  );

  const onNodesChange: OnNodesChange<SvcNode> = useCallback(
    (changes) => {
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position && ch.id) {
          move(ch.id, ch.position.x, ch.position.y);
        }
        if (ch.type === 'select') {
          if (ch.selected) select(ch.id);
        }
      }
    },
    [move, select],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const ch of changes) {
        if (ch.type === 'remove') disconnect(ch.id);
        if (ch.type === 'select' && ch.selected) select(ch.id);
      }
    },
    [disconnect, select],
  );

  const onPaneClick = useCallback(
    (ev: React.MouseEvent) => {
      if (placing) {
        dropAt(ev.clientX, ev.clientY, placing);
        return;
      }
      select(null);
    },
    [dropAt, placing, select],
  );

  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      const svc = (ev.dataTransfer.getData('application/buildsystem') || placing) as ServiceId | '';
      if (!svc || !CATALOG[svc]) return;
      dropAt(ev.clientX, ev.clientY, svc);
    },
    [dropAt, placing],
  );

  const onDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      className={`canvas-wrap ${placing ? 'placing' : ''} ${event?.type === 'ddos' ? 'ddos' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={rfNodes as Node[]}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={onPaneClick}
        onNodeClick={(_, n) => select(n.id)}
        onEdgeClick={(_, e) => select(e.id)}
        onEdgeDoubleClick={(_, e) => disconnect(e.id)}
        edgesReconnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        panOnDrag
        selectionOnDrag={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1c2a3a" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const svc = (n.data as SvcNode['data'] | undefined)?.service;
            return svc ? CATALOG[svc].color : '#314257';
          }}
          maskColor="rgba(7,11,16,0.7)"
        />
      </ReactFlow>
      <PacketLayer />
      <EventBanner />
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}
