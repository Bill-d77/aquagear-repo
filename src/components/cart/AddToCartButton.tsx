"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Check } from "lucide-react";

interface AddToCartButtonProps {
    productId: string;
}

export function AddToCartButton({ productId }: AddToCartButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    async function handleAddToCart() {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append("productId", productId);
            formData.append("quantity", "1");

            const res = await fetch("/api/cart/add", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Failed to add to cart");

            // Trigger success state
            setIsLoading(false);
            setIsSuccess(true);
            toast.success("Added to cart!");

            // Reset after animation
            setTimeout(() => setIsSuccess(false), 2000);
        } catch (error) {
            setIsLoading(false);
            toast.error("Something went wrong");
        }
    }

    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAddToCart}
            disabled={isLoading || isSuccess}
            className={`
        relative w-full h-12 rounded-lg font-medium text-white shadow-sm transition-colors
        flex items-center justify-center gap-2
        ${isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
      `}
        >
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </motion.div>
                ) : isSuccess ? (
                    <motion.div
                        key="success"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        <span>Added!</span>
                    </motion.div>
                ) : (
                    <motion.div
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        <span>Add to Cart</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
}
