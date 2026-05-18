"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Loader2 } from "lucide-react";
import { updateCartItemQuantity } from "@/app/actions";

interface CartQuantitySelectorProps {
  itemId: string;
  initialQuantity: number;
  unitPrice: number; // in cents
}

export function CartQuantitySelector({
  itemId,
  initialQuantity,
  unitPrice,
}: CartQuantitySelectorProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isPending, startTransition] = useTransition();

  const update = (newQty: number) => {
    if (newQty < 0) return;
    setQuantity(newQty); // optimistic
    startTransition(async () => {
      await updateCartItemQuantity(itemId, newQty);
    });
  };

  const lineTotal = ((quantity * unitPrice) / 100).toFixed(2);

  return (
    <div className="flex items-center gap-3">
      {/* Quantity controls */}
      <div className="flex items-center border rounded-lg h-9">
        <button
          onClick={() => update(quantity - 1)}
          disabled={isPending}
          className="px-2.5 h-full hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40 rounded-l-lg"
          aria-label="Decrease quantity"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="w-10 text-center text-sm font-medium">
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-gray-400" />
          ) : (
            quantity
          )}
        </div>
        <button
          onClick={() => update(quantity + 1)}
          disabled={isPending}
          className="px-2.5 h-full hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40 rounded-r-lg"
          aria-label="Increase quantity"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Line subtotal */}
      <span className="text-sm font-medium text-gray-900 w-24 text-right tabular-nums">
        {lineTotal} USD
      </span>
    </div>
  );
}
