import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeChar, TypingEngine, TypingEngineEnv } from './typing-engine'

function createEnv(doc: Document): TypingEngineEnv {
  return {
    document: doc,
    getComputedStyle: window.getComputedStyle,
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

function pressKey(doc: Document, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  doc.dispatchEvent(event)
}

function getChars(doc: Document): HTMLSpanElement[] {
  return Array.from(doc.querySelectorAll('.typing-char')) as HTMLSpanElement[]
}

describe('normalizeChar', () => {
  it('normalizes smart single quotes to straight quote', () => {
    expect(normalizeChar('\u2018')).toBe("'")
    expect(normalizeChar('\u2019')).toBe("'")
  })

  it('normalizes smart double quotes to straight quote', () => {
    expect(normalizeChar('\u201C')).toBe('"')
    expect(normalizeChar('\u201D')).toBe('"')
  })

  it('normalizes en-dash and em-dash to hyphen', () => {
    expect(normalizeChar('\u2013')).toBe('-')
    expect(normalizeChar('\u2014')).toBe('-')
  })

  it('passes regular chars through unchanged', () => {
    expect(normalizeChar('a')).toBe('a')
    expect(normalizeChar('Z')).toBe('Z')
    expect(normalizeChar('1')).toBe('1')
  })
})

describe('TypingEngine', () => {
  let engine: TypingEngine
  let container: HTMLElement

  afterEach(() => {
    engine?.destroy()
    container?.remove()
  })

  describe('text discovery & span creation', () => {
    it('creates typing-char spans from text content', () => {
      const { range, container: c } = makeRange(document, '<p>Hello</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      // 5 chars + 1 enter marker
      expect(chars.length).toBe(6)
      expect(chars[0].textContent).toBe('H')
      expect(chars[4].textContent).toBe('o')
    })

    it('inserts enter markers at end of blocks', () => {
      const { range, container: c } = makeRange(document, '<p>Hi</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      const lastChar = chars[chars.length - 1]
      expect(lastChar.classList.contains('enter-required')).toBe(true)
      expect(lastChar.textContent).toBe('\u23CE')
    })

    it('inserts separate enter markers for multiple blocks', () => {
      const { range, container: c } = makeRange(document, '<p>A</p><p>B</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      const enterChars = chars.filter((c) => c.classList.contains('enter-required'))
      expect(enterChars.length).toBe(2)
    })

    it('marks first char as current', () => {
      const { range, container: c } = makeRange(document, '<p>Hi</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      expect(chars[0].classList.contains('current')).toBe(true)
    })
  })

  describe('typing behavior', () => {
    beforeEach(() => {
      const { range, container: c } = makeRange(document, '<p>abc</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))
    })

    it('correct character adds correct class', () => {
      pressKey(document, 'a')
      const chars = getChars(document)
      expect(chars[0].classList.contains('correct')).toBe(true)
    })

    it('wrong character adds incorrect class', () => {
      pressKey(document, 'x')
      const chars = getChars(document)
      expect(chars[0].classList.contains('incorrect')).toBe(true)
    })

    it('cursor advances after keystroke', () => {
      pressKey(document, 'a')
      const chars = getChars(document)
      expect(chars[0].classList.contains('current')).toBe(false)
      expect(chars[1].classList.contains('current')).toBe(true)
    })

    it('backspace moves cursor back and clears state', () => {
      pressKey(document, 'a')
      pressKey(document, 'Backspace')
      const chars = getChars(document)
      expect(chars[0].classList.contains('current')).toBe(true)
      expect(chars[0].classList.contains('correct')).toBe(false)
    })

    it('backspace at position 0 is a no-op', () => {
      pressKey(document, 'Backspace')
      const chars = getChars(document)
      expect(chars[0].classList.contains('current')).toBe(true)
    })

    it('previously incorrect then corrected gets corrected class', () => {
      pressKey(document, 'x') // incorrect
      pressKey(document, 'Backspace') // go back
      pressKey(document, 'a') // correct this time
      const chars = getChars(document)
      expect(chars[0].classList.contains('corrected')).toBe(true)
      expect(chars[0].classList.contains('correct')).toBe(false)
    })
  })

  describe('enter / end-of-block behavior', () => {
    it('Enter on enter-required span marks correct', () => {
      const { range, container: c } = makeRange(document, '<p>a</p><p>b</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      const enterSpan = chars.find((c) => c.classList.contains('enter-required'))!

      pressKey(document, 'a') // type 'a', cursor moves to enter marker
      pressKey(document, 'Enter') // enter marker

      expect(enterSpan.classList.contains('correct')).toBe(true)
    })

    it('regular key on enter-required span marks incorrect', () => {
      const { range, container: c } = makeRange(document, '<p>a</p><p>b</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const chars = getChars(document)
      const enterSpan = chars.find((c) => c.classList.contains('enter-required'))!

      pressKey(document, 'a') // type 'a', cursor moves to enter marker
      pressKey(document, 'x') // wrong key on enter marker

      expect(enterSpan.classList.contains('incorrect')).toBe(true)
    })

    it('after Enter, consecutive enter spans auto-skip to next text block', () => {
      const { range, container: c } = makeRange(document, '<p>a</p><p>b</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      pressKey(document, 'a') // type 'a'
      pressKey(document, 'Enter') // enter after first block - should skip to 'b'

      const chars = getChars(document)
      const bSpan = chars.find((c) => c.textContent === 'b')!
      expect(bSpan.classList.contains('current')).toBe(true)
    })
  })

  describe('tab / block skipping', () => {
    it('Tab skips to first char of next block', () => {
      const { range, container: c } = makeRange(document, '<p>ab</p><p>cd</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      pressKey(document, 'Tab')

      const chars = getChars(document)
      const cSpan = chars.find((c) => c.textContent === 'c')!
      expect(cSpan.classList.contains('current')).toBe(true)
    })

    it('Tab on last block is a no-op', () => {
      const { range, container: c } = makeRange(document, '<p>ab</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const charsBefore = getChars(document)
      expect(charsBefore[0].classList.contains('current')).toBe(true)

      pressKey(document, 'Tab')

      // Still on same position
      const charsAfter = getChars(document)
      expect(charsAfter[0].classList.contains('current')).toBe(true)
    })
  })

  describe('stats / metrics', () => {
    it('onStatsChange fires after keystrokes via interval', () => {
      vi.useFakeTimers()
      const { range, container: c } = makeRange(document, '<p>abc</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const statsCalls: any[] = []
      engine.onStatsChange = (stats) => statsCalls.push(stats)

      pressKey(document, 'a')
      vi.advanceTimersByTime(1000)

      expect(statsCalls.length).toBeGreaterThan(0)
      expect(statsCalls[0].correctKeystrokes).toBe(1)
      expect(statsCalls[0].totalKeystrokes).toBe(1)
      expect(statsCalls[0].accuracy).toBe(100)

      vi.useRealTimers()
    })

    it('accuracy reflects correct/total ratio', () => {
      vi.useFakeTimers()
      const { range, container: c } = makeRange(document, '<p>abc</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const statsCalls: any[] = []
      engine.onStatsChange = (stats) => statsCalls.push(stats)

      pressKey(document, 'a') // correct
      pressKey(document, 'x') // incorrect
      vi.advanceTimersByTime(1000)

      const last = statsCalls[statsCalls.length - 1]
      expect(last.accuracy).toBe(50) // 1/2 * 100

      vi.useRealTimers()
    })

    it('onComplete fires when all chars typed', () => {
      const { range, container: c } = makeRange(document, '<p>a</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      let completedStats: any = null
      engine.onComplete = (stats) => {
        completedStats = stats
      }

      pressKey(document, 'a') // type 'a'
      pressKey(document, 'Enter') // enter marker - this completes it

      expect(completedStats).not.toBeNull()
      expect(completedStats.correctKeystrokes).toBe(2)
    })
  })

  describe('pause detection', () => {
    it('5-second idle triggers pause', () => {
      vi.useFakeTimers()
      const { range, container: c } = makeRange(document, '<p>abcdef</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const statsCalls: any[] = []
      engine.onStatsChange = (stats) => statsCalls.push(stats)

      pressKey(document, 'a')
      vi.advanceTimersByTime(6000) // trigger pause detection

      // WPM should be calculated excluding paused time
      expect(statsCalls.length).toBeGreaterThan(0)

      vi.useRealTimers()
    })
  })

  describe('lifecycle / cleanup', () => {
    it('destroy restores original text nodes', () => {
      const { range, container: c } = makeRange(document, '<p>Hello</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      engine.destroy()

      expect(container.querySelector('.typing-char')).toBeNull()
      expect(container.textContent).toBe('Hello')
    })

    it('destroy removes style element', () => {
      const { range, container: c } = makeRange(document, '<p>Hi</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      const stylesBefore = document.querySelectorAll('style')
      const engineStyles = Array.from(stylesBefore).filter((s) =>
        s.textContent?.includes('typing-char')
      )
      expect(engineStyles.length).toBe(1)

      engine.destroy()

      const stylesAfter = document.querySelectorAll('style')
      const engineStylesAfter = Array.from(stylesAfter).filter((s) =>
        s.textContent?.includes('typing-char')
      )
      expect(engineStylesAfter.length).toBe(0)
    })

    it('Escape triggers destroy', () => {
      const { range, container: c } = makeRange(document, '<p>Hello</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      pressKey(document, 'Escape')

      expect(container.querySelector('.typing-char')).toBeNull()
      expect(container.textContent).toBe('Hello')
    })

    it('destroy removes keydown listener', () => {
      const { range, container: c } = makeRange(document, '<p>abc</p>')
      container = c
      engine = new TypingEngine(range, createEnv(document))

      engine.destroy()

      // After destroy, typing should have no effect
      // Re-create some spans manually to verify no handler fires
      const span = document.createElement('span')
      span.className = 'typing-char current'
      span.textContent = 'x'
      container.appendChild(span)

      pressKey(document, 'x')
      // The span should remain unchanged since handler was removed
      expect(span.classList.contains('correct')).toBe(false)
      span.remove()
    })
  })
})
