const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: 'RM',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
};

export const getCurrencySymbol = (currency: string) =>
  CURRENCY_SYMBOLS[currency] ?? currency;

export const formatCurrency = (
  amount: number,
  currency = 'MYR',
  options: { showSign?: boolean; compact?: boolean } = {}
): string => {
  const symbol = getCurrencySymbol(currency);
  const abs    = Math.abs(amount);
  const sign   = options.showSign && amount !== 0 ? (amount > 0 ? '+' : '-') : amount < 0 ? '-' : '';

  let formatted: string;
  if (options.compact && abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1) + 'M';
  } else if (options.compact && abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(1) + 'K';
  } else {
    formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return `${sign}${symbol}${formatted}`;
};

export const parseCurrencyInput = (input: string): number => {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const parsed  = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
};
