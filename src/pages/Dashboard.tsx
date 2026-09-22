import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChefHat,
  Loader2,
  PackageCheck,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  ORDER_STATUS_META,
  formatDateTime,
  formatMoney,
  type Order,
} from "@/lib/types";

const ACTIVE = (order: Order) =>
  order.status !== "DELIVERED" && order.status !== "CANCELLED";

/**
 * The signed-in home for every role. Customers get their live orders and
 * basket; staff roles are pointed at the console that owns their work.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const cart = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await api.myOrders();
        if (!cancelled) setOrders(list);
      } catch (cause) {
        if (!cancelled) setError(describeError(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(() => orders.filter(ACTIVE), [orders]);
  const delivered = useMemo(
    () => orders.filter((order) => order.status === "DELIVERED"),
    [orders],
  );
  const spent = useMemo(
    () =>
      orders
        .filter((order) => order.paymentState === "PAID")
        .reduce((sum, order) => sum + order.totalAmount, 0),
    [orders],
  );
  const tracked = active[0] ?? orders[0] ?? null;

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isStaff = user?.role === "RESTAURANT_ADMIN" || user?.role === "DELIVERY_AGENT";

  return (
    <AppLayout
      title={`Welcome back, ${firstName}`}
      subtitle="Your CraveDash orders, basket and kitchens in one place."
      actions={
        <Button asChild size="sm" className="gap-2">
          <Link to="/restaurants">
            <Store className="size-4" />
            <span className="hidden sm:inline">Order food</span>
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Truck,
              label: "Orders in flight",
              value: String(active.length),
            },
            {
              icon: PackageCheck,
              label: "Delivered",
              value: String(delivered.length),
            },
            {
              icon: Wallet,
              label: "Total paid",
              value: formatMoney(spent),
            },
            {
              icon: ShoppingBag,
              label: "Basket",
              value: `${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`,
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
              className="rounded-xl border bg-card p-4"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                <stat.icon className="size-4 text-primary" />
              </span>
              <p className="mt-3 text-xl font-bold tracking-tight">
                {loading ? "—" : stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Live order */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Live order</h2>
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link to="/orders">
                  All orders
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : tracked ? (
              <motion.article
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{tracked.id}
                      </span>
                      <OrderStatusBadge status={tracked.status} />
                    </div>
                    <h3 className="mt-2 text-lg font-bold tracking-tight">
                      {tracked.restaurantName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ORDER_STATUS_META[tracked.status].blurb}
                    </p>
                  </div>
                  <span className="text-lg font-bold tracking-tight">
                    {formatMoney(tracked.totalAmount)}
                  </span>
                </div>

                <ul className="mt-4 flex flex-col gap-2 border-t pt-4">
                  {tracked.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <FoodTile
                        name={item.itemName}
                        className="size-10"
                        emojiClassName="text-lg"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {item.quantity} × {item.itemName}
                      </span>
                      <span className="text-sm font-medium">
                        {formatMoney(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
                  <span className="text-xs text-muted-foreground">
                    {tracked.deliveryAgentName
                      ? `Courier: ${tracked.deliveryAgentName}`
                      : "Awaiting a courier"}
                    {" · "}
                    {formatDateTime(tracked.createdAt)}
                  </span>
                  <Button asChild size="sm" className="ml-auto gap-2">
                    <Link to={`/orders/${tracked.id}`}>
                      Track order
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </motion.article>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                <Sparkles className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No orders yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Pick a kitchen and your first order will show up here with its
                  live status.
                </p>
                <Button asChild className="gap-2">
                  <Link to="/restaurants">
                    Browse kitchens
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Recent */}
            {orders.length > 1 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold tracking-tight">Recent orders</h3>
                {orders.slice(1, 5).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
                  >
                    <Receipt className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {order.restaurantName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        #{order.id} · {formatDateTime(order.createdAt)}
                      </span>
                    </span>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold">
                      {formatMoney(order.totalAmount)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          {/* Side rail */}
          <section className="flex flex-col gap-4">
            {isStaff ? (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                  <ChefHat className="size-4 text-primary" />
                  Your staff console
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {user?.role === "RESTAURANT_ADMIN"
                    ? "Publish your menu, flip dishes in and out of stock and work the ticket queue."
                    : "Claim packed orders from the dispatch board and close them out on delivery."}
                </p>
                <Button asChild className="mt-4 w-full gap-2">
                  <Link
                    to={user?.role === "RESTAURANT_ADMIN" ? "/admin" : "/fulfillment"}
                  >
                    {user?.role === "RESTAURANT_ADMIN"
                      ? "Open kitchen console"
                      : "Open dispatch board"}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}

            <div className="rounded-xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <ShoppingBag className="size-4 text-primary" />
                Your basket
              </h2>
              {cart.lines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Empty. Dishes you add stay saved on this device until you
                  check out.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cart.itemCount} item
                    {cart.itemCount === 1 ? "" : "s"} from{" "}
                    <span className="font-medium text-foreground">
                      {cart.restaurantName}
                    </span>
                  </p>
                  <p className="mt-1 text-lg font-bold tracking-tight">
                    {formatMoney(cart.total)}
                  </p>
                </>
              )}
              <Button
                asChild
                variant={cart.lines.length === 0 ? "outline" : "default"}
                className="mt-4 w-full gap-2"
              >
                <Link to={cart.lines.length === 0 ? "/restaurants" : "/checkout"}>
                  {cart.lines.length === 0 ? "Find a kitchen" : "Go to checkout"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-base font-bold tracking-tight">
                How the flow works
              </h2>
              <ol className="mt-3 flex flex-col gap-2 text-xs leading-5 text-muted-foreground">
                <li>1 · order-service prices the basket and the delivery fee.</li>
                <li>2 · payment-service captures the charge immediately.</li>
                <li>3 · the kitchen confirms, prepares and hands off.</li>
                <li>4 · a courier claims the packed order and delivers it.</li>
              </ol>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
