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

      <Section title="Messages on Instagram and WhatsApp">
        If you message us on Instagram (@aquagear4) or WhatsApp, Meta forwards the message to our
        store system so we can reply and prepare your order. We receive your Instagram username or
        WhatsApp number and profile name, and what you send us (text and any photos). We use it
        only to answer you and to create and deliver your order. It is visible only to AquaGear
        staff, and we never sell it or use it for advertising.
      </Section>

      <Section title="Your choices">
        You can change or withdraw cookie consent at any time via <CookieSettingsLink />. You may
        request access to, correction of, or deletion of your personal data by contacting us.
        Withdrawing consent removes non-essential cookies from your browser.
      </Section>

      <Section title="Deleting your data" id="data-deletion">
        To delete your data, including messages you sent us on Instagram or WhatsApp, message us on
        Instagram (@aquagear4) or WhatsApp with &ldquo;delete my data&rdquo;. We delete your
        account details, conversations and messages within 30 days and confirm when it&rsquo;s
        done. Order records we must keep for accounting are retained without message content.
      </Section>

      <Section title="Retention">
        Order records are kept as required for accounting and legal obligations. Raw message data
        received from Meta is deleted after 30 days; conversations are kept while needed to
        support your orders, or until you ask us to delete them. Consent decisions are logged for
        audit purposes. Non-essential cookies follow the retention periods listed in
        the Cookie Policy.
      </Section>

      <p className="mt-8 text-sm text-gray-500">
        Questions about your data? Reach us via the contact options in the site footer.
      </p>
    </article>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-24">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{children}</p>
    </section>
  );
}
