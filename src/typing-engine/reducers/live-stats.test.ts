import { describe, it, expect } from 'vitest'
import { liveStatsReducer, createLiveStatsState, computeStats } from './live-stats'
import type { TypingEvent } from '../events'

describe('liveStatsReducer', () => {
  it('TypingStarted records start time', () => {
    const state = createLiveStatsState()
    const event: TypingEvent = { type: 'TypingStarted', timestamp: 1000 }
    const next = liveStatsReducer(state, event, 0)
    expect(next.typingStarted).toBe(true)
    expect(next.startTime).toBe(1000)
    expect(next.lastKeyTime).toBe(1000)
  })

  it('CharTyped increments keystrokes', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    state.startTime = 1000
    const event: TypingEvent = { type: 'CharTyped', timestamp: 1500, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    const next = liveStatsReducer(state, event, 0)
    expect(next.totalKeystrokes).toBe(1)
    expect(next.correctKeystrokes).toBe(1)
    expect(next.lastKeyTime).toBe(1500)
  })

  it('incorrect CharTyped increments total but not correct', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    const event: TypingEvent = { type: 'CharTyped', timestamp: 1500, index: 0, expected: 'a', actual: 'x', isCorrect: false }
    const next = liveStatsReducer(state, event, 0)
    expect(next.totalKeystrokes).toBe(1)
    expect(next.correctKeystrokes).toBe(0)
  })

  it('correct EnterPressed counts auto-skipped enters', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    state.startTime = 1000
    const event: TypingEvent = { type: 'EnterPressed', timestamp: 2000, index: 1, actual: 'Enter', isCorrect: true }
    const next = liveStatsReducer(state, event, 2)
    expect(next.totalKeystrokes).toBe(3) // 1 + 2 auto-skipped
    expect(next.correctKeystrokes).toBe(3)
    expect(next.isPaused).toBe(true)
    expect(next.pauseStartTime).toBe(2000)
  })

  it('CharTyped while paused ends pause', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    state.startTime = 1000
    state.isPaused = true
    state.pauseStartTime = 2000
    const event: TypingEvent = { type: 'CharTyped', timestamp: 3000, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    const next = liveStatsReducer(state, event, 0)
    expect(next.isPaused).toBe(false)
    expect(next.totalPausedTime).toBe(1000)
  })

  it('PauseStarted sets pause state', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    const event: TypingEvent = { type: 'PauseStarted', timestamp: 6000 }
    const next = liveStatsReducer(state, event, 0)
    expect(next.isPaused).toBe(true)
    expect(next.pauseStartTime).toBe(6000)
  })

  it('PauseEnded accumulates paused time', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    state.isPaused = true
    state.pauseStartTime = 5000
    const event: TypingEvent = { type: 'PauseEnded', timestamp: 8000 }
    const next = liveStatsReducer(state, event, 0)
    expect(next.isPaused).toBe(false)
    expect(next.totalPausedTime).toBe(3000)
  })

  it('BlockSkipped sets pause when typing is active', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    const event: TypingEvent = { type: 'BlockSkipped', timestamp: 3000, fromIndex: 0, toIndex: 5 }
    const next = liveStatsReducer(state, event, 0)
    expect(next.isPaused).toBe(true)
    expect(next.pauseStartTime).toBe(3000)
  })

  it('BlockSkipped does not pause when already paused', () => {
    const state = createLiveStatsState()
    state.typingStarted = true
    state.isPaused = true
    state.pauseStartTime = 2000
    const event: TypingEvent = { type: 'BlockSkipped', timestamp: 3000, fromIndex: 0, toIndex: 5 }
    const next = liveStatsReducer(state, event, 0)
    expect(next.pauseStartTime).toBe(2000) // unchanged
  })
})

describe('computeStats', () => {
  it('returns 100% accuracy with no keystrokes', () => {
    const state = createLiveStatsState()
    const stats = computeStats(state, 1000)
    expect(stats.accuracy).toBe(100)
    expect(stats.wpm).toBe(0)
  })

  it('calculates accuracy as correct/total ratio', () => {
    const state = createLiveStatsState()
    state.startTime = 0
    state.totalKeystrokes = 4
    state.correctKeystrokes = 3
    const stats = computeStats(state, 60000)
    expect(stats.accuracy).toBe(75)
  })

  it('calculates WPM excluding paused time', () => {
    const state = createLiveStatsState()
    state.startTime = 0
    state.correctKeystrokes = 50
    state.totalKeystrokes = 50
    state.totalPausedTime = 0
    // 50 correct keystrokes / 5 = 10 words, in 1 minute = 10 WPM
    const stats = computeStats(state, 60000)
    expect(stats.wpm).toBe(10)
  })

  it('excludes current pause from elapsed time', () => {
    const state = createLiveStatsState()
    state.startTime = 0
    state.correctKeystrokes = 50
    state.totalKeystrokes = 50
    state.isPaused = true
    state.pauseStartTime = 30000
    // Effective time = 60000 - 0 - 0 - (60000 - 30000) = 30000ms = 0.5min
    // WPM = (50/5) / 0.5 = 20
    const stats = computeStats(state, 60000)
    expect(stats.wpm).toBe(20)
  })
})
