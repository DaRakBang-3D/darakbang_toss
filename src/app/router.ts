import { create } from 'zustand';

/** 화면 4개뿐이라 라우터 라이브러리 없이 상태로 관리. 늘어나면 교체 */
export type Page = 'home' | 'editor' | 'visit' | 'shop';

interface RouterState {
  page: Page;
  go: (page: Page) => void;
}

export const useRouter = create<RouterState>((set) => ({
  page: 'home',
  go: (page) => set({ page }),
}));
