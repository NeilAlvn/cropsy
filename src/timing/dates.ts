// Tiny UTC-calendar date helpers shared by the timing engines. Dates are treated
// as UTC calendar days so timezone drift can never shift a window by a day.

export const MS_PER_DAY = 86_400_000

export function parseISO(d: string): Date {
  const parts = d.split('-').map(Number)
  const [y, m, day] = parts
  if (parts.length !== 3 || y === undefined || m === undefined || day === undefined) {
    throw new Error(`invalid ISO date: ${d}`)
  }
  return new Date(Date.UTC(y, m - 1, day))
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + Math.round(n) * MS_PER_DAY)
}

export function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, Math.round(weeks * 7))
}
