import { Storage } from '@apps-in-toss/web-framework';
import { create } from 'zustand';
import { CATALOG, footprint, GRID, type ItemType } from './catalog';

export interface PlacedItem {
  id: string;
  type: ItemType;
  /** 차지 영역의 왼쪽 위 칸 (0 ~ GRID-1) */
  x: number;
  z: number;
  /** 0~3 (90° 단위) */
  rot: number;
  color: string;
}

export interface RoomData {
  version: 1;
  wallColor: string;
  floorColor: string;
  items: PlacedItem[];
}

interface RoomState extends RoomData {
  selectedId: string | null;
  dirty: boolean;
  add: (type: ItemType) => void;
  select: (id: string | null) => void;
  move: (id: string, x: number, z: number) => void;
  rotate: (id: string) => void;
  recolor: (id: string, color: string) => void;
  remove: (id: string) => void;
  setWall: (color: string) => void;
  setFloor: (color: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

const MAX_ITEMS = 40; // 저사양 기기 보호
const STORAGE_KEY = 'darakbang.room.v1';

/** 방 밖으로 나가지 않게 칸 좌표 보정 */
export function clampPos(type: ItemType, rot: number, x: number, z: number) {
  const { w, d } = footprint(type, rot);
  return {
    x: Math.min(Math.max(0, Math.round(x)), GRID - w),
    z: Math.min(Math.max(0, Math.round(z)), GRID - d),
  };
}

/** 러그는 바닥에 깔리므로 다른 소품과 겹쳐도 된다 */
const isFlat = (t: ItemType) => t === 'rug';

/** (x,z)에 rot 방향으로 놓았을 때 다른 소품과 겹치는지. 러그끼리·러그 위 가구는 허용 */
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

/** 새 소품을 놓을 빈자리: 가운데에서 가까운 칸부터 탐색. 없으면 가운데 */
export function findFreeSpot(items: PlacedItem[], type: ItemType) {
  const { w, d } = footprint(type, 0);
  const cx = (GRID - w) / 2;
  const cz = (GRID - d) / 2;
  const spots: { x: number; z: number }[] = [];
  for (let z = 0; z <= GRID - d; z++) for (let x = 0; x <= GRID - w; x++) spots.push({ x, z });
  spots.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  return spots.find((s) => !collides(items, type, 0, s.x, s.z)) ?? { x: Math.floor(cx), z: Math.floor(cz) };
}

const DEFAULT: RoomData = { version: 1, wallColor: '#efe6da', floorColor: '#d9c3a5', items: [] };
const uid = () => Math.random().toString(36).slice(2, 10);

export const useRoom = create<RoomState>((set, get) => {
  const update = (id: string, fn: (it: PlacedItem) => PlacedItem) =>
    set((s) => ({ items: s.items.map((it) => (it.id === id ? fn(it) : it)), dirty: true }));

  return {
    ...DEFAULT,
    selectedId: null,
    dirty: false,

    add: (type) => {
      const { items } = get();
      if (items.length >= MAX_ITEMS) return;
      const item: PlacedItem = {
        id: uid(),
        type,
        ...findFreeSpot(items, type),
        rot: 0,
        color: CATALOG[type].color,
      };
      set((s) => ({ items: [...s.items, item], selectedId: item.id, dirty: true }));
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
    recolor: (id, color) => update(id, (it) => ({ ...it, color })),
    remove: (id) =>
      set((s) => ({ items: s.items.filter((it) => it.id !== id), selectedId: null, dirty: true })),
    setWall: (wallColor) => set({ wallColor, dirty: true }),
    setFloor: (floorColor) => set({ floorColor, dirty: true }),

    // TODO(server): toss_rooms 테이블 저장으로 교체 (지금은 기기 저장소)
    load: async () => {
      try {
        const raw = await Storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw) as RoomData;
        if (data.version === 1) set({ ...data, selectedId: null, dirty: false });
      } catch (e) {
        console.warn('[room] 불러오기 실패', e);
      }
    },
    save: async () => {
      const { wallColor, floorColor, items } = get();
      const data: RoomData = { version: 1, wallColor, floorColor, items };
      await Storage.setItem(STORAGE_KEY, JSON.stringify(data));
      set({ dirty: false });
    },
  };
});
