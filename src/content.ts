import { TypingEngine } from './typing-engine'

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

  const engine = new TypingEngine(
    range,
    { document, getComputedStyle: (el: Element) => window.getComputedStyle(el) },
    debug,
  )

  if (debug) console.log('[TypeMaster] Engine created')

  const meter = document.createElement('div')
  meter.id = 'typing-meter'
  meter.style.position = 'fixed'
  meter.style.bottom = '10px'
  meter.style.right = '10px'
  meter.style.backgroundColor = 'white'
  meter.style.border = '1px solid black'
  meter.style.padding = '5px'
  meter.style.zIndex = '999999'
  document.body.appendChild(meter)

  engine.onStatsChange = (stats) => {
    meter.textContent = `WPM: ${stats.wpm} | Accuracy: ${stats.accuracy}%`
    if (debug) console.log('[TypeMaster] Stats update:', stats)
  }

  engine.onComplete = () => {
    meter.remove()
  }

  selection.removeAllRanges()
}

startTypingPractice()
