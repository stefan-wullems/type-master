import type { Store, CharacterDef } from './store'

export function normalizeChar(char: string): string {
  const map: Record<string, string> = {
    '\u2018': "'", '\u2019': "'",
    '\u201C': '"', '\u201D': '"',
    '\u2013': '-', '\u2014': '-',
  }
  return map[char] || char
}

export function createInputHandler(
  store: Store,
  characters: CharacterDef[],
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    const { cursor, liveStats } = store.getState()
    if (cursor.completed || cursor.escaped) return

    const now = Date.now()

    if (event.key === 'Escape') {
      store.dispatch({ type: 'Escaped', timestamp: now })
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (cursor.currentIndex > 0) {
        store.dispatch({ type: 'BackspacePressed', timestamp: now, index: cursor.currentIndex - 1 })
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const currentBlockIndex = characters[cursor.currentIndex]?.blockIndex
      let nextBlockStart = cursor.currentIndex
      let found = false
      while (nextBlockStart < characters.length) {
        if (characters[nextBlockStart].blockIndex !== currentBlockIndex) {
          found = true
          break
        }
        nextBlockStart++
      }
      if (found) {
        store.dispatch({
          type: 'BlockSkipped',
          timestamp: now,
          fromIndex: cursor.currentIndex,
          toIndex: nextBlockStart,
        })
      }
      return
    }

    if (event.key.length === 1 || event.key === 'Enter') {
      event.preventDefault()
      if (cursor.currentIndex >= characters.length) return

      if (!liveStats.typingStarted) {
        store.dispatch({ type: 'TypingStarted', timestamp: now })
      } else if (liveStats.isPaused && !characters[cursor.currentIndex].isEnterRequired) {
        store.dispatch({ type: 'PauseEnded', timestamp: now })
      }

      const charDef = characters[cursor.currentIndex]

      if (charDef.isEnterRequired) {
        const isCorrect = event.key === 'Enter'
        store.dispatch({
          type: 'EnterPressed',
          timestamp: now,
          index: cursor.currentIndex,
          actual: event.key,
          isCorrect,
        })
      } else {
        const expected = normalizeChar(charDef.char)
        const actual = normalizeChar(event.key)
        const isCorrect = actual === expected
        store.dispatch({
          type: 'CharTyped',
          timestamp: now,
          index: cursor.currentIndex,
          expected,
          actual,
          isCorrect,
        })
      }

      // Check completion after dispatch (cursor has advanced)
      const { cursor: newCursor } = store.getState()
      if (newCursor.currentIndex >= characters.length) {
        store.dispatch({ type: 'Completed', timestamp: now })
      }
    }
  }
}
