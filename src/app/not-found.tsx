import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <Compass size={28} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-500">
        The page you&apos;re looking for drifted away. Let&apos;s get you back to shore.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="btn-primary px-6 py-2.5">Home</Link>
        <Link href="/shop" className="btn-outline px-6 py-2.5">Browse the shop</Link>
      </div>
    </div>
  );
}
