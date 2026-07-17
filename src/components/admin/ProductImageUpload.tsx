"use client";

import { UploadButton } from "@/utils/uploadthing";
import Image from "next/image";
import { useState } from "react";
import { X, ImagePlus } from "lucide-react";

interface ProductImageUploadProps {
  /** Pre-existing image URLs (used in edit mode). */
  defaultValues?: string[];
  /** Legacy single-image prop – converted to array internally. */
  defaultValue?: string;
  /** Form field name – each URL is submitted as a separate input with this name. */
  name: string;
}

export function ProductImageUpload({
  defaultValues,
  defaultValue,
  name,
}: ProductImageUploadProps) {
  const initial: string[] = defaultValues
    ? defaultValues
    : defaultValue
    ? [defaultValue]
    : [];

  const [imageUrls, setImageUrls] = useState<string[]>(initial);

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {imageUrls.map((url, index) => (
            <div
              key={url + index}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group"
            >
              <Image
                src={url}
                alt={`Product image ${index + 1}`}
                fill
                className="object-cover"
              />
              {/* Primary badge */}
              {index === 0 && (
                <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-sky-700 text-white px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 bg-white rounded-full shadow border border-gray-200 text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {/* Hidden form input for this URL */}
              <input type="hidden" name={name} value={url} />
            </div>
          ))}
        </div>
      )}

      {/* Upload zone – always visible so more images can be added */}
      <div className="w-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center py-6 bg-gray-50 hover:bg-gray-100 transition-colors">
        <ImagePlus className="w-7 h-7 text-gray-400 mb-2" />
        <p className="text-xs text-gray-500 mb-3">
          {imageUrls.length === 0
            ? "Upload product images"
            : "Add more images"}
        </p>
        <UploadButton
          endpoint="productImage"
          onClientUploadComplete={(res) => {
            if (res && res.length > 0) {
              setImageUrls((prev) => [
                ...prev,
                ...res.map((r) => r.url),
              ]);
            }
          }}
          onUploadError={(error: Error) => {
            alert(`Upload error: ${error.message}`);
          }}
          appearance={{
            button:
              "bg-sky-700 hover:bg-sky-800 text-white text-sm px-4 py-2 rounded-md",
            allowedContent: "text-gray-500 text-xs mt-1",
          }}
        />
      </div>

      {/* Invisible required sentinel – ensures at least one image is present */}
      {imageUrls.length === 0 && (
        <input
          type="text"
          name={name}
          value=""
          required
          readOnly
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
