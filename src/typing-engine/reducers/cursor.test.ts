import { describe, it, expect } from 'vitest'
import { cursorReducer, createCursorState, CharStatus } from './cursor'
import type { CharacterDef } from '../store'
import type { TypingEvent } from '../events'

function chars(...defs: Array<{ char: string; enter?: boolean; block?: number }>): CharacterDef[] {
  return defs.map((d, i) => ({
    char: d.char,
    isEnterRequired: d.enter ?? false,
    blockIndex: d.block ?? 0,
  }))
}

describe('cursorReducer', () => {
  const abcChars = chars({ char: 'a' }, { char: 'b' }, { char: 'c' })

  it('advances index on correct CharTyped', () => {
    const state = createCursorState(3)
    const event: TypingEvent = { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.currentIndex).toBe(1)
    expect(next.charStates[0]).toBe(CharStatus.Correct)
  })

  it('marks incorrect on wrong CharTyped', () => {
    const state = createCursorState(3)
    const event: TypingEvent = { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'x', isCorrect: false }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.currentIndex).toBe(1)
    expect(next.charStates[0]).toBe(CharStatus.Incorrect)
  })

  it('marks corrected when wasIncorrect and now correct', () => {
    const state = createCursorState(3)
    state.wasIncorrect[0] = true
    const event: TypingEvent = { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.charStates[0]).toBe(CharStatus.Corrected)
  })

  it('backspace sets wasIncorrect and resets to pending', () => {
    const state = createCursorState(3)
    state.currentIndex = 1
    state.charStates[0] = CharStatus.Incorrect
    const event: TypingEvent = { type: 'BackspacePressed', timestamp: 0, index: 0 }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.currentIndex).toBe(0)
    expect(next.charStates[0]).toBe(CharStatus.Pending)
    expect(next.wasIncorrect[0]).toBe(true)
  })

  it('backspace on correct char does not set wasIncorrect', () => {
    const state = createCursorState(3)
    state.currentIndex = 1
    state.charStates[0] = CharStatus.Correct
    const event: TypingEvent = { type: 'BackspacePressed', timestamp: 0, index: 0 }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.wasIncorrect[0]).toBe(false)
    expect(next.charStates[0]).toBe(CharStatus.Pending)
  })

  it('correct Enter auto-skips consecutive enter-required chars', () => {
    const characters = chars(
      { char: 'a', block: 0 },
      { char: '⏎', enter: true, block: 0 },
      { char: '⏎', enter: true, block: 1 },
      { char: 'b', block: 1 },
    )
    const state = createCursorState(4)
    state.currentIndex = 1
    const event: TypingEvent = { type: 'EnterPressed', timestamp: 0, index: 1, actual: 'Enter', isCorrect: true }
    const { state: next, autoSkippedCount } = cursorReducer(state, event, characters)
    expect(next.currentIndex).toBe(3)
    expect(next.charStates[1]).toBe(CharStatus.Correct)
    expect(next.charStates[2]).toBe(CharStatus.Correct)
    expect(autoSkippedCount).toBe(1)
  })

  it('incorrect Enter does not auto-skip', () => {
    const characters = chars(
      { char: 'a', block: 0 },
      { char: '⏎', enter: true, block: 0 },
      { char: 'b', block: 1 },
    )
    const state = createCursorState(3)
    state.currentIndex = 1
    const event: TypingEvent = { type: 'EnterPressed', timestamp: 0, index: 1, actual: 'x', isCorrect: false }
    const { state: next } = cursorReducer(state, event, characters)
    expect(next.currentIndex).toBe(2)
    expect(next.charStates[1]).toBe(CharStatus.Incorrect)
  })

  it('BlockSkipped moves currentIndex', () => {
    const state = createCursorState(5)
    const event: TypingEvent = { type: 'BlockSkipped', timestamp: 0, fromIndex: 0, toIndex: 3 }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.currentIndex).toBe(3)
  })

  it('Completed sets completed flag', () => {
    const state = createCursorState(3)
    const event: TypingEvent = { type: 'Completed', timestamp: 0 }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.completed).toBe(true)
  })

  it('Escaped sets escaped flag', () => {
    const state = createCursorState(3)
    const event: TypingEvent = { type: 'Escaped', timestamp: 0 }
    const { state: next } = cursorReducer(state, event, abcChars)
    expect(next.escaped).toBe(true)
  })

  it('does not mutate original state', () => {
    const state = createCursorState(3)
    const original = { ...state, charStates: [...state.charStates] }
    const event: TypingEvent = { type: 'CharTyped', timestamp: 0, index: 0, expected: 'a', actual: 'a', isCorrect: true }
    cursorReducer(state, event, abcChars)
    expect(state.currentIndex).toBe(original.currentIndex)
    expect(state.charStates).toEqual(original.charStates)
  })
})
