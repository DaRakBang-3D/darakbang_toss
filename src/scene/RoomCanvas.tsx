import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { usePerf } from './perfPreset';

/**
 * 최소 방 씬 (바닥 + 벽 2면 + 천창 빛).
 * TODO: @darakbang/editor-core 배포 후 이 컴포넌트를 공유 에디터로 교체
 */
export default function RoomCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const preset = usePerf((s) => s.preset);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxDpr));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3ede4');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(6, 5, 6);
    camera.lookAt(0, 1, 0);

    const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 5), mat('#d9c3a5'));
    floor.receiveShadow = true;
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 5), mat('#efe6da'));
    wallL.position.set(-2.6, 1.5, 0);
    const wallB = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.2), mat('#efe6da'));
    wallB.position.set(0, 1.5, -2.6);
    [wallL, wallB].forEach((w) => (w.receiveShadow = true));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat('#f5b83d'));
    box.position.set(0, 0.5, 0);
    box.castShadow = true;
    scene.add(floor, wallL, wallB, box);

    // 시그니처: 천창 빛
    scene.add(new THREE.HemisphereLight('#fff8ec', '#b9a38a', 0.6));
    const sky = new THREE.SpotLight('#ffe7b8', 40, 12, Math.PI / 7, 0.95);
    sky.position.set(0.5, 6, 0.5);
    sky.castShadow = true;
    sky.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    sky.shadow.radius = 6;
    scene.add(sky);

    // 변화가 있을 때만 그린다 (상시 rAF 루프 금지 → 배터리·발열 절약). 지금은 크기 변경 시에만
    const resizeAndRender = () => {
      const { clientWidth: w, clientHeight: h } = host;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resizeAndRender);
    ro.observe(host);
    resizeAndRender();

    return () => {
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [preset]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />;
}
