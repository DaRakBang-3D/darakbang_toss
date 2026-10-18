import * as THREE from 'three';
import {
  CATALOG,
  CELL,
  footprint,
  GRID,
  ROOM,
  WALL_H,
  type Mood,
  type TextureSlot,
} from '@/features/editor/catalog';
import type { PlacedItem } from '@/features/editor/roomStore';
import { buildItem, makePhotoMaterial } from './itemMeshes';
import type { PerfPreset } from './perfPreset';

export interface SceneState {
  items: PlacedItem[];
  wallColor: string;
  floorColor: string;
  mood: Mood;
  /** 슬롯별 사진 주소 (없으면 단색) */
  textureSrc: Partial<Record<TextureSlot, string>>;
  selectedId: string | null;
}

interface Callbacks {
  onSelect: (id: string | null) => void;
  /** 칸 좌표(소수). 반올림·범위 보정은 스토어가 한다 */
  onMove: (id: string, x: number, z: number) => void;
}

const ACCENT = '#f5b83d'; // 램프빛 노랑: 선택 전용
const TAP_SLOP = 6; // px: 이보다 덜 움직이면 탭
const AZ = { min: THREE.MathUtils.degToRad(12), max: THREE.MathUtils.degToRad(78) };
const POLAR = { min: THREE.MathUtils.degToRad(38), max: THREE.MathUtils.degToRad(68) };
const ZOOM = { min: 0.6, max: 1.25 };

/** 무드별 천창 빛 (브랜드 조명값은 씬 안에만 둔다) */
const MOOD_LIGHT: Record<
  Mood,
  {
    bg: string;
    sky: string;
    ground: string;
    hemi: number;
    spot: string;
    spotI: number;
    spotPos: [number, number, number];
    glow: number;
  }
> = {
  morning: {
    bg: '#f3ede4',
    sky: '#fff8ec',
    ground: '#b9a38a',
    hemi: 0.9,
    spot: '#ffe7b8',
    spotI: 60,
    spotPos: [0.4, 6.5, 0.6],
    glow: 0,
  },
  sunset: {
    bg: '#efd9c9',
    sky: '#ffd6b0',
    ground: '#8a6a5a',
    hemi: 0.65,
    spot: '#ff9a5c',
    spotI: 70,
    spotPos: [3.2, 5, 2.4],
    glow: 0.25,
  },
  night: {
    bg: '#262a38',
    sky: '#6070a0',
    ground: '#272733',
    hemi: 0.35,
    spot: '#a8b8ff',
    spotI: 22,
    spotPos: [0.4, 6.5, 0.6],
    glow: 1.1,
  },
};
/** 사진 반복 횟수: 정사각 사진이 벽(4m×2.6m)·바닥(4m×4m)에서 늘어나 보이지 않게 */
const WALL_REPEAT: [number, number] = [2, 1.3];
const FLOOR_REPEAT: [number, number] = [3, 3];
const H = ROOM / 2;
/** 화면에 반드시 들어와야 하는 방의 점: 바닥 네 모서리 + 두 벽의 윗선 */
const FIT_POINTS = [
  new THREE.Vector3(-H, 0, -H),
  new THREE.Vector3(H, 0, -H),
  new THREE.Vector3(-H, 0, H),
  new THREE.Vector3(H, 0, H),
  new THREE.Vector3(-H, WALL_H, -H),
  new THREE.Vector3(H, WALL_H, -H),
  new THREE.Vector3(-H, WALL_H, H),
];
// 렌더마다 new 하지 않도록 재사용하는 벡터 (씬 규칙)
const CAM_TARGET = new THREE.Vector3(0, WALL_H * 0.32, 0);
const TMP_DIR = new THREE.Vector3();
const TMP_PROJ = new THREE.Vector3();

/**
 * 다락방 3D 씬 (React 밖에서 관리).
 * - 변화가 있을 때만 그린다 (상시 루프 없음 → 배터리·발열 절약)
 * - 카메라 거리는 화면 비율로 계산 → 어떤 폰에서도 방 전체가 보임
 */
