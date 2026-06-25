// ponytail: oldPrice is always derived (price + $5), never stored — changes with price automatically.
const OLD_PRICE_MARKUP = 500; // cents added to current price to form the "original" price

export default function PriceTag({
  priceCents,
  size = "sm",
}: {
  priceCents: number;
  size?: "sm" | "lg";
}) {
  const fmt = (cents: number) => (cents / 100).toFixed(2);
  const oldPrice = priceCents + OLD_PRICE_MARKUP;

  if (size === "lg") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-sky-600">{fmt(priceCents)} USD</span>
        <span className="text-lg text-gray-400 line-through">{fmt(oldPrice)}</span>
        <span className="rounded-full bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">
          Save $5
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-sm font-semibold text-sky-600">{fmt(priceCents)} USD</span>
      <span className="text-xs text-gray-400 line-through">{fmt(oldPrice)}</span>
      <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
        Save $5
      </span>
    </div>
  );
}
