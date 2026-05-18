# AquaGear UI & UX Improvement Plan
**Pages: Home · /shop · /cart**
_Generated: May 2026_

---

## 1. Overview

The AquaGear storefront is built on a strong modern stack:

- **Next.js App Router** with TypeScript
- **Tailwind CSS** for styling
- **Prisma** for data access
- **Framer Motion** for animations (already installed)
- **Sonner** for toast notifications
- **Lucide** for icons

The current foundation is already clean and intentional — glassmorphism cards, a sticky navbar, sky-blue branding, and a responsive grid structure. However, the storefront still feels closer to an early-stage prototype than a polished ecommerce experience. The main issues are:

- Competing CTAs cluttering product cards and the cart
- Inconsistent spacing across pages
- A weak cart flow (no quantity editing, poor empty state)
- Incomplete responsive refinement across device sizes
- Missing loading and skeleton states
- Lack of clear visual hierarchy on the home page

This plan improves **usability, conversion flow, mobile experience, accessibility, consistency, and perceived performance** without requiring a full redesign.

---

## 2. Core Design Principles

### 2.1 Clarity Over Density

Every section and card must have one primary action and one clear visual focus. The shop page currently places two full-width buttons ("Add to Cart" + "WhatsApp") on every product card — this splits attention and weakens both. The cart has per-item WhatsApp buttons that compete with the checkout flow. Demote every secondary action to a subtler treatment.

### 2.2 Motion Should Confirm Intent

Framer Motion is already installed. Use it only to confirm user intent, not to decorate static content. Good uses: add-to-cart success state, quantity change feedback, mobile menu slide, loading spinners. Avoid entrance animations on page content that appears without user interaction.

### 2.3 Mobile-First Design

Design for the smallest screen first, then scale up. Every interactive element must meet a **44px minimum tap target**. Buttons should be full-width on mobile and shrink to inline on desktop. Layouts stack vertically on phones and expand to multi-column on larger screens.

### 2.4 Consistent Design System

Standardize across the app:

| Token | Value |
|-------|-------|
| Border radius | `rounded-2xl` |
| Card shadow | `shadow-sm` → `shadow-md` on hover |
| Button height | `h-11` (desktop) / `h-12` (mobile) |
| Section spacing | `space-y-6` or `space-y-12` |
| Container | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |

---

## 3. Responsive Design Strategy

The storefront must feel native across every device — from iPhone SE to ultrawide desktop monitors — without cramped, stretched, or broken layouts.

### 3.1 Breakpoint System

Use Tailwind's standard breakpoints consistently across all pages:

| Breakpoint | Target |
|------------|--------|
| _(default)_ | Small phones |
| `sm` (640px) | Large phones |
| `md` (768px) | Tablets / iPads |
| `lg` (1024px) | Small laptops |
| `xl` (1280px) | Desktop |
| `2xl` (1536px) | Large monitors |

The global container padding should be:

```
px-4 sm:px-6 lg:px-8
```

This prevents content from touching screen edges on small devices and keeps layouts breathable on large ones.

### 3.2 Product Grid

All product grids across Home, Shop, and any featured strips must follow one standardized system:

```
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
```

The current shop grid uses `sm:grid-cols-2 md:grid-cols-3` — missing the `xl` step, which causes cards to feel oversized on large monitors.

### 3.3 Typography Scaling

Headings must scale smoothly rather than jumping from mobile to desktop:

```
text-2xl sm:text-3xl lg:text-4xl xl:text-5xl
```

The current hero uses `text-4xl md:text-5xl` which is fine but leaves a gap on tablets.

### 3.4 Spacing Scaling

Section padding should scale with screen size to avoid cramped mobile and oversized desktop gaps:

```
py-8 sm:py-10 lg:py-14
gap-4 sm:gap-6 lg:gap-8
```

### 3.5 Responsive Images

All images should use `next/image` with:

- `fill` + `sizes` prop for fluid sizing
- `blurDataURL` placeholder to prevent layout shift
- Lazy loading below the fold (Next.js default)

```tsx
<Image
  src={imageUrl}
  alt={name}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  className="object-contain"
  placeholder="blur"
  blurDataURL="/placeholder.png"
/>
```

### 3.6 Landscape & Foldable Support

