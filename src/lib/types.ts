/**
 * Contracts shared with the Spring Boot microservices.
 *
 * Field names match the Java DTOs exactly (auth-service AuthResponse,
 * restaurant-service RestaurantResponse/MenuItemResponse, order-service
 * OrderResponse, payment-service PaymentResponse) so the same types describe
 * live gateway responses and the offline demo backend.
 */

export type Role =
  | "CUSTOMER"
  | "RESTAURANT_ADMIN"
  | "ADMIN"
  | "DELIVERY_AGENT";

export const ROLES: Role[] = [
  "CUSTOMER",
  "RESTAURANT_ADMIN",
  "ADMIN",
  "DELIVERY_AGENT",
];

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentMethod = "CARD" | "UPI" | "CASH";

export type PaymentState = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

/** Mirrors OrderStatus#allowedNextStates() in order-service. */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** The happy path used to render the tracking timeline (cancellations handled separately). */
export const TRACK: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export interface OrderStatusMeta {
  label: string;
  blurb: string;
  /** Tailwind classes for badges using theme tokens. */
  badge: string;
  dot: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  PENDING: {
    label: "Pending",
    blurb: "Sent to the kitchen — waiting for confirmation.",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    blurb: "The restaurant accepted this order.",
    badge: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  PREPARING: {
    label: "Preparing",
    blurb: "Your food is being cooked right now.",
    badge: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  READY_FOR_PICKUP: {
    label: "Ready for pickup",
    blurb: "Packed and waiting for a courier to claim it.",
    badge: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    blurb: "A courier is on the way to the delivery address.",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  DELIVERED: {
    label: "Delivered",
    blurb: "Handed over. Enjoy your meal.",
    badge: "bg-emerald-600/10 text-emerald-800 border-emerald-600/30 dark:text-emerald-300",
    dot: "bg-emerald-600",
  },
  CANCELLED: {
    label: "Cancelled",
    blurb: "This order was cancelled.",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export const PAYMENT_STATE_META: Record<
  PaymentState,
  { label: string; badge: string }
> = {
  PENDING: {
    label: "Payment pending",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  PAID: {
    label: "Paid",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  FAILED: {
    label: "Payment failed",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
  },
  REFUNDED: {
    label: "Refunded",
    badge: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  },
};

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  createdAt?: string | null;
}

export interface AuthSession {
  token: string;
  tokenType?: string;
  userId: number;
  name: string;
  email: string;
  role: Role;
}

export interface Restaurant {
  id: number;
  name: string;
  description?: string | null;
  address: string;
  phone?: string | null;
  email?: string | null;
  ownerEmail?: string | null;
  imageUrl?: string | null;
  active: boolean;
  createdAt?: string | null;
}

export interface MenuItem {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  imageUrl?: string | null;
  available: boolean;
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
  specialInstructions?: string | null;
  lineTotal: number;
}

export interface Order {
  id: number;
  customerId: number;
  customerEmail?: string | null;
  customerName: string;
  restaurantId: number;
  restaurantName: string;
  deliveryAddress: string;
  notes?: string | null;
  status: OrderStatus;
  paymentState: PaymentState;
  paymentMethod: PaymentMethod;
  paymentId?: number | null;
  transactionId?: string | null;
  deliveryAgentId?: number | null;
  deliveryAgentName?: string | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  cancellationReason?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface OrderStats {
  totalOrders: number;
  pending: number;
  active: number;
  delivered: number;
  cancelled: number;
  awaitingCourier: number;
  capturedRevenue: number;
}

export interface Payment {
  id: number;
  orderId: number;
  customerId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string | null;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: Role;
}

export interface RestaurantPayload {
  name: string;
  description?: string;
  address: string;
  phone?: string;
  email?: string;
  imageUrl?: string;
  active?: boolean;
}

export interface MenuItemPayload {
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  available?: boolean;
}

export interface OrderLineInput {
  menuItemId: number;
  quantity: number;
  specialInstructions?: string;
}

export interface CreateOrderPayload {
  restaurantId: number;
  customerName: string;
  deliveryAddress: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  items: OrderLineInput[];
}

/** Free delivery once the basket clears this subtotal (order.delivery.free-threshold). */
export const FREE_DELIVERY_THRESHOLD = 30;
export const DELIVERY_FEE = 2.99;

export function deliveryFeeFor(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

export function formatMoney(value: number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
