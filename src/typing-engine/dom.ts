import type { TypingEngineEnv } from './engine'
import type { CharacterDef, StoreState } from './store'
import type { TypingEvent } from './events'
import { CharStatus } from './reducers/cursor'
import { themeToCSS, detectTheme } from './theme'

interface Modification {
  beforeNode: Text | null
  wrapper: HTMLSpanElement
  afterNode: Text | null
  originalContent: string
  parent: Node
  nextSibling: Node | null
}

export interface DOMSetupResult {
  characters: CharacterDef[]
  spans: HTMLSpanElement[]
  destroy: () => void
  isDark: boolean
}

export function setupDOM(range: Range, env: TypingEngineEnv): DOMSetupResult {
  const textNodes = getTextNodesInRange(range, env)
  if (!textNodes.length) {
    return { characters: [], spans: [], destroy: () => {}, isDark: false }
  }

  const modifications: Modification[] = []
  const blockSpanMap = new Map<Element, HTMLSpanElement[]>()

  for (const textNode of textNodes) {
    const { start, end } = getSelectedIndices(textNode, range)
    const originalContent = textNode.textContent!
    const selectedText = originalContent.substring(start, end)

    const wrapper = env.document.createElement('span')
    wrapper.innerHTML = selectedText
      .split('')
      .map((char) => `<span class="typing-char">${char}</span>`)
      .join('')

    const beforeText = start > 0 ? originalContent.substring(0, start) : null
    const afterText = end < originalContent.length ? originalContent.substring(end) : null
    const beforeNode = beforeText ? env.document.createTextNode(beforeText) : null
    const afterNode = afterText ? env.document.createTextNode(afterText) : null

    const parent = textNode.parentNode!
    const nextSibling = textNode.nextSibling
    if (beforeNode) parent.insertBefore(beforeNode, textNode)
    parent.insertBefore(wrapper, textNode)
    if (afterNode) parent.insertBefore(afterNode, textNode)
    parent.removeChild(textNode)

    const block = getClosestBlockAncestor(wrapper, env)
    if (!blockSpanMap.has(block)) blockSpanMap.set(block, [])
    blockSpanMap.get(block)!.push(...(Array.from(wrapper.children) as HTMLSpanElement[]))

    modifications.push({
      beforeNode: beforeNode as Text | null,
      wrapper,
      afterNode: afterNode as Text | null,
      originalContent,
      parent,
      nextSibling,
    })
  }

  insertEnterMarkers(env, blockSpanMap)

  const allSpans = Array.from(
    env.document.querySelectorAll('.typing-char')
  ) as HTMLSpanElement[]

  let blockIndex = 0
  let currentBlock: Element | null = null
  const characters: CharacterDef[] = allSpans.map((span) => {
    const block = getClosestBlockAncestor(span, env)
    if (block !== currentBlock) {
      if (currentBlock !== null) blockIndex++
      currentBlock = block
    }
    return {
      char: span.textContent!,
      isEnterRequired: span.classList.contains('enter-required'),
      blockIndex,
    }
  })

  const ancestorEl = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement ?? env.document.body
  const { theme, isDark } = detectTheme(ancestorEl, env.getComputedStyle)

  const styleElement = env.document.createElement('style')
  styleElement.textContent = themeToCSS(theme)
  env.document.head.appendChild(styleElement)

  function destroy() {
    modifications.forEach((mod) => {
      const { beforeNode, wrapper, afterNode, originalContent, parent, nextSibling } = mod
      if (parent && (parent as Element).isConnected) {
        if (beforeNode && parent.contains(beforeNode)) parent.removeChild(beforeNode)
        if (wrapper && parent.contains(wrapper)) parent.removeChild(wrapper)
        if (afterNode && parent.contains(afterNode)) parent.removeChild(afterNode)
        const newTextNode = env.document.createTextNode(originalContent)
        parent.insertBefore(newTextNode, nextSibling)
      }
    })
    env.document.querySelectorAll('.typing-char.enter-required').forEach((el) => el.remove())
    styleElement.remove()
  }

  return { characters, spans: allSpans, destroy, isDark }
}

