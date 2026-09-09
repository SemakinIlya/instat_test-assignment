import { formatMoney } from '@/lib/money';

export type Line = {
  productId: string;
  title: string;
  quantity: number;
  lineTotal: number;
};

export function LineList({ items }: { items: readonly Line[] }) {
  return (
    <ul className="lines">
      {items.map((item) => (
        <li key={item.productId}>
          <span>
            {item.title} × {item.quantity}
          </span>
          <span className="num">{formatMoney(item.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}
