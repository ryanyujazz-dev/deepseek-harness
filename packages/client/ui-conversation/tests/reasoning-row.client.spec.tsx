// @vitest-environment jsdom
// ReasoningRow clamp contract: the 15-line window, the Show more/less
// toggle riding the dictionary, and the overflow-gated rendering.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ReasoningRow } from '../src/client/chat/ReasoningRow.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

const t = makeTranslate(zh, commonZh)

/** Many wrapped lines of reasoning text. */
const longText = Array.from({ length: 40 }, (_, i) => `reasoning line ${i + 1}`).join('\n')
const shortText = 'just one thought'

/** jsdom has no layout: stub the clamp's geometry probes. */
function stubGeometry(element: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => clientHeight })
}

describe('ReasoningRow clamp', () => {

  it('renders the Show more toggle only when the text overflows the window', () => {
    const long = render(<ReasoningRow text={longText} running={false} defaultExpanded t={t} />)
    const longScroll = long.container.querySelector('[class*="thinkScroll"]') as HTMLElement
    stubGeometry(longScroll, 1200, 368)
    // The probe runs on reader scrolls too — drive it through the event.
    fireEvent.scroll(longScroll)
    expect(long.container.textContent).toContain('显示更多')

    const short = render(<ReasoningRow text={shortText} running={false} defaultExpanded t={t} />)
    const shortScroll = short.container.querySelector('[class*="thinkScroll"]') as HTMLElement
    stubGeometry(shortScroll, 100, 368)
    fireEvent.scroll(shortScroll)
    expect(short.container.textContent).not.toContain('显示更多')
  })

  it('collapses a long body behind the 15-line window by default', () => {
    const r = render(<ReasoningRow text={longText} running={false} defaultExpanded t={t} />)
    const scroll = r.container.querySelector('[class*="thinkScroll"]') as HTMLElement
    stubGeometry(scroll, 1200, 368)
    r.rerender(<ReasoningRow text={longText} running={false} defaultExpanded t={t} />)
    // The clamped attribute rides the wrapper while not full.
    const wrap = r.container.querySelector('[class*="thinkBody"]')
    expect(wrap?.hasAttribute('data-clamped')).toBe(true)
  })

  it('streams the LATEST line while running and the FIRST line after settling', () => {
    const runningView = render(<ReasoningRow text={'line one\nline two\nline three'} running defaultExpanded={false} t={t} />)
    const runningSummary = runningView.container.querySelector('[class*="summary"]')
    expect(runningSummary?.textContent).toBe('line three')
    const settledView = render(<ReasoningRow text={'line one\nline two\nline three'} running={false} defaultExpanded={false} t={t} />)
    const settledSummary = settledView.container.querySelector('[class*="summary"]')
    expect(settledSummary?.textContent).toBe('line one')
  })

  it('expands from the row click and folds back', () => {
    const view = render(<ReasoningRow text={longText} running={false} defaultExpanded={false} t={t} />)
    expect(view.container.querySelector('[class*="thinkBody"]')).toBeNull()
    fireEvent.click(view.getByRole('button'))
    expect(view.container.querySelector('[class*="thinkBody"]')).not.toBeNull()
    fireEvent.click(view.getByRole('button'))
    expect(view.container.querySelector('[class*="thinkBody"]')).toBeNull()
  })

  it('renders no IN card — the row is a disclosure, not a terminal', () => {
    const view = render(<ReasoningRow text={longText} running={false} defaultExpanded t={t} />)
    expect(view.container.querySelector('[class*="ioCard"]')).toBeNull()
    expect(view.container.querySelector('[class*="terminal"]')).toBeNull()
  })

  it('keeps the collapsed summary line when not expanded', () => {
    const r = render(<ReasoningRow text={longText} running={false} defaultExpanded={false} t={t} />)
    // Collapsed: the summary shows the first line, no body.
    expect(r.container.textContent).toContain('reasoning line 1')
    expect(r.container.querySelector('[class*="thinkBody"]')).toBeNull()
  })
})
