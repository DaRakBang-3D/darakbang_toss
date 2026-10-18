import { Button, useToast } from '@toss/tds-mobile';
import { lazy, Suspense, useEffect, useState } from 'react';
import { CATALOG, ITEM_TYPES, SWATCHES } from '@/editor/catalog';
import { useRoom } from '@/editor/roomStore';
import { useInterstitialAfter } from '@/features/ads/useInterstitialAfter';
import { track } from '@/lib/analytics';
import '@/styles/editor.css';

// three는 에디터 진입 시점에만 받는다
const RoomCanvas = lazy(() => import('@/scene/RoomCanvas'));

type Tab = 'items' | 'room';

export function EditorPage() {
  const { openToast } = useToast();
  const showInterstitial = useInterstitialAfter();
  const [tab, setTab] = useState<Tab>('items');
  const room = useRoom();
  const selected = room.items.find((i) => i.id === room.selectedId);

  useEffect(() => {
    void useRoom.getState().load();
  }, []);

  const handleSave = async () => {
    try {
      await room.save();
      track('room_save', { items: room.items.length });
      openToast('저장했어');
      showInterstitial('after-save');
    } catch {
      openToast('저장이 안 됐어. 다시 해볼래?');
    }
  };

  return (
    <div className="editor">
      <div className="editor__stage">
        <Suspense fallback={null}>
          <RoomCanvas />
        </Suspense>
        {room.items.length === 0 && <div className="hint">아래에서 소품을 골라 방을 채워봐</div>}
        {selected && <div className="hint">끌어서 옮기고, 빈 곳을 누르면 선택이 풀려</div>}
      </div>

      <aside className="editor__panel">
        {selected ? (
          <>
            <div className="panel__row">
              <span className="panel__title">{CATALOG[selected.type].label}</span>
              <Button size="small" variant="weak" onClick={() => room.rotate(selected.id)}>
                돌리기
              </Button>
              <Button size="small" variant="weak" color="danger" onClick={() => room.remove(selected.id)}>
                빼기
              </Button>
              <Button size="small" onClick={() => room.select(null)}>
                완료
              </Button>
            </div>
            <div className="panel__section">
              <div className="panel__label">색</div>
              <Swatches value={selected.color} onPick={(c) => room.recolor(selected.id, c)} />
            </div>
          </>
        ) : (
          <>
            <div className="panel__row">
              <Button
                size="small"
                variant={tab === 'items' ? 'fill' : 'weak'}
                color="dark"
                onClick={() => setTab('items')}
              >
                소품
              </Button>
              <Button
                size="small"
                variant={tab === 'room' ? 'fill' : 'weak'}
                color="dark"
                onClick={() => setTab('room')}
              >
                방 색
              </Button>
              <span style={{ flex: 1 }} />
              <Button size="small" disabled={!room.dirty} onClick={handleSave}>
                저장
              </Button>
            </div>

            {tab === 'items' ? (
              <div className="panel__section catalog">
                {ITEM_TYPES.map((type) => (
                  <button
                    key={type}
                    className="tile"
                    onClick={() => {
                      room.add(type);
                      track('item_place', { type });
                    }}
                  >
                    <span className="tile__dot" style={{ background: CATALOG[type].color }} />
                    {CATALOG[type].label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="panel__section">
                  <div className="panel__label">벽</div>
                  <Swatches value={room.wallColor} onPick={room.setWall} />
                </div>
                <div className="panel__section">
                  <div className="panel__label">바닥</div>
                  <Swatches value={room.floorColor} onPick={room.setFloor} />
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {SWATCHES.map((c) => (
        <button
          key={c}
          className="swatch"
          style={{ background: c }}
          aria-label={`색 ${c}`}
          aria-pressed={c === value}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}
