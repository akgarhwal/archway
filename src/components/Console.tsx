import { BottomBar } from './BottomBar';
import { Canvas, LiveGate } from './Canvas';
import { Catalog } from './Catalog';
import { Inspector } from './Inspector';
import { MixBar } from './MixBar';
import { TopBar } from './TopBar';
import { TrafficBill } from './TrafficBill';

export function Console() {
  return (
    <div className="console">
      <TopBar />
      <div className="workspace">
        <Catalog />
        <div className="canvas-col">
          <TrafficBill layout="bar" />
          <MixBar />
          <Canvas />
          <LiveGate />
        </div>
        <Inspector />
      </div>
      <BottomBar />
    </div>
  );
}
