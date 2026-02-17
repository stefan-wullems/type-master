import { createTypingEngine, lightTheme, darkTheme } from './typing-engine'

function isDarkBackground(el: Element): boolean {
  let current: Element | null = el
  while (current) {
    const bg = window.getComputedStyle(current).backgroundColor
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (match) {
        const [, r, g, b] = match.map(Number)
        // Relative luminance approximation
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance < 0.5
      }
    }
    current = current.parentElement
  }
  // Fallback to OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyMeterTheme(meter: HTMLElement, isDark: boolean): void {
  meter.style.backgroundColor = isDark ? '#1e293b' : 'white'
  meter.style.color = isDark ? '#e2e8f0' : 'black'
  meter.style.border = `1px solid ${isDark ? '#475569' : 'black'}`
}

async function startTypingPractice() {
  const selection = window.getSelection()
  if (!selection?.rangeCount) {
    alert('Please select some text first.')
    return
  }

  const range = selection.getRangeAt(0)

  const { debug = false } = await chrome.storage.local.get('debug')
  if (debug) {
    console.log('[TypeMaster] Debug mode enabled')
    console.log('[TypeMaster] Selection:', selection.toString().substring(0, 100))
    console.log('[TypeMaster] Range:', range.startContainer.nodeName, range.startOffset, '-', range.endContainer.nodeName, range.endOffset)
  }

  const selectionEl = range.commonAncestorContainer instanceof Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement ?? document.body
  const dark = isDarkBackground(selectionEl)

  const meter = document.createElement('div')
  meter.id = 'typing-meter'
  meter.style.position = 'fixed'
  meter.style.bottom = '10px'
  meter.style.right = '10px'
  meter.style.padding = '5px'
  meter.style.zIndex = '999999'
  applyMeterTheme(meter, dark)
  document.body.appendChild(meter)

  const engine = createTypingEngine({
    range,
    env: { document, getComputedStyle: (el: Element) => window.getComputedStyle(el) },
    debug,
    theme: dark ? darkTheme : lightTheme,
    onStatsChange: (stats) => {
      meter.textContent = `WPM: ${stats.wpm} | Accuracy: ${stats.accuracy}%`
      if (debug) console.log('[TypeMaster] Stats update:', stats)
    },
    onComplete: () => {
      meter.remove()
    },
  })

  if (debug) console.log('[TypeMaster] Engine created')

  selection.removeAllRanges()
}

startTypingPractice()
