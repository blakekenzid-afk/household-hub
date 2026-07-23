import type { NoteColor } from './db'

export const NOTE_COLORS: NoteColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
]

const HEX: Record<NoteColor, string> = {
  red: '#E5484D',
  orange: '#EA580C',
  yellow: '#D9A400',
  green: '#16A34A',
  teal: '#0D9488',
  blue: '#2563EB',
  purple: '#7C3AED',
  pink: '#DB2777',
}

export function noteColorHex(color: NoteColor | undefined): string | undefined {
  return color ? HEX[color] : undefined
}
