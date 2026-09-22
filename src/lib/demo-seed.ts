import type { MenuItem, OrderStatus, PaymentState, Restaurant, User } from "@/lib/types";

/**
 * Seed data for the offline demo backend (see demo-backend.ts).
 *
 * It mirrors what the real stack contains after you run it locally: one
 * restaurant admin that owns a listing, one courier, one platform admin and a
 * customer with an order history in every lifecycle state.
 */

/** Demo accounts keep their password in the local sandbox store only — never sent anywhere. */
export interface DemoUser extends User {
  password: string;
}

export const DEMO_PASSWORD = "cravedash";

export const DEMO_USERS: DemoUser[] = [
  {
    id: 1,
    name: "Maya Chen",
    email: "maya@cravedash.dev",
    phone: "+1 415 555 0132",
    role: "CUSTOMER",
    password: DEMO_PASSWORD,
    createdAt: "2026-02-04T09:12:00",
  },
  {
    id: 2,
    name: "Ravi Patel",
    email: "chef@cravedash.dev",
    phone: "+1 415 555 0101",
    role: "RESTAURANT_ADMIN",
    password: DEMO_PASSWORD,
    createdAt: "2026-01-21T16:40:00",
  },
  {
    id: 3,
    name: "Nora Silva",
    email: "nora@cravedash.dev",
    phone: "+1 415 555 0177",
    role: "DELIVERY_AGENT",
    password: DEMO_PASSWORD,
    createdAt: "2026-02-11T11:05:00",
  },
  {
    id: 4,
    name: "Ada Okoye",
    email: "admin@cravedash.dev",
    phone: "+1 415 555 0190",
    role: "ADMIN",
    password: DEMO_PASSWORD,
    createdAt: "2026-01-05T08:00:00",
  },
];

export const DEMO_RESTAURANTS: Restaurant[] = [
  {
    id: 1,
    name: "Spice Vault",
    description:
      "Slow-simmered curries, tandoor plates and fresh naan from a family kitchen that has been at it for three generations.",
    address: "14 Lantern Street, SoMa",
    phone: "+1 415 555 0101",
    email: "chef@cravedash.dev",
    ownerEmail: "chef@cravedash.dev",
    imageUrl: "",
    active: true,
    createdAt: "2026-01-22T10:00:00",
  },
  {
    id: 2,
    name: "Ember & Oak",
    description:
      "Flame-grilled burgers, charred corn and hand-cut fries cooked over oak embers.",
    address: "88 Foundry Row, Mission District",
    phone: "+1 415 555 0122",
    email: "hello@emberandoak.dev",
    ownerEmail: "grill@emberandoak.dev",
    imageUrl: "",
    active: true,
    createdAt: "2026-01-28T12:30:00",
  },
  {
    id: 3,
    name: "Nori Tide",
    description:
      "Sushi counter and hand rolls built from the morning catch, served with wasabi ground to order.",
    address: "3 Pier Walk, Embarcadero",
    phone: "+1 415 555 0144",
    email: "counter@noritide.dev",
    ownerEmail: "sushi@noritide.dev",
    imageUrl: "",
    active: true,
    createdAt: "2026-02-02T09:45:00",
  },
  {
    id: 4,
    name: "Sweet Circuit",
    description:
      "Small-batch desserts and single-origin espresso from a converted tram depot.",
    address: "27 Voltage Lane, Dogpatch",
    phone: "+1 415 555 0166",
    email: "order@sweetcircuit.dev",
    ownerEmail: "baker@sweetcircuit.dev",
    imageUrl: "",
    active: true,
    createdAt: "2026-02-09T14:20:00",
  },
];

