import type { TypingEvent } from './events'
import { type CursorState, createCursorState, cursorReducer } from './reducers/cursor'
import { type LiveStatsState, createLiveStatsState, liveStatsReducer } from './reducers/live-stats'
import { type AnalysisState, createAnalysisState, analysisReducer } from './reducers/analysis'

export interface CharacterDef {
  char: string
  isEnterRequired: boolean
  blockIndex: number
}

export interface StoreState {
  cursor: CursorState
  liveStats: LiveStatsState
  analysis: AnalysisState
}

export type Subscriber = (state: StoreState, event: TypingEvent) => void

export interface Store {
  getState(): StoreState
  dispatch(event: TypingEvent): void
  subscribe(fn: Subscriber): () => void
}

export function createStore(characters: CharacterDef[]): Store {
  let cursor = createCursorState(characters.length)
  let liveStats = createLiveStatsState()
  let analysis = createAnalysisState()
  const subscribers: Set<Subscriber> = new Set()

  function getState(): StoreState {
    return { cursor, liveStats, analysis }
  }

  function dispatch(event: TypingEvent): void {
    const cursorResult = cursorReducer(cursor, event, characters)
    cursor = cursorResult.state
    liveStats = liveStatsReducer(liveStats, event, cursorResult.autoSkippedCount)
    analysis = analysisReducer(analysis, event)

    const state = getState()
    for (const fn of subscribers) {
      fn(state, event)
    }
  }

  function subscribe(fn: Subscriber): () => void {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  return { getState, dispatch, subscribe }
}
