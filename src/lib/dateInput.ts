/** Validate without Date's automatic rollover (for links, storage and forms). */
export function validDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

export function parseTime(value: string): { hour: number; minute: number } | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour < 24 && minute < 60 ? { hour, minute } : null
}
