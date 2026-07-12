import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookies/CookieSettingsLink";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AquaGear collects, uses, and protects your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-300">
        This policy explains what personal data AquaGear collects and why. It complements our{" "}
        <Link href="/cookie-policy" className="text-sky-700 underline dark:text-sky-400">
          Cookie Policy
        </Link>
        , which covers cookies specifically.
      </p>

      <Section title="Data we collect">
        Account details you provide (name, email), order and delivery information you enter at
        checkout, and — with your consent — analytics and marketing identifiers as described in the
        Cookie Policy. Authentication uses secure, HttpOnly session cookies that are not accessible
        to JavaScript.
      </Section>

      <Section title="How we use it">
        To process and deliver orders, provide customer support, secure the site (rate limiting,
        fraud prevention), and — only where you have consented — to measure usage and attribute
        marketing.
      </Section>

      <Section title="Your choices">
        You can change or withdraw cookie consent at any time via <CookieSettingsLink />. You may
        request access to, correction of, or deletion of your personal data by contacting us.
        Withdrawing consent removes non-essential cookies from your browser.
      </Section>

      <Section title="Retention">
        Order records are kept as required for accounting and legal obligations. Consent decisions
        are logged for audit purposes. Non-essential cookies follow the retention periods listed in
        the Cookie Policy.
      </Section>

      <p className="mt-8 text-sm text-gray-500">
        Questions about your data? Reach us via the contact options in the site footer.
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
