import * as THREE from 'three';
import { CATALOG, CELL, type ItemType, type MaterialId, type Variant } from '@/features/editor/catalog';

// ---- 재질 (값만 바꾸는 프리셋 5종: 셰이더 종류가 늘지 않아 컴파일·드로우콜 부담이 적음) ----

/** 아주 작은 절차 생성 무늬. 앱 전체에서 1장씩만 만들어 공유 */
let woodTex: THREE.CanvasTexture | null = null;
let weaveTex: THREE.CanvasTexture | null = null;

function canvasTex(size: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  return t;
}

function woodGrain() {
  woodTex ??= canvasTex(128, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 18; i++) {
      c.strokeStyle = `rgba(120,80,40,${0.06 + (i % 3) * 0.03})`;
      c.lineWidth = 1 + (i % 4);
      c.beginPath();
      const y = (i * 128) / 18;
      c.moveTo(0, y);
      c.bezierCurveTo(40, y + 4, 88, y - 4, 128, y);
      c.stroke();
    }
  });
  return woodTex;
}

function weave() {
  weaveTex ??= canvasTex(32, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 32; i += 4) {
      c.fillRect(i, 0, 2, 32);
      c.fillRect(0, i, 32, 2);
    }
  });
  return weaveTex;
}

const PRESET: Record<MaterialId, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.9, metalness: 0 },
  fabric: { roughness: 1, metalness: 0 },
  wood: { roughness: 0.7, metalness: 0 },
  glossy: { roughness: 0.18, metalness: 0 },
  metal: { roughness: 0.35, metalness: 0.85 },
};

export function makeMaterial(id: MaterialId, color: string) {
  const m = new THREE.MeshStandardMaterial({ color, ...PRESET[id] });
  if (id === 'wood') m.map = woodGrain();
  if (id === 'fabric') m.map = weave();
  return m;
}

/** 사용자 사진을 입힌 패브릭 재질. 색은 흰색이어야 사진 색이 그대로 나옴 */
export function makePhotoMaterial(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.95 });
}

const shared = {
  wood: new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: '#f6f1ea', roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: '#4a4f5a', roughness: 0.6, metalness: 0.3 }),
};
// 여러 소품이 함께 쓰는 재질 → 소품 삭제 시 dispose 하지 않음
Object.values(shared).forEach((m) => (m.userData.shared = true));

// ---- 도형 ----

