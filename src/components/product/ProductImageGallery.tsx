"use client";

import { useState } from "react";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";

interface ProductImageGalleryProps {
  name: string;
  /** Primary / legacy single image URL */
  imageUrl: string;
  /** Additional images from the ProductImage relation */
  images: { id: string; url: string; order: number }[];
}

export function ProductImageGallery({ name, imageUrl, images }: ProductImageGalleryProps) {
  // Merge: images relation (sorted by order) first, then fall back to imageUrl if none
  const allImages: string[] =
    images.length > 0
      ? images.map((img) => img.url)
      : [imageUrl].filter(Boolean);

  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="card overflow-hidden">
        <Image
          src={ensureValidImageUrl(allImages[selected])}
          alt={`${name} – image ${selected + 1}`}
          width={800}
          height={600}
          className="w-full h-80 object-contain bg-white"
          priority
        />
      </div>

      {/* Thumbnails – only shown when there are multiple images */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                i === selected
                  ? "border-sky-500"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <Image
                src={ensureValidImageUrl(url)}
                alt={`${name} thumbnail ${i + 1}`}
                width={64}
                height={64}
                className="w-full h-full object-cover bg-white"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
