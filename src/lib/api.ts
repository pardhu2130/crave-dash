import { useSyncExternalStore } from "react";
import { GATEWAY_URL, pingGateway, request } from "@/lib/api-client";
import { demoApi } from "@/lib/demo-backend";
import type {
  AuthSession,
  CreateOrderPayload,
  Credentials,
  MenuItem,
  MenuItemPayload,
  Order,
  OrderStats,
  OrderStatus,
  Payment,
  RegisterPayload,
  Restaurant,
  RestaurantPayload,
  User,
} from "@/lib/types";

/**
 * Every method below maps 1:1 to an API Gateway route. When the gateway cannot
 * be reached, the same call is served by the offline demo backend so the UI
 * stays fully usable without the Spring stack running.
 */

export type BackendMode = "checking" | "live" | "demo";

let mode: BackendMode = "checking";
let probe: Promise<BackendMode> | null = null;
const listeners = new Set<() => void>();

function updateMode(next: BackendMode): void {
  if (mode === next) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

function subscribeBackendMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getBackendMode(): BackendMode {
  return mode;
}

/** Reactive backend mode for the status badge in the app shell. */
export function useBackendMode(): BackendMode {
  return useSyncExternalStore(subscribeBackendMode, getBackendMode);
}

export function resolveBackendMode(force = false): Promise<BackendMode> {
  if (!probe || force) {
    mode = force ? "checking" : mode;
    probe = pingGateway().then((reachable) => {
      const next: BackendMode = reachable ? "live" : "demo";
      updateMode(next);
      return next;
    });
  }
  return probe;
}

async function offline(): Promise<boolean> {
  return (await resolveBackendMode()) === "demo";
}

export const gatewayUrl = GATEWAY_URL;

export const api = {
  // ---------- auth-service ----------
  async register(payload: RegisterPayload): Promise<AuthSession> {
    if (await offline()) return demoApi.register(payload);
    return request<AuthSession>({
      method: "POST",
      url: "/api/auth/register",
      data: payload,
    });
  },

  async login(credentials: Credentials): Promise<AuthSession> {
    if (await offline()) return demoApi.login(credentials);
    return request<AuthSession>({
      method: "POST",
      url: "/api/auth/login",
      data: credentials,
    });
  },

  async me(): Promise<User> {
    if (await offline()) return demoApi.me();
    return request<User>({ method: "GET", url: "/api/auth/me" });
  },

  // ---------- restaurant-service ----------
  async listRestaurants(search?: string): Promise<Restaurant[]> {
    if (await offline()) return demoApi.listRestaurants(search);
    return request<Restaurant[]>({
      method: "GET",
      url: "/api/restaurants",
      params: search ? { search } : undefined,
    });
  },

  async myRestaurants(): Promise<Restaurant[]> {
    if (await offline()) return demoApi.myRestaurants();
    return request<Restaurant[]>({ method: "GET", url: "/api/restaurants/mine" });
  },

  async getRestaurant(id: number): Promise<Restaurant> {
    if (await offline()) return demoApi.getRestaurant(id);
    return request<Restaurant>({ method: "GET", url: `/api/restaurants/${id}` });
  },

  async createRestaurant(payload: RestaurantPayload): Promise<Restaurant> {
    if (await offline()) return demoApi.createRestaurant(payload);
    return request<Restaurant>({
      method: "POST",
      url: "/api/restaurants",
      data: payload,
    });
  },

  async updateRestaurant(
    id: number,
    payload: RestaurantPayload,
  ): Promise<Restaurant> {
    if (await offline()) return demoApi.updateRestaurant(id, payload);
    return request<Restaurant>({
      method: "PUT",
      url: `/api/restaurants/${id}`,
      data: payload,
    });
  },

  async getMenu(restaurantId: number): Promise<MenuItem[]> {
    if (await offline()) return demoApi.getMenu(restaurantId);
    return request<MenuItem[]>({
      method: "GET",
      url: `/api/restaurants/${restaurantId}/menu`,
    });
  },

  async addMenuItem(
    restaurantId: number,
    payload: MenuItemPayload,
  ): Promise<MenuItem> {
    if (await offline()) return demoApi.addMenuItem(restaurantId, payload);
    return request<MenuItem>({
      method: "POST",
      url: `/api/restaurants/${restaurantId}/menu`,
      data: payload,
    });
  },

  async updateMenuItem(
    restaurantId: number,
    itemId: number,
    payload: MenuItemPayload,
  ): Promise<MenuItem> {
    if (await offline()) {
      return demoApi.updateMenuItem(restaurantId, itemId, payload);
    }
    return request<MenuItem>({
      method: "PUT",
      url: `/api/restaurants/${restaurantId}/menu/${itemId}`,
      data: payload,
    });
  },

  async deleteMenuItem(restaurantId: number, itemId: number): Promise<void> {
    if (await offline()) return demoApi.deleteMenuItem(restaurantId, itemId);
    await request<void>({
      method: "DELETE",
      url: `/api/restaurants/${restaurantId}/menu/${itemId}`,
    });
  },

  async setAvailability(
    restaurantId: number,
    itemId: number,
    available: boolean,
  ): Promise<MenuItem> {
    if (await offline()) {
      return demoApi.setAvailability(restaurantId, itemId, available);
    }
    return request<MenuItem>({
      method: "PATCH",
      url: `/api/restaurants/${restaurantId}/menu/${itemId}/availability`,
      data: { available },
    });
  },

  // ---------- order-service ----------
  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    if (await offline()) return demoApi.createOrder(payload);
    return request<Order>({ method: "POST", url: "/api/orders", data: payload });
  },

  async myOrders(): Promise<Order[]> {
    if (await offline()) return demoApi.myOrders();
    return request<Order[]>({ method: "GET", url: "/api/orders/mine" });
  },

  async ordersForRestaurant(restaurantId: number): Promise<Order[]> {
    if (await offline()) return demoApi.ordersForRestaurant(restaurantId);
    return request<Order[]>({
      method: "GET",
      url: `/api/orders/restaurant/${restaurantId}`,
    });
  },

  async allOrders(): Promise<Order[]> {
    if (await offline()) return demoApi.allOrders();
    return request<Order[]>({ method: "GET", url: "/api/orders" });
  },

  async availableDeliveries(): Promise<Order[]> {
    if (await offline()) return demoApi.availableDeliveries();
    return request<Order[]>({
      method: "GET",
      url: "/api/orders/agent/available",
    });
  },

  async myDeliveries(): Promise<Order[]> {
    if (await offline()) return demoApi.myDeliveries();
    return request<Order[]>({ method: "GET", url: "/api/orders/agent/mine" });
  },

  async getOrder(id: number): Promise<Order> {
    if (await offline()) return demoApi.getOrder(id);
    return request<Order>({ method: "GET", url: `/api/orders/${id}` });
  },

  async updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
    if (await offline()) return demoApi.updateOrderStatus(id, status);
    return request<Order>({
      method: "PATCH",
      url: `/api/orders/${id}/status`,
      data: { status },
    });
  },

  async claimOrder(id: number): Promise<Order> {
    if (await offline()) return demoApi.claimOrder(id);
    return request<Order>({ method: "POST", url: `/api/orders/${id}/claim` });
  },

  async cancelOrder(id: number, reason?: string): Promise<Order> {
    if (await offline()) return demoApi.cancelOrder(id, reason);
    return request<Order>({
      method: "POST",
      url: `/api/orders/${id}/cancel`,
      data: { reason },
    });
  },

  async stats(): Promise<OrderStats> {
    if (await offline()) return demoApi.stats();
    return request<OrderStats>({ method: "GET", url: "/api/orders/stats" });
  },

  // ---------- payment-service ----------
  async paymentForOrder(orderId: number): Promise<Payment> {
    if (await offline()) return demoApi.paymentForOrder(orderId);
    return request<Payment>({
      method: "GET",
      url: `/api/payments/order/${orderId}`,
    });
  },

  async refundPayment(paymentId: number, reason?: string): Promise<Payment> {
    if (await offline()) return demoApi.refundPayment(paymentId, reason);
    return request<Payment>({
      method: "POST",
      url: `/api/payments/${paymentId}/refund`,
      data: { reason },
    });
  },

  /** Demo-only helper: seeded accounts for one-click role switching. */
  demoAccounts() {
    return demoApi.demoAccounts();
  },
};
