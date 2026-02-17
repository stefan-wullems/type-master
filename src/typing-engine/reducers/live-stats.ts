import type { TypingEvent } from '../events'

export interface LiveStatsState {
  totalKeystrokes: number
  correctKeystrokes: number
  startTime: number | null
  lastKeyTime: number | null
  totalPausedTime: number
  isPaused: boolean
  pauseStartTime: number | null
  typingStarted: boolean
}

export interface TypingStats {
  wpm: number
  accuracy: number
  totalKeystrokes: number
  correctKeystrokes: number
}

export function createLiveStatsState(): LiveStatsState {
  return {
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    startTime: null,
    lastKeyTime: null,
    totalPausedTime: 0,
    isPaused: false,
    pauseStartTime: null,
    typingStarted: false,
  }
}

export function liveStatsReducer(
  state: LiveStatsState,
  event: TypingEvent,
  autoSkippedCount: number,
): LiveStatsState {
  switch (event.type) {
    case 'TypingStarted': {
      return {
        ...state,
        typingStarted: true,
        startTime: event.timestamp,
        lastKeyTime: event.timestamp,
      }
    }

    case 'CharTyped': {
      const next = { ...state }
      if (state.isPaused) {
        next.totalPausedTime += event.timestamp - state.pauseStartTime!
        next.isPaused = false
        next.pauseStartTime = null
      }
      next.lastKeyTime = event.timestamp
      next.totalKeystrokes++
      if (event.isCorrect) next.correctKeystrokes++
      return next
    }

    case 'EnterPressed': {
      const next = { ...state }
      next.lastKeyTime = event.timestamp
      next.totalKeystrokes++
      if (event.isCorrect) {
        next.correctKeystrokes++
        next.totalKeystrokes += autoSkippedCount
        next.correctKeystrokes += autoSkippedCount
        next.isPaused = true
        next.pauseStartTime = event.timestamp
      }
      return next
    }

    case 'PauseStarted': {
      return {
        ...state,
        isPaused: true,
        pauseStartTime: event.timestamp,
      }
    }

    case 'PauseEnded': {
      if (!state.isPaused || !state.pauseStartTime) return state
      return {
        ...state,
        totalPausedTime: state.totalPausedTime + (event.timestamp - state.pauseStartTime),
        isPaused: false,
        pauseStartTime: null,
      }
    }

    case 'BlockSkipped': {
      if (state.typingStarted && !state.isPaused) {
        return {
          ...state,
          isPaused: true,
          pauseStartTime: event.timestamp,
        }
      }
      return state
    }

    default:
      return state
  }
}

export function computeStats(state: LiveStatsState, now: number): TypingStats {
  let elapsedTime = now - (state.startTime ?? now) - state.totalPausedTime
  if (state.isPaused && state.pauseStartTime) {
    elapsedTime -= now - state.pauseStartTime
  }
  const elapsedMinutes = elapsedTime / 60000
  const wpm = elapsedMinutes > 0 ? Math.round((state.correctKeystrokes / 5) / elapsedMinutes) : 0
  const accuracy = state.totalKeystrokes > 0
    ? Math.round((state.correctKeystrokes / state.totalKeystrokes) * 100)
    : 100
  return {
    wpm,
    accuracy,
    totalKeystrokes: state.totalKeystrokes,
    correctKeystrokes: state.correctKeystrokes,
  }
}