export const DEMO_MENU: MenuItem[] = [
  // Spice Vault
  {
    id: 101,
    restaurantId: 1,
    name: "Butter Chicken",
    description: "Tandoor chicken folded into tomato-fenugreek cream.",
    price: 16.5,
    category: "Curry",
    imageUrl: "",
    available: true,
  },
  {
    id: 102,
    restaurantId: 1,
    name: "Paneer Tikka Masala",
    description: "Charred paneer, cashew gravy, crushed coriander.",
    price: 14.75,
    category: "Curry",
    imageUrl: "",
    available: true,
  },
  {
    id: 103,
    restaurantId: 1,
    name: "Garlic Naan",
    description: "Tandoor naan brushed with garlic butter.",
    price: 3.95,
    category: "Breads",
    imageUrl: "",
    available: true,
  },
  {
    id: 104,
    restaurantId: 1,
    name: "Lamb Biryani",
    description: "Sealed-pot biryani with saffron rice and fried shallots.",
    price: 18.25,
    category: "Rice",
    imageUrl: "",
    available: true,
  },
  {
    id: 105,
    restaurantId: 1,
    name: "Mango Lassi",
    description: "Alphonso mango, thick yoghurt, cardamom.",
    price: 4.5,
    category: "Drinks",
    imageUrl: "",
    available: true,
  },
  {
    id: 106,
    restaurantId: 1,
    name: "Chicken 65",
    description: "Curry-leaf fried chicken with a chilli hit.",
    price: 11.0,
    category: "Starters",
    imageUrl: "",
    available: false,
  },
  // Ember & Oak
  {
    id: 201,
    restaurantId: 2,
    name: "Oak Smash Burger",
    description: "Double patty, aged cheddar, ember sauce, brioche.",
    price: 13.9,
    category: "Burgers",
    imageUrl: "",
    available: true,
  },
  {
    id: 202,
    restaurantId: 2,
    name: "Charred Corn Ribs",
    description: "Ember-roasted corn, lime crema, chilli salt.",
    price: 7.5,
    category: "Sides",
    imageUrl: "",
    available: true,
  },
  {
    id: 203,
    restaurantId: 2,
    name: "Hand-Cut Fries",
    description: "Twice-fried, rosemary salt.",
    price: 5.25,
    category: "Sides",
    imageUrl: "",
    available: true,
  },
  {
    id: 204,
    restaurantId: 2,
    name: "Smoked Brisket Bun",
    description: "Twelve-hour brisket, pickles, mustard seed slaw.",
    price: 16.4,
    category: "Burgers",
    imageUrl: "",
    available: true,
  },
  {
    id: 205,
    restaurantId: 2,
    name: "Vanilla Shake",
    description: "Frozen custard, Tahitian vanilla.",
    price: 6.0,
    category: "Drinks",
    imageUrl: "",
    available: true,
  },
  // Nori Tide
  {
    id: 301,
    restaurantId: 3,
    name: "Salmon Nigiri Set",
    description: "Six pieces of hand-pressed salmon nigiri.",
    price: 17.75,
    category: "Sushi",
    imageUrl: "",
    available: true,
  },
  {
    id: 302,
    restaurantId: 3,
    name: "Spicy Tuna Hand Roll",
    description: "Crisp nori, tuna tartare, chilli mayo.",
    price: 9.25,
    category: "Rolls",
    imageUrl: "",
    available: true,
  },
  {
    id: 303,
    restaurantId: 3,
    name: "Miso Soup",
    description: "Dashi, white miso, wakame, scallion.",
    price: 4.25,
    category: "Soups",
    imageUrl: "",
    available: true,
  },
  {
    id: 304,
    restaurantId: 3,
    name: "Dragon Roll",
    description: "Tempura prawn, avocado, eel glaze.",
    price: 19.5,
    category: "Rolls",
    imageUrl: "",
    available: true,
  },
  {
    id: 305,
    restaurantId: 3,
    name: "Cold Green Tea",
    description: "Sencha brewed and chilled overnight.",
    price: 3.5,
    category: "Drinks",
    imageUrl: "",
    available: true,
  },
  // Sweet Circuit
  {
    id: 401,
    restaurantId: 4,
    name: "Basque Cheesecake",
    description: "Burnt top, custard centre, sea salt.",
    price: 8.5,
    category: "Desserts",
    imageUrl: "",
    available: true,
  },
  {
    id: 402,
    restaurantId: 4,
    name: "Pistachio Éclair",
    description: "Choux, pistachio crème, candied peel.",
    price: 6.75,
    category: "Desserts",
    imageUrl: "",
    available: true,
  },
  {
    id: 403,
    restaurantId: 4,
    name: "Single-Origin Espresso",
    description: "Ethiopian Guji, pulled short.",
    price: 3.75,
    category: "Coffee",
    imageUrl: "",
    available: true,
  },
  {
    id: 404,
    restaurantId: 4,
    name: "Salted Caramel Tart",
    description: "Dark caramel, cocoa crust, Maldon salt.",
    price: 7.25,
    category: "Desserts",
    imageUrl: "",
    available: true,
  },
];

