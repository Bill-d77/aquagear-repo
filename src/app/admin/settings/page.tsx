import { getStoreSettings } from "@/lib/settings";
import { Settings as SettingsIcon } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · AquaGear Admin",
};

export default async function AdminSettings() {
  const settings = await getStoreSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-gray-400" />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Store settings</h1>
      </div>
      <p className="text-sm text-gray-500">
        These values are read live from the database. Changes take effect immediately — no deploy required.
      </p>

      <form
        action="/api/admin/settings"
        method="post"
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4"
      >
        <Field
          label="Store name"
          name="storeName"
          defaultValue={settings.storeName}
          hint="Used in metadata, emails, and customer-facing copy."
        />

        <Field
          label="WhatsApp number"
          name="whatsappNumber"
          defaultValue={settings.whatsappNumber}
          hint="Digits only, including country code (e.g., 96171634379). Used on the floating WhatsApp button, shop, product, cart, and checkout."
        />

        <Field
          label="Flat shipping rate (USD cents)"
          name="shippingFlatRate"
          type="number"
          min={0}
          defaultValue={settings.shippingFlatRate.toString()}
          hint="Enter in cents. 500 = $5.00. Use 0 to keep shipping off."
        />

        <Field
          label="Business hours"
          name="businessHours"
          defaultValue={settings.businessHours}
          hint="Free-form. Shown on the contact card and order confirmations."
        />

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-gray-500">
            Last updated {new Date(settings.updatedAt).toLocaleString()}
          </span>
          <button type="submit" className="btn-primary">Save settings</button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  type?: string;
  min?: number;
}

function Field({ label, name, defaultValue, hint, type = "text", min }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        min={min}
        defaultValue={defaultValue}
        required
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