function getTextNodesInRange(range: Range, env: TypingEngineEnv): Text[] {
  const textNodes: Text[] = []
  const startNode = range.startContainer
  const endNode = range.endContainer

  if (startNode === endNode && startNode.nodeType === Node.TEXT_NODE) {
    if (startNode.textContent!.substring(range.startOffset, range.endOffset).trim()) {
      textNodes.push(startNode as Text)
    }
    return textNodes
  }

  const walker = env.document.createTreeWalker(
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

function getSelectedIndices(textNode: Text, range: Range): { start: number; end: number } {
  let start = 0
  let end = textNode.length
  if (textNode === range.startContainer) start = range.startOffset
  if (textNode === range.endContainer) end = range.endOffset
  return { start, end }
}

export function getClosestBlockAncestor(node: Node, env: TypingEngineEnv): Element {
  let current: Node | null = node
  while (current && current.nodeType === 1) {
    const display = env.getComputedStyle(current as Element).display
    if (display === 'block') {
      return current as Element
    }
    current = current.parentNode
  }
  return env.document.body
}

function insertEnterMarkers(
  env: TypingEngineEnv,
  blockSpanMap: Map<Element, HTMLSpanElement[]>,
): void {
  const allTypingSpans = env.document.querySelectorAll('.typing-char')
  const blockToLastSpan = new Map<Element, Element>()

  allTypingSpans.forEach((span) => {
    const block = getClosestBlockAncestor(span, env)
    if (
      !blockToLastSpan.has(block) ||
      span.compareDocumentPosition(blockToLastSpan.get(block)!) &
        Node.DOCUMENT_POSITION_PRECEDING
    ) {
      blockToLastSpan.set(block, span)
    }
  })

  blockToLastSpan.forEach((lastSpan) => {
    const enterSpan = env.document.createElement('span')
    enterSpan.className = 'typing-char enter-required'
    enterSpan.textContent = '\u23CE'
    lastSpan.parentNode!.insertBefore(enterSpan, lastSpan.nextSibling)
    const block = getClosestBlockAncestor(lastSpan, env)
    if (blockSpanMap.has(block)) {
      blockSpanMap.get(block)!.push(enterSpan)
    }
  })
}

const STATUS_TO_CLASS: Record<CharStatus, string | null> = {
  [CharStatus.Pending]: null,
  [CharStatus.Correct]: 'correct',
  [CharStatus.Incorrect]: 'incorrect',
  [CharStatus.Corrected]: 'corrected',
}

export function createRenderer(spans: HTMLSpanElement[]): (state: StoreState, event: TypingEvent) => void {
  let prevIndex = 0

  return (state: StoreState, event: TypingEvent) => {
    const { cursor } = state

    switch (event.type) {
      case 'CharTyped':
      case 'EnterPressed': {
        const typedIndex = event.type === 'CharTyped' ? event.index : event.index
        // Update typed span
        updateSpanStatus(spans[typedIndex], cursor.charStates[typedIndex])
        spans[typedIndex].classList.remove('current')

        // Auto-skipped enters (for correct Enter)
        if (event.type === 'EnterPressed' && event.isCorrect) {
          for (let i = typedIndex + 1; i < cursor.currentIndex; i++) {
            updateSpanStatus(spans[i], cursor.charStates[i])
          }
        }

        // Move current indicator
        if (cursor.currentIndex < spans.length) {
          spans[cursor.currentIndex].classList.add('current')
          spans[cursor.currentIndex].scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        prevIndex = cursor.currentIndex
        break
      }

      case 'BackspacePressed': {
        // Remove current from old position
        if (prevIndex < spans.length) {
          spans[prevIndex].classList.remove('current')
        }
        // Reset the target span
        const target = spans[event.index]
        target.classList.remove('correct', 'incorrect', 'corrected')
        target.classList.add('current')
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        prevIndex = cursor.currentIndex
        break
      }

      case 'BlockSkipped': {
        // Remove current from old position
        if (event.fromIndex < spans.length) {
          spans[event.fromIndex].classList.remove('current')
        }
        // Set current on new position
        if (cursor.currentIndex < spans.length) {
          spans[cursor.currentIndex].classList.add('current')
          spans[cursor.currentIndex].scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        prevIndex = cursor.currentIndex
        break
      }
    }
  }
}

function updateSpanStatus(span: HTMLSpanElement, status: CharStatus): void {
  span.classList.remove('correct', 'incorrect', 'corrected')
  const cls = STATUS_TO_CLASS[status]
  if (cls) span.classList.add(cls)
}
