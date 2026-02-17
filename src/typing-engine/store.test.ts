import { describe, it, expect, vi } from 'vitest'
import { createStore } from './store'
import type { CharacterDef } from './store'
import { CharStatus } from './reducers/cursor'
import type { TypingEvent } from './events'

function chars(...defs: Array<{ char: string; enter?: boolean; block?: number }>): CharacterDef[] {
  return defs.map((d) => ({
    char: d.char,
    isEnterRequired: d.enter ?? false,
    blockIndex: d.block ?? 0,
  }))
}

describe('createStore', () => {
  it('initializes with correct state', () => {
    const store = createStore(chars({ char: 'a' }, { char: 'b' }))
    const state = store.getState()
    expect(state.cursor.currentIndex).toBe(0)
    expect(state.cursor.charStates).toEqual([CharStatus.Pending, CharStatus.Pending])
    expect(state.liveStats.typingStarted).toBe(false)
    expect(state.analysis.events).toHaveLength(0)
  })

  it('dispatches events to all reducers', () => {
    const store = createStore(chars({ char: 'a' }, { char: 'b' }))
    const event: TypingEvent = { type: 'CharTyped', timestamp: 100, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    store.dispatch(event)

    const state = store.getState()
    expect(state.cursor.currentIndex).toBe(1)
    expect(state.cursor.charStates[0]).toBe(CharStatus.Correct)
    expect(state.liveStats.totalKeystrokes).toBe(1)
    expect(state.analysis.events).toHaveLength(1)
  })

  it('notifies subscribers on dispatch', () => {
    const store = createStore(chars({ char: 'a' }))
    const subscriber = vi.fn()
    store.subscribe(subscriber)

    const event: TypingEvent = { type: 'TypingStarted', timestamp: 0 }
    store.dispatch(event)

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith(store.getState(), event)
  })

  it('unsubscribe removes subscriber', () => {
    const store = createStore(chars({ char: 'a' }))
    const subscriber = vi.fn()
    const unsub = store.subscribe(subscriber)
    unsub()

    store.dispatch({ type: 'TypingStarted', timestamp: 0 })
    expect(subscriber).not.toHaveBeenCalled()
  })

  it('passes autoSkippedCount from cursor to liveStats', () => {
    const characters = chars(
      { char: 'a', block: 0 },
      { char: '⏎', enter: true, block: 0 },
      { char: '⏎', enter: true, block: 1 },
      { char: 'b', block: 1 },
    )
    const store = createStore(characters)
    store.dispatch({ type: 'TypingStarted', timestamp: 0 })
    store.dispatch({ type: 'CharTyped', timestamp: 100, index: 0, expected: 'a', actual: 'a', isCorrect: true })
    store.dispatch({ type: 'EnterPressed', timestamp: 200, index: 1, actual: 'Enter', isCorrect: true })

    const state = store.getState()
    expect(state.cursor.currentIndex).toBe(3)
    // 1 CharTyped + 1 EnterPressed + 1 auto-skipped = 3
    expect(state.liveStats.totalKeystrokes).toBe(3)
    expect(state.liveStats.correctKeystrokes).toBe(3)
  })
})
