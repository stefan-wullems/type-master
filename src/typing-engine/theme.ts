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

export function isDarkBackground(
  el: Element,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
): boolean {
  let current: Element | null = el
  while (current) {
    const bg = getComputedStyle(current).backgroundColor
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (match) {
        const [, r, g, b] = match.map(Number)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance < 0.5
      }
    }
    current = current.parentElement
  }
  return false
}

export function detectTheme(
  el: Element,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
): { theme: TypingTheme; isDark: boolean } {
  const isDark = isDarkBackground(el, getComputedStyle)
  return { theme: isDark ? darkTheme : lightTheme, isDark }
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
