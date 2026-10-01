// Deterministic order extraction from a DM thread. Pure and dependency-free:
// given the recent conversation and the catalog it returns a structured,
// validated guess — it never writes anything. ingest.ts decides what to do
// with it, and every draft still goes through admin review.
//
// ponytail: rule-based (intent phrases + token-overlap product matching), no
// LLM. Handles English, Arabizi and a few Arabic intent words. Ceiling: free-
// form phrasing it has no rule for lands as LOW/MEDIUM and needs an admin. To
// upgrade, swap extractOrder() for an LLM call that returns the same Extraction
// shape — the validation in ingest.ts (product ids, quantities) stays.

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  aliases: string[];
  mpn?: string | null;
  brand?: string | null;
}

export interface ChatLine {
  direction: "INBOUND" | "OUTBOUND";
  text: string | null;
  location?: { latitude: number; longitude: number } | null;
}

export interface Candidate {
  productId: string;
  name: string;
  score: number;
}

export interface ExtractedItem {
  customerText: string;
  quantity: number;
  quantityExplicit: boolean;
  productId: string | null;
  productName: string | null;
  candidates: Candidate[];
  confidence: number;
  matchedBy: "sku" | "alias" | "name" | null;
  variant: string | null;
}

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface Extraction {
  isOrder: boolean;
  intent: "NONE" | "INQUIRY" | "INTENT";
  customerConfirmed: boolean;
  confidence: Confidence;
  score: number;
  items: ExtractedItem[];
  name: string | null;
  phone: string | null;
  location: string | null;
  addressDetails: string | null;
  pin: string | null;
  missingFields: string[];
}

// ── Text helpers ────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stem = (t: string) =>
  t.length > 4 && /(ss|sh|ch|x)es$/.test(t) ? t.slice(0, -2) : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;

const tokens = (s: string) => norm(s).split(" ").filter(Boolean).map(stem);

