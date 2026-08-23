// setup.ts —— Vitest + RTL 的清理与 fake-timer 桥。
// 边界：只服务 viewer 测试，不引入 handoff 全局状态。
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())
vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
