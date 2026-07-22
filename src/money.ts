/** Money is stored as integer cents everywhere; these convert at the edges. */

const fmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

/** 123456 → "$1,234.56" */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

/** Compact signed form for summaries, e.g. -$12.00 / +$40.00 */
export function formatSignedCents(cents: number, sign: 1 | -1): string {
  const s = formatCents(Math.abs(cents))
  return sign < 0 ? `−${s}` : `+${s}`
}

/** Parse a user-typed amount ("12", "12.5", "$1,234.56") to integer cents, or null. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}
