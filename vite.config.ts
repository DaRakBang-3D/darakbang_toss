import { fileURLToPath, URL } from 'node:url';
import aitDevtools from '@apps-in-toss/devtools/unplugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // aitDevtools: 브라우저에서 SDK를 mock으로 치환 + 패널 표시 (프로덕션 빌드에선 비활성)
  plugins: [react(), aitDevtools.vite()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173 },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        // three는 덩치가 커서 별도 청크로 분리 (첫 화면 로딩 단축)
        manualChunks: { three: ['three'] },
      },
    },
  },
});
