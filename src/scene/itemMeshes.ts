import * as THREE from 'three';
import { CATALOG, CELL, type ItemType } from '@/editor/catalog';

// ---- 절차 생성 메시 (glTF 없이 기본 도형만. 다운로드 0) ----

const shared = {
  wood: new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: '#f6f1ea', roughness: 0.9 }),
  pot: new THREE.MeshStandardMaterial({ color: '#d7896b', roughness: 0.9 }),
};
// 여러 소품이 함께 쓰는 재질 → 소품 삭제 시 dispose 하지 않음
Object.values(shared).forEach((m) => (m.userData.shared = true));

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

/** 소품 그룹 생성. 원점 = 바닥 중심, 회전 0 기준 크기 w×d 칸 */
export function buildItem(type: ItemType, color: string): THREE.Group {
  const g = new THREE.Group();
  const main = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const { w: cw, d: cd } = CATALOG[type];
  const w = cw * CELL - 0.06;
  const d = cd * CELL - 0.06;

  switch (type) {
    case 'bed':
      g.add(mesh(rbox(w, 0.35, d), shared.wood));
      g.add(mesh(rbox(w - 0.08, 0.18, d - 0.1), shared.white, 0, 0.35, 0.02));
      g.add(mesh(rbox(w - 0.1, 0.06, d * 0.62), main, 0, 0.52, d * 0.17));
      g.add(mesh(rbox(w * 0.38, 0.12, 0.3), shared.white, -w * 0.22, 0.53, -d / 2 + 0.25));
      g.add(mesh(rbox(w * 0.38, 0.12, 0.3), shared.white, w * 0.22, 0.53, -d / 2 + 0.25));
      g.add(mesh(rbox(w, 0.9, 0.08), shared.wood, 0, 0, -d / 2 + 0.04));
      break;
    case 'sofa':
      g.add(mesh(rbox(w, 0.4, d), main));
      g.add(mesh(rbox(w, 0.45, 0.22), main, 0, 0.35, -d / 2 + 0.11));
      g.add(mesh(rbox(0.2, 0.25, d), main, -w / 2 + 0.1, 0.35, 0));
      g.add(mesh(rbox(0.2, 0.25, d), main, w / 2 - 0.1, 0.35, 0));
      break;
    case 'table': {
      g.add(mesh(rbox(w, 0.06, d, 0.03), main, 0, 0.66, 0));
      const leg = new THREE.CylinderGeometry(0.04, 0.04, 0.66, 10);
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const)
        g.add(mesh(leg, shared.wood, (x * w) / 2.6, 0.33, (z * d) / 2.6));
      break;
    }
    case 'chair':
      g.add(mesh(rbox(w * 0.85, 0.08, d * 0.85, 0.03), main, 0, 0.4, 0));
      g.add(mesh(rbox(w * 0.85, 0.45, 0.06, 0.03), main, 0, 0.45, -d * 0.4));
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const)
        g.add(
          mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8),
            shared.wood,
            x * w * 0.35,
            0.2,
            z * d * 0.35,
          ),
        );
      break;
    case 'shelf':
      g.add(mesh(rbox(w, 1.6, d, 0.03), main));
      for (const y of [0.4, 0.8, 1.2])
        g.add(mesh(rbox(w - 0.12, 0.04, d - 0.06, 0.01), shared.white, 0, y, 0.03));
      break;
    case 'lamp':
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 20), shared.wood, 0, 0.02, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), shared.wood, 0, 0.67, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 20, 1, true), main, 0, 1.38, 0));
      break;
    case 'plant':
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.28, 16), shared.pot, 0, 0.14, 0));
      g.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), main, 0, 0.5, 0));
      g.add(mesh(new THREE.SphereGeometry(0.14, 16, 12), main, 0.08, 0.68, 0.04));
      break;
    case 'rug': {
      const rug = mesh(rbox(w, 0.02, d, 0.01), main);
      rug.castShadow = false;
      g.add(rug);
      break;
    }
  }
  return g;
}