/** 둥근 모서리 상자 (토이·소프트 렌더 느낌) */
function rbox(w: number, h: number, d: number, r = 0.06) {
  const shape = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -d / 2 + r;
  shape.moveTo(x, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, y);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(x, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, y);
  shape.quadraticCurveTo(-w / 2, -d / 2, x, -d / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - r * 2,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r * 0.6,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, r, 0);
  return geo;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

export interface ItemLook {
  type: ItemType;
  variant: Variant;
  material: MaterialId;
  color: string;
  /** 패브릭 부분에 입힐 사진 재질 (침대 이불·소파·매트) */
  photo?: THREE.Material | null;
}

/** 소품 그룹 생성. 원점 = 바닥 중심, 회전 0 기준 크기 w×d 칸 */
export function buildItem({ type, variant, material, color, photo }: ItemLook): THREE.Group {
  const g = new THREE.Group();
  const main = makeMaterial(material, color);
  const cloth = photo ?? main;
  const { w: cw, d: cd } = CATALOG[type];
  const w = cw * CELL - 0.06;
  const d = cd * CELL - 0.06;

  switch (type) {
    case 'bed': {
      g.add(mesh(rbox(w, 0.35, d), shared.wood));
      g.add(mesh(rbox(w - 0.08, 0.18, d - 0.1), shared.white, 0, 0.35, 0.02));
      g.add(mesh(rbox(w - 0.1, 0.06, d * 0.62), cloth, 0, 0.52, d * 0.17));
      g.add(mesh(rbox(w * 0.38, 0.12, 0.3), shared.white, -w * 0.22, 0.53, -d / 2 + 0.25));
      g.add(mesh(rbox(w * 0.38, 0.12, 0.3), shared.white, w * 0.22, 0.53, -d / 2 + 0.25));
      if (variant === 0) g.add(mesh(rbox(w, 0.9, 0.08), main, 0, 0, -d / 2 + 0.04));
      else {
        // 반원판: 원기둥 절반(θ=π/2~3π/2)을 눕혀 위쪽 반원이 되게
        const geo = new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 32, 1, false, Math.PI / 2, Math.PI);
        geo.rotateX(Math.PI / 2);
        g.add(mesh(geo, main, 0, 0.45, -d / 2 + 0.04), mesh(rbox(w, 0.45, 0.08), main, 0, 0, -d / 2 + 0.04));
      }
      break;
    }
    case 'lamp':
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 20), shared.dark, 0, 0.02, 0));
      if (variant === 0) {
        g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), shared.dark, 0, 0.67, 0));
        const shade = mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 20, 1, true), main, 0, 1.38, 0);
        shade.userData.glow = true;
        g.add(shade);
      } else {
        g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), shared.dark, 0, 0.27, 0));
        const globe = mesh(new THREE.SphereGeometry(0.2, 24, 16), main, 0, 0.7, 0);
        globe.userData.glow = true;
        g.add(globe);
      }
      break;
    case 'desk':
      g.add(mesh(rbox(w, 0.05, d, 0.02), main, 0, 0.7, 0));
      if (variant === 0) {
        for (const [x, z] of CORNERS)
          g.add(
            mesh(
              new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8),
              shared.dark,
              (x * w) / 2.3,
              0.35,
              (z * d) / 2.6,
            ),
          );
      } else {
        g.add(mesh(rbox(w * 0.35, 0.7, d - 0.04, 0.03), main, w * 0.3, 0, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), shared.dark, -w / 2.3, 0.35, -d / 2.6));
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), shared.dark, -w / 2.3, 0.35, d / 2.6));
      }
      break;
    case 'wardrobe':
      g.add(mesh(rbox(w, 1.9, d, 0.04), main));
      g.add(mesh(rbox(0.02, 1.7, 0.02, 0.005), shared.dark, 0, 0.1, d / 2));
      if (variant === 1) {
        // 반원기둥을 앞뒤 방향으로 눕혀 지붕처럼 얹고 높이만 납작하게
        const geo = new THREE.CylinderGeometry(w / 2, w / 2, d, 24, 1, false, -Math.PI / 2, Math.PI);
        geo.rotateX(-Math.PI / 2);
        geo.scale(1, 0.35, 1);
        g.add(mesh(geo, main, 0, 1.9, 0));
      }
      break;
    case 'chair':
      if (variant === 0) {
        g.add(mesh(rbox(w * 0.85, 0.08, d * 0.85, 0.03), main, 0, 0.4, 0));
        g.add(mesh(rbox(w * 0.85, 0.45, 0.06, 0.03), main, 0, 0.45, -d * 0.4));
        for (const [x, z] of CORNERS)
          g.add(
            mesh(
              new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8),
              shared.wood,
              x * w * 0.35,
              0.2,
              z * d * 0.35,
            ),
          );
      } else {
        g.add(mesh(new THREE.CylinderGeometry(w * 0.4, w * 0.4, 0.08, 24), main, 0, 0.44, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.42, 12), shared.dark, 0, 0.21, 0));
      }
      break;
    case 'sofa':
      g.add(mesh(rbox(w, 0.4, d), cloth));
      g.add(mesh(rbox(w, 0.45, 0.22), cloth, 0, 0.35, -d / 2 + 0.11));
      if (variant === 0) {
        g.add(mesh(rbox(0.2, 0.25, d), cloth, -w / 2 + 0.1, 0.35, 0));
        g.add(mesh(rbox(0.2, 0.25, d), cloth, w / 2 - 0.1, 0.35, 0));
      } else {
        for (const sx of [-1, 1]) {
          const arm = mesh(
            new THREE.CylinderGeometry(0.15, 0.15, d, 20),
            cloth,
            sx * (w / 2 - 0.15),
            0.45,
            0,
          );
          arm.rotation.x = Math.PI / 2;
          g.add(arm);
        }
      }
      break;
    case 'rug': {
      const rug =
        variant === 0
          ? mesh(rbox(w, 0.02, d, 0.01), cloth)
          : mesh(
              new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, 0.02, 48),
              cloth,
              0,
              0.01,
              0,
            );
      rug.castShadow = false;
      g.add(rug);
      break;
    }
    case 'drawer':
      if (variant === 0) {
        g.add(mesh(rbox(w, 0.9, d, 0.03), main));
        for (const y of [0.2, 0.48, 0.76])
          g.add(mesh(rbox(w * 0.2, 0.03, 0.03, 0.01), shared.dark, 0, y, d / 2));
      } else {
        g.add(mesh(rbox(w, 0.5, d, 0.03), main, 0, 0.25, 0));
        for (const y of [0.4, 0.6]) g.add(mesh(rbox(w * 0.2, 0.03, 0.03, 0.01), shared.dark, 0, y, d / 2));
        for (const [x, z] of CORNERS)
          g.add(
            mesh(
              new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8),
              shared.dark,
              x * w * 0.42,
              0.125,
              z * d * 0.35,
            ),
          );
      }
      break;
  }
  return g;
}
