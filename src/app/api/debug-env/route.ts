import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
        const dbUrl = process.env.DATABASE_URL;

        let dbStatus = "unknown";
        let userCount = -1;
        let adminExists = false;

        try {
            userCount = await prisma.user.count();
            const admin = await prisma.user.findUnique({
                where: { email: "admin@aquagear4.com" },
            });
            adminExists = !!admin;
            dbStatus = "connected";
        } catch (e) {
            dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
        }

        return NextResponse.json({
            env: {
                AUTH_SECRET_SET: !!authSecret,
                DATABASE_URL_SET: !!dbUrl,
                NODE_ENV: process.env.NODE_ENV,
            },
            db: {
                status: dbStatus,
                userCount,
                adminExists,
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}
