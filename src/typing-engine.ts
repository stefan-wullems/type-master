export interface TypingStats {
  wpm: number
  accuracy: number
  totalKeystrokes: number
  correctKeystrokes: number
}

export interface TypingEngineEnv {
  document: Document
  getComputedStyle: (el: Element) => CSSStyleDeclaration
}

export function normalizeChar(char: string): string {
  const map: Record<string, string> = {
    '\u2018': "'", '\u2019': "'",
    '\u201C': '"', '\u201D': '"',
    '\u2013': '-', '\u2014': '-',
  }
  return map[char] || char
}

interface Modification {
  beforeNode: Text | null
  wrapper: HTMLSpanElement
  afterNode: Text | null
  originalContent: string
  parent: Node
  nextSibling: Node | null
}

export class TypingEngine {
  onStatsChange?: (stats: TypingStats) => void
  onComplete?: (stats: TypingStats) => void

  private env: TypingEngineEnv
  private debug: boolean
  private allTypingChars: HTMLSpanElement[] = []
  private modifications: Modification[] = []
  private blockSpanMap: Map<Element, HTMLSpanElement[]> = new Map()
  private currentIndex = 0
  private totalKeystrokes = 0
  private correctKeystrokes = 0
  private startTime: number | null = null
  private lastKeyTime: number | null = null
  private totalPausedTime = 0
  private isPaused = false
  private pauseStartTime: number | null = null
  private typingStarted = false
  private keyHandler: (event: KeyboardEvent) => void
  private styleElement: HTMLStyleElement
  private updateInterval: ReturnType<typeof setInterval>
  private destroyed = false

  constructor(range: Range, env: TypingEngineEnv, debug = false) {
    this.env = env
    this.debug = debug

    const textNodes = this.getTextNodesInRange(range)
    this.log('Text nodes found:', textNodes.length)
    if (!textNodes.length) return

    this.prepareDOM(textNodes, range)
    this.insertEnterMarkers()
    this.allTypingChars = Array.from(
      this.env.document.querySelectorAll('.typing-char')
    ) as HTMLSpanElement[]
    this.log('Total typing chars:', this.allTypingChars.length)

    if (this.allTypingChars.length) {
      this.allTypingChars[0].classList.add('current')
    }

    this.styleElement = this.env.document.createElement('style')
    this.styleElement.textContent = `
    .typing-char.current { outline: 1px solid lightgray; }
    .typing-char.correct { background-color: #dcfce7; color: #052e16; }
    .typing-char.incorrect { background-color: #fee2e2; color: #450a0a; }
    .typing-char.corrected { background-color: #fef9c3; color: #422006; }
    .enter-required { color: #888; }
  `
    this.env.document.head.appendChild(this.styleElement)

    this.keyHandler = (event: KeyboardEvent) => this.handleKeydown(event)
    this.env.document.addEventListener('keydown', this.keyHandler, true)

    this.updateInterval = setInterval(() => this.updateStats(), 1000)
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.log('[TypingEngine]', ...args)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.log('Destroying engine')

    this.modifications.forEach((mod) => {
      const { beforeNode, wrapper, afterNode, originalContent, parent, nextSibling } = mod
      if (parent && (parent as Element).isConnected) {
        if (beforeNode && parent.contains(beforeNode)) parent.removeChild(beforeNode)
        if (wrapper && parent.contains(wrapper)) parent.removeChild(wrapper)
        if (afterNode && parent.contains(afterNode)) parent.removeChild(afterNode)
        const newTextNode = this.env.document.createTextNode(originalContent)
        parent.insertBefore(newTextNode, nextSibling)
      }
    })

    // Remove enter markers that were inserted outside wrappers
    this.env.document.querySelectorAll('.typing-char.enter-required').forEach((el) => el.remove())

    this.env.document.removeEventListener('keydown', this.keyHandler, true)
    clearInterval(this.updateInterval)
    this.styleElement.remove()
  }

  private getClosestBlockAncestor(node: Node): Element {
    let current: Node | null = node
    while (current && current.nodeType === 1) {
      const display = this.env.getComputedStyle(current as Element).display
      this.log('getClosestBlockAncestor: checking', (current as Element).tagName, 'display:', display)
      if (display === 'block') {
        return current as Element
      }
      current = current.parentNode
    }
    this.log('getClosestBlockAncestor: fell through to body')
    return this.env.document.body
  }

