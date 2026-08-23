// vite.config.ts —— viewer 的开发服务器与相对资源构建配置。
// 边界：生产资源必须可挂在任意同源路径，开发时只反代宿主 API。
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const agentdTarget = process.env.AGENTD_URL ?? 'http://127.0.0.1:7777'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': { target: agentdTarget } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
