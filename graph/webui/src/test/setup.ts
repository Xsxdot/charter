// setup.ts —— Vitest + RTL 的全局测试设置。
// 边界：只服务 viewer 测试，不引入任何宿主全局状态。
//
// jest-dom：接上 toBeDisabled / toHaveTextContent 等 matcher。
//
// RTL 清理：@testing-library/react 的自动 cleanup 只在检测到全局 afterEach 时
// 注册（dist/index.js）；本工程未开 vitest globals，没有该全局，DOM 会在用例间
// 累积，导致 getByRole/getByText 报 multiple matches。这里显式注册等价清理。
//
// 上游 handoff 版这里还有一个 vi.stubGlobal('jest', …) 桩，用于让 RTL 的 waitFor
// 走 fake-timer 分支。本工程一支测试都没有用 vi.useFakeTimers()，那个桩在这里是
// 死代码，已删除。将来若真要引入 fake timer，把它连同解释一起加回来。
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
