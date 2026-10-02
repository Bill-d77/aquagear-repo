import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for ordering from AquaGear: delivery, payment, cancellations, and returns.",
};

// ponytail: fees and delivery times are described, not hard-coded — the live
// amounts come from store settings and are shown at checkout.
export default function TermsPage() {
  return (
    <article className="prose mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-300">
        These terms apply when you browse aquagear-repo.vercel.app or order from AquaGear on our
        website, Instagram, or WhatsApp. By placing an order you agree to them. How we handle your
        personal data is covered in our{" "}
        <Link href="/privacy-policy" className="text-sky-700 underline dark:text-sky-400">
          Privacy Policy
        </Link>
        .
      </p>

      <Section title="Orders">
        An order is confirmed once we accept it — we may contact you by phone or WhatsApp to confirm
        details first. We may decline or cancel an order if an item is out of stock, a price was
        displayed in error, or we cannot reach you to confirm; if so, you pay nothing.
      </Section>

      <Section title="Prices and payment">
        Prices are in US dollars. Payment is cash on delivery: you
        pay the courier the order total, including any delivery fee, when you receive your order.
      </Section>

      <Section title="Delivery">
        We deliver across Lebanon, usually within 1–3 business days. The delivery fee, and the order
        amount above which delivery is free, are shown at checkout before you order. Please make
        sure someone can receive the order at the address and phone number you give us.
      </Section>

      <Section title="Cancellations">
        You can cancel free of charge at any time before your order is shipped — message us on
        WhatsApp or Instagram (@aquagear4). Once it has shipped, the returns section below applies.
      </Section>

      <Section title="Returns and defective items">
        We do not accept returns for change of mind. If an item arrives damaged, defective, or is not
        what you ordered, tell us within 3 days of delivery with a photo and we will replace it or
        refund you, and cover the delivery costs. If we agree to take back an item that is not
        defective, return delivery is at your cost. Items must be unused and in their original
        packaging unless the defect prevents it.
      </Section>

      <Section title="Safety equipment">
        Use life jackets, diving gear, and other safety equipment according to the manufacturer&rsquo;s
        instructions and size guidance. They reduce risk but do not replace supervision, training,
        or safe conditions on the water.
      </Section>

      <Section title="Liability">
        To the extent permitted by law, our liability for any order is limited to the amount you paid
        for it. Nothing in these terms limits rights you have under Lebanese consumer protection law.
      </Section>

      <Section title="Changes and governing law">
        We may update these terms; the version on this page when you order applies to that order.
        These terms are governed by the laws of Lebanon.
      </Section>

      <p className="mt-8 text-sm text-gray-500">
        Questions? Reach us via the contact options in the site footer.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{children}</p>
    </section>
  );
}
