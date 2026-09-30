const formatter = new Intl.NumberFormat('en-SL', {
  style: 'currency',
  currency: 'SLL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatLe(amount) {
  if (amount == null || isNaN(amount)) return 'Le 0'
  return formatter.format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
