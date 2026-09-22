import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bike,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Wallet,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  FREE_DELIVERY_THRESHOLD,
  formatMoney,
  type PaymentMethod,
} from "@/lib/types";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: typeof CreditCard;
}[] = [
  { value: "CARD", label: "Card", hint: "Charged through payment-service", icon: CreditCard },
  { value: "UPI", label: "UPI", hint: "Instant transfer", icon: Wallet },
  { value: "CASH", label: "Cash", hint: "Pay the courier on arrival", icon: Banknote },
];

const ADDRESS_KEY = "cravedash.address.v1";

/**
 * Basket review and order placement. This is the only page that calls
 * `POST /api/orders`, which in turn charges payment-service.
 */
export default function Checkout() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName((current) => current || (user?.name ?? ""));
  }, [user?.name]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADDRESS_KEY);
      if (stored) setAddress((current) => current || stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const remainingForFreeDelivery = useMemo(
    () => Math.max(0, FREE_DELIVERY_THRESHOLD - cart.subtotal),
    [cart.subtotal],
  );

  const handlePlaceOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cart.restaurantId === null || cart.lines.length === 0) return;

    setPending(true);
    setError(null);
    try {
      const order = await api.createOrder({
        restaurantId: cart.restaurantId,
        customerName: customerName.trim(),
        deliveryAddress: address.trim(),
        notes: notes.trim() || undefined,
        paymentMethod,
        items: cart.lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          specialInstructions: line.specialInstructions,
        })),
      });

      try {
        window.localStorage.setItem(ADDRESS_KEY, address.trim());
      } catch {
        /* ignore */
      }

      cart.clear();
      toast("Order placed", {
        description: `#${order.id} · ${formatMoney(order.totalAmount)} · ${order.restaurantName}`,
      });
      navigate(`/orders/${order.id}`);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setPending(false);
    }
  };

  if (cart.lines.length === 0) {
    return (
      <AppLayout title="Checkout" subtitle="Your basket is empty">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <ShoppingBag className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing in the basket yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Pick a kitchen, add a few dishes and they will show up here priced
            with the delivery rules applied.
          </p>
          <Button asChild className="gap-2">
            <Link to="/restaurants">
              Browse kitchens
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Checkout"
      subtitle={`${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"} from ${cart.restaurantName}`}
    >
      <form onSubmit={handlePlaceOrder} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Delivery details */}
        <div className="flex flex-col gap-6">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border bg-card p-5"
          >
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
              <Bike className="size-4 text-primary" />
              Where should it go?
            </h2>

            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="checkout-name">Name on the order</Label>
                <Input
                  id="checkout-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  minLength={2}
                  placeholder="Maya Chen"
                  disabled={pending}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="checkout-address">Delivery address</Label>
                <Input
                  id="checkout-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                  minLength={5}
                  placeholder="402 Alder Street, Apt 6B, SoMa"
                  disabled={pending}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="checkout-notes">
                  Notes for the courier (optional)
                </Label>
                <Textarea
                  id="checkout-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Leave at the door, buzzer is broken."
                  disabled={pending}
                />
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-xl border bg-card p-5"
          >
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
              <CreditCard className="size-4 text-primary" />
              How are you paying?
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((option) => {
                const selected = paymentMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={pending}
                    onClick={() => setPaymentMethod(option.value)}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent"
                    }`}
                  >
                    <option.icon
                      className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-[11px] leading-4 text-muted-foreground">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Payment is captured by payment-service the moment the order is
              created. Cancelling before the kitchen confirms triggers a refund.
            </p>
          </motion.section>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        {/* Basket summary */}
        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex h-fit flex-col rounded-xl border bg-card p-5 lg:sticky lg:top-24"
        >
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Store className="size-4 text-primary" />
            {cart.restaurantName}
          </h2>

          <ul className="mt-4 flex flex-col gap-4">
            {cart.lines.map((line) => (
              <li key={line.menuItemId} className="flex gap-3">
                <FoodTile name={line.name} className="size-12" emojiClassName="text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(line.unitPrice)} each
                  </p>
                  {line.specialInstructions ? (
                    <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                      “{line.specialInstructions}”
                    </p>
                  ) : null}

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Reduce ${line.name}`}
                        onClick={() =>
                          cart.setQuantity(line.menuItemId, line.quantity - 1)
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-7 text-center text-xs font-semibold">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Add another ${line.name}`}
                        onClick={() =>
                          cart.setQuantity(line.menuItemId, line.quantity + 1)
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => cart.removeItem(line.menuItemId)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                    <span className="ml-auto text-sm font-semibold">
                      {formatMoney(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Separator className="my-5" />

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{formatMoney(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd className="font-medium">
                {cart.deliveryFee === 0 ? "Free" : formatMoney(cart.deliveryFee)}
              </dd>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{formatMoney(cart.total)}</dd>
            </div>
          </dl>

          {remainingForFreeDelivery > 0 ? (
            <p className="mt-3 rounded-lg border bg-muted/50 p-2.5 text-[11px] leading-4 text-muted-foreground">
              Add {formatMoney(remainingForFreeDelivery)} more for free delivery.
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
              Free delivery unlocked on this order.
            </p>
          )}

          <Button type="submit" className="mt-5 w-full gap-2" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Place order · {formatMoney(cart.total)}
          </Button>

          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to={`/restaurants/${cart.restaurantId}`}>Add more dishes</Link>
          </Button>
        </motion.aside>
      </form>
    </AppLayout>
  );
}
