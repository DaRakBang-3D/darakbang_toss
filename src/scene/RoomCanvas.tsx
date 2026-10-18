import { useEffect, useRef } from 'react';
import { useRoom } from '@/editor/roomStore';
import { usePerf } from './perfPreset';
import { RoomScene } from './RoomScene';

/** 3D 씬 마운트. 상태 변경은 React 렌더 없이 엔진으로 직접 전달 (zustand subscribe) */
export default function RoomCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const preset = usePerf((s) => s.preset);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { select, move } = useRoom.getState();
    const engine = new RoomScene(host, preset, { onSelect: select, onMove: move });
    const push = (s = useRoom.getState()) =>
      engine.sync({
        items: s.items,
        wallColor: s.wallColor,
        floorColor: s.floorColor,
        selectedId: s.selectedId,
      });
    push();
    const unsub = useRoom.subscribe((s) => push(s));
    return () => {
      unsub();
      engine.dispose();
    };
  }, [preset]);

  return <div ref={hostRef} className="room-canvas" />;
}
