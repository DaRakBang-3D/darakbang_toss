/** 방 크기: 4m × 4m, 격자 0.5m → 8 × 8칸 */
export const GRID = 8;
export const CELL = 0.5;
export const ROOM = GRID * CELL;
export const WALL_H = 2.6;

/** MVP 소품 8종. 형태는 고정, 모양 2종·재질·색으로 개인화 (성능상 종류를 늘리지 않음) */
export type ItemType = 'bed' | 'lamp' | 'desk' | 'wardrobe' | 'chair' | 'sofa' | 'rug' | 'drawer';
export type Variant = 0 | 1;
export type MaterialId = 'matte' | 'fabric' | 'wood' | 'glossy' | 'metal';
export type Mood = 'morning' | 'sunset' | 'night';
/** 사진을 입힐 수 있는 자리 (방당 3장) */
export type TextureSlot = 'wall' | 'floor' | 'fabric';

interface CatalogEntry {
  label: string;
  /** 회전 0일 때 차지하는 칸 수 (가로 w × 세로 d) */
  w: number;
  d: number;
  color: string;
  material: MaterialId;
  /** 모양 2종 이름 */
  variants: [string, string];
  /** 패브릭 사진을 입힐 수 있는 소품 */
  fabric: boolean;
  /** 새로 놓을 때 뒷벽에 붙이는 소품 (키가 커서 가운데 두면 시야를 가림) */
  againstWall?: boolean;
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  bed: {
    label: '침대',
    w: 3,
    d: 4,
    color: '#f2c6c2',
    material: 'fabric',
    variants: ['네모 헤드', '둥근 헤드'],
    fabric: true,
  },
  lamp: {
    label: '전등',
    w: 1,
    d: 1,
    color: '#f5b83d',
    material: 'matte',
    variants: ['갓 스탠드', '동그란 조명'],
    fabric: false,
  },
  desk: {
    label: '책상',
    w: 2,
    d: 1,
    color: '#d8b48a',
    material: 'wood',
    variants: ['다리 네 개', '서랍 달린'],
    fabric: false,
    againstWall: true,
  },
  wardrobe: {
    label: '옷장',
    w: 2,
    d: 1,
    color: '#efe6da',
    material: 'wood',
    variants: ['문 두 짝', '둥근 지붕'],
    fabric: false,
    againstWall: true,
  },
  chair: {
    label: '의자',
    w: 1,
    d: 1,
    color: '#e8a87c',
    material: 'wood',
    variants: ['등받이', '동그란 스툴'],
    fabric: false,
  },
  sofa: {
    label: '소파',
    w: 4,
    d: 2,
    color: '#9fb8d9',
    material: 'fabric',
    variants: ['각진 팔걸이', '둥근 팔걸이'],
    fabric: true,
  },
  rug: {
    label: '바닥 매트',
    w: 4,
    d: 3,
    color: '#c9b8e8',
    material: 'fabric',
    variants: ['네모', '동그라미'],
    fabric: true,
  },
  drawer: {
    label: '서랍',
    w: 2,
    d: 1,
    color: '#b98b63',
    material: 'wood',
    variants: ['3단', '다리 달린 2단'],
    fabric: false,
    againstWall: true,
  },
};

export const ITEM_TYPES = Object.keys(CATALOG) as ItemType[];

export const MATERIALS: Record<MaterialId, string> = {
  matte: '매트',
  fabric: '패브릭',
  wood: '나무',
  glossy: '광택',
  metal: '메탈',
};
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export const MOODS: Record<Mood, string> = { morning: '아침', sunset: '노을', night: '밤' };
export const MOOD_IDS = Object.keys(MOODS) as Mood[];

export const SLOT_LABELS: Record<TextureSlot, string> = { wall: '벽지', floor: '바닥', fabric: '패브릭' };

/** 추천 팔레트 (방의 색은 사용자 자유 → 색상환으로 무엇이든 고를 수 있음) */
export const SWATCHES = [
  '#f2c6c2',
  '#f5b83d',
  '#7fb77e',
  '#9fb8d9',
  '#c9b8e8',
  '#d8b48a',
  '#efe6da',
  '#5b5f6b',
];

export const ROOM_NAME_MAX = 12;

/** 회전(0~3, 90° 단위)을 반영한 차지 칸 수 */
export function footprint(type: ItemType, rot: number) {
  const { w, d } = CATALOG[type];
  return rot % 2 === 0 ? { w, d } : { w: d, d: w };
}

/** 바닥에 깔리는 소품: 다른 소품과 겹쳐도 됨 */
export const isFlat = (t: ItemType) => t === 'rug';
