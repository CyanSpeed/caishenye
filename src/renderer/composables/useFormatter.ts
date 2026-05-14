import Decimal from 'decimal.js'

export function useFormatter() {
  function currency(value: string | Decimal, showSign = true): string {
    const d = typeof value === 'string' ? new Decimal(value) : value
    const isNeg = d.isNegative()
    const absVal = d.abs()
    const parts = absVal.toFixed(2).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const formatted = `¥${parts.join('.')}`
    if (!showSign) return formatted
    return isNeg ? `-${formatted}` : `+${formatted}`
  }

  function currencyPlain(value: string | Decimal): string {
    const d = typeof value === 'string' ? new Decimal(value) : value
    const absVal = d.abs()
    const parts = absVal.toFixed(2).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const sign = d.isNegative() ? '-' : ''
    return `${sign}¥${parts.join('.')}`
  }

  function percent(value: Decimal, decimals = 2): string {
    return `${value.mul(100).toFixed(decimals)}%`
  }

  function shortDate(dateStr: string): string {
    const parts = dateStr.split('-')
    return `${parts[1]}月${parts[2]}日`
  }

  function fullDate(dateStr: string): string {
    const parts = dateStr.split('-')
    return `${parts[0]}年${parts[1]}月${parts[2]}日`
  }

  return { currency, currencyPlain, percent, shortDate, fullDate }
}
