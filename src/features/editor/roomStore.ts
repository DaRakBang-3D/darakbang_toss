import { Storage } from '@apps-in-toss/web-framework';
import { create } from 'zustand';
import { api } from '@/api/client';
import {
  CATALOG,
  footprint,
  GRID,
  isFlat,
  ROOM_NAME_MAX,
  type ItemType,
  type MaterialId,
  type Mood,
  type TextureSlot,
  type Variant,
} from './catalog';

export interface PlacedItem {
  id: string;
  type: ItemType;
  variant: Variant;
  material: MaterialId;
  /** 차지 영역의 왼쪽 위 칸 (0 ~ GRID-1) */
  x: number;
  z: number;
  /** 0~3 (90° 단위) */
  rot: number;
  color: string;
  /** 패브릭 사진 슬롯을 입힐지 (침대·소파·매트만) */
  useFabricPhoto: boolean;
}

/** 사진 텍스처 참조. 이미지 자체는 서버(검사 통과) 또는 기기 저장소에 따로 둔다 */
export interface TextureRef {
  id: string;
  /** approved: 서버 검사 통과 → 친구에게도 보임 / local: 검사 못 함 → 내 폰에서만 */
  status: 'approved' | 'local';
}

export interface RoomData {
  version: 2;
  name: string;
  mood: Mood;
  wallColor: string;
  floorColor: string;
  items: PlacedItem[];
  textures: Partial<Record<TextureSlot, TextureRef>>;
  savedAt: number;
}

/** AI 추천 결과 (서버가 허용 값만 검증해서 보냄) */
export interface RoomSuggestion {
  mood: Mood;
  wallColor: string;
  floorColor: string;
  items: { type: ItemType; variant: Variant; material: MaterialId; color: string }[];
}

