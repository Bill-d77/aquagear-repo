"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export async function deleteProduct(id: string) {
    if (!(await isAdmin())) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await prisma.product.delete({ where: { id } });
        revalidatePath("/admin/products");
        return { success: true, message: "Product deleted" };
    } catch (error: any) {
        console.error("Delete product error:", error);
        if (error.code === "P2003") {
            try {
                await prisma.product.update({
                    where: { id },
                    data: { isArchived: true },
                });
                revalidatePath("/admin/products");
                return {
                    success: true,
                    message: "Product archived because it has associated orders/reviews.",
                };
            } catch (archiveError) {
                console.error("Archive product error:", archiveError);
                return { success: false, message: "Failed to archive product" };
            }
        }
        return { success: false, message: "Failed to delete product" };
    }
}
