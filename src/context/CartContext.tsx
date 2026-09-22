import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deliveryFeeFor,
  type MenuItem,
  type Restaurant,
} from "@/lib/types";

/**
 * Client-side basket. CraveDash orders are single-restaurant, so adding an item
 * from another listing replaces the basket (the caller confirms with the user).
 */

const STORAGE_KEY = "cravedash.cart.v1";

export interface CartLine {
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  specialInstructions?: string;
  available: boolean;
}

interface CartSnapshot {
  restaurantId: number | null;
  restaurantName: string;
  lines: CartLine[];
}

interface CartContextValue extends CartSnapshot {
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addItem: (
    restaurant: Restaurant,
    item: MenuItem,
    quantity?: number,
    specialInstructions?: string,
  ) => "added" | "replaced" | "same-restaurant";
  setQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  clear: () => void;
  hasItem: (menuItemId: number) => boolean;
}

const emptyCart: CartSnapshot = {
  restaurantId: null,
  restaurantName: "",
  lines: [],
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartSnapshot {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCart;
    const parsed = JSON.parse(raw) as CartSnapshot;
    if (!parsed?.lines?.length) return emptyCart;
    return parsed;
  } catch {
    return emptyCart;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartSnapshot>(emptyCart);

  // Hydrate after mount so the first render matches the server-less HTML shell.
  useEffect(() => {
    setCart(readCart());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* ignore storage failures */
    }
  }, [cart]);

  const addItem = useCallback(
    (
      restaurant: Restaurant,
      item: MenuItem,
      quantity = 1,
      specialInstructions?: string,
    ): "added" | "replaced" | "same-restaurant" => {
      const switchingRestaurant =
        cart.restaurantId !== null && cart.restaurantId !== restaurant.id;

      setCart((current) => {
        if (current.restaurantId !== null && current.restaurantId !== restaurant.id) {
          return {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            lines: [
              {
                menuItemId: item.id,
                name: item.name,
                unitPrice: item.price,
                quantity,
                specialInstructions,
                available: item.available,
              },
            ],
          };
        }

        const existing = current.lines.find(
          (line) => line.menuItemId === item.id,
        );
        if (existing) {
          return {
            ...current,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            lines: current.lines.map((line) =>
              line.menuItemId === item.id
                ? {
                    ...line,
                    quantity: Math.min(50, line.quantity + quantity),
                    specialInstructions:
                      specialInstructions ?? line.specialInstructions,
                    unitPrice: item.price,
                    available: item.available,
                  }
                : line,
            ),
          };
        }

        return {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          lines: [
            ...current.lines,
            {
              menuItemId: item.id,
              name: item.name,
              unitPrice: item.price,
              quantity,
              specialInstructions,
              available: item.available,
            },
          ],
        };
      });

      return switchingRestaurant ? "replaced" : "added";
    },
    [cart.restaurantId],
  );

  const setQuantity = useCallback((menuItemId: number, quantity: number) => {
    setCart((current) => {
      const lines = current.lines
        .map((line) =>
          line.menuItemId === menuItemId
            ? { ...line, quantity: Math.max(0, Math.min(50, quantity)) }
            : line,
        )
        .filter((line) => line.quantity > 0);
      return lines.length === 0
        ? emptyCart
        : { ...current, lines };
    });
  }, []);

  const removeItem = useCallback((menuItemId: number) => {
    setCart((current) => {
      const lines = current.lines.filter(
        (line) => line.menuItemId !== menuItemId,
      );
      return lines.length === 0 ? emptyCart : { ...current, lines };
    });
  }, []);

  const clear = useCallback(() => setCart(emptyCart), []);

  const hasItem = useCallback(
    (menuItemId: number) =>
      cart.lines.some((line) => line.menuItemId === menuItemId),
    [cart.lines],
  );

  const value = useMemo<CartContextValue>(() => {
    const subtotal = round(
      cart.lines.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity,
        0,
      ),
    );
    const fee = cart.lines.length > 0 ? deliveryFeeFor(subtotal) : 0;
    return {
      ...cart,
      itemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      deliveryFee: fee,
      total: round(subtotal + fee),
      addItem,
      setQuantity,
      removeItem,
      clear,
      hasItem,
    };
  }, [cart, addItem, setQuantity, removeItem, clear, hasItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return context;
}
