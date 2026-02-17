import type { TypingEvent } from '../events'

export interface AnalysisState {
  events: TypingEvent[]
}

export function createAnalysisState(): AnalysisState {
  return { events: [] }
}

export function analysisReducer(state: AnalysisState, event: TypingEvent): AnalysisState {
  return { events: [...state.events, event] }
}

export function perKeyAccuracy(events: TypingEvent[]): Map<string, { correct: number; total: number }> {
  const map = new Map<string, { correct: number; total: number }>()
  for (const e of events) {
    if (e.type === 'CharTyped') {
      const entry = map.get(e.expected) ?? { correct: 0, total: 0 }
      entry.total++
      if (e.isCorrect) entry.correct++
      map.set(e.expected, entry)
    }
  }
  return map
}

type KeyTimingEvent = Extract<TypingEvent, { type: 'CharTyped' | 'EnterPressed' }>

function isTimingEvent(e: TypingEvent): e is KeyTimingEvent {
  return e.type === 'CharTyped' || e.type === 'EnterPressed'
}

export function interKeySpeed(events: TypingEvent[]): number[] {
  const timingEvents = events.filter(isTimingEvent)
  const deltas: number[] = []
  for (let i = 1; i < timingEvents.length; i++) {
    deltas.push(timingEvents[i].timestamp - timingEvents[i - 1].timestamp)
  }
  return deltas
}

export function speedOverTime(events: TypingEvent[], windowSize: number): number[] {
  const timingEvents = events.filter(isTimingEvent)
  if (timingEvents.length < windowSize) return []

  const wpms: number[] = []
  for (let i = windowSize; i <= timingEvents.length; i++) {
    const window = timingEvents.slice(i - windowSize, i)
    const duration = window[window.length - 1].timestamp - window[0].timestamp
    if (duration > 0) {
      const minutes = duration / 60000
      wpms.push(Math.round((windowSize / 5) / minutes))
    }
  }
  return wpms
}

export function slowestKeys(events: TypingEvent[], n: number): Array<{ key: string; avgTime: number }> {
  return keysByAvgTime(events).slice(-n).reverse()
}

export function fastestKeys(events: TypingEvent[], n: number): Array<{ key: string; avgTime: number }> {
  return keysByAvgTime(events).slice(0, n)
}

function keysByAvgTime(events: TypingEvent[]): Array<{ key: string; avgTime: number }> {
  const timingEvents = events.filter(isTimingEvent)
  const keyTimes = new Map<string, number[]>()

  for (let i = 1; i < timingEvents.length; i++) {
    const e = timingEvents[i]
    const delta = e.timestamp - timingEvents[i - 1].timestamp
    const key = e.type === 'CharTyped' ? e.expected : 'Enter'
    const times = keyTimes.get(key) ?? []
    times.push(delta)
    keyTimes.set(key, times)
  }

  const result: Array<{ key: string; avgTime: number }> = []
  for (const [key, times] of keyTimes) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    result.push({ key, avgTime: Math.round(avg) })
  }
  result.sort((a, b) => a.avgTime - b.avgTime)
  return result
}

export function errorHotspots(events: TypingEvent[]): Map<number, number> {
  const hotspots = new Map<number, number>()
  for (const e of events) {
    if (e.type === 'BackspacePressed') {
      const count = hotspots.get(e.index) ?? 0
      hotspots.set(e.index, count + 1)
    }
  }
  return hotspots
}
