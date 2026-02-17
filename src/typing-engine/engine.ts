import { setupDOM, createRenderer } from './dom'
import { createStore } from './store'
import { createInputHandler } from './input-handler'
import { computeStats, type TypingStats } from './reducers/live-stats'
export { type TypingStats }

export interface TypingEngineEnv {
  document: Document
  getComputedStyle: (el: Element) => CSSStyleDeclaration
}

export interface TypingEngineOptions {
  range: Range
  env: TypingEngineEnv
  debug?: boolean
  onStatsChange?: (stats: TypingStats) => void
  onComplete?: (stats: TypingStats) => void
}

export function createTypingEngine(options: TypingEngineOptions): { destroy: () => void; isDark: boolean } {
  const { range, env, debug = false, onStatsChange, onComplete } = options
  let destroyed = false

  function log(...args: unknown[]) {
    if (debug) console.log('[TypingEngine]', ...args)
  }

  const { characters, spans, destroy: destroyDOM, isDark } = setupDOM(range, env)
  log('Total typing chars:', spans.length)

  if (!spans.length) {
    return { destroy: () => {}, isDark: false }
  }

  // Mark first char as current
  spans[0].classList.add('current')

  const store = createStore(characters)
  const renderer = createRenderer(spans)
  store.subscribe(renderer)

  const keyHandler = createInputHandler(store, characters)
  env.document.addEventListener('keydown', keyHandler, true)

  // Completion & escape subscriber
  store.subscribe((state, event) => {
    if (destroyed) return
    if (event.type === 'Completed') {
      const stats = computeStats(state.liveStats, event.timestamp)
      log('Completed:', stats)
      onComplete?.(stats)
      destroy()
    } else if (event.type === 'Escaped') {
      log('Escaped')
      destroy()
    }
  })

  // Pause detection interval
  const pauseInterval = setInterval(() => {
    if (destroyed) return
    const { liveStats } = store.getState()
    if (!liveStats.typingStarted || !liveStats.lastKeyTime) return

    const now = Date.now()
    if (!liveStats.isPaused && now - liveStats.lastKeyTime > 5000) {
      store.dispatch({
        type: 'PauseStarted',
        timestamp: liveStats.lastKeyTime + 5000,
      })
    }
  }, 1000)

  // Stats update interval
  const statsInterval = setInterval(() => {
    if (destroyed) return
    const { liveStats } = store.getState()
    if (!liveStats.typingStarted || !liveStats.startTime) return
    onStatsChange?.(computeStats(liveStats, Date.now()))
  }, 1000)

  function destroy() {
    if (destroyed) return
    destroyed = true
    log('Destroying engine')
    env.document.removeEventListener('keydown', keyHandler, true)
    clearInterval(pauseInterval)
    clearInterval(statsInterval)
    destroyDOM()
  }

  return { destroy, isDark }
}
