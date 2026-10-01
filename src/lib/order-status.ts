export const ORDER_STATUSES = ["PENDING", "PLACED", "SHIPPED", "CANCELED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PLACED_ORDER_STATUS: OrderStatus = "PLACED";

// Orders drafted from a WhatsApp/Instagram conversation that an admin hasn't
// confirmed yet. They hold no stock; confirming moves them to PLACED through
// changeOrderStatus(), the same path that reserves inventory for any order.
export const DRAFT_STATUSES = ["PENDING_CONFIRMATION", "NEEDS_REVIEW"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
export const isDraftStatus = (s: string): s is DraftStatus => (DRAFT_STATUSES as readonly string[]).includes(s);

export const ORDER_SOURCES = ["WEBSITE", "APP", "WHATSAPP", "INSTAGRAM"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/** Rows in the Order table that aren't orders yet: live carts and unreviewed drafts. */
export const NOT_YET_ORDER_STATUSES: string[] = ["PENDING", ...DRAFT_STATUSES];
