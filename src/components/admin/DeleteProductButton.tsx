"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProduct } from "@/app/admin/products/actions";

export function DeleteProductButton({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();

    const handleDelete = () => {
        if (!window.confirm("Are you sure you want to delete this product?")) return;

        startTransition(async () => {
            const result = await deleteProduct(id);
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            // Deleting from the edit page leaves a dead form — go back to the list.
            if (pathname.includes("/edit")) {
                router.push("/admin/products");
            }
        });
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className={`btn-outline text-red-600 border-red-200 hover:bg-red-50 ${isPending ? "opacity-50" : ""}`}
        >
            {isPending ? "Deleting..." : "Delete"}
        </button>
    );
}