interface RoomState extends RoomData {
  selectedId: string | null;
  dirty: boolean;
  /** 슬롯별 실제 이미지 주소 (서버 서명 URL 또는 data URI). 저장하지 않는 실행 중 값 */
  textureSrc: Partial<Record<TextureSlot, string>>;
  add: (type: ItemType) => void;
  select: (id: string | null) => void;
  move: (id: string, x: number, z: number) => void;
  rotate: (id: string) => void;
  patchItem: (
    id: string,
    patch: Partial<Pick<PlacedItem, 'color' | 'material' | 'variant' | 'useFabricPhoto'>>,
  ) => void;
  remove: (id: string) => void;
  setRoom: (patch: Partial<Pick<RoomData, 'name' | 'mood' | 'wallColor' | 'floorColor'>>) => void;
  setTexture: (slot: TextureSlot, ref: TextureRef | null, src?: string) => void;
  applySuggestion: (s: RoomSuggestion) => number;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

const MAX_ITEMS = 40; // 저사양 기기 보호
// 키 이름은 바꾸지 않는다 (사용자 데이터 유실). 내용 형식은 version으로 구분
const STORAGE_KEY = 'darakbang.room.v1';

/** 방 밖으로 나가지 않게 칸 좌표 보정 */
export function clampPos(type: ItemType, rot: number, x: number, z: number) {
  const { w, d } = footprint(type, rot);
  return {
    x: Math.min(Math.max(0, Math.round(x)), GRID - w),
    z: Math.min(Math.max(0, Math.round(z)), GRID - d),
  };
}

/** (x,z)에 rot 방향으로 놓았을 때 다른 소품과 겹치는지. 매트끼리·매트 위 가구는 허용 */
export function collides(
  items: PlacedItem[],
  type: ItemType,
  rot: number,
  x: number,
  z: number,
  ignoreId?: string,
) {
  const { w, d } = footprint(type, rot);
  return items.some((it) => {
    if (it.id === ignoreId || isFlat(it.type) !== isFlat(type)) return false;
    const f = footprint(it.type, it.rot);
    return x < it.x + f.w && it.x < x + w && z < it.z + f.d && it.z < z + d;
  });
}

/** 새 소품을 놓을 빈자리: 가운데에서 가까운 칸부터. 없으면 null */
export function findFreeSpot(items: PlacedItem[], type: ItemType) {
  const { w, d } = footprint(type, 0);
  const cx = (GRID - w) / 2;
  const cz = (GRID - d) / 2;
  const spots: { x: number; z: number }[] = [];
  for (let z = 0; z <= GRID - d; z++) for (let x = 0; x <= GRID - w; x++) spots.push({ x, z });
  // 벽에 붙이는 소품은 뒷벽(z=0) 줄부터, 그 안에서 가운데에 가까운 칸부터
  const score = CATALOG[type].againstWall
    ? (s: { x: number; z: number }) => s.z * GRID + Math.abs(s.x - cx)
    : (s: { x: number; z: number }) => Math.hypot(s.x - cx, s.z - cz);
  spots.sort((a, b) => score(a) - score(b));
  return spots.find((s) => !collides(items, type, 0, s.x, s.z)) ?? null;
}

const DEFAULT: RoomData = {
  version: 2,
  name: '',
  mood: 'morning',
  wallColor: '#efe6da',
  floorColor: '#d9c3a5',
  items: [],
  textures: {},
  savedAt: 0,
};
const uid = () => Math.random().toString(36).slice(2, 10);

function newItem(items: PlacedItem[], type: ItemType): PlacedItem | null {
  const spot = findFreeSpot(items, type);
  if (!spot) return null;
  const c = CATALOG[type];
  return {
    id: uid(),
    type,
    variant: 0,
    material: c.material,
    rot: 0,
    color: c.color,
    useFabricPhoto: false,
    ...spot,
  };
}

/** v1(7d6cd89 이전 저장분) → v2: 없어진 소품(책장·화분)은 빼고 기본값 채움 */
function migrate(raw: unknown): RoomData | null {
  const d = raw as { version?: number; wallColor?: string; floorColor?: string; items?: V1Item[] } | null;
  if (d?.version === 2) return { ...DEFAULT, ...(raw as RoomData) };
  if (d?.version !== 1) return null;
  const items: PlacedItem[] = [];
  for (const old of d.items ?? []) {
    const type = (old.type === 'table' ? 'desk' : old.type) as ItemType;
    if (!(type in CATALOG)) continue; // 책장·화분은 MVP에서 빠짐
    const rot = old.rot ?? 0;
    items.push({
      id: old.id ?? uid(),
      type,
      variant: 0,
      material: CATALOG[type].material,
      rot,
      color: old.color ?? CATALOG[type].color,
      useFabricPhoto: false,
      ...clampPos(type, rot, old.x ?? 0, old.z ?? 0),
    });
  }
  return {
    ...DEFAULT,
    wallColor: d.wallColor ?? DEFAULT.wallColor,
    floorColor: d.floorColor ?? DEFAULT.floorColor,
    items,
  };
}

/** v1 저장 형식의 소품 (type은 지금 없는 값일 수 있음) */
interface V1Item {
  id?: string;
  type?: string;
  x?: number;
  z?: number;
  rot?: number;
  color?: string;
}

function pickData(s: RoomData): RoomData {
  const { version, name, mood, wallColor, floorColor, items, textures, savedAt } = s;
  return { version, name, mood, wallColor, floorColor, items, textures, savedAt };
}

export const useRoom = create<RoomState>((set, get) => {
  const update = (id: string, fn: (it: PlacedItem) => PlacedItem) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? fn(it) : it)), dirty: true }));

  return {
    ...DEFAULT,
    selectedId: null,
    dirty: false,
    textureSrc: {},

    add: (type) => {
      const { items } = get();
      if (items.length >= MAX_ITEMS) return;
      const item = newItem(items, type);
      if (item) set((s) => ({ items: [...s.items, item], selectedId: item.id, dirty: true }));
    },
    select: (id) => set({ selectedId: id }),
    // 겹치는 위치로는 이동·회전하지 않음 (그 자리에 멈춤)
    move: (id, x, z) =>
      update(id, (it) => {
        const pos = clampPos(it.type, it.rot, x, z);
        if (pos.x === it.x && pos.z === it.z) return it;
        return collides(get().items, it.type, it.rot, pos.x, pos.z, it.id) ? it : { ...it, ...pos };
      }),
    rotate: (id) =>
      update(id, (it) => {
        const rot = (it.rot + 1) % 4;
        const pos = clampPos(it.type, rot, it.x, it.z);
        return collides(get().items, it.type, rot, pos.x, pos.z, it.id) ? it : { ...it, rot, ...pos };
      }),
    patchItem: (id, patch) => update(id, (it) => ({ ...it, ...patch })),
    remove: (id) =>
      set((s) => ({ items: s.items.filter((it) => it.id !== id), selectedId: null, dirty: true })),
    setRoom: (patch) =>
      set({
        ...patch,
        ...(patch.name !== undefined && { name: patch.name.slice(0, ROOM_NAME_MAX) }),
        dirty: true,
      }),
    setTexture: (slot, ref, src) =>
      set((s) => {
        const textures = { ...s.textures };
        const textureSrc = { ...s.textureSrc };
        if (ref) {
          textures[slot] = ref;
          textureSrc[slot] = src;
        } else {
          delete textures[slot];
          delete textureSrc[slot];
        }
        return { textures, textureSrc, dirty: true };
      }),

    /** AI 추천 적용: 색·무드는 바꾸고, 소품은 빈자리가 있는 만큼 추가. 추가된 개수 반환 */
    applySuggestion: (sg) => {
      const items = [...get().items];
      let added = 0;
      for (const s of sg.items) {
        if (items.length >= MAX_ITEMS) break;
        const it = newItem(items, s.type);
        if (!it) continue;
        items.push({ ...it, variant: s.variant, material: s.material, color: s.color });
        added += 1;
      }
      set({
        items,
        mood: sg.mood,
        wallColor: sg.wallColor,
        floorColor: sg.floorColor,
        selectedId: null,
        dirty: true,
      });
      return added;
    },

    /** 기기 저장분을 먼저 보여주고, 서버 저장분이 더 최신이면 교체 */
    load: async () => {
      try {
        const raw = await Storage.getItem(STORAGE_KEY);
        const local = raw ? migrate(JSON.parse(raw)) : null;
        if (local) set({ ...local, selectedId: null, dirty: false });
      } catch (e) {
        console.warn('[room] 기기 저장분 불러오기 실패', e);
      }
      try {
        const remote = await api<{ data: unknown } | null>('/rooms/me');
        const data = remote && migrate(remote.data);
        if (data && data.savedAt > get().savedAt) set({ ...data, selectedId: null, dirty: false });
      } catch {
        /* 서버 미연결이어도 기기 저장분으로 계속 꾸밀 수 있음 */
      }
    },

    /** 기기에 먼저 저장(항상 성공해야 함), 서버는 가능할 때만 */
    save: async () => {
      const data = { ...pickData(get()), savedAt: Date.now() };
      await Storage.setItem(STORAGE_KEY, JSON.stringify(data));
      set({ savedAt: data.savedAt, dirty: false });
      await api('/rooms/me', { method: 'PUT', json: { name: data.name, data } }).catch(() => {
        /* 서버 저장 실패는 다음 저장 때 다시 올라감 */
      });
    },
  };
});
