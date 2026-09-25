import type { CSSProperties } from 'react'

export type ThemeName = 'vault' | 'paper' | 'draft' | 'film'

export interface Theme {
  bg: string; panel: string; ink: string; muted: string; line: string
  accent: string; stamp: string; err: string; tex: string; texSize: string
}

/** Only the accent follows the seed; text and surface colours are fixed so contrast never depends on luck. */
export function theme(name: ThemeName, hue: number): Theme {
  switch (name) {
    case 'vault': return { bg: '#15120e', panel: '#211d17', ink: '#e9e1cf', muted: '#a89c84', line: '#3a342b', accent: `oklch(0.8 0.12 ${hue})`, stamp: '#e9e1cf', err: '#ff8f7a', tex: 'none', texSize: 'auto' }
    case 'paper': return { bg: '#ebe4d1', panel: '#e2d9c2', ink: '#1c1a15', muted: '#5a5447', line: '#c6baa0', accent: `oklch(0.48 0.15 ${hue})`, stamp: 'oklch(0.5 0.17 28)', err: 'oklch(0.5 0.17 28)', tex: 'none', texSize: 'auto' }
    case 'draft': return { bg: '#1c2a46', panel: '#22324f', ink: '#eef0ee', muted: '#a9b5c9', line: '#3d5076', accent: `oklch(0.83 0.12 ${hue})`, stamp: `oklch(0.83 0.12 ${hue})`, err: '#ff9a86', tex: 'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)', texSize: '28px 28px' }
    case 'film': return { bg: '#0d100d', panel: '#141914', ink: '#d3e0c6', muted: '#8c9a84', line: '#29332a', accent: `oklch(0.84 0.13 ${hue})`, stamp: `oklch(0.84 0.13 ${hue})`, err: '#ff9a86', tex: 'repeating-linear-gradient(0deg,rgba(211,224,198,.025) 0 1px,transparent 1px 3px)', texSize: 'auto' }
  }
}

/** The theme as CSS custom properties, so components can write var(--ink) instead of threading colours through props. */
export function themeVars(t: Theme): CSSProperties {
  return {
    '--bg': t.bg, '--panel': t.panel, '--ink': t.ink, '--muted': t.muted, '--line': t.line,
    '--accent': t.accent, '--stamp': t.stamp, '--err': t.err, '--tex': t.tex, '--tex-size': t.texSize,
  } as CSSProperties
}
