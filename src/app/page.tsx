import Link from "next/link";

export default function Home() {
  return (
    <section className="space-y-10">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Sea gear, floats, and safety for Lebanon</h1>
          <p className="text-gray-600 text-lg">Shop life jackets, fenders, floats, kickboards, and more. Built for beach days and boat crews.</p>
          <div className="flex gap-3">
            <Link href="/shop" className="btn-primary">Browse products</Link>
            <Link href="/account" className="btn-outline">Sign in</Link>
          </div>
        </div>
        <div className="card h-64 md:h-80 flex items-center justify-center text-sky-700 font-semibold">
          Ocean-ready gear for every trip
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card"><h3 className="font-semibold">Fast pickup</h3><p className="text-gray-600 mt-1">Local delivery or pickup in Lebanon.</p></div>
        <div className="card"><h3 className="font-semibold">Verified safety</h3><p className="text-gray-600 mt-1">We stock reliable brands for the sea.</p></div>
        <div className="card"><h3 className="font-semibold">Support</h3><p className="text-gray-600 mt-1">WhatsApp for quick answers.</p></div>
      </div>
    </section>
  );
}
