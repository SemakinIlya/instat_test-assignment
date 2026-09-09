const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** API sends kopecks. */
export function formatMoney(kopecks: number): string {
  return rub.format(kopecks / 100);
}
