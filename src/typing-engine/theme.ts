export interface TypingTheme {
  current: { outline: string }
  correct: { background: string; color: string }
  incorrect: { background: string; color: string }
  corrected: { background: string; color: string }
  enterMarker: { color: string }
}

export const lightTheme: TypingTheme = {
  current: { outline: '#94a3b8' },
  correct: { background: '#bbf7d0', color: '#052e16' },
  incorrect: { background: '#fecaca', color: '#450a0a' },
  corrected: { background: '#fde68a', color: '#422006' },
  enterMarker: { color: '#94a3b8' },
}

export const darkTheme: TypingTheme = {
  current: { outline: '#64748b' },
  correct: { background: '#166534', color: '#bbf7d0' },
  incorrect: { background: '#991b1b', color: '#fecaca' },
  corrected: { background: '#854d0e', color: '#fde68a' },
  enterMarker: { color: '#64748b' },
}

export function themeToCSS(theme: TypingTheme): string {
  return `
    .typing-char.current { outline: 1px solid ${theme.current.outline}; }
    .typing-char.correct { background-color: ${theme.correct.background}; color: ${theme.correct.color}; }
    .typing-char.incorrect { background-color: ${theme.incorrect.background}; color: ${theme.incorrect.color}; }
    .typing-char.corrected { background-color: ${theme.corrected.background}; color: ${theme.corrected.color}; }
    .enter-required { color: ${theme.enterMarker.color}; }
  `
}
