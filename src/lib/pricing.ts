/**
 * Centralized pricing configuration for postcard orders
 */

export function getUnitPriceCents(): number {
  return 500; // $5.00
}

export function getTotalPriceCents(sendOption: 'single' | 'double' | 'triple'): number {
  switch (sendOption) {
    case 'single':
      return 500; // $5.00
    case 'double':
      return 1000; // $10.00
    case 'triple':
      return 1200; // $12.00 (bundle discount)
    default:
      throw new Error(`Invalid send option: ${sendOption}`);
  }
}

export function getUnitPriceDollars(): number {
  return getUnitPriceCents() / 100;
}

export function getTotalPriceDollars(sendOption: 'single' | 'double' | 'triple'): number {
  return getTotalPriceCents(sendOption) / 100;
}