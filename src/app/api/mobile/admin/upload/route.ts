export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { requireMobileAdmin } from "@/lib/mobile-admin";

const MAX_BYTES = 4 * 1024 * 1024; // match the web uploader's 4MB image limit

/** Multipart upload: field "file" → { url } on UploadThing, same store the web admin uses. */
export async function POST(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 4MB limit" }, { status: 413 });
    }

    const utapi = new UTApi();
    const result = await utapi.uploadFiles(file);
    if (result.error || !result.data) {
      console.error("UploadThing error:", result.error);
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }
    // data.url is the utfs.io URL — the host ensureValidImageUrl allows.
    return NextResponse.json({ url: result.data.url }, { status: 201 });
  } catch (e) {
    console.error("POST /api/mobile/admin/upload:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