export class RoomScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private itemsRoot = new THREE.Group();
  private itemObjs = new Map<string, { group: THREE.Group; key: string }>();
  private hemi!: THREE.HemisphereLight;
  private sky!: THREE.SpotLight;
  private textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private photoMat: { src: string; mat: THREE.MeshStandardMaterial } | null = null;
  private selection: THREE.Group;
  private grid: THREE.GridHelper;
  private ro: ResizeObserver;
  private frame = 0;

  private az = THREE.MathUtils.degToRad(45);
  private polar = THREE.MathUtils.degToRad(55);
  private zoom = 1;
  private state: SceneState | null = null;

  private pointers = new Map<number, { x: number; y: number }>();
  private gesture:
    | { kind: 'none' }
    | { kind: 'drag'; id: string; offset: THREE.Vector3 }
    | { kind: 'orbit'; startX: number; startY: number; moved: boolean }
    | { kind: 'pinch'; startDist: number; startZoom: number } = { kind: 'none' };

  constructor(
    private host: HTMLElement,
    preset: PerfPreset,
    private cb: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxDpr));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#f3ede4');
    this.buildRoom(preset);
    this.scene.add(this.itemsRoot);

    this.selection = this.buildSelection();
    this.scene.add(this.selection);
    this.grid = new THREE.GridHelper(ROOM, GRID, ACCENT, '#bfae96');
    this.grid.position.y = 0.011;
    this.grid.visible = false;
    this.scene.add(this.grid);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMoveEvt);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  // ---------- 공개 API ----------

  sync(state: SceneState) {
    this.state = state;
    this.applySurface(this.wallMat, state.wallColor, state.textureSrc.wall, WALL_REPEAT);
    this.applySurface(this.floorMat, state.floorColor, state.textureSrc.floor, FLOOR_REPEAT);
    this.applyMood(state.mood);
    const photo = this.fabricMaterial(state.textureSrc.fabric);
    const glow = MOOD_LIGHT[state.mood].glow;

    const alive = new Set<string>();
    for (const it of state.items) {
      alive.add(it.id);
      const usePhoto = it.useFabricPhoto && CATALOG[it.type].fabric && photo;
      const key = `${it.type}|${it.variant}|${it.material}|${it.color}|${usePhoto ? state.textureSrc.fabric : ''}|${glow}`;
      let obj = this.itemObjs.get(it.id);
      if (!obj || obj.key !== key) {
        if (obj) this.disposeGroup(obj.group);
        const group = buildItem({ ...it, photo: usePhoto ? photo : null });
        // 밤·노을 무드에서 전등 갓이 은은하게 빛남 (실제 광원 추가 없이 → 성능 부담 없음)
        group.traverse((o) => {
          if (o instanceof THREE.Mesh && o.userData.glow) {
            const m = o.material as THREE.MeshStandardMaterial;
            m.emissive.copy(m.color);
            m.emissiveIntensity = glow;
          }
        });
        group.userData.itemId = it.id;
        group.traverse((o) => (o.userData.itemId = it.id));
        this.itemsRoot.add(group);
        obj = { group, key };
        this.itemObjs.set(it.id, obj);
      }
      const { w, d } = footprint(it.type, it.rot);
      obj.group.position.set(-ROOM / 2 + (it.x + w / 2) * CELL, 0, -ROOM / 2 + (it.z + d / 2) * CELL);
      obj.group.rotation.y = (-it.rot * Math.PI) / 2;
    }
    for (const [id, obj] of this.itemObjs) {
      if (!alive.has(id)) {
        this.disposeGroup(obj.group);
        this.itemObjs.delete(id);
      }
    }

    const sel = state.items.find((i) => i.id === state.selectedId);
    this.selection.visible = !!sel;
    if (sel) {
      const { w, d } = footprint(sel.type, sel.rot);
      this.selection.scale.set(w * CELL, 1, d * CELL);
      this.selection.position.set(
        -ROOM / 2 + (sel.x + w / 2) * CELL,
        0.012,
        -ROOM / 2 + (sel.z + d / 2) * CELL,
      );
    }
    this.requestRender();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMoveEvt);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.textures.forEach((t) => t.dispose());
    this.photoMat?.mat.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // ---------- 장면 구성 ----------

  private buildRoom(preset: PerfPreset) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM, 0.1, ROOM), this.floorMat);
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, WALL_H, ROOM + 0.1), this.wallMat);
    wallL.position.set(-ROOM / 2 - 0.05, WALL_H / 2, -0.05);
    const wallB = new THREE.Mesh(new THREE.BoxGeometry(ROOM, WALL_H, 0.1), this.wallMat);
    wallB.position.set(0, WALL_H / 2, -ROOM / 2 - 0.05);
    wallL.receiveShadow = wallB.receiveShadow = true;
    this.scene.add(floor, wallL, wallB);

    // 브랜드 시그니처: 천창 빛 (색·세기·위치는 무드에 따라 applyMood가 바꿈)
    this.hemi = new THREE.HemisphereLight('#fff8ec', '#b9a38a', 0.9);
    this.scene.add(this.hemi);
    const sky = new THREE.SpotLight('#ffe7b8', 60, 14, Math.PI / 5, 0.95, 1.4);
    this.sky = sky;
    sky.position.set(0.4, 6.5, 0.6);
    sky.target.position.set(0, 0, 0);
    sky.castShadow = true;
    sky.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    sky.shadow.radius = 6;
    sky.shadow.bias = -0.0005;
    this.scene.add(sky, sky.target);
  }

  private applyMood(mood: Mood) {
    const m = MOOD_LIGHT[mood];
    (this.scene.background as THREE.Color).set(m.bg);
    this.hemi.color.set(m.sky);
    this.hemi.groundColor.set(m.ground);
    this.hemi.intensity = m.hemi;
    this.sky.color.set(m.spot);
    this.sky.intensity = m.spotI;
    this.sky.position.set(...m.spotPos);
  }

  /** 사진 텍스처 로드 (주소별 1회, 로드되면 다시 그림) */
  private texture(src: string) {
    let t = this.textures.get(src);
    if (!t) {
      t = this.loader.load(src, () => this.requestRender());
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.textures.set(src, t);
    }
    return t;
  }

  /** 벽·바닥: 사진이 있으면 사진(색은 흰색이어야 사진 색 그대로), 없으면 단색 */
  private applySurface(
    mat: THREE.MeshStandardMaterial,
    color: string,
    src: string | undefined,
    repeat: [number, number],
  ) {
    const map = src ? this.texture(src) : null;
    if (map) map.repeat.set(...repeat);
    if (mat.map !== map) {
      mat.map = map;
      mat.needsUpdate = true;
    }
    mat.color.set(map ? '#ffffff' : color);
  }

  /** 패브릭 사진 재질: 사진이 바뀔 때만 새로 만들고 이전 것은 정리 */
  private fabricMaterial(src: string | undefined) {
    if (this.photoMat?.src === src) return this.photoMat?.mat ?? null;
    this.photoMat?.mat.dispose();
    this.photoMat = null;
    if (!src) return null;
    const mat = makePhotoMaterial(this.texture(src));
    mat.userData.shared = true; // 여러 소품이 함께 씀 → 소품 삭제 시 dispose 안 함
    this.photoMat = { src, mat };
    return mat;
  }

  private buildSelection() {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: ACCENT }),
    );
    g.add(fill, edge);
    g.visible = false;
    return g;
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material;
        if (!m.userData.shared) m.dispose();
      }
    });
    group.removeFromParent();
  }

  // ---------- 카메라 / 렌더 ----------

  /**
   * 화면 비율 맞춤: 방의 실제 모서리(바닥 4점 + 벽 윗선 3점)가 화면 안(여백 8%)에 들어오는
   * 가장 가까운 거리를 이분 탐색. 세로로 긴 폰·폴드·태블릿 모두 방이 꽉 차게 보인다.
   */
  private placeCamera() {
    const dir = TMP_DIR.set(
      Math.sin(this.polar) * Math.sin(this.az),
      Math.cos(this.polar),
      Math.sin(this.polar) * Math.cos(this.az),
    );
    const put = (dist: number) => {
      this.camera.position.copy(CAM_TARGET).addScaledVector(dir, dist);
      this.camera.lookAt(CAM_TARGET);
      this.camera.updateMatrixWorld();
    };
    const fits = () =>
      FIT_POINTS.every((p) => {
        const v = TMP_PROJ.copy(p).project(this.camera);
        return Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.92;
      });

    let lo = 2;
    let hi = 40;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      put(mid);
      if (fits()) hi = mid;
      else lo = mid;
    }
    put(hi * this.zoom);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.placeCamera();
      this.renderer.render(this.scene, this.camera);
    });
  }

  // ---------- 입력 ----------

  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private floorPoint(e: PointerEvent) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.floorPlane, p) ? p : null;
  }

  private pickItem(e: PointerEvent): string | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit = this.raycaster.intersectObjects(this.itemsRoot.children, true)[0];
    return (hit?.object.userData.itemId as string | undefined) ?? null;
  }

  private onDown = (e: PointerEvent) => {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.endDrag();
      this.gesture = { kind: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y), startZoom: this.zoom };
      return;
    }
    if (this.pointers.size > 2) return;

    const id = this.pickItem(e);
    const it = id && this.state?.items.find((i) => i.id === id);
    const p = this.floorPoint(e);
    if (it && p) {
      this.cb.onSelect(it.id);
      const obj = this.itemObjs.get(it.id)!;
      this.gesture = { kind: 'drag', id: it.id, offset: p.sub(obj.group.position).setY(0) };
      this.grid.visible = true;
      this.requestRender();
    } else {
      this.gesture = { kind: 'orbit', startX: e.clientX, startY: e.clientY, moved: false };
    }
  };

  private onMoveEvt = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;

    if (g.kind === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom = THREE.MathUtils.clamp((g.startZoom * g.startDist) / Math.max(dist, 1), ZOOM.min, ZOOM.max);
      this.requestRender();
    } else if (g.kind === 'drag' && this.state) {
      const p = this.floorPoint(e);
      const it = this.state.items.find((i) => i.id === g.id);
      if (!p || !it) return;
      p.sub(g.offset);
      const { w, d } = footprint(it.type, it.rot);
      this.cb.onMove(g.id, (p.x + ROOM / 2) / CELL - w / 2, (p.z + ROOM / 2) / CELL - d / 2);
    } else if (g.kind === 'orbit') {
      if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < TAP_SLOP) return;
      g.moved = true;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.az = THREE.MathUtils.clamp(this.az - dx * 0.006, AZ.min, AZ.max);
      this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.004, POLAR.min, POLAR.max);
      this.requestRender();
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g.kind === 'orbit' && !g.moved) this.cb.onSelect(null); // 빈 곳 탭 → 선택 해제
    if (this.pointers.size === 0) {
      this.endDrag();
      this.gesture = { kind: 'none' };
    }
  };

  private endDrag() {
    if (this.grid.visible) {
      this.grid.visible = false;
      this.requestRender();
    }
  }
}