Avoid hardcoded pixel heights in hero and card sections. Use flexible systems:

```
min-h-[50vh] md:min-h-[60vh]
```

Instead of `h-64 md:h-80` which can crop content on landscape phones or foldable devices. For foldable Android, avoid fixed-width or edge-anchored absolute layouts — use fluid grids throughout.

---

## 4. Global / Layout Changes

### 4.1 Navbar

**Live cart badge** — The cart link currently reads "Cart" with no count indicator. Read the cart item count server-side in `layout.tsx` (it already runs `auth()` and `getStoreSettings()`) and pass it to a thin `CartLink` client component:

```tsx
// layout.tsx — add alongside existing queries
const cartCount = cartId
  ? await prisma.orderItem.count({ where: { orderId: cartId, order: { status: "PENDING" } } })
  : 0;
```

The badge renders as a small sky-600 pill next to "Cart" and updates optimistically when items are added.

**Active link highlight** — No nav link currently changes appearance when active. Add a `usePathname()` client component wrapping the nav links that applies `text-sky-700 font-semibold` or a bottom underline to the current route.

**Container padding** — The navbar uses `px-6`. Update to `px-4 sm:px-6 lg:px-8` to match the global responsive container strategy.

### 4.2 Mobile Menu

The current mobile menu (`MobileMenu.tsx`) opens as an `absolute` div with no backdrop and no animation. Two improvements:

**Backdrop** — Add a `fixed inset-0 bg-black/20 backdrop-blur-sm` layer behind the menu that closes it on tap:

```tsx
{isOpen && (
  <>
    <div className="fixed inset-0 bg-black/20" onClick={() => setIsOpen(false)} />
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="absolute top-16 left-0 right-0 bg-white border-b shadow-lg z-50 p-4 space-y-4"
    >
      ...
    </motion.div>
  </>
)}
```

**Tap targets** — Nav links inside the menu should be `py-3 px-4` minimum so they're comfortable on all phone sizes.

### 4.3 Global Utility Classes

Add to `globals.css`:

```css
.section-title  { @apply text-2xl sm:text-3xl font-bold tracking-tight mb-6; }
.page-wrapper   { @apply space-y-12 py-8 sm:py-10 lg:py-14; }
.product-card   { @apply card relative group hover:shadow-md transition-shadow; }
.icon-action    { @apply p-2 rounded-full bg-white/80 hover:bg-white shadow-sm transition; }
```

### 4.4 Accessibility Baseline

Apply across all interactive elements:

```
focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2
```

Add `aria-label` to all icon-only buttons. Ensure heading levels are sequential on every page (`h1` → `h2` → `h3`, never skipping). Add `prefers-reduced-motion` support by wrapping Framer Motion animations conditionally:

```tsx
const prefersReduced = useReducedMotion();
const transition = prefersReduced ? { duration: 0 } : { duration: 0.15 };
```

---

## 5. Home Page (`/`)

### Current State

The hero has two columns: a text block on the left and a **placeholder `div` card** on the right containing only the string "Ocean-ready gear for every trip" — no actual image. Below that, three plain feature cards with no icons. There are no products visible on the home page at all.

### 5.1 Hero Visual

Replace the placeholder card with a real visual. Two options depending on available assets:

```tsx
// Option A — product or lifestyle image
<div className="relative rounded-2xl overflow-hidden min-h-[240px] md:min-h-[320px]">
  <Image src="/hero.jpg" alt="AquaGear sea gear" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
</div>

// Option B — branded gradient (no image required)
<div className="rounded-2xl min-h-[240px] md:min-h-[320px] bg-gradient-to-br from-sky-400 via-sky-500 to-blue-700 flex items-end p-6">
  <span className="text-white font-bold text-lg drop-shadow">Ocean-ready gear for every trip</span>
</div>
```

On mobile, the hero stacks vertically (text first, image below). On md+ it stays two-column.

### 5.2 CTA Hierarchy

"Browse products" and "Sign in" currently use the same button weight. Make the primary CTA visually dominant:

```tsx
// Primary — larger
<Link href="/shop" className="btn-primary px-6 py-3 text-base">Browse products</Link>

// Secondary — standard outline
<Link href="/account" className="btn-outline">Sign in</Link>
```

