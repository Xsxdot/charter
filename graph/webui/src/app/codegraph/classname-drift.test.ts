// @vitest-environment node
// classname-drift —— §2.5-40 防漂判据的机械检查：两轴新世界的交互控件必须有非空 className。
//
// 职责：对装配切换后仍存活的七个组件源码做静态扫描——每个 <button>/<select>/<a>/
// <input>/<textarea> 开标签必须带 className 属性且字面量值非空白。拦截「结构对、
// 样式无」漂移族（C12 spec 记录的约 38 处零 className 即此族的既往实害）。
//
// 边界与已知限制（评审对照面）：
// - 只断言「属性在场 ∧ 字面量非空白」；表达式形态（className={cond ? 'a' : 'b'}）
//   只查在场不追运行期空串——静态扫描查不出值，这是本检查的声明边界，不是漏洞豁免；
// - 禁止断言具体 class 值的原有纪律不变（spec 明文），本检查永不写期望样式表；
// - 扫描窗口按引号与花括号平衡找到真标签尾，`=>` 箭头、多行标签、属性含 '>' 均
//   不误报；组件内自产的非交互元素不在词表，天然跳过。
// 落点说明：breakdown K6 有界文件集把落点交给 plan——选 vitest 内嵌而非独立脚本，
// 与全量回归同闸执行，变异必红可直接复验（§4.3）。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CODEGRAPH_DIR = import.meta.dirname

/** 两轴新世界仍存活的组件全集：K4 五件套 + K5 两件 + K6 装配壳。 */
const SCANNED_COMPONENTS = [
  'TwoAxisPage.tsx',
  'ScopeCanvas.tsx',
  'RightPanel.tsx',
  'MigrationDrawer.tsx',
  'FlowChart.tsx',
  'FlowPageView.tsx',
  'CodegraphPage.tsx',
] as const

const INTERACTIVE_TAGS = ['button', 'select', 'a', 'input', 'textarea'] as const

/** 从标签起点按引号/花括号平衡找真正的 '>'（JSX 属性里允许 =>、对象字面量、多行）。 */
function tagEndAt(src: string, start: number): number {
  let i = start
  let quote = ''
  while (i < src.length) {
    const c = src[i]!
    if (quote !== '') {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '{') {
      let depth = 1
      i += 1
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth += 1
        else if (src[i] === '}') depth -= 1
        i += 1
      }
      continue
    } else if (c === '>') {
      return i
    }
    i += 1
  }
  return -1
}

function findViolations(source: string): string[] {
  const violations: string[] = []
  const tagOpen = new RegExp(`<(${INTERACTIVE_TAGS.join('|')})[\\s>]`, 'g')
  for (const m of source.matchAll(tagOpen)) {
    const end = tagEndAt(source, m.index)
    if (end < 0) continue
    const tag = source.slice(m.index, end + 1)
    const line = source.slice(0, m.index).split('\n').length
    const cm = tag.match(/className\s*=\s*("([^"]*)"|'([^']*)'|\{)/)
    if (!cm) {
      violations.push(`line ${line}: <${m[1]}> 缺 className`)
      continue
    }
    const literal = cm[2] ?? cm[3]
    if (literal !== undefined && literal.trim() === '') {
      violations.push(`line ${line}: <${m[1]}> className 为空白字面量`)
    }
  }
  return violations
}

describe('C12.6 §2.5-40 防漂：交互控件非空 className 机械检查', () => {
  for (const file of SCANNED_COMPONENTS) {
    it(`${file} 全部交互控件带非空 className`, () => {
      const source = readFileSync(join(CODEGRAPH_DIR, file), 'utf8')
      expect(findViolations(source)).toEqual([])
    })
  }

  it('扫描器自身有牙：构造缺 className 的样本必须被抓到', () => {
    expect(findViolations('<button type="button" data-x>\n点我</button>')).toEqual([
      'line 1: <button> 缺 className',
    ])
    expect(findViolations('<select onChange={() => f(">")} className="">')).toEqual([
      'line 1: <select> className 为空白字面量',
    ])
    expect(findViolations("<a href=\"#x\" className={'rounded ' + active}>链接</a>")).toEqual([])
  })
})
