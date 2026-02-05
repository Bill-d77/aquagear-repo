"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function deleteProduct(id: string) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (role !== "ADMIN") {
        return { success: false, message: "Unauthorized" };
    }

    try {
        await prisma.product.delete({ where: { id } });
        revalidatePath("/admin/products");
        return { success: true, message: "Product deleted" };
    } catch (error: any) {
        console.error("Delete product error:", error);
        if (error.code === "P2003") {
            return {
                success: false,
                message: "Cannot delete product because it is referenced by orders or reviews.",
            };
        }
        return { success: false, message: "Failed to delete product" };
    }
}
