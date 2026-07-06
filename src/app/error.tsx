"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
        <AlertTriangle size={28} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
      <p className="text-sm text-gray-500">A wave knocked us over. Try again, or head back home.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary px-6 py-2.5">Try again</button>
        <Link href="/" className="btn-outline px-6 py-2.5">Home</Link>
      </div>
    </div>
  );
}
