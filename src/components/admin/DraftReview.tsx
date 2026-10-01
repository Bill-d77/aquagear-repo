import type { Extraction } from "@/lib/meta/extract";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface DraftOrder {
  id: string;
  status: string;
  name: string | null;
  phoneNumber: string | null;
  location: string | null;
  apartment: string | null;
  notes: string | null;
  items: { productId: string; quantity: number; price: number }[];
  extraction: unknown;
}

const input = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500";
const dollars = (c: number) => (c / 100).toFixed(2);

/** Editable review form for a WhatsApp/Instagram draft. Posts to /api/admin/orders/review. */
export function DraftReview({ order, products }: { order: DraftOrder; products: Product[] }) {
  const ex = order.extraction as Extraction | null;
  const unresolved = ex?.items.filter((i) => !i.productId) ?? [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const productSelect = (defaultValue: string, preferred: { productId: string; name: string }[] = []) => (
    <select name="itemProductId" defaultValue={defaultValue} className={input} aria-label="Product">
      <option value="">— choose product —</option>
      {preferred.length > 0 && (
        <optgroup label="Suggested">
          {preferred.map((c) => (
            <option key={`s-${c.productId}`} value={c.productId}>{c.name}</option>
          ))}
        </optgroup>
      )}
      <optgroup label="All products">
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name} — ${dollars(p.price)} ({p.stock} in stock)</option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <form action="/api/admin/orders/review" method="post" className="bg-white rounded-xl border-2 border-amber-200 shadow-sm p-6 space-y-5">
      <input type="hidden" name="id" value={order.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 text-lg">Review order</h2>
        {ex && (
          <span className="text-sm text-gray-600">
            Detection confidence: <b>{ex.confidence}</b> ({Math.round(ex.score * 100)}%)
            {ex.customerConfirmed && " · customer said yes in chat"}
          </span>
        )}
      </div>
      {ex && ex.missingFields.length > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">
          Missing or uncertain: {ex.missingFields.join(", ").replace(/_/g, " ")}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Customer name"><input name="name" defaultValue={order.name ?? ""} maxLength={100} className={input} /></Field>
        <Field label="Phone"><input name="phoneNumber" defaultValue={order.phoneNumber ?? ""} maxLength={40} className={input} inputMode="tel" /></Field>
        <Field label="City / area"><input name="location" defaultValue={order.location ?? ""} maxLength={200} className={input} placeholder="e.g. Tripoli, Mina" /></Field>
        <Field label="Street, building, floor, landmark">
          <input name="apartment" defaultValue={order.apartment ?? ""} maxLength={200} className={input} />
        </Field>
      </div>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs uppercase tracking-wider text-gray-500">
          <span className="col-span-7">Product</span>
          <span className="col-span-2">Qty</span>
          <span className="col-span-3">Unit price ($)</span>
        </div>
        {order.items.map((item, i) => (
          <div key={`i-${i}`} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 sm:col-span-7">{productSelect(item.productId)}</div>
            <input name="itemQuantity" type="number" min={0} max={99} defaultValue={item.quantity} className={`${input} col-span-4 sm:col-span-2`} aria-label="Quantity" />
            <input name="itemPrice" type="number" min={0} step="0.01" defaultValue={dollars(item.price)} className={`${input} col-span-8 sm:col-span-3`} aria-label="Unit price" />
            {byId.get(item.productId) && item.quantity > byId.get(item.productId)!.stock && (
              <p className="col-span-12 text-xs text-red-700">Only {byId.get(item.productId)!.stock} in stock.</p>
            )}
          </div>
        ))}
        {unresolved.map((u, i) => (
          <div key={`u-${i}`} className="grid grid-cols-12 gap-2 items-center bg-amber-50 rounded-md p-2">
            <p className="col-span-12 text-xs text-amber-800">Customer wrote “{u.customerText}” — pick the product:</p>
            <div className="col-span-12 sm:col-span-7">{productSelect("", u.candidates)}</div>
            <input name="itemQuantity" type="number" min={0} max={99} defaultValue={u.quantity} className={`${input} col-span-4 sm:col-span-2`} aria-label="Quantity" />
            <input name="itemPrice" type="number" min={0} step="0.01" placeholder="catalog" className={`${input} col-span-8 sm:col-span-3`} aria-label="Unit price" />
          </div>
        ))}
        {[0, 1].map((i) => (
          <div key={`n-${i}`} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 sm:col-span-7">{productSelect("")}</div>
            <input name="itemQuantity" type="number" min={0} max={99} defaultValue={1} className={`${input} col-span-4 sm:col-span-2`} aria-label="Quantity" />
            <input name="itemPrice" type="number" min={0} step="0.01" placeholder="catalog" className={`${input} col-span-8 sm:col-span-3`} aria-label="Unit price" />
          </div>
        ))}
        <p className="text-xs text-gray-500">Set quantity to 0 to remove an item. Leave price blank for the catalog price; the delivery fee is added automatically.</p>
      </div>

      <Field label="Reason for any price change (logged)"><input name="priceReason" maxLength={200} className={input} placeholder="e.g. agreed $20 in chat" /></Field>
      <Field label="Notes"><textarea name="notes" defaultValue={order.notes ?? ""} rows={4} maxLength={2000} className={input} /></Field>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button name="intent" value="confirm" className="btn-primary text-sm">Confirm order</button>
        <button name="intent" value="save" className="btn-outline text-sm">Save draft</button>
        <button name="intent" value="reject" className="text-sm px-3 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50">Reject</button>
      </div>
      <p className="text-xs text-gray-500">Confirming places the order and reserves stock, exactly like a website order.</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