On mobile, both buttons should stack full-width with `flex-col sm:flex-row` on the wrapper.

### 5.3 Feature Cards — Add Icons

The three cards have headings and descriptions but no visual anchor. Add a Lucide icon in sky-600 above each heading:

```tsx
import { Truck, ShieldCheck, MessageCircle } from "lucide-react";

// Fast pickup
<div className="card">
  <Truck className="text-sky-600 mb-2" size={24} />
  <h3 className="font-semibold">Fast pickup</h3>
  <p className="text-gray-600 mt-1 text-sm">Local delivery or pickup in Lebanon.</p>
</div>
```

### 5.4 Featured Products Strip

Fetch 4 recent products server-side and display them below the feature cards with a "See all →" link. On mobile this renders as a horizontal scroll strip; on desktop as a 4-column grid:

```tsx
const featured = await prisma.product.findMany({
  where: { isArchived: false },
  orderBy: { createdAt: "desc" },
  take: 4,
  select: { id: true, slug: true, imageUrl: true, name: true, price: true },
});
```

Each product tile shows only the image and name — no CTA buttons — keeping the home page clean and funneling users to `/shop`.

---

## 6. Shop Page (`/shop`)

### Current State

A heading and a 3-column grid of product cards. Each card has an image, name, price, a blue "Add to Cart" button, and a sky-blue "WhatsApp" button at full width. Two competing full-width CTAs per card create visual noise and dilute the add-to-cart action. No filtering, no product count, no empty or loading state.

### 6.1 Demote the WhatsApp Button

Move the per-card WhatsApp link from a full `btn-primary` to an icon-only button in the top-right corner of the card. The card container becomes `relative`:

```tsx
<div className="product-card">
  {/* WhatsApp icon — top right */}
  <a
    href={waLink}
    className="icon-action absolute top-2 right-2 text-green-600"
    aria-label={`WhatsApp about ${p.name}`}
  >
    <MessageCircle size={16} />
  </a>

  <Link href={`/product/${p.slug}`}>
    {/* image, name, price */}
  </Link>

  {/* Single primary CTA */}
  <AddToCartButton productId={p.id} />
</div>
```

### 6.2 Product Card Refinements

- Change the product name `<div>` to an `<h2>` for correct heading hierarchy and SEO
- Add `hover:shadow-md transition-shadow` to the whole card (not just image scale) for a more premium feel
- Remove the image wrapper scale and replace with a subtle opacity hover: `group-hover:opacity-90 transition-opacity` — scale on a contained image creates a jarring zoom clip

### 6.3 Category Filter Bar

The database already has a categories model. Fetch categories server-side and render a horizontal pill filter bar above the grid. Clicking a pill appends `?category=slug` to the URL; the server component reads `searchParams` and filters the Prisma query — no client-side state required:

```tsx
export default async function Shop({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        isArchived: false,
        ...(searchParams.category
          ? { category: { slug: searchParams.category } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, imageUrl: true, name: true, price: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
```

Filter pill UI:

```tsx
<div className="flex gap-2 flex-wrap mb-6">
  <Link href="/shop" className={`pill ${!searchParams.category ? "pill-active" : ""}`}>All</Link>
  {categories.map((c) => (
    <Link key={c.id} href={`/shop?category=${c.slug}`} className={`pill ${searchParams.category === c.slug ? "pill-active" : ""}`}>
      {c.name}
    </Link>
  ))}
</div>
```

Add to `globals.css`:

```css
.pill        { @apply px-4 py-1.5 rounded-full border text-sm font-medium hover:bg-sky-50 transition; }
.pill-active { @apply bg-sky-600 text-white border-sky-600 hover:bg-sky-700; }
```

### 6.4 Product Count

Add a single line above the grid:

```tsx
<p className="text-sm text-gray-500 mb-4">Showing {products.length} product{products.length !== 1 ? "s" : ""}</p>
```

### 6.5 Empty State

When a category filter returns no products:

```tsx
{products.length === 0 && (
  <div className="flex flex-col items-center gap-4 py-20 text-center">
    <PackageOpen size={48} className="text-gray-300" />
    <h2 className="text-lg font-semibold text-gray-700">No products in this category yet</h2>
    <Link href="/shop" className="btn-primary">Browse all products</Link>
  </div>
)}
```

