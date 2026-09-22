import { ApiError, readSession } from "@/lib/api-client";
import {
  DEMO_MENU,
  DEMO_ORDER_BLUEPRINTS,
  DEMO_RESTAURANTS,
  DEMO_USERS,
  type DemoUser,
} from "@/lib/demo-seed";
import {
  deliveryFeeFor,
  ORDER_FLOW,
  type AuthSession,
  type CreateOrderPayload,
  type Credentials,
  type MenuItem,
  type MenuItemPayload,
  type Order,
  type OrderItem,
  type OrderStats,
  type OrderStatus,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type RegisterPayload,
  type Restaurant,
  type RestaurantPayload,
  type Role,
} from "@/lib/types";

/**
 * Offline demo backend.
 *
 * CraveDash's real backend is six Spring Boot services behind an API Gateway.
 * That stack is a local process, so when the browser cannot reach the gateway
 * this module answers the same endpoints with the same rules — menu
 * availability checks, the free-delivery threshold, the order state machine,
 * refunds and the per-role visibility rules — persisted in localStorage. The
 * moment the gateway answers, `@/lib/api` stops using this and talks to the
 * real microservices instead.
 */

const STORAGE_KEY = "cravedash.demo.state.v1";

interface DemoState {
  users: DemoUser[];
  restaurants: Restaurant[];
  menu: MenuItem[];
  orders: Order[];
  payments: Payment[];
  seq: {
    user: number;
    restaurant: number;
    menu: number;
    order: number;
    item: number;
    payment: number;
  };
}

const STAFF_ROLES: Role[] = ["ADMIN", "RESTAURANT_ADMIN", "DELIVERY_AGENT"];

const money = (value: number) => Math.round(value * 100) / 100;
const iso = (date: Date) => date.toISOString().slice(0, 19);
const delay = (ms = 180) => new Promise((resolve) => window.setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function buildInitialState(): DemoState {
  const now = Date.now();
  const state: DemoState = {
    users: DEMO_USERS.map((user) => ({ ...user })),
    restaurants: DEMO_RESTAURANTS.map((restaurant) => ({ ...restaurant })),
    menu: DEMO_MENU.map((item) => ({ ...item })),
    orders: [],
    payments: [],
    seq: {
      user: DEMO_USERS.length,
      restaurant: DEMO_RESTAURANTS.length,
      menu: 500,
      order: 1000,
      item: 5000,
      payment: 9000,
    },
  };

  for (const blueprint of DEMO_ORDER_BLUEPRINTS) {
    const restaurant = state.restaurants.find(
      (candidate) => candidate.id === blueprint.restaurantId,
    );
    if (!restaurant) continue;

    const createdAt = new Date(now - blueprint.minutesAgo * 60_000);
    const items: OrderItem[] = [];
    let subtotal = 0;

    for (const line of blueprint.lines) {
      const menuItem = state.menu.find(
        (candidate) =>
          candidate.restaurantId === blueprint.restaurantId &&
          candidate.name === line.item,
      );
      if (!menuItem) continue;
      const lineTotal = money(menuItem.price * line.quantity);
      subtotal = money(subtotal + lineTotal);
      items.push({
        id: ++state.seq.item,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice: money(menuItem.price),
        quantity: line.quantity,
        specialInstructions: line.specialInstructions ?? null,
        lineTotal,
      });
    }

    const fee = deliveryFeeFor(subtotal);
    const orderId = ++state.seq.order;
    const total = money(subtotal + fee);
    const settled = blueprint.paymentState === "PAID" || blueprint.paymentState === "REFUNDED";

    state.orders.push({
      id: orderId,
      customerId: blueprint.customerId,
      customerEmail: blueprint.customerEmail,
      customerName: blueprint.customerName,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      deliveryAddress: blueprint.deliveryAddress,
      notes: blueprint.notes ?? null,
      status: blueprint.status,
      paymentState: blueprint.paymentState,
      paymentMethod: blueprint.paymentMethod,
      paymentId: settled ? ++state.seq.payment : null,
      transactionId: settled ? transactionId() : null,
      deliveryAgentId: blueprint.agentId ?? null,
      deliveryAgentName: blueprint.agentName ?? null,
      subtotal,
      deliveryFee: fee,
      totalAmount: total,
      cancellationReason: blueprint.cancellationReason ?? null,
      items,
      createdAt: iso(createdAt),
      updatedAt: iso(createdAt),
    });

    if (settled) {
      state.payments.push({
        id: state.seq.payment,
        orderId,
        customerId: blueprint.customerId,
        amount: total,
        paymentMethod: blueprint.paymentMethod,
        paymentStatus:
          blueprint.paymentState === "REFUNDED" ? "REFUNDED" : "SUCCESS",
        transactionId: transactionId(),
        createdAt: iso(createdAt),
      });
    }
  }

  return state;
}

function loadState(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.restaurants?.length && parsed?.users?.length) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = buildInitialState();
  persist(fresh);
  return fresh;
}

