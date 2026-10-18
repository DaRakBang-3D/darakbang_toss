import { Button, TextField, useToast } from '@toss/tds-mobile';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useFullScreenAd } from '@/features/ads/useFullScreenAd';
import { useInterstitialAfter } from '@/features/ads/useInterstitialAfter';
import { useQuota } from '@/features/ai-generate/quota';
import { AI_PROMPT_MAX, requestSuggestion } from '@/features/editor/aiSuggest';
import {
  CATALOG,
  ITEM_TYPES,
  MATERIAL_IDS,
  MATERIALS,
  MOOD_IDS,
  MOODS,
  ROOM_NAME_MAX,
  SLOT_LABELS,
  SWATCHES,
  type TextureSlot,
} from '@/features/editor/catalog';
import { applyPhoto, removePhoto, resolvePhotos, type PhotoResult } from '@/features/editor/photoTexture';
import { useRoom } from '@/features/editor/roomStore';
import { track } from '@/lib/analytics';
import { env } from '@/lib/env';
import '@/styles/editor.css';

// three는 에디터 진입 시점에만 받는다
const RoomCanvas = lazy(() => import('@/scene/RoomCanvas').then((m) => ({ default: m.RoomCanvas })));

type Tab = 'items' | 'room' | 'ai';

const PHOTO_TOAST: Record<PhotoResult, string | null> = {
  approved: '사진을 입혔어',
  local: '사진을 입혔어. 서버 확인 전이라 내 폰에서만 보여',
  blocked: '이 사진은 쓸 수 없어. 다른 사진을 골라줘',
  denied: '사진을 쓰려면 앨범 권한이 필요해',
  failed: '앨범을 열지 못했어. 다시 해볼래?',
  cancelled: null,
};

const AI_EXAMPLES = ['비 오는 날 아늑한 방', '파스텔 공부방', '밤에 영화 보는 방'];

