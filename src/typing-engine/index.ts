export { createTypingEngine, type TypingEngineEnv, type TypingEngineOptions, type TypingStats } from './engine'
export { type TypingTheme, lightTheme, darkTheme } from './theme'
export { normalizeChar } from './input-handler'
export type { TypingEvent } from './events'
export type { CharacterDef, StoreState, Store } from './store'
export { CharStatus } from './reducers/cursor'
export type { CursorState } from './reducers/cursor'
export type { LiveStatsState } from './reducers/live-stats'
export type { AnalysisState } from './reducers/analysis'
export {
  perKeyAccuracy,
  interKeySpeed,
  speedOverTime,
  slowestKeys,
  fastestKeys,
  errorHotspots,
} from './reducers/analysis'
