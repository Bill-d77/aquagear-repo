"use client";

import { useState } from "react";
import { AddToCartButton } from "./AddToCartButton";
import { Minus, Plus } from "lucide-react";

interface ProductQuantitySelectorProps {
    productId: string;
}

export function ProductQuantitySelector({ productId }: ProductQuantitySelectorProps) {
    const [quantity, setQuantity] = useState(1);

    const decrease = () => setQuantity((q) => Math.max(1, q - 1));
    const increase = () => setQuantity((q) => q + 1);

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center border rounded-lg h-12">
                <button
                    onClick={decrease}
                    className="px-3 h-full hover:bg-gray-50 text-gray-600 transition-colors"
                    aria-label="Decrease quantity"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <div className="w-12 text-center font-medium">{quantity}</div>
                <button
                    onClick={increase}
                    className="px-3 h-full hover:bg-gray-50 text-gray-600 transition-colors"
                    aria-label="Increase quantity"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="w-40">
                <AddToCartButton productId={productId} quantity={quantity} />
            </div>
        </div>
    );
}