function persist(state: DemoState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

let state: DemoState = loadState();

/** Wipes local demo data back to the seed. Exposed for the reset button. */
export function resetDemoBackend(): void {
  state = buildInitialState();
  persist(state);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function transactionId(): string {
  const bytes = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
  return `TXN-${new Date().toISOString().slice(0, 10)}-${bytes.toUpperCase()}`;
}

function issueToken(user: DemoUser): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 86_400_000,
  };
  return `demo.${window.btoa(JSON.stringify(payload))}.cravedash`;
}

interface DemoClaims {
  userId: number;
  email: string;
  role: Role;
  name: string;
}

function claimsFromToken(token: string): DemoClaims | null {
  try {
    const [, encoded, signature] = token.split(".");
    if (!encoded || signature !== "cravedash") return null;
    const payload = JSON.parse(window.atob(encoded)) as DemoClaims & {
      exp?: number;
    };
    if (!payload?.userId) return null;
    if (payload.exp && payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

function currentClaims(): DemoClaims {
  const session = readSession();
  const claims = session ? claimsFromToken(session.token) : null;
  if (!claims) {
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  return claims;
}

function session(user: DemoUser): AuthSession {
  return {
    token: issueToken(user),
    tokenType: "Bearer",
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function publicUser(user: DemoUser): Omit<DemoUser, "password"> {
  const { password: _password, ...rest } = user;
  return rest;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function findRestaurant(id: number): Restaurant {
  const restaurant = state.restaurants.find((candidate) => candidate.id === id);
  if (!restaurant) throw new ApiError(`Restaurant not found with id: ${id}`, 404);
  return restaurant;
}

function findMenuItem(restaurantId: number, itemId: number): MenuItem {
  const item = state.menu.find(
    (candidate) =>
      candidate.id === itemId && candidate.restaurantId === restaurantId,
  );
  if (!item) {
    throw new ApiError(
      `Menu item not found with id: ${itemId} for restaurant ${restaurantId}`,
      404,
    );
  }
  return item;
}

function findOrder(id: number): Order {
  const order = state.orders.find((candidate) => candidate.id === id);
  if (!order) throw new ApiError(`Order not found with id: ${id}`, 404);
  return order;
}

function assertVisible(order: Order, claims: DemoClaims): void {
  if (STAFF_ROLES.includes(claims.role)) return;
  if (order.customerId === claims.userId) return;
  throw new ApiError(`You are not allowed to access order ${order.id}`, 403);
}

// ---------------------------------------------------------------------------
// Demo API surface (mirrors the gateway endpoints)
// ---------------------------------------------------------------------------

export const demoApi = {
  async register(payload: RegisterPayload): Promise<AuthSession> {
    await delay();
    const email = payload.email.trim().toLowerCase();
    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      throw new ApiError("An account with that email already exists", 409);
    }
    const user: DemoUser = {
      id: ++state.seq.user,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone ?? null,
      role: payload.role,
      password: payload.password,
      createdAt: iso(new Date()),
    };
    state.users.push(user);
    persist(state);
    return session(user);
  },

  async login(credentials: Credentials): Promise<AuthSession> {
    await delay();
    const email = credentials.email.trim().toLowerCase();
    const user = state.users.find(
      (candidate) => candidate.email.toLowerCase() === email,
    );
    if (!user || user.password !== credentials.password) {
      throw new ApiError("Invalid email or password", 401);
    }
    return session(user);
  },

  async me() {
    await delay(120);
    const claims = currentClaims();
    const user = state.users.find((candidate) => candidate.id === claims.userId);
    if (!user) throw new ApiError("User not found", 404);
    return publicUser(user);
  },

  async listRestaurants(search?: string): Promise<Restaurant[]> {
    await delay(140);
    const term = search?.trim().toLowerCase();
    return state.restaurants
      .filter((restaurant) => restaurant.active)
      .filter((restaurant) =>
        term ? restaurant.name.toLowerCase().includes(term) : true,
      )
      .map((restaurant) => ({ ...restaurant }));
  },

  async myRestaurants(): Promise<Restaurant[]> {
    await delay(140);
    const claims = currentClaims();
    return state.restaurants
      .filter(
        (restaurant) =>
          restaurant.ownerEmail?.toLowerCase() === claims.email.toLowerCase(),
      )
      .map((restaurant) => ({ ...restaurant }));
  },

  async getRestaurant(id: number): Promise<Restaurant> {
    await delay(120);
    return { ...findRestaurant(id) };
  },

  async createRestaurant(payload: RestaurantPayload): Promise<Restaurant> {
    await delay();
    const claims = currentClaims();
    const restaurant: Restaurant = {
      id: ++state.seq.restaurant,
      name: payload.name,
      description: payload.description ?? null,
      address: payload.address,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      ownerEmail: claims.email,
      imageUrl: payload.imageUrl ?? "",
      active: payload.active ?? true,
      createdAt: iso(new Date()),
    };
    state.restaurants.push(restaurant);
    persist(state);
    return { ...restaurant };
  },

  async updateRestaurant(
    id: number,
    payload: RestaurantPayload,
  ): Promise<Restaurant> {
    await delay();
    const restaurant = findRestaurant(id);
    Object.assign(restaurant, {
      name: payload.name,
      description: payload.description ?? null,
      address: payload.address,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      imageUrl: payload.imageUrl ?? "",
      active: payload.active ?? restaurant.active,
    });
    persist(state);
    return { ...restaurant };
  },

  async getMenu(restaurantId: number): Promise<MenuItem[]> {
    await delay(140);
    findRestaurant(restaurantId);
    return state.menu
      .filter((item) => item.restaurantId === restaurantId)
      .map((item) => ({ ...item }));
  },

  async addMenuItem(
    restaurantId: number,
    payload: MenuItemPayload,
  ): Promise<MenuItem> {
    await delay();
    const restaurant = findRestaurant(restaurantId);
    const item: MenuItem = {
      id: ++state.seq.menu,
      restaurantId: restaurant.id,
      name: payload.name,
      description: payload.description ?? null,
      price: money(payload.price),
      category: payload.category ?? null,
      imageUrl: payload.imageUrl ?? "",
      available: payload.available ?? true,
    };
    state.menu.push(item);
    persist(state);
    return { ...item };
  },

  async updateMenuItem(
    restaurantId: number,
    itemId: number,
    payload: MenuItemPayload,
  ): Promise<MenuItem> {
    await delay();
    const item = findMenuItem(restaurantId, itemId);
    Object.assign(item, {
      name: payload.name,
      description: payload.description ?? null,
      price: money(payload.price),
      category: payload.category ?? null,
      imageUrl: payload.imageUrl ?? "",
      available: payload.available ?? item.available,
    });
    persist(state);
    return { ...item };
  },

  async deleteMenuItem(restaurantId: number, itemId: number): Promise<void> {
    await delay();
    findMenuItem(restaurantId, itemId);
    state.menu = state.menu.filter((item) => item.id !== itemId);
    persist(state);
  },

  async setAvailability(
    restaurantId: number,
    itemId: number,
    available: boolean,
  ): Promise<MenuItem> {
    await delay(120);
    const item = findMenuItem(restaurantId, itemId);
    item.available = available;
    persist(state);
    return { ...item };
  },

  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    await delay(320);
    const claims = currentClaims();
    const restaurant = findRestaurant(payload.restaurantId);
    if (!restaurant.active) {
      throw new ApiError(
        `${restaurant.name} is not accepting orders right now`,
        409,
      );
    }

    const items: OrderItem[] = [];
    let subtotal = 0;
    for (const line of payload.items) {
      const menuItem = findMenuItem(payload.restaurantId, line.menuItemId);
      if (!menuItem.available) {
        throw new ApiError(
          `${menuItem.name} is sold out right now. Remove it and try again.`,
          409,
        );
      }
      const lineTotal = money(menuItem.price * line.quantity);
      subtotal = money(subtotal + lineTotal);
      items.push({
        id: ++state.seq.item,
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice: money(menuItem.price),
        quantity: line.quantity,
        specialInstructions: line.specialInstructions ?? null,
        lineTotal,
      });
    }

    if (items.length === 0) {
      throw new ApiError("An order must contain at least one item", 400);
    }

    const fee = deliveryFeeFor(subtotal);
    const total = money(subtotal + fee);
    const orderId = ++state.seq.order;
    const createdAt = iso(new Date());

    const order: Order = {
      id: orderId,
      customerId: claims.userId,
      customerEmail: claims.email,
      customerName: payload.customerName,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      deliveryAddress: payload.deliveryAddress,
      notes: payload.notes ?? null,
      status: "PENDING",
      paymentState: "PENDING",
      paymentMethod: payload.paymentMethod,
      paymentId: null,
      transactionId: null,
      deliveryAgentId: null,
      deliveryAgentName: null,
      subtotal,
      deliveryFee: fee,
      totalAmount: total,
      cancellationReason: null,
      items,
      createdAt,
      updatedAt: createdAt,
    };
    state.orders.push(order);

    // Mirrors order-service charging payment-service right after creating the order.
    const payment: Payment = {
      id: ++state.seq.payment,
      orderId,
      customerId: claims.userId,
      amount: total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: "SUCCESS",
      transactionId: transactionId(),
      createdAt,
    };
    state.payments.push(payment);

    order.paymentId = payment.id;
    order.transactionId = payment.transactionId ?? null;
    order.paymentState = "PAID";

    persist(state);
    return { ...order, items: order.items.map((item) => ({ ...item })) };
  },

  async myOrders(): Promise<Order[]> {
    await delay(160);
    const claims = currentClaims();
    return byCreatedDesc(
      state.orders.filter((order) => order.customerId === claims.userId),
    );
  },

  async ordersForRestaurant(restaurantId: number): Promise<Order[]> {
    await delay(160);
    return byCreatedDesc(
      state.orders.filter((order) => order.restaurantId === restaurantId),
    );
  },

  async allOrders(): Promise<Order[]> {
    await delay(180);
    return byCreatedDesc(state.orders);
  },

  async availableDeliveries(): Promise<Order[]> {
    await delay(150);
    return state.orders
      .filter(
        (order) => order.status === "READY_FOR_PICKUP" && !order.deliveryAgentId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(cloneOrder);
  },

  async myDeliveries(): Promise<Order[]> {
    await delay(150);
    const claims = currentClaims();
    return state.orders
      .filter((order) => order.deliveryAgentId === claims.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneOrder);
  },

  async getOrder(id: number): Promise<Order> {
    await delay(120);
    const claims = currentClaims();
    const order = findOrder(id);
    assertVisible(order, claims);
    return cloneOrder(order);
  },

  async updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
    await delay(200);
    const claims = currentClaims();
    const order = findOrder(id);

    if (!ORDER_FLOW[order.status].includes(status)) {
      throw new ApiError(
        `Order ${id} cannot move from ${order.status} to ${status}`,
        409,
      );
    }
    if (order.paymentState !== "PAID" && status !== "CANCELLED") {
      throw new ApiError(`Order ${id} has no successful payment yet`, 409);
    }
    if (status === "OUT_FOR_DELIVERY" && !order.deliveryAgentId) {
      if (claims.role !== "DELIVERY_AGENT") {
        throw new ApiError(
          "Only a delivery agent can start this delivery",
          403,
        );
      }
      order.deliveryAgentId = claims.userId;
      order.deliveryAgentName = claims.name;
    }

    order.status = status;
    order.updatedAt = iso(new Date());
    persist(state);
    return cloneOrder(order);
  },

  async claimOrder(id: number): Promise<Order> {
    await delay(200);
    const claims = currentClaims();
    const order = findOrder(id);
    if (order.status !== "READY_FOR_PICKUP") {
      throw new ApiError(
        `Order ${id} is ${order.status} and cannot be claimed yet`,
        409,
      );
    }
    if (order.deliveryAgentId) {
      throw new ApiError(
        `Order ${id} is already assigned to ${order.deliveryAgentName}`,
        409,
      );
    }
    order.deliveryAgentId = claims.userId;
    order.deliveryAgentName = claims.name;
    order.updatedAt = iso(new Date());
    persist(state);
    return cloneOrder(order);
  },

  async cancelOrder(id: number, reason?: string): Promise<Order> {
    await delay(240);
    const claims = currentClaims();
    const order = findOrder(id);
    assertVisible(order, claims);

    if (!ORDER_FLOW[order.status].includes("CANCELLED")) {
      throw new ApiError(
        `Order ${id} is ${order.status} and can no longer be cancelled`,
        409,
      );
    }

    if (order.paymentState === "PAID" && order.paymentId) {
      const payment = state.payments.find(
        (candidate) => candidate.id === order.paymentId,
      );
      if (payment) {
        payment.paymentStatus = "REFUNDED";
      }
      order.paymentState = "REFUNDED";
    }

    order.status = "CANCELLED";
    order.cancellationReason =
      reason && reason.trim() ? reason.trim() : "Cancelled by customer";
    order.updatedAt = iso(new Date());
    persist(state);
    return cloneOrder(order);
  },

  async stats(): Promise<OrderStats> {
    await delay(160);
    const orders = state.orders;
    const capturedRevenue = money(
      orders
        .filter((order) => order.paymentState === "PAID")
        .reduce((sum, order) => sum + order.totalAmount, 0),
    );
    return {
      totalOrders: orders.length,
      pending: orders.filter((order) => order.status === "PENDING").length,
      active: orders.filter(
        (order) => order.status !== "DELIVERED" && order.status !== "CANCELLED",
      ).length,
      delivered: orders.filter((order) => order.status === "DELIVERED").length,
      cancelled: orders.filter((order) => order.status === "CANCELLED").length,
      awaitingCourier: orders.filter(
        (order) => order.status === "READY_FOR_PICKUP" && !order.deliveryAgentId,
      ).length,
      capturedRevenue,
    };
  },

  async paymentForOrder(orderId: number): Promise<Payment> {
    await delay(120);
    const payment = state.payments.find(
      (candidate) => candidate.orderId === orderId,
    );
    if (!payment) {
      throw new ApiError(`Payment not found for order: ${orderId}`, 404);
    }
    return { ...payment };
  },

  async refundPayment(paymentId: number, _reason?: string): Promise<Payment> {
    await delay(200);
    const payment = state.payments.find(
      (candidate) => candidate.id === paymentId,
    );
    if (!payment) {
      throw new ApiError(`Payment not found with id: ${paymentId}`, 404);
    }
    if (payment.paymentStatus !== "SUCCESS") {
      throw new ApiError(
        `Only SUCCESS payments can be refunded. Current status: ${payment.paymentStatus}`,
        409,
      );
    }
    payment.paymentStatus = "REFUNDED" as PaymentStatus;
    const order = state.orders.find(
      (candidate) => candidate.id === payment.orderId,
    );
    if (order) order.paymentState = "REFUNDED";
    persist(state);
    return { ...payment };
  },

  /** Active accounts in the demo store, used for the quick sign-in switcher. */
  demoAccounts(): { role: Role; email: string; name: string }[] {
    return state.users
      .filter((user) => DEMO_USERS.some((seed) => seed.id === user.id))
      .map((user) => ({
        role: user.role,
        email: user.email,
        name: user.name,
      }));
  },

  paymentMethodLabel(method: PaymentMethod): string {
    return method === "CASH"
      ? "Cash on delivery"
      : method === "UPI"
        ? "UPI transfer"
        : "Card";
  },
};

function cloneOrder(order: Order): Order {
  return { ...order, items: order.items.map((item) => ({ ...item })) };
}

function byCreatedDesc(orders: Order[]): Order[] {
  return [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(cloneOrder);
}
