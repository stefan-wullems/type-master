import { TypingEngine } from './typing-engine'

function startTypingPractice() {
  const selection = window.getSelection()
  if (!selection?.rangeCount) {
    alert('Please select some text first.')
    return
  }

  const range = selection.getRangeAt(0)
  const engine = new TypingEngine(range, { document, getComputedStyle: window.getComputedStyle })

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
  }

  engine.onComplete = () => {
    meter.remove()
  }

  selection.removeAllRanges()
}

startTypingPractice()
