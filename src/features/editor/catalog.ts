/** 방 크기: 4m × 4m, 격자 0.5m → 8 × 8칸 */
export const GRID = 8;
export const CELL = 0.5;
export const ROOM = GRID * CELL;
export const WALL_H = 2.6;

export type ItemType = 'bed' | 'sofa' | 'table' | 'chair' | 'shelf' | 'lamp' | 'plant' | 'rug';

interface CatalogEntry {
  label: string;
  /** 회전 0일 때 차지하는 칸 수 (가로 w × 세로 d) */
  w: number;
  d: number;
  color: string;
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  bed: { label: '침대', w: 3, d: 4, color: '#f2c6c2' },
  sofa: { label: '소파', w: 4, d: 2, color: '#9fb8d9' },
  table: { label: '테이블', w: 2, d: 2, color: '#d8b48a' },
  chair: { label: '의자', w: 1, d: 1, color: '#e8a87c' },
  shelf: { label: '책장', w: 2, d: 1, color: '#b98b63' },
  lamp: { label: '스탠드', w: 1, d: 1, color: '#f5b83d' },
  plant: { label: '화분', w: 1, d: 1, color: '#7fb77e' },
  rug: { label: '러그', w: 4, d: 3, color: '#c9b8e8' },
};

export const ITEM_TYPES = Object.keys(CATALOG) as ItemType[];

/** 소품 색 팔레트 (방의 색은 사용자 자유 → 대표 색만 제안) */
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

/** 회전(0~3, 90° 단위)을 반영한 차지 칸 수 */
export function footprint(type: ItemType, rot: number) {
  const { w, d } = CATALOG[type];
  return rot % 2 === 0 ? { w, d } : { w: d, d: w };
}