### 6.6 Skeleton Loading States

Wrap the shop grid in a `<Suspense>` boundary with a skeleton fallback so category switches feel instant:

```tsx
// app/shop/loading.tsx
export default function ShopLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="w-full h-40 bg-gray-100 rounded-xl" />
          <div className="mt-3 h-4 bg-gray-100 rounded w-3/4" />
          <div className="mt-2 h-3 bg-gray-100 rounded w-1/3" />
          <div className="mt-4 h-11 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Cart Page (`/cart`)

### Current State

A list of cart items, each showing image, name, `quantity × price`, a per-item "WhatsApp" button, and a "Remove" button. At the bottom: total, "Proceed to Checkout", and "Order via WhatsApp". There is no way to adjust quantity from the cart. The empty state is a single `<p>` tag.

### 7.1 Inline Quantity Adjustment

The `ProductQuantitySelector` component already exists. Wire it into the cart via a new server action and replace the static quantity text:

```tsx
// New: src/app/api/cart/update-quantity/route.ts
// PATCH { itemId, quantity } → update orderItem.quantity, return updated subtotal

// In cart/page.tsx — replace static text
// Before:
<div className="text-sm text-gray-600">{i.quantity} x {(i.price / 100).toFixed(2)} USD</div>

// After:
<CartQuantitySelector itemId={i.id} initialQuantity={i.quantity} unitPrice={i.price} />
```

`CartQuantitySelector` is a new client component that calls the update endpoint on `+`/`−` press and shows an optimistic updated subtotal per line.

> **Architecture note:** Prefer a `"use server"` Server Action over the `/api/cart/update-quantity` REST route. Server Actions give cleaner TypeScript integration, easier `revalidatePath` cache invalidation, and less boilerplate. The REST route is shown above for clarity but the implementation should use `actions.ts`.

### 7.2 Remove Per-Item WhatsApp Buttons

The per-item WhatsApp button in each cart row is confusing — shoppers contact about their full order, not individual items. Remove them entirely. The "Order via WhatsApp" CTA in the order summary already covers this correctly with the full order pre-filled.

### 7.3 Two-Column Layout with Sticky Summary

On `lg+` screens, split into a two-column grid. The order summary panel becomes sticky:

```tsx
<div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8 lg:items-start">
  {/* Left: items list */}
  <div className="space-y-3">
    {items.map(...)}
  </div>

  {/* Right: sticky order summary */}
  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24">
    <div className="card space-y-4">
      <h2 className="font-semibold text-lg">Order summary</h2>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Subtotal</span>
        <span>{(total / 100).toFixed(2)} USD</span>
      </div>
      <div className="flex justify-between text-sm text-gray-400">
        <span>Shipping</span>
        <span>TBD</span>
      </div>
      <div className="border-t pt-3 flex justify-between font-semibold">
        <span>Total</span>
        <span>{(total / 100).toFixed(2)} USD</span>
      </div>
      <Link href="/checkout" className="btn-primary w-full text-center">Proceed to Checkout</Link>
      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-outline w-full text-center">
        Order via WhatsApp
      </a>
    </div>
  </div>
</div>
```

On mobile, the summary stacks below the items list at full width.

### 7.4 Line Subtotals

Display each line's total (quantity × price) right-aligned so the math is immediately visible:

```
[img]  Life Jacket       − 1 +     28.00 USD
[img]  Kickboard         − 2 +     34.00 USD
```

### 7.5 Improved Empty State

Replace the bare `<p>Your cart is empty.</p>` with a proper empty state:

```tsx
<div className="flex flex-col items-center gap-4 py-20 text-center">
  <ShoppingCart size={48} className="text-gray-300" />
  <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
  <p className="text-gray-500 text-sm">Add some sea gear to get started.</p>
  <Link href="/shop" className="btn-primary">Browse products</Link>
</div>
```

### 7.6 Continue Shopping Link

Add a low-key link at the top of the cart heading row:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="section-title mb-0">Your cart</h1>
  <Link href="/shop" className="text-sm text-sky-700 hover:underline flex items-center gap-1">
    <ArrowLeft size={14} /> Continue shopping
  </Link>
</div>
```

---

