export function qtyByProductId(
  items: readonly { productId: string; quantity: number }[],
): Record<string, number> {
  const qty: Record<string, number> = {};
  for (let i = 0; i < items.length; i++) qty[items[i].productId] = items[i].quantity;
  return qty;
}

export function stockByProductId(
  products: readonly { id: string; stock: number }[],
): Record<string, number> {
  const stock: Record<string, number> = {};
  for (let i = 0; i < products.length; i++) stock[products[i].id] = products[i].stock;
  return stock;
}

export function activePayment<T extends { status: string }>(payments: readonly T[]): T | undefined {
  for (let i = 0; i < payments.length; i++) {
    const status = payments[i].status;
    if (status === 'pending' || status === 'processing') return payments[i];
  }
  return undefined;
}
