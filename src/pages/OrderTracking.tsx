import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bike,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import {
  OrderStatusBadge,
  OrderTimeline,
  PaymentStateBadge,
} from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  ORDER_FLOW,
  ORDER_STATUS_META,
  formatDateTime,
  formatMoney,
  type Order,
  type Payment,
} from "@/lib/types";

/** Live tracking for one order, re-read from the gateway every 20 seconds. */
export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const id = Number(orderId);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!Number.isFinite(id)) {
        setError("That order id is not valid.");
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const data = await api.getOrder(id);
        setOrder(data);
        setError(null);
        api
          .paymentForOrder(id)
          .then(setPayment)
          .catch(() => setPayment(null));
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleCancel = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const updated = await api.cancelOrder(
        order.id,
        reason.trim() || "Cancelled by customer",
      );
      setOrder(updated);
      setReason("");
      toast("Order cancelled", {
        description:
          updated.paymentState === "REFUNDED"
            ? "payment-service refunded the charge."
            : "No payment was captured.",
      });
      void load(true);
    } catch (cause) {
      toast("Could not cancel", { description: describeError(cause) });
    } finally {
      setBusy(false);
    }
  };

  const canCancel = order ? ORDER_FLOW[order.status].includes("CANCELLED") : false;
  const isOwner = order && user ? order.customerId === user.id : false;

  return (
    <AppLayout
      title={order ? `Order #${order.id}` : "Order"}
      subtitle={order?.restaurantName}
      actions={
        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/orders")}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">All orders</span>
          </Button>
        </div>
      }
    >
      {loading && !order ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !order ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            {error ?? "This order could not be loaded."}
          </p>
          <Button asChild variant="outline">
            <Link to="/orders">Back to your orders</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="cravedash-ember rounded-2xl border p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <PaymentStateBadge
                    state={order.paymentState}
                    method={order.paymentMethod}
                  />
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  {ORDER_STATUS_META[order.status].label}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {ORDER_STATUS_META[order.status].blurb}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Placed {formatDateTime(order.createdAt)}
                  {order.updatedAt
                    ? ` · last update ${formatDateTime(order.updatedAt)}`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total charged
                </p>
                <p className="text-2xl font-bold tracking-tight">
                  {formatMoney(order.totalAmount)}
                </p>
                {order.transactionId ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {order.transactionId}
                  </p>
                ) : null}
              </div>
            </div>

            {order.status === "CANCELLED" ? (
              <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {order.cancellationReason || "Cancelled"}
              </p>
            ) : null}
          </motion.section>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Timeline */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-xl border bg-card p-5"
            >
              <h3 className="text-base font-bold tracking-tight">Progress</h3>
              <div className="mt-5">
                <OrderTimeline order={order} />
              </div>
            </motion.section>

            <div className="flex flex-col gap-6">
              {/* Line items */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="rounded-xl border bg-card p-5"
              >
                <h3 className="flex items-center gap-2 text-base font-bold tracking-tight">
                  <Receipt className="size-4 text-primary" />
                  What was ordered
                </h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <FoodTile
                        name={item.itemName}
                        className="size-12"
                        emojiClassName="text-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {item.quantity} × {item.itemName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(item.unitPrice)} each
                        </p>
                        {item.specialInstructions ? (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                            “{item.specialInstructions}”
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold">
                        {formatMoney(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Separator className="my-5" />

                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium">{formatMoney(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="font-medium">
                      {order.deliveryFee === 0
                        ? "Free"
                        : formatMoney(order.deliveryFee)}
                    </dd>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-base">
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-bold">{formatMoney(order.totalAmount)}</dd>
                  </div>
                </dl>
              </motion.section>

              {/* Delivery */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="rounded-xl border bg-card p-5"
              >
                <h3 className="text-base font-bold tracking-tight">Delivery</h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm">
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                        Address
                      </span>
                      {order.deliveryAddress}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <UserIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                        Recipient
                      </span>
                      {order.customerName}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Bike className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                        Courier
                      </span>
                      {order.deliveryAgentName ??
                        (order.deliveryAgentId
                          ? `Agent #${order.deliveryAgentId}`
                          : "Waiting for a courier to claim it")}
                    </span>
                  </li>
                  {order.notes ? (
                    <li className="flex items-start gap-3">
                      <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                          Your notes
                        </span>
                        {order.notes}
                      </span>
                    </li>
                  ) : null}
                  {payment ? (
                    <li className="flex items-start gap-3">
                      <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                          Payment
                        </span>
                        {payment.paymentMethod} · {payment.paymentStatus} ·{" "}
                        {formatMoney(payment.amount)}
                      </span>
                    </li>
                  ) : null}
                </ul>

                {isOwner && canCancel ? (
                  <div className="mt-5 flex flex-col gap-3 border-t pt-5">
                    <p className="text-xs text-muted-foreground">
                      Changed your mind? Cancelling before the kitchen confirms
                      refunds the payment.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Reason (optional)"
                        className="h-9 min-w-[180px] flex-1 text-sm"
                        disabled={busy}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 text-destructive"
                        disabled={busy}
                        onClick={() => void handleCancel()}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <XCircle className="size-4" />
                        )}
                        Cancel order
                      </Button>
                    </div>
                  </div>
                ) : null}
              </motion.section>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
