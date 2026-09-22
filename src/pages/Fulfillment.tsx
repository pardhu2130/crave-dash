import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  formatDateTime,
  formatMoney,
  type Order,
  type OrderStats,
} from "@/lib/types";

/**
 * Dispatch board for couriers: claim a packed order, start the run and close it
 * out. Anything else is refused by the order-service state machine.
 */
export default function Fulfillment() {
  const { user, hasRole } = useAuth();

  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = hasRole("DELIVERY_AGENT", "ADMIN");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [pool, assigned, network] = await Promise.all([
        api.availableDeliveries(),
        api.myDeliveries(),
        api.stats(),
      ]);
      setAvailable(pool);
      setMine(assigned);
      setStats(network);
      setError(null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    const timer = window.setInterval(() => void load(true), 25000);
    return () => window.clearInterval(timer);
  }, [allowed, load]);

  const openRuns = useMemo(
    () => mine.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED"),
    [mine],
  );
  const completedRuns = useMemo(
    () => mine.filter((order) => order.status === "DELIVERED"),
    [mine],
  );
  const earnings = useMemo(
    () => completedRuns.reduce((sum, order) => sum + order.totalAmount, 0),
    [completedRuns],
  );

  async function claim(order: Order) {
    setBusyId(order.id);
    try {
      const updated = await api.claimOrder(order.id);
      setAvailable((current) => current.filter((candidate) => candidate.id !== order.id));
      setMine((current) => [updated, ...current]);
      toast(`Claimed #${order.id}`, {
        description: `${order.restaurantName} · ${order.deliveryAddress}`,
      });
    } catch (cause) {
      toast("Could not claim that order", { description: describeError(cause) });
    } finally {
      setBusyId(null);
    }
  }

  async function advance(order: Order) {
    const next = order.status === "READY_FOR_PICKUP" ? "OUT_FOR_DELIVERY" : "DELIVERED";
    setBusyId(order.id);
    try {
      const updated = await api.updateOrderStatus(order.id, next);
      setMine((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      toast(next === "DELIVERED" ? `#${order.id} delivered` : `#${order.id} picked up`);
    } catch (cause) {
      toast("Status not changed", { description: describeError(cause) });
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <AppLayout title="Dispatch board" subtitle="Couriers only">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <Truck className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            This board is for DELIVERY_AGENT accounts
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            You are signed in as {user?.role.replace("_", " ").toLowerCase()}.
            Register a delivery agent account to claim runs.
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard">
              Back to your dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Dispatch board"
      subtitle={`${available.length} ready to claim · ${openRuns.length} on your run`}
      actions={
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
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Bike, label: "Ready to claim", value: String(available.length) },
            { icon: Truck, label: "On your run", value: String(openRuns.length) },
            { icon: PackageCheck, label: "Delivered by you", value: String(completedRuns.length) },
            { icon: Users, label: "Network orders", value: stats ? String(stats.totalOrders) : "—" },
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

        <Tabs defaultValue="available">
          <TabsList>
            <TabsTrigger value="available" className="cursor-pointer gap-2">
              Ready to claim
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                {available.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="mine" className="cursor-pointer gap-2">
              My runs
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                {openRuns.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="cursor-pointer">
              History
            </TabsTrigger>
          </TabsList>

          {/* Available */}
          <TabsContent value="available" className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : available.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                <Bike className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No packed orders waiting</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Orders appear here as soon as a kitchen marks them ready for
                  pickup.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {available.map((order, index) => (
                  <motion.article
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                    className="flex flex-col rounded-xl border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{order.id}
                          </span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <h3 className="mt-2 text-base font-bold tracking-tight">
                          {order.restaurantName}
                        </h3>
                        <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 size-3.5 shrink-0" />
                          {order.deliveryAddress}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="size-3.5" />
                          {order.customerName}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold">
                        {formatMoney(order.totalAmount)}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-[11px] text-muted-foreground">
                      {order.items
                        .map((item) => `${item.quantity}× ${item.itemName}`)
                        .join(", ")}
                      {order.notes ? ` · “${order.notes}”` : ""}
                    </p>

                    <Button
                      type="button"
                      className="mt-4 w-full gap-2"
                      disabled={busyId === order.id}
                      onClick={() => void claim(order)}
                    >
                      {busyId === order.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Bike className="size-4" />
                      )}
                      Claim this run
                    </Button>
                  </motion.article>
                ))}
              </div>
            )}
          </TabsContent>

          {/* My runs */}
          <TabsContent value="mine" className="mt-6">
            {openRuns.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                <Truck className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Nothing on your run</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Claim a packed order and it moves here until you deliver it.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {openRuns.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5"
                  >
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{order.id}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="mt-2 text-sm font-semibold">
                        {order.restaurantName} → {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.deliveryAddress}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Placed {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={busyId === order.id}
                      onClick={() => void advance(order)}
                    >
                      {busyId === order.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {order.status === "READY_FOR_PICKUP"
                        ? "Picked up"
                        : "Mark delivered"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-6">
            {completedRuns.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                Completed deliveries will be listed here.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {completedRuns.length} deliveries · {formatMoney(earnings)}{" "}
                  collected from customers
                </p>
                {completedRuns.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
                  >
                    <div className="min-w-[200px] flex-1">
                      <p className="text-sm font-semibold">
                        #{order.id} · {order.restaurantName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName} ·{" "}
                        {formatDateTime(order.updatedAt ?? order.createdAt)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold">
                      {formatMoney(order.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