## 8. Component Improvements

### `AddToCartButton`

The component already has an excellent loading → success → reset animation. One addition: when `isSuccess` fires, dispatch a custom DOM event so the navbar cart badge can increment optimistically without a full page reload:

```ts
window.dispatchEvent(new CustomEvent("cart:updated", { detail: { delta: quantity } }));
```

The navbar `CartLink` component listens for this event and updates the displayed count client-side.

### `Button.tsx`

The file exists but is unused. Consolidate `btn-primary` and `btn-outline` from `globals.css` into this component with a `variant` prop so all buttons across the app go through one place. This makes future theme changes instant.

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
}
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(variant === "primary" ? "btn-primary" : "btn-outline", className)}
      {...props}
    />
  );
}
```

---

## 9. Performance

- Keep all three pages as **Server Components** — the current approach is correct. Avoid converting pages to client components to add features; prefer Server Actions or small client leaf components instead.
- Use `next/image` `placeholder="blur"` on all product images to eliminate layout shift.
- Limit Framer Motion to the components that already use it (`AddToCartButton`, `MobileMenu`). Do not add entrance animations to the product grid or page-level elements.
- The shop page and cart page both use `export const dynamic = "force-dynamic"` — this is correct for pages driven by cookies and live DB data.

---

## 10. Implementation Priority

| Priority | Page | Change | Effort |
|----------|------|--------|--------|
| 🔴 High | Cart | Remove per-item WhatsApp buttons | Low |
| 🔴 High | Cart | Improved empty state | Low |
| 🔴 High | Shop | Demote WhatsApp to icon-only per card | Low |
| 🔴 High | Cart | Inline quantity adjustment + new action | Medium |
| 🟡 Medium | Home | Hero visual (image or gradient) | Low–Med |
| 🟡 Medium | Home | Feature card icons (Lucide) | Low |
| 🟡 Medium | Shop | Category filter bar | Medium |
| 🟡 Medium | Cart | Sticky order summary panel | Medium |
| 🟡 Medium | Cart | Continue shopping link + line subtotals | Low |
| 🟡 Medium | Global | Responsive container padding (`px-4 sm:px-6 lg:px-8`) | Low |
| 🟡 Medium | Global | Active nav link highlight | Low |
| 🟢 Low | Home | Featured products strip | Medium |
| 🟢 Low | Global | Live cart badge in navbar | Medium |
| 🟢 Low | Shop | Skeleton loading state | Low |
| 🟢 Low | Global | Mobile menu backdrop + slide animation | Low |
| 🟢 Low | Global | Accessibility pass (aria, focus-visible, headings) | Medium |
| 🟢 Low | Global | `Button.tsx` consolidation | Low |

---

## 11. File Change Map

| File | Change |
|------|--------|
| `src/app/page.tsx` | Hero visual, CTA hierarchy, icon feature cards, featured products strip |
| `src/app/shop/page.tsx` | Category filter, demote WhatsApp, product count, empty state |
| `src/app/cart/page.tsx` | Two-column layout, remove per-item WhatsApp, quantity controls, empty state, continue shopping |
| `src/app/layout.tsx` | Cart badge, active link highlight, responsive padding |
| `src/app/shop/loading.tsx` | **New** — skeleton loading state |
| `src/app/globals.css` | `.section-title`, `.page-wrapper`, `.product-card`, `.pill`, `.pill-active` tokens |
| `src/components/cart/AddToCartButton.tsx` | Dispatch `cart:updated` event on success |
| `src/components/cart/CartQuantitySelector.tsx` | **New** — cart-aware quantity control |
| `src/components/layout/MobileMenu.tsx` | Backdrop overlay + Framer Motion slide animation |
| `src/components/ui/Button.tsx` | Implement `variant` prop, consolidate btn classes |
| `src/app/actions.ts` | **Add** `updateCartItemQuantity` server action |

---

## 12. Final Goal

The objective is not a full redesign. The objective is to transform AquaGear from a functional prototype into a **polished, fully responsive, production-quality storefront** that feels optimized across every device — iPhone, Android, iPad, tablet, laptop, and large desktop — through stronger UX, cleaner hierarchy, consistent responsive layouts, accessibility improvements, smoother interactions, and professional ecommerce behavior.
