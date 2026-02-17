export type TypingEvent =
  | { type: 'TypingStarted'; timestamp: number }
  | { type: 'CharTyped'; timestamp: number; index: number; expected: string; actual: string; isCorrect: boolean }
  | { type: 'EnterPressed'; timestamp: number; index: number; actual: string; isCorrect: boolean }
  | { type: 'BackspacePressed'; timestamp: number; index: number }
  | { type: 'BlockSkipped'; timestamp: number; fromIndex: number; toIndex: number }
  | { type: 'PauseStarted'; timestamp: number }
  | { type: 'PauseEnded'; timestamp: number }
  | { type: 'Completed'; timestamp: number }
  | { type: 'Escaped'; timestamp: number }
