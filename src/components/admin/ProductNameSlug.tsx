"use client";

import { useState } from "react";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ProductNameSlugProps {
  defaultName?: string;
  defaultSlug?: string;
}

export function ProductNameSlug({
  defaultName = "",
  defaultSlug = "",
}: ProductNameSlugProps) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugLocked, setSlugLocked] = useState(!!defaultSlug);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (!slugLocked) {
      setSlug(toSlug(e.target.value));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setSlugLocked(true);
  };

  const regenerate = () => {
    setSlug(toSlug(name));
    setSlugLocked(false);
  };

  return (
    <>
      <input
        name="name"
        placeholder="Name"
        value={name}
        onChange={handleNameChange}
        className="border rounded w-full p-2"
        required
      />
      <div className="relative">
        <input
          name="slug"
          placeholder="slug-auto-generated"
          value={slug}
          onChange={handleSlugChange}
          className="border rounded w-full p-2 pr-28"
          required
        />
        <button
          type="button"
          onClick={regenerate}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sky-600 hover:text-sky-800 font-medium"
        >
          ↺ from name
        </button>
      </div>
    </>
  );
}
