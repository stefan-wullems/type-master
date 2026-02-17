import { describe, it, expect } from 'vitest'
import {
  analysisReducer,
  createAnalysisState,
  perKeyAccuracy,
  interKeySpeed,
  speedOverTime,
  slowestKeys,
  fastestKeys,
  errorHotspots,
} from './analysis'
import type { TypingEvent } from '../events'

describe('analysisReducer', () => {
  it('accumulates events', () => {
    let state = createAnalysisState()
    const e1: TypingEvent = { type: 'TypingStarted', timestamp: 0 }
    const e2: TypingEvent = { type: 'CharTyped', timestamp: 100, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    state = analysisReducer(state, e1)
    state = analysisReducer(state, e2)
    expect(state.events).toHaveLength(2)
    expect(state.events[0].type).toBe('TypingStarted')
    expect(state.events[1].type).toBe('CharTyped')
  })

  it('does not mutate previous state', () => {
    const state = createAnalysisState()
    const event: TypingEvent = { type: 'TypingStarted', timestamp: 0 }
    const next = analysisReducer(state, event)
    expect(state.events).toHaveLength(0)
    expect(next.events).toHaveLength(1)
  })
})

describe('perKeyAccuracy', () => {
  it('groups correct/total by expected char', () => {
    const events: TypingEvent[] = [
      { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'a', isCorrect: true },
      { type: 'CharTyped', timestamp: 100, index: 1, expected: 'a', actual: 'x', isCorrect: false },
      { type: 'CharTyped', timestamp: 200, index: 2, expected: 'b', actual: 'b', isCorrect: true },
    ]
    const result = perKeyAccuracy(events)
    expect(result.get('a')).toEqual({ correct: 1, total: 2 })
    expect(result.get('b')).toEqual({ correct: 1, total: 1 })
  })
})

describe('interKeySpeed', () => {
  it('returns time deltas between typing events', () => {
    const events: TypingEvent[] = [
      { type: 'CharTyped', timestamp: 100, index: 0, expected: 'a', actual: 'a', isCorrect: true },
      { type: 'CharTyped', timestamp: 250, index: 1, expected: 'b', actual: 'b', isCorrect: true },
      { type: 'CharTyped', timestamp: 500, index: 2, expected: 'c', actual: 'c', isCorrect: true },
    ]
    expect(interKeySpeed(events)).toEqual([150, 250])
  })

  it('ignores non-typing events', () => {
    const events: TypingEvent[] = [
      { type: 'CharTyped', timestamp: 100, index: 0, expected: 'a', actual: 'a', isCorrect: true },
      { type: 'PauseStarted', timestamp: 200 },
      { type: 'CharTyped', timestamp: 300, index: 1, expected: 'b', actual: 'b', isCorrect: true },
    ]
    expect(interKeySpeed(events)).toEqual([200])
  })
})

describe('speedOverTime', () => {
  it('calculates sliding window WPM', () => {
    const events: TypingEvent[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'CharTyped' as const,
      timestamp: i * 100,
      index: i,
      expected: 'a',
      actual: 'a',
      isCorrect: true,
    }))
    const result = speedOverTime(events, 5)
    expect(result.length).toBe(6) // 10 - 5 + 1
    // Each window: 5 chars in 400ms = 5/5 words in 400/60000 min
    expect(result[0]).toBe(Math.round(1 / (400 / 60000)))
  })
})

describe('slowestKeys / fastestKeys', () => {
  it('returns keys sorted by avg time', () => {
    const events: TypingEvent[] = [
      { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'a', isCorrect: true },
      { type: 'CharTyped', timestamp: 100, index: 1, expected: 'b', actual: 'b', isCorrect: true },
      { type: 'CharTyped', timestamp: 400, index: 2, expected: 'c', actual: 'c', isCorrect: true },
    ]
    const slow = slowestKeys(events, 2)
    expect(slow[0].key).toBe('c') // 300ms
    expect(slow[1].key).toBe('b') // 100ms

    const fast = fastestKeys(events, 2)
    expect(fast[0].key).toBe('b') // 100ms
    expect(fast[1].key).toBe('c') // 300ms
  })
})

describe('errorHotspots', () => {
  it('counts backspaces by position', () => {
    const events: TypingEvent[] = [
      { type: 'BackspacePressed', timestamp: 100, index: 2 },
      { type: 'BackspacePressed', timestamp: 200, index: 2 },
      { type: 'BackspacePressed', timestamp: 300, index: 5 },
    ]
    const result = errorHotspots(events)
    expect(result.get(2)).toBe(2)
    expect(result.get(5)).toBe(1)
  })
})
