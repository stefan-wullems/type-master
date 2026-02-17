import { describe, it, expect, afterEach } from 'vitest'
import { setupDOM } from './dom'
import type { TypingEngineEnv } from './engine'
import { lightTheme } from './theme'

function createEnv(doc: Document): TypingEngineEnv {
  return {
    document: doc,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
  }
}

function makeRange(doc: Document, html: string): { range: Range; container: HTMLElement } {
  const container = doc.createElement('div')
  container.innerHTML = html
  doc.body.appendChild(container)
  const range = doc.createRange()
  range.selectNodeContents(container)
  return { range, container }
}

describe('setupDOM', () => {
  let container: HTMLElement
  let destroy: (() => void) | undefined

  afterEach(() => {
    destroy?.()
    container?.remove()
  })

  it('creates typing-char spans from text', () => {
    const { range, container: c } = makeRange(document, '<p>Hello</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)
    destroy = result.destroy

    expect(result.spans.length).toBe(6) // 5 chars + 1 enter
    expect(result.characters.length).toBe(6)
    expect(result.characters[0].char).toBe('H')
    expect(result.characters[4].char).toBe('o')
  })

  it('inserts enter markers at end of blocks', () => {
    const { range, container: c } = makeRange(document, '<p>Hi</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)
    destroy = result.destroy

    const lastChar = result.characters[result.characters.length - 1]
    expect(lastChar.isEnterRequired).toBe(true)
    expect(lastChar.char).toBe('\u23CE')
  })

  it('assigns block indices to characters', () => {
    const { range, container: c } = makeRange(document, '<p>A</p><p>B</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)
    destroy = result.destroy

    const aChar = result.characters.find(c => c.char === 'A')!
    const bChar = result.characters.find(c => c.char === 'B')!
    expect(aChar.blockIndex).not.toBe(bChar.blockIndex)
  })

  it('inserts enter markers for multiple blocks', () => {
    const { range, container: c } = makeRange(document, '<p>A</p><p>B</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)
    destroy = result.destroy

    const enters = result.characters.filter(c => c.isEnterRequired)
    expect(enters.length).toBe(2)
  })

  it('destroy restores original text nodes', () => {
    const { range, container: c } = makeRange(document, '<p>Hello</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)
    result.destroy()
    destroy = undefined

    expect(container.querySelector('.typing-char')).toBeNull()
    expect(container.textContent).toBe('Hello')
  })

  it('destroy removes style element', () => {
    const { range, container: c } = makeRange(document, '<p>Hi</p>')
    container = c
    const result = setupDOM(range, createEnv(document), lightTheme)

    const stylesBefore = Array.from(document.querySelectorAll('style')).filter(s =>
      s.textContent?.includes('typing-char')
    )
    expect(stylesBefore.length).toBe(1)

    result.destroy()
    destroy = undefined

    const stylesAfter = Array.from(document.querySelectorAll('style')).filter(s =>
      s.textContent?.includes('typing-char')
    )
    expect(stylesAfter.length).toBe(0)
  })

  it('handles empty range', () => {
    const container2 = document.createElement('div')
    document.body.appendChild(container2)
    container = container2
    const range = document.createRange()
    range.selectNodeContents(container2)
    const result = setupDOM(range, createEnv(document), lightTheme)
    destroy = result.destroy

    expect(result.spans).toHaveLength(0)
    expect(result.characters).toHaveLength(0)
  })
})
