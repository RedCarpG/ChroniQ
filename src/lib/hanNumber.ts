// Small numbers in Chinese numerals, for text set vertically (天书's 八字), where an Arabic numeral
// would lie on its side: 4 → 四, 12 → 十二, 20 → 二十, 23 → 二十三. Up to 99.
const DIGITS = '〇一二三四五六七八九'

export function hanNumber(n: number): string {
  if (n < 10) return DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens > 1 ? DIGITS[tens] : ''}十${ones ? DIGITS[ones] : ''}`
}

/** A year, digit by digit, for text set vertically: 2026 → 二〇二六 */
export function hanDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => DIGITS[Number(d)])
}
