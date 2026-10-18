import { create } from 'zustand';

export type PerfLevel = 'low' | 'high';

export interface PerfPreset {
  maxDpr: number;
  shadowMapSize: number;
  volumetricLight: boolean;
  dustParticles: boolean;
  antialias: boolean;
}

export const PRESETS: Record<PerfLevel, PerfPreset> = {
  low: { maxDpr: 1.5, shadowMapSize: 512, volumetricLight: false, dustParticles: false, antialias: false },
  high: { maxDpr: 2, shadowMapSize: 1024, volumetricLight: true, dustParticles: true, antialias: true },
};

/** 간단한 기기 판정. 애매하면 low (WebView에서 발열·끊김이 더 치명적) */
function detectLevel(): PerfLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return mem >= 6 && cores >= 6 ? 'high' : 'low';
}

const STORAGE_KEY = 'darakbang.perf';

function readSaved(): PerfLevel | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'low' || v === 'high' ? v : null;
  } catch {
    return null;
  }
}

interface PerfState {
  level: PerfLevel;
  preset: PerfPreset;
  setLevel: (level: PerfLevel) => void;
}

const initial = readSaved() ?? detectLevel();

/** 사용자가 설정에서 직접 바꿀 수 있음 (선택값은 기기에 저장) */
export const usePerf = create<PerfState>((set) => ({
  level: initial,
  preset: PRESETS[initial],
  setLevel: (level) => {
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      /* 저장 실패해도 동작엔 영향 없음 */
    }
    set({ level, preset: PRESETS[level] });
  },
}));
