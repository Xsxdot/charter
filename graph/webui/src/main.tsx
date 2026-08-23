// main.tsx：只组装 viewer 页面；静态资源 base 由 Vite 配置改写。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CodegraphPage } from './app/codegraph/CodegraphPage'

createRoot(document.getElementById('root')!).render(<StrictMode><CodegraphPage /></StrictMode>)
