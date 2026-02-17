import { createTypingEngine } from '@type-master/typing-engine'

function applyMeterTheme(meter: HTMLElement, isDark: boolean): void {
  meter.style.backgroundColor = isDark ? '#1e293b' : 'white'
  meter.style.color = isDark ? '#e2e8f0' : 'black'
  meter.style.border = `1px solid ${isDark ? '#475569' : 'black'}`
}

function makeDraggable(el: HTMLElement): void {
  let offsetX = 0
  let offsetY = 0
  let dragging = false

  el.style.cursor = 'grab'

  el.addEventListener('mousedown', (e) => {
    dragging = true
    offsetX = e.clientX - el.getBoundingClientRect().left
    offsetY = e.clientY - el.getBoundingClientRect().top
    el.style.cursor = 'grabbing'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    el.style.right = 'auto'
    el.style.bottom = 'auto'
    el.style.left = `${e.clientX - offsetX}px`
    el.style.top = `${e.clientY - offsetY}px`
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    el.style.cursor = 'grab'
  })
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

  const meter = document.createElement('div')
  meter.id = 'typing-meter'
  meter.style.position = 'fixed'
  meter.style.bottom = '10px'
  meter.style.right = '10px'
  meter.style.padding = '5px'
  meter.style.zIndex = '999999'
  makeDraggable(meter)
  document.body.appendChild(meter)

  const engine = createTypingEngine({
    range,
    env: { document, getComputedStyle: (el: Element) => window.getComputedStyle(el) },
    debug,
    onStatsChange: (stats) => {
      meter.textContent = `WPM: ${stats.wpm} | Accuracy: ${stats.accuracy}%`
      if (debug) console.log('[TypeMaster] Stats update:', stats)
    },
    onComplete: () => {
      meter.remove()
    },
  })

  applyMeterTheme(meter, engine.isDark)

  if (debug) console.log('[TypeMaster] Engine created')

  selection.removeAllRanges()
}

startTypingPractice()
