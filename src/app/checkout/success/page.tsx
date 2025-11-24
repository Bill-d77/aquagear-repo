import Link from "next/link";

export default function CheckoutSuccess() {
    return (
        <div className="max-w-2xl mx-auto text-center py-12">
            <div className="mb-6 flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-4">Order Placed Successfully!</h1>
            <p className="text-lg text-gray-600 mb-8">
                Thank you for your order. We will contact you shortly to confirm delivery details.
            </p>
            <div className="flex justify-center gap-4">
                <Link href="/shop" className="btn-primary">
                    Continue Shopping
                </Link>
                <Link href="/account" className="btn-outline">
                    View Orders
                </Link>
            </div>
        </div>
    );
}
