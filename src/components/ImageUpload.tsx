"use client";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

type UploadResult = Array<{ url: string } | undefined> | undefined;

export function ImageUpload({ onUrl }: { onUrl: (url: string) => void }) {
  return (
    <UploadButton<OurFileRouter>
      endpoint="productImage"
      onClientUploadComplete={(res: UploadResult) => {
        const url = res?.[0]?.url;
        if (url) onUrl(url);
      }}
      onUploadError={(e: Error) => {
        alert(e.message);
      }}
      appearance={{
        button: "btn-outline",
      }}
    />
  );
} 