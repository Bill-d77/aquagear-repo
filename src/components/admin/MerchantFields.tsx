// Optional Google Merchant Center attributes for a product. Rendered inside the
// admin new/edit product forms. Leaving these blank is fine — the feed marks
// such products identifier_exists=no.

interface MerchantDefaults {
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  condition?: string | null;
  googleProductCategory?: string | null;
}

/** DM aliases for the WhatsApp/Instagram order extractor. Rendered in the new/edit product forms. */
export function AliasField({ defaultValue }: { defaultValue?: string[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="aliases">
        DM aliases (optional)
      </label>
      <input
        id="aliases"
        name="aliases"
        defaultValue={defaultValue?.join(", ") ?? ""}
        placeholder="e.g. black mask, mask black, black goggles"
        className="border rounded w-full p-2 text-sm"
      />
      <p className="text-xs text-gray-500 mt-1">
        Comma-separated phrases customers use for this product on WhatsApp/Instagram. They take priority over name matching.
      </p>
    </div>
  );
}

export function MerchantFields({ defaults }: { defaults?: MerchantDefaults }) {
  const input = "border rounded w-full p-2 text-sm";
  return (
    <details className="rounded-lg border border-gray-200 p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700">
        Google Merchant Center (optional)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-gray-500">
          Fill these in to list the product on Google Shopping. Blank is fine — the product still
          appears in the feed, just without a GTIN/brand identifier.
        </p>
        <input name="brand" defaultValue={defaults?.brand ?? ""} placeholder="Brand (e.g. AquaGear)" className={input} />
        <div className="grid grid-cols-2 gap-3">
          <input name="gtin" defaultValue={defaults?.gtin ?? ""} placeholder="GTIN / barcode (digits)" className={input} inputMode="numeric" />
          <input name="mpn" defaultValue={defaults?.mpn ?? ""} placeholder="MPN (part number)" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select name="condition" defaultValue={defaults?.condition ?? "new"} className={input}>
            <option value="new">New</option>
            <option value="refurbished">Refurbished</option>
            <option value="used">Used</option>
          </select>
          <input
            name="googleProductCategory"
            defaultValue={defaults?.googleProductCategory ?? ""}
            placeholder="Google category (optional)"
            className={input}
          />
        </div>
      </div>
    </details>
  );
}