const STOP = new Set(["the", "a", "an", "and", "or", "for", "with", "of", "to", "in", "on", "set", "pair", "pc", "pcs", "piece", "new", "by"]);
// Words that describe a product but can't identify one on their own.
const ATTRIBUTES = new Set([
  "black", "white", "blue", "red", "green", "yellow", "pink", "grey", "gray", "orange", "purple", "silver", "gold",
  "clear", "transparent", "small", "medium", "large", "xl", "xxl", "kid", "child", "children", "junior", "adult",
  "men", "women", "unisex", "pro", "sport", "classic", "premium", "mini",
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  single: 1, couple: 2, wahad: 1, wa7ad: 1, tnen: 2, tnein: 2, tlete: 3,
};

// ── Intent ──────────────────────────────────────────────────────────────────

const POSITIVE = [
  /\bi\s*(?:want|need|wanna|would like|'d like|d like)\b/,
  /\b(?:i'?ll|i will|let me|can i|could i|may i)\s+(?:take|get|have|order|buy)\b/,
  /\bsend\s+(?:me|it|them|us)\b/,
  /\bgive me\b/,
  /\b(?:order|buy|book|reserve)\b/,
  /\b(?:badde|baddi|bade|bady|bde|bdi|bidde)\b/,
  /(?:بدي|بدنا|أريد|اريد|ابغى)/,
];
const HEDGE = /\b(?:maybe|perhaps|might|not sure|let you know|think about|thinking|later|i'?ll see|we'?ll see)\b/;
const INQUIRY =
  /\b(?:how (?:do|can) i|how much|price|prices|cost|do you have|is there|any\b.*\bleft|available|availability|in stock|pictures?|photos?|pics?|images?|video|where is my|status of|track(?:ing)?)\b/;
const CONFIRM = /^(?:yes|yeah|yep|yup|ok(?:ay)?|sure|deal|tamam|eh|ee|aywa|confirm(?:ed)?)\b|\bconfirm/;

const sentences = (s: string) => s.split(/[.!?\n؟]+/).map((x) => x.trim()).filter(Boolean);
const classify = (sentence: string) => {
  const s = sentence.toLowerCase();
  if (HEDGE.test(s)) return "HEDGE";
  if (INQUIRY.test(s)) return "INQUIRY";
  if (POSITIVE.some((r) => r.test(s))) return "INTENT";
  return "OTHER";
};

// ── Product matching ────────────────────────────────────────────────────────

interface Prepared {
  p: CatalogProduct;
  nameTokens: string[];
  aliases: string[]; // stemmed token phrases joined by " "
  sku: string | null;
}

function prepare(catalog: CatalogProduct[]): Prepared[] {
  return catalog.map((p) => {
    const brand = new Set([...tokens(p.brand ?? ""), "aquagear"]);
    const all = [...new Set(tokens(p.name))];
    const meaningful = all.filter((t) => !STOP.has(t) && !brand.has(t));
    return {
      p,
      nameTokens: meaningful.length ? meaningful : all,
      aliases: p.aliases.map((a) => tokens(a).join(" ")).filter(Boolean),
      sku: p.mpn ? norm(p.mpn) || null : null,
    };
  });
}

interface Hit {
  prep: Prepared;
  score: number;
  matched: number;
  by: "sku" | "alias" | "name";
  firstToken: string;
  /** Identifying (non-attribute) name tokens the customer didn't write. */
  missingCore: number;
}

function scoreProduct(seg: string[], prep: Prepared): Hit | null {
  const phrase = ` ${seg.join(" ")} `;
  if (prep.sku && phrase.includes(` ${prep.sku} `)) return { prep, score: 1, matched: 99, by: "sku", firstToken: prep.sku.split(" ")[0], missingCore: 0 };
  const alias = prep.aliases.filter((a) => phrase.includes(` ${a} `)).sort((a, b) => b.length - a.length)[0];
  if (alias) return { prep, score: 1, matched: 50 + alias.split(" ").length, by: "alias", firstToken: alias.split(" ")[0], missingCore: 0 };

  const set = new Set(seg);
  const matched = prep.nameTokens.filter((t) => set.has(t));
  if (!matched.some((t) => !ATTRIBUTES.has(t))) return null;
  const coverage = matched.length / prep.nameTokens.length;
  if (coverage < 0.5) return null;
  const firstToken = seg.find((t) => matched.includes(t))!;
  const missingCore = prep.nameTokens.filter((t) => !set.has(t) && !ATTRIBUTES.has(t)).length;
  return { prep, score: coverage, matched: matched.length, by: "name", firstToken, missingCore };
}

const toCandidate = (h: Hit): Candidate => ({ productId: h.prep.p.id, name: h.prep.p.name, score: Math.round(h.score * 100) / 100 });

function resolve(hits: Hit[]): Pick<ExtractedItem, "productId" | "productName" | "candidates" | "confidence" | "matchedBy"> {
  const sorted = [...hits].sort((a, b) => b.matched - a.matched || b.score - a.score);
  const strong = sorted.filter((h) => h.by !== "name");
  const pick = (h: Hit, confidence: number) => ({
    productId: h.prep.p.id,
    productName: h.prep.p.name,
    candidates: sorted.slice(0, 5).map(toCandidate),
    confidence: Math.round(confidence * 100) / 100,
    matchedBy: h.by,
  });
  if (strong.length === 1) return pick(strong[0], 1);
  if (!strong.length && sorted.length === 1) return pick(sorted[0], 0.5 + 0.45 * sorted[0].score);
  if (!strong.length) {
    const [top, ...rest] = sorted;
    // The best match wins only if it explains strictly more of what the
    // customer wrote than every alternative ("black mask" vs "black pro mask"
    // is a tie → ambiguous, never a silent guess) and the only words it's
    // missing are attributes like a colour the customer didn't mention.
    if (top.missingCore === 0 && rest.every((h) => h.matched < top.matched)) return pick(top, top.score === 1 ? 0.9 : 0.8);
  }
  // Only alternatives that explain the text as well as the best one are real candidates.
  const tied = sorted.filter((h) => h.matched === sorted[0].matched);
  return { productId: null, productName: null, candidates: tied.slice(0, 5).map(toCandidate), confidence: 0.3, matchedBy: null };
}

function quantityIn(rawTokens: string[], before: number): number | null {
  const window = rawTokens.slice(0, before < 0 ? rawTokens.length : before);
  for (let i = window.length - 1; i >= 0 && i >= window.length - 4; i--) {
    if (window[i - 1] === "size" || window[i - 1] === "number") continue;
    const t = window[i];
    const n = /^\d{1,2}$/.test(t) ? Number(t) : NUMBER_WORDS[t] ?? null;
    if (n && n > 0) return n;
  }
  const x = rawTokens.join(" ").match(/\bx\s?(\d{1,2})\b|\b(\d{1,2})\s?x\b/);
  return x ? Number(x[1] ?? x[2]) || null : null;
}

const SIZE = /\bsize\s*(\d{1,2}(?:[.,]5)?|xxs|xs|s|m|l|xl|xxl)\b/i;

// ── Contact / delivery ──────────────────────────────────────────────────────

const LEBANESE_PHONE = /(?:\+|00)?961[\s-]?0?(?:3|7\d|8[01])[\s-]?\d{3}[\s-]?\d{3}|\b0?(?:3|7[0169]|8[01])[\s-]?\d{3}[\s-]?\d{3}\b/;
const INTL_PHONE = /\+\d[\d\s-]{7,15}\d/;

export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return `+${d.replace(/^9610/, "961")}`;
  if (/^0\d{7}$/.test(d)) return `+961${d.slice(1)}`;
  if (/^(?:7[0169]|8[01])\d{6}$/.test(d) || /^3\d{6}$/.test(d)) return `+961${d}`;
  return raw.trim().startsWith("+") ? `+${d}` : d;
}

// ponytail: small gazetteer of common Lebanese delivery areas, used only when
// the customer names a place without "deliver to …". Extend as needed.
const PLACES = [
  "Beirut", "Achrafieh", "Ashrafieh", "Hamra", "Verdun", "Mar Mikhael", "Gemmayze", "Tripoli", "Mina", "Jounieh",
  "Kaslik", "Zouk", "Byblos", "Jbeil", "Batroun", "Chekka", "Anfeh", "Koura", "Zgharta", "Akkar", "Halba", "Sidon",
  "Saida", "Tyre", "Sour", "Nabatieh", "Zahle", "Baalbek", "Bekaa", "Chtaura", "Aley", "Chouf", "Damour", "Jiyeh",
  "Khalde", "Choueifat", "Baabda", "Hazmieh", "Dekwaneh", "Sin el Fil", "Jdeideh", "Dbayeh", "Antelias", "Jal el Dib",
  "Broummana", "Beit Mery", "Bikfaya", "Faraya", "Metn", "Keserwan", "Mansourieh",
];

const cutPlace = (s: string) =>
  s
    .split(/\b(?:my|and|please|pls|plz|tomorrow|today|asap|number|phone|call|whatsapp)\b|\d/i)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

// ── Main ────────────────────────────────────────────────────────────────────

export function extractOrder(lines: ChatLine[], catalog: CatalogProduct[]): Extraction {
  const prepared = prepare(catalog);
  const items: ExtractedItem[] = [];
  let intent: Extraction["intent"] = "NONE";
  let firstIntentAt = -1;
  let customerConfirmed = false;
  let pendingQuantity: number | null = null;
  let phone: string | null = null;
  let location: string | null = null;
  let answeredLocation: string | null = null;
  let name: string | null = null;
  let pin: string | null = null;
  let pinLabel: string | null = null;
  const addressBits: string[] = [];
  let lastOutbound = "";

  lines.forEach((line, idx) => {
    if (line.direction === "OUTBOUND") {
      lastOutbound = (line.text ?? "").toLowerCase();
      return;
    }
    if (line.location) {
      pin = `https://maps.google.com/?q=${line.location.latitude},${line.location.longitude}`;
      pinLabel = line.text || pinLabel;
    }
    const text = line.text?.trim();
    if (!text) return;
    const askedWhere = /\b(?:deliver|address|location|where)\b/.test(lastOutbound);
    const askedName = /\bname\b/.test(lastOutbound);
    lastOutbound = "";

    for (const [sIdx, sentence] of sentences(text).entries()) {
      const kind = classify(sentence);
      if (kind === "INTENT") {
        intent = "INTENT";
        if (firstIntentAt < 0) firstIntentAt = idx;
      } else if (kind === "INQUIRY" && intent === "NONE") {
        intent = "INQUIRY";
      }
      if (CONFIRM.test(sentence.toLowerCase()) && (firstIntentAt >= 0 || kind === "INTENT")) customerConfirmed = true;

      let sentenceHasProduct = false;
      for (const segment of sentence.split(/,|\band\b|\bw\b|&|\+|;/i)) {
        const raw = norm(segment).split(" ").filter(Boolean);
        const seg = raw.map(stem);
        if (!seg.length) continue;
        const hits = prepared.map((p) => scoreProduct(seg, p)).filter((h): h is Hit => h !== null);
        if (!hits.length) {
          if (narrowOpenItem(items, seg, prepared, segment)) sentenceHasProduct = true;
          continue;
        }
        sentenceHasProduct = true;

        const resolved = resolve(hits);
        const firstIdx = seg.indexOf(hits[0].firstToken.split(" ")[0]);
        const qty = quantityIn(raw, firstIdx);
        const variant = segment.match(SIZE)?.[0]?.toLowerCase() ?? null;
        mergeItem(items, {
          customerText: segment.trim().slice(0, 120),
          quantity: qty ?? 1,
          quantityExplicit: qty !== null,
          variant,
          ...resolved,
        });
      }

      if (!sentenceHasProduct && kind === "INTENT") {
        const q = quantityIn(norm(sentence).split(" ").filter(Boolean), -1);
        if (q) pendingQuantity = q;
      }
      // A short reply right after "where should we deliver?" is the address.
      if (askedWhere && sIdx === 0 && !sentenceHasProduct && sentence.length <= 60 && !LEBANESE_PHONE.test(sentence)) {
        answeredLocation = cutPlace(sentence) || answeredLocation;
      }
      if (askedName && sIdx === 0 && !sentenceHasProduct && sentence.split(" ").length <= 4 && !name) {
        name = sentence.slice(0, 60);
      }
    }

    const phoneMatch = text.match(LEBANESE_PHONE) ?? text.match(INTL_PHONE);
    if (phoneMatch) phone = normalizePhone(phoneMatch[0]);

    const deliverTo = text.match(/\b(?:deliver(?:y|ed)?|send(?: it| them)?|ship|bring)\b[^.?!\n,]{0,25}?\bto\s+([^.?!\n,]{2,60})/i);
    const addressIs = text.match(/\b(?:address|location|i live in|i'?m in|i am in)\s*(?:is|:)?\s+([^.?!\n]{2,80})/i);
    const explicit = cutPlace(deliverTo?.[1] ?? addressIs?.[1] ?? "");
    if (explicit) location = explicit;

    const myName = text.match(/\bmy name is\s+([a-z؀-ۿ][a-z؀-ۿ '-]{1,40})/i);
    if (myName) name = myName[1].trim();

    for (const m of text.matchAll(/\b(?:bldg|building|floor|flr|apt|apartment|street|st\.|near|next to|facing|behind)\b[^.?!\n,]{0,60}/gi)) {
      addressBits.push(m[0].trim());
    }
  });

  if (pendingQuantity && items.length === 1 && !items[0].quantityExplicit) {
    items[0].quantity = pendingQuantity;
    items[0].quantityExplicit = true;
  }

  if (!location) location = answeredLocation;
  if (!location) {
    const inbound = lines.filter((l) => l.direction === "INBOUND").map((l) => l.text ?? "").join("\n");
    const found = PLACES.map((p) => ({ p, at: inbound.search(new RegExp(`\\b${p}\\b`, "i")) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.p);
    location = [...new Set(found)].join(", ") || pinLabel || null;
  }

  const finalIntent = intent as Extraction["intent"];
  const resolvedAll = items.length > 0 && items.every((i) => i.productId);
  const missingFields: string[] = [];
  if (!items.length) missingFields.push("products");
  else if (!resolvedAll) missingFields.push("product_selection");
  if (!phone) missingFields.push("phone");
  if (!location) missingFields.push("delivery_location");
  else if (!addressBits.length) missingFields.push("address_details");

  const isOrder = finalIntent === "INTENT";
  const confidence: Confidence = !isOrder ? "NONE" : !items.length ? "LOW" : resolvedAll && phone && location ? "HIGH" : "MEDIUM";
  const avgItem = items.length ? items.reduce((s, i) => s + (i.productId ? i.confidence : 0), 0) / items.length : 0;
  const score = isOrder ? Math.round((0.5 * avgItem + (phone ? 0.25 : 0) + (location ? 0.25 : 0)) * 100) / 100 : 0;

  return {
    isOrder,
    intent: finalIntent,
    customerConfirmed,
    confidence,
    score,
    items,
    name,
    phone,
    location,
    addressDetails: addressBits.length ? [...new Set(addressBits)].join("; ").slice(0, 200) : null,
    pin,
    missingFields,
  };
}

/**
 * "The black Pro ones" can't identify a product by itself (attributes only),
 * but it can pick between the candidates of an earlier ambiguous mention.
 */
function narrowOpenItem(items: ExtractedItem[], seg: string[], prepared: Prepared[], segment: string): boolean {
  const open = [...items].reverse().find((i) => !i.productId && i.candidates.length > 1);
  if (!open) return false;
  const counts = open.candidates.map((c) => prepared.find((x) => x.p.id === c.productId)?.nameTokens.filter((t) => seg.includes(t)).length ?? 0);
  const best = Math.max(...counts);
  if (best === 0) return false;
  open.candidates = open.candidates.filter((_, i) => counts[i] === best);
  if (open.candidates.length === 1) {
    open.productId = open.candidates[0].productId;
    open.productName = open.candidates[0].name;
    open.confidence = 0.75;
    open.matchedBy = "name";
  }
  open.customerText = `${open.customerText} → ${segment.trim()}`.slice(0, 200);
  return true;
}

/**
 * Fold a new mention into the running item list. A follow-up like "the black
 * Pro ones" (no quantity) narrows an earlier ambiguous "2 diving masks"; a
 * repeated product with a new explicit quantity replaces the old quantity.
 */
function mergeItem(items: ExtractedItem[], next: ExtractedItem) {
  const nextIds = next.productId ? [next.productId] : next.candidates.map((c) => c.productId);
  if (!next.quantityExplicit) {
    const open = items.find((i) => !i.productId && i.candidates.some((c) => nextIds.includes(c.productId)));
    if (open) {
      const narrowed = open.candidates.filter((c) => nextIds.includes(c.productId));
      open.candidates = narrowed;
      if (narrowed.length === 1 || next.productId) {
        const chosen = next.productId ? narrowed.find((c) => c.productId === next.productId) ?? narrowed[0] : narrowed[0];
        open.productId = chosen.productId;
        open.productName = chosen.name;
        open.confidence = Math.max(next.confidence, 0.7);
        open.matchedBy = next.matchedBy ?? "name";
      }
      open.variant = open.variant ?? next.variant;
      open.customerText = `${open.customerText} → ${next.customerText}`.slice(0, 200);
      return;
    }
  }
  const same = next.productId ? items.find((i) => i.productId === next.productId) : undefined;
  if (same) {
    if (next.quantityExplicit) {
      same.quantity = next.quantity;
      same.quantityExplicit = true;
    }
    same.variant = next.variant ?? same.variant;
    return;
  }
  items.push(next);
}
