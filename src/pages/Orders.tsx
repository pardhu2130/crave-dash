import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Receipt,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import {
  OrderMetaLine,
  OrderStatusBadge,
  PaymentStateBadge,
} from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import { ORDER_FLOW, formatMoney, type Order } from "@/lib/types";

type Filter = "active" | "delivered" | "cancelled" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function matches(order: Order, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "delivered") return order.status === "DELIVERED";
  if (filter === "cancelled") return order.status === "CANCELLED";
  return order.status !== "DELIVERED" && order.status !== "CANCELLED";
}

/** Everything this account has ordered, straight from `/api/orders/mine`. */
export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await api.myOrders());
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async (order: Order) => {
    setCancelling(order.id);
    try {
      const updated = await api.cancelOrder(order.id);
      setOrders((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      toast("Order cancelled", {
        description:
          updated.paymentState === "REFUNDED"
            ? "The payment was refunded."
            : "No payment was captured.",
      });
    } catch (cause) {
      toast("Could not cancel", { description: describeError(cause) });
    } finally {
      setCancelling(null);
    }
  };

  const visible = useMemo(
    () => orders.filter((order) => matches(order, filter)),
    [orders, filter],
  );

  const counts = useMemo(
    () => ({
      active: orders.filter((order) => matches(order, "active")).length,
      delivered: orders.filter((order) => matches(order, "delivered")).length,
      cancelled: orders.filter((order) => matches(order, "cancelled")).length,
      all: orders.length,
    }),
    [orders],
  );

  return (
    <AppLayout
      title="Your orders"
      subtitle={`${counts.all} order${counts.all === 1 ? "" : "s"} placed`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/restaurants">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">New order</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:grid-cols-4">
            {FILTERS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="cursor-pointer gap-2"
              >
                {option.label}
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                  {counts[option.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
            <Receipt className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {filter === "active"
                ? "No orders in flight"
                : `No ${filter} orders yet`}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Orders you place appear here with their live status and payment
              state.
            </p>
            <Button asChild className="gap-2">
              <Link to="/restaurants">
                Browse kitchens
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((order, index) => {
              const cancellable = ORDER_FLOW[order.status].includes("CANCELLED");
              return (
                <motion.article
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                  className="rounded-xl border bg-card p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{order.id}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <PaymentStateBadge
                          state={order.paymentState}
                          method={order.paymentMethod}
                        />
                      </div>
                      <h3 className="mt-2 text-base font-bold tracking-tight">
                        {order.restaurantName}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.items.length} item
                        {order.items.length === 1 ? "" : "s"} ·{" "}
                        {order.items
                          .slice(0, 3)
                          .map((item) => `${item.quantity}× ${item.itemName}`)
                          .join(", ")}
                        {order.items.length > 3 ? " …" : ""}
                      </p>
                      <OrderMetaLine order={order} />
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-lg font-bold tracking-tight">
                        {formatMoney(order.totalAmount)}
                      </span>
                      <div className="flex items-center gap-2">
                        {cancellable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-destructive"
                            disabled={cancelling === order.id}
                            onClick={() => void handleCancel(order)}
                          >
                            {cancelling === order.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                            Cancel
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="outline" className="gap-2">
                          <Link to={`/orders/${order.id}`}>
                            Track
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