/** Orders are built from these sketches so seed pricing uses the real rules. */
export interface DemoOrderBlueprint {
  customerId: number;
  customerName: string;
  customerEmail: string;
  restaurantId: number;
  deliveryAddress: string;
  notes?: string;
  status: OrderStatus;
  paymentState: PaymentState;
  paymentMethod: "CARD" | "UPI" | "CASH";
  agentId?: number;
  agentName?: string;
  cancellationReason?: string;
  minutesAgo: number;
  /** Menu item names (resolved per restaurant) with quantities. */
  lines: { item: string; quantity: number; specialInstructions?: string }[];
}

export const DEMO_ORDER_BLUEPRINTS: DemoOrderBlueprint[] = [
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 1,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    notes: "Leave at the door, buzzer is broken.",
    status: "PENDING",
    paymentState: "PAID",
    paymentMethod: "CARD",
    minutesAgo: 7,
    lines: [
      { item: "Butter Chicken", quantity: 1, specialInstructions: "Medium heat" },
      { item: "Garlic Naan", quantity: 2 },
      { item: "Mango Lassi", quantity: 1 },
    ],
  },
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 2,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    status: "PREPARING",
    paymentState: "PAID",
    paymentMethod: "UPI",
    minutesAgo: 26,
    lines: [
      { item: "Oak Smash Burger", quantity: 2 },
      { item: "Hand-Cut Fries", quantity: 1 },
      { item: "Vanilla Shake", quantity: 1 },
    ],
  },
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 3,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    status: "READY_FOR_PICKUP",
    paymentState: "PAID",
    paymentMethod: "CARD",
    minutesAgo: 44,
    lines: [
      { item: "Dragon Roll", quantity: 1 },
      { item: "Miso Soup", quantity: 2 },
    ],
  },
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 1,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    status: "OUT_FOR_DELIVERY",
    paymentState: "PAID",
    paymentMethod: "CARD",
    agentId: 3,
    agentName: "Nora Silva",
    minutesAgo: 71,
    lines: [
      { item: "Lamb Biryani", quantity: 1 },
      { item: "Paneer Tikka Masala", quantity: 1 },
      { item: "Garlic Naan", quantity: 1 },
    ],
  },
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 4,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    status: "DELIVERED",
    paymentState: "PAID",
    paymentMethod: "CARD",
    agentId: 3,
    agentName: "Nora Silva",
    minutesAgo: 1500,
    lines: [
      { item: "Basque Cheesecake", quantity: 1 },
      { item: "Single-Origin Espresso", quantity: 2 },
    ],
  },
  {
    customerId: 1,
    customerName: "Maya Chen",
    customerEmail: "maya@cravedash.dev",
    restaurantId: 2,
    deliveryAddress: "402 Alder Street, Apt 6B, SoMa",
    status: "CANCELLED",
    paymentState: "REFUNDED",
    paymentMethod: "CARD",
    cancellationReason: "Restaurant ran out of brisket",
    minutesAgo: 2900,
    lines: [{ item: "Smoked Brisket Bun", quantity: 2 }],
  },
  {
    customerId: 12,
    customerName: "Jonas Weber",
    customerEmail: "jonas@example.com",
    restaurantId: 1,
    deliveryAddress: "9 Harbour Court, Unit 2, Mission Bay",
    notes: "Extra napkins please.",
    status: "PENDING",
    paymentState: "PAID",
    paymentMethod: "CARD",
    minutesAgo: 3,
    lines: [
      { item: "Chicken 65", quantity: 1 },
      { item: "Butter Chicken", quantity: 1 },
    ],
  },
  {
    customerId: 13,
    customerName: "Priya Raman",
    customerEmail: "priya@example.com",
    restaurantId: 1,
    deliveryAddress: "55 Folsom Street, Floor 12, Financial District",
    status: "CONFIRMED",
    paymentState: "PAID",
    paymentMethod: "UPI",
    minutesAgo: 12,
    lines: [
      { item: "Lamb Biryani", quantity: 2 },
      { item: "Mango Lassi", quantity: 2 },
    ],
  },
];