export function EditorPage() {
  const { openToast } = useToast();
  const showInterstitial = useInterstitialAfter();
  const [tab, setTab] = useState<Tab>('items');
  const room = useRoom();
  const selected = room.items.find((i) => i.id === room.selectedId);

  useEffect(() => {
    void useRoom
      .getState()
      .load()
      .then(() => resolvePhotos(useRoom.getState().textures));
    useQuota
      .getState()
      .refresh()
      .catch(() => {
        /* 서버 미연결: AI 탭에서 안내 */
      });
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

  const handlePhoto = async (slot: TextureSlot) => {
    const result = await applyPhoto(slot);
    const msg = PHOTO_TOAST[result];
    if (msg) openToast(msg);
  };

  return (
    <div className="editor">
      <div className="editor__stage">
        <Suspense fallback={null}>
          <RoomCanvas />
        </Suspense>
        {room.name && <div className="room-name">{room.name}</div>}
        {room.items.length === 0 && !selected && <div className="hint">아래에서 소품을 골라 방을 채워봐</div>}
        {selected && <div className="hint">끌어서 옮기고, 빈 곳을 누르면 선택이 풀려</div>}
      </div>

      <aside className="editor__panel">
        {selected ? (
          <ItemPanel id={selected.id} onPickFabric={() => handlePhoto('fabric')} />
        ) : (
          <>
            <div className="panel__row">
              {(['items', 'room', 'ai'] as const).map((t) => (
                <Button
                  key={t}
                  size="small"
                  variant={tab === t ? 'fill' : 'weak'}
                  color="dark"
                  onClick={() => setTab(t)}
                >
                  {{ items: '소품', room: '방', ai: 'AI 추천' }[t]}
                </Button>
              ))}
              <span style={{ flex: 1 }} />
              <Button size="small" disabled={!room.dirty} onClick={handleSave}>
                저장
              </Button>
            </div>

            {tab === 'items' && (
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
            )}
            {tab === 'room' && <RoomPanel onPhoto={handlePhoto} />}
            {tab === 'ai' && <AiPanel />}
          </>
        )}
      </aside>
    </div>
  );
}

function ItemPanel({ id, onPickFabric }: { id: string; onPickFabric: () => void }) {
  const item = useRoom((s) => s.items.find((i) => i.id === id));
  const hasFabricPhoto = useRoom((s) => !!s.textureSrc.fabric);
  const { rotate, remove, select, patchItem } = useRoom.getState();
  if (!item) return null;
  const c = CATALOG[item.type];

  return (
    <>
      <div className="panel__row">
        <span className="panel__title">{c.label}</span>
        <Button size="small" variant="weak" onClick={() => rotate(item.id)}>
          돌리기
        </Button>
        <Button size="small" variant="weak" color="danger" onClick={() => remove(item.id)}>
          빼기
        </Button>
        <Button size="small" onClick={() => select(null)}>
          완료
        </Button>
      </div>
      <div className="panel__section">
        <div className="panel__label">모양</div>
        <div className="chips">
          {c.variants.map((label, v) => (
            <Button
              key={label}
              size="small"
              variant={item.variant === v ? 'fill' : 'weak'}
              color="dark"
              onClick={() => patchItem(item.id, { variant: v as 0 | 1 })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="panel__section">
        <div className="panel__label">재질</div>
        <div className="chips">
          {MATERIAL_IDS.map((m) => (
            <Button
              key={m}
              size="small"
              variant={item.material === m ? 'fill' : 'weak'}
              color="dark"
              onClick={() => patchItem(item.id, { material: m })}
            >
              {MATERIALS[m]}
            </Button>
          ))}
        </div>
      </div>
      <div className="panel__section">
        <div className="panel__label">색</div>
        <Swatches value={item.color} onPick={(color) => patchItem(item.id, { color })} />
      </div>
      {c.fabric && (
        <div className="panel__section">
          <div className="panel__label">패브릭 사진</div>
          {hasFabricPhoto ? (
            <Button
              size="small"
              variant={item.useFabricPhoto ? 'fill' : 'weak'}
              onClick={() => patchItem(item.id, { useFabricPhoto: !item.useFabricPhoto })}
            >
              {item.useFabricPhoto ? '사진 입힘' : '사진 입히기'}
            </Button>
          ) : (
            <Button size="small" variant="weak" onClick={onPickFabric}>
              앨범에서 패브릭 사진 고르기
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function RoomPanel({ onPhoto }: { onPhoto: (slot: TextureSlot) => void }) {
  const { name, mood, wallColor, floorColor, textures, setRoom } = useRoom();

  const photoRow = (slot: TextureSlot) => (
    <div className="chips">
      <Button size="small" variant="weak" onClick={() => onPhoto(slot)}>
        {textures[slot] ? `${SLOT_LABELS[slot]} 사진 바꾸기` : `${SLOT_LABELS[slot]} 사진 고르기`}
      </Button>
      {textures[slot] && (
        <Button size="small" variant="weak" color="danger" onClick={() => void removePhoto(slot)}>
          사진 빼기
        </Button>
      )}
      {textures[slot]?.status === 'local' && <span className="panel__note">내 폰에서만 보여</span>}
    </div>
  );

  return (
    <>
      <div className="panel__section">
        <TextField
          variant="box"
          label="방 이름"
          placeholder="예: 비밀 다락방"
          value={name}
          maxLength={ROOM_NAME_MAX}
          onChange={(e) => setRoom({ name: e.target.value })}
        />
      </div>
      <div className="panel__section">
        <div className="panel__label">무드</div>
        <div className="chips">
          {MOOD_IDS.map((m) => (
            <Button
              key={m}
              size="small"
              variant={mood === m ? 'fill' : 'weak'}
              color="dark"
              onClick={() => setRoom({ mood: m })}
            >
              {MOODS[m]}
            </Button>
          ))}
        </div>
      </div>
      <div className="panel__section">
        <div className="panel__label">벽</div>
        <Swatches value={wallColor} onPick={(c) => setRoom({ wallColor: c })} />
        {photoRow('wall')}
      </div>
      <div className="panel__section">
        <div className="panel__label">바닥</div>
        <Swatches value={floorColor} onPick={(c) => setRoom({ floorColor: c })} />
        {photoRow('floor')}
      </div>
      <div className="panel__section">
        <div className="panel__label">패브릭 (침대·소파·매트)</div>
        {photoRow('fabric')}
      </div>
    </>
  );
}

function AiPanel() {
  const { openToast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const { remaining, known, grantFromAd, setRemaining } = useQuota();
  const applySuggestion = useRoom((s) => s.applySuggestion);
  const rewarded = useFullScreenAd({
    adGroupId: env.adRewardedId,
    onReward: () => {
      track('ad_reward_earned');
      grantFromAd()
        .then(() => openToast('추천 1회를 받았어'))
        .catch(() => openToast('지급이 늦어지고 있어. 잠시 후 다시 확인해줘'));
    },
  });

  const run = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = await requestSuggestion(text);
    setBusy(false);
    if (r.remaining !== undefined) setRemaining(r.remaining);
    if (!r.ok) {
      if (r.reason === 'no_quota') track('quota_exhausted');
      openToast(
        r.reason === 'no_quota'
          ? '오늘 추천을 다 썼어. 광고 보고 1회 더 받을 수 있어'
          : '추천을 못 받았어. 다시 해볼래?',
      );
      return;
    }
    const added = applySuggestion(r.suggestion);
    track('item_generate', { added });
    openToast(
      added > 0 ? `소품 ${added}개를 놓았어` : '색과 무드를 바꿨어. 빈자리가 없어서 소품은 못 놓았어',
    );
  };

  return (
    <>
      <div className="panel__section">
        <TextField
          variant="box"
          label="어떤 방을 원해?"
          placeholder="예: 비 오는 날 아늑한 방"
          value={prompt}
          maxLength={AI_PROMPT_MAX}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="panel__section chips">
        {AI_EXAMPLES.map((ex) => (
          <Button key={ex} size="small" variant="weak" color="dark" onClick={() => setPrompt(ex)}>
            {ex}
          </Button>
        ))}
      </div>
      <div className="panel__section">
        <Button
          display="full"
          loading={busy}
          disabled={!prompt.trim() || (known && remaining <= 0)}
          onClick={() => run(prompt)}
        >
          {known ? `추천받기 (${remaining}회 남음)` : '추천받기'}
        </Button>
      </div>
      {known && remaining <= 0 && (
        <div className="panel__section">
          <Button display="full" variant="weak" disabled={!rewarded.ready} onClick={rewarded.show}>
            광고 보고 1회 더 받기
          </Button>
        </div>
      )}
      {!known && <div className="panel__note">서버에 연결되면 AI 추천을 쓸 수 있어</div>}
    </>
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
      {/* 팔레트에 없는 색은 색상환으로 (방의 색은 사용자 자유) */}
      <label
        className="swatch swatch--picker"
        aria-pressed={!SWATCHES.includes(value)}
        aria-label="다른 색 고르기"
      >
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}
