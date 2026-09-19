export function parseNumber(value: string): number | null {
  if (!value || value === '—') return null
  const cleaned = value.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}
