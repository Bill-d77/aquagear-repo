export const ORDER_STATUSES = ["PENDING", "PLACED", "SHIPPED", "CANCELED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PLACED_ORDER_STATUS: OrderStatus = "PLACED";