  private getTextNodesInRange(range: Range): Text[] {
    const textNodes: Text[] = []
    const startNode = range.startContainer
    const endNode = range.endContainer

    if (startNode === endNode && startNode.nodeType === Node.TEXT_NODE) {
      if (startNode.textContent!.substring(range.startOffset, range.endOffset).trim()) {
        textNodes.push(startNode as Text)
      }
      return textNodes
    }

    const walker = this.env.document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          if (!node.textContent!.trim()) return NodeFilter.FILTER_REJECT
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      }
    )
    let node: Node | null
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text)
    }
    return textNodes
  }

  private getSelectedIndices(textNode: Text, range: Range): { start: number; end: number } {
    let start = 0
    let end = textNode.length
    if (textNode === range.startContainer) start = range.startOffset
    if (textNode === range.endContainer) end = range.endOffset
    return { start, end }
  }

  private prepareDOM(textNodes: Text[], range: Range): void {
    this.log('prepareDOM: processing', textNodes.length, 'text nodes')
    for (const textNode of textNodes) {
      const { start, end } = this.getSelectedIndices(textNode, range)
      const originalContent = textNode.textContent!
      const selectedText = originalContent.substring(start, end)

      this.log('prepareDOM: node text:', JSON.stringify(selectedText))
      const wrapper = this.env.document.createElement('span')
      wrapper.innerHTML = selectedText
        .split('')
        .map((char) => `<span class="typing-char">${char}</span>`)
        .join('')

      const beforeText = start > 0 ? originalContent.substring(0, start) : null
      const afterText = end < originalContent.length ? originalContent.substring(end) : null
      const beforeNode = beforeText ? this.env.document.createTextNode(beforeText) : null
      const afterNode = afterText ? this.env.document.createTextNode(afterText) : null

      const parent = textNode.parentNode!
      const nextSibling = textNode.nextSibling
      if (beforeNode) parent.insertBefore(beforeNode, textNode)
      parent.insertBefore(wrapper, textNode)
      if (afterNode) parent.insertBefore(afterNode, textNode)
      parent.removeChild(textNode)

      const block = this.getClosestBlockAncestor(wrapper)
      if (!this.blockSpanMap.has(block)) this.blockSpanMap.set(block, [])
      this.blockSpanMap.get(block)!.push(...(Array.from(wrapper.children) as HTMLSpanElement[]))

      this.modifications.push({
        beforeNode: beforeNode as Text | null,
        wrapper,
        afterNode: afterNode as Text | null,
        originalContent,
        parent,
        nextSibling,
      })
    }
  }

  private insertEnterMarkers(): void {
    this.log('insertEnterMarkers: starting')
    const allTypingSpans = this.env.document.querySelectorAll('.typing-char')
    const blockToLastSpan = new Map<Element, Element>()

    allTypingSpans.forEach((span) => {
      const block = this.getClosestBlockAncestor(span)
      if (
        !blockToLastSpan.has(block) ||
        span.compareDocumentPosition(blockToLastSpan.get(block)!) &
          Node.DOCUMENT_POSITION_PRECEDING
      ) {
        blockToLastSpan.set(block, span)
      }
    })

    this.log('insertEnterMarkers: inserting', blockToLastSpan.size, 'markers')
    blockToLastSpan.forEach((lastSpan) => {
      const enterSpan = this.env.document.createElement('span')
      enterSpan.className = 'typing-char enter-required'
      enterSpan.textContent = '\u23CE'
      lastSpan.parentNode!.insertBefore(enterSpan, lastSpan.nextSibling)
      const block = this.getClosestBlockAncestor(lastSpan)
      if (this.blockSpanMap.has(block)) {
        this.blockSpanMap.get(block)!.push(enterSpan)
      }
    })
  }

  private getStats(): TypingStats {
    const currentTime = Date.now()
    let elapsedTime = currentTime - (this.startTime || currentTime) - this.totalPausedTime
    if (this.isPaused && this.pauseStartTime) {
      elapsedTime -= currentTime - this.pauseStartTime
    }
    const elapsedMinutes = elapsedTime / 60000
    const wpm = elapsedMinutes > 0 ? Math.round((this.correctKeystrokes / 5) / elapsedMinutes) : 0
    const accuracy =
      this.totalKeystrokes > 0
        ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
        : 100
    const stats = {
      wpm,
      accuracy,
      totalKeystrokes: this.totalKeystrokes,
      correctKeystrokes: this.correctKeystrokes,
    }
    this.log('getStats:', stats)
    return stats
  }

  private updateStats(): void {
    if (!this.typingStarted || !this.startTime) return

    const currentTime = Date.now()
    if (!this.isPaused && this.lastKeyTime && currentTime - this.lastKeyTime > 5000) {
      this.isPaused = true
      this.pauseStartTime = this.lastKeyTime + 5000
    }

    this.onStatsChange?.(this.getStats())
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.destroyed) return

    if (event.key === 'Escape') {
      this.destroy()
      return
    }

    const currentSpan = this.allTypingChars[this.currentIndex]
    if (!currentSpan) return

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (this.currentIndex > 0) {
        currentSpan.classList.remove('current')
        this.currentIndex--
        if (this.allTypingChars[this.currentIndex].classList.contains('incorrect')) {
          this.allTypingChars[this.currentIndex].classList.add('was-incorrect')
        }
        this.allTypingChars[this.currentIndex].classList.remove(
          'correct',
          'incorrect',
          'corrected'
        )
        this.allTypingChars[this.currentIndex].classList.add('current')
        this.scrollToCurrent()
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      this.skipToNextBlock()
      return
    }

    if (event.key.length === 1 || event.key === 'Enter') {
      event.preventDefault()
      this.log('handleKeydown: key:', event.key, 'index:', this.currentIndex)
      if (!this.typingStarted) {
        this.typingStarted = true
        this.startTime = Date.now()
        this.lastKeyTime = this.startTime
      } else if (this.isPaused && !currentSpan.classList.contains('enter-required')) {
        this.totalPausedTime += Date.now() - this.pauseStartTime!
        this.isPaused = false
      }
      this.lastKeyTime = Date.now()
      this.totalKeystrokes++

      if (currentSpan.classList.contains('enter-required')) {
        if (event.key === 'Enter') {
          if (currentSpan.classList.contains('was-incorrect')) {
            currentSpan.classList.add('corrected')
          } else {
            currentSpan.classList.add('correct')
          }
          this.correctKeystrokes++
          this.advanceCursor(true)
          this.isPaused = true
          this.pauseStartTime = Date.now()
        } else {
          currentSpan.classList.add('incorrect')
          this.advanceCursor()
        }
      } else {
        const expectedChar = normalizeChar(currentSpan.textContent!)
        const typedChar = normalizeChar(event.key)
        this.log('handleKeydown: expected:', JSON.stringify(expectedChar), 'typed:', JSON.stringify(typedChar))
        if (typedChar === expectedChar) {
          if (currentSpan.classList.contains('was-incorrect')) {
            currentSpan.classList.add('corrected')
          } else {
            currentSpan.classList.add('correct')
          }
          this.correctKeystrokes++
        } else {
          currentSpan.classList.add('incorrect')
        }
        this.advanceCursor()
      }
    }
  }

  private advanceCursor(skipToText = false): void {
    this.allTypingChars[this.currentIndex].classList.remove('current')
    this.currentIndex++

    while (
      skipToText &&
      this.currentIndex < this.allTypingChars.length &&
      this.allTypingChars[this.currentIndex].classList.contains('enter-required')
    ) {
      this.allTypingChars[this.currentIndex].classList.add('correct')
      this.correctKeystrokes++
      this.totalKeystrokes++
      this.currentIndex++
    }

    if (this.currentIndex < this.allTypingChars.length) {
      this.allTypingChars[this.currentIndex].classList.add('current')
      this.scrollToCurrent()
      this.log('advanceCursor: new index:', this.currentIndex)
    } else {
      this.log('advanceCursor: completed')
      const stats = this.getStats()
      this.onComplete?.(stats)
      this.destroy()
    }
  }

  private skipToNextBlock(): void {
    const currentBlock = this.getClosestBlockAncestor(this.allTypingChars[this.currentIndex])
    let nextBlockIndex = this.currentIndex
    let foundNextBlock = false

    while (nextBlockIndex < this.allTypingChars.length) {
      const nextSpan = this.allTypingChars[nextBlockIndex]
      const nextBlock = this.getClosestBlockAncestor(nextSpan)
      if (nextBlock !== currentBlock) {
        foundNextBlock = true
        break
      }
      nextBlockIndex++
    }

    if (foundNextBlock) {
      this.log('skipToNextBlock: jumping from', this.currentIndex, 'to', nextBlockIndex)
      this.allTypingChars[this.currentIndex].classList.remove('current')
      this.currentIndex = nextBlockIndex
      this.allTypingChars[this.currentIndex].classList.add('current')
      this.scrollToCurrent()
      if (this.typingStarted && !this.isPaused) {
        this.isPaused = true
        this.pauseStartTime = Date.now()
      }
    }
  }

  private scrollToCurrent(): void {
    const currentSpan = this.allTypingChars[this.currentIndex]
    if (currentSpan?.scrollIntoView) {
      currentSpan.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }
}
