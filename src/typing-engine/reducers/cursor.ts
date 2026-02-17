import type { TypingEvent } from '../events'
import type { CharacterDef } from '../store'

export enum CharStatus {
  Pending = 'pending',
  Correct = 'correct',
  Incorrect = 'incorrect',
  Corrected = 'corrected',
}

export interface CursorState {
  currentIndex: number
  charStates: CharStatus[]
  wasIncorrect: boolean[]
  completed: boolean
  escaped: boolean
}

export function createCursorState(charCount: number): CursorState {
  return {
    currentIndex: 0,
    charStates: new Array(charCount).fill(CharStatus.Pending),
    wasIncorrect: new Array(charCount).fill(false),
    completed: false,
    escaped: false,
  }
}

export interface CursorReducerResult {
  state: CursorState
  autoSkippedCount: number
}

export function cursorReducer(
  state: CursorState,
  event: TypingEvent,
  characters: CharacterDef[],
): CursorReducerResult {
  switch (event.type) {
    case 'CharTyped': {
      const next = cloneState(state)
      if (event.isCorrect) {
        next.charStates[event.index] = next.wasIncorrect[event.index]
          ? CharStatus.Corrected
          : CharStatus.Correct
      } else {
        next.charStates[event.index] = CharStatus.Incorrect
      }
      next.currentIndex = event.index + 1
      return { state: next, autoSkippedCount: 0 }
    }

    case 'EnterPressed': {
      const next = cloneState(state)
      if (event.isCorrect) {
        next.charStates[event.index] = next.wasIncorrect[event.index]
          ? CharStatus.Corrected
          : CharStatus.Correct
        next.currentIndex = event.index + 1

        let autoSkipped = 0
        while (
          next.currentIndex < characters.length &&
          characters[next.currentIndex].isEnterRequired
        ) {
          next.charStates[next.currentIndex] = CharStatus.Correct
          next.currentIndex++
          autoSkipped++
        }
        return { state: next, autoSkippedCount: autoSkipped }
      } else {
        next.charStates[event.index] = CharStatus.Incorrect
        next.currentIndex = event.index + 1
        return { state: next, autoSkippedCount: 0 }
      }
    }

    case 'BackspacePressed': {
      const next = cloneState(state)
      const targetIndex = event.index
      if (next.charStates[targetIndex] === CharStatus.Incorrect) {
        next.wasIncorrect[targetIndex] = true
      }
      next.charStates[targetIndex] = CharStatus.Pending
      next.currentIndex = targetIndex
      return { state: next, autoSkippedCount: 0 }
    }

    case 'BlockSkipped': {
      const next = cloneState(state)
      next.currentIndex = event.toIndex
      return { state: next, autoSkippedCount: 0 }
    }

    case 'Completed': {
      const next = cloneState(state)
      next.completed = true
      return { state: next, autoSkippedCount: 0 }
    }

    case 'Escaped': {
      const next = cloneState(state)
      next.escaped = true
      return { state: next, autoSkippedCount: 0 }
    }

    default:
      return { state, autoSkippedCount: 0 }
  }
}

function cloneState(state: CursorState): CursorState {
  return {
    currentIndex: state.currentIndex,
    charStates: [...state.charStates],
    wasIncorrect: [...state.wasIncorrect],
    completed: state.completed,
    escaped: state.escaped,
  }
}
