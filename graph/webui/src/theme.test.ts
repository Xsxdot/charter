// theme.test.ts —— 锁 index.css 里三条「搬迁最容易整段丢掉」的样式事实。
// 边界：只读 CSS 源文件做结构断言，不渲染组件、不验像素——版式效果靠真机看，
// 这里守的是「这几行还在不在」。它们全是无 DOM 后果的全局样式，组件测试照不到：
// 上一轮搬迁把高度链、Geist 自托管、滚动条弱化三样一起丢了，10 个组件测试全绿。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
// 先剥注释再解析：本文件的注释里有中文逗号也有半角逗号，留着会被下面按 ',' 切
// 选择器列表的逻辑当成选择器，把紧跟注释的那条规则的首个选择器吃掉。
const css = readFileSync(resolve(here, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** declarationsFor 收集所有「选择器列表含 sel」的规则块正文，合并成一段。
 *  按 `}` 粗切即可：本文件不含嵌套 at-rule 以外的花括号，且我们只查声明存在性。 */
function declarationsFor(sel: string): string {
  return css
    .split('}')
    .map((chunk) => chunk.split('{'))
    .filter((parts) => parts.length === 2)
    .filter(([selectors]) => selectors.split(',').some((s) => s.trim().split(/\s+/).pop() === sel))
    .map(([, body]) => body)
    .join('\n')
}

describe('index.css 全局样式', () => {
  // 为什么必须是确定高度：CodegraphPage 根元素是 flex h-full flex-col，h-full 的
  // 百分比对着 auto 高度会解析失败，三栏塌成内容高，左右内容区各自的
  // overflow 滚动失效，中图坐标与全景区高度也会按塌掉的高度计算。min-height
  // 撑不起百分比链。
  it.each(['html', 'body', '#root'])('%s 有确定高度，撑起 h-full 百分比链', (sel) => {
    expect(declarationsFor(sel)).toMatch(/height:\s*100%/)
  })

  it('自托管 Geist：字体文件真在仓里，不引 CDN', () => {
    const face = css.match(/@font-face\s*\{[^}]*\}/)
    expect(face, '缺少 @font-face').toBeTruthy()
    expect(face![0]).toMatch(/font-family:\s*'Geist'/)
    const src = face![0].match(/url\(\s*'([^']+)'/)
    expect(src, '@font-face 缺少 url()').toBeTruthy()
    // 引用的文件必须真在仓里。/fonts/x 是 Vite 的 publicDir 写法，实体在 public/fonts/x
    const onDisk = src![1].startsWith('/') ? resolve(here, '../public', src![1].slice(1)) : resolve(here, src![1])
    expect(() => readFileSync(onDisk), `字体文件不存在：${onDisk}`).not.toThrow()
  })

  // 为什么把 base 一起锁进来：@font-face 写的是 publicDir 绝对路径 /fonts/…，
  // 它能挂在宿主子路径下，全靠 base:'./' 让 Vite 把它改写成 CSS 相对的
  // ../fonts/…（本轮 vite 6.4.3 实测产物为 url(../fonts/Geist-Variable.woff2)）。
  // 把 base 改回 '/' 不会让任何组件测试变红，字体却会在非根挂载点静默 404。
  it('构建 base 是相对的，字体与 JS/CSS 才能挂在任意同源路径', () => {
    const config = readFileSync(resolve(here, '../vite.config.ts'), 'utf8')
    expect(config).toMatch(/base:\s*'\.\/'/)
  })

  it('--font-sans 首位是 Geist，回退栈覆盖中英文', () => {
    const stack = css.match(/--font-sans:\s*([^;]+);/)
    expect(stack, '缺少 --font-sans').toBeTruthy()
    expect(stack![1].trim().startsWith("'Geist'")).toBe(true)
    expect(stack![1]).toContain('PingFang SC')
  })

  it('滚动条弱化：标准属性与 webkit 伪元素两套都在', () => {
    expect(css).toMatch(/scrollbar-width:\s*thin/)
    expect(css).toMatch(/scrollbar-color:/)
    for (const pseudo of ['::-webkit-scrollbar', '::-webkit-scrollbar-track', '::-webkit-scrollbar-thumb']) {
      expect(css, `缺少 ${pseudo} 规则`).toContain(pseudo)
    }
  })
})
