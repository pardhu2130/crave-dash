import {
  CheckCircle2,
  Circle,
  CircleDot,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  ORDER_STATUS_META,
  PAYMENT_STATE_META,
  TRACK,
  type Order,
  type OrderStatus,
  type PaymentState,
} from "@/lib/types";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        meta.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function PaymentStateBadge({
  state,
  method,
  className,
}: {
  state: PaymentState;
  method?: string;
  className?: string;
}) {
  const meta = PAYMENT_STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.badge,
        className,
      )}
    >
      {meta.label}
      {method ? <span className="opacity-60">· {method}</span> : null}
    </span>
  );
}

/** Vertical lifecycle timeline driven by the same state machine as order-service. */
export function OrderTimeline({ order }: { order: Order }) {
  const cancelled = order.status === "CANCELLED";
  const currentIndex = TRACK.indexOf(order.status);

  return (
    <ol className="relative flex flex-col gap-4">
      {TRACK.map((status, index) => {
        const done = !cancelled && index <= currentIndex;
        const active = !cancelled && index === currentIndex;
        return (
          <motion.li
            key={status}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="flex items-start gap-3"
          >
            <span className="mt-0.5 shrink-0">
              {done ? (
                active ? (
                  <CircleDot className="size-5 text-primary" />
                ) : (
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                )
              ) : (
                <Circle className="size-5 text-muted-foreground/40" />
              )}
            </span>
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  done ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {ORDER_STATUS_META[status].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {ORDER_STATUS_META[status].blurb}
              </span>
            </span>
          </motion.li>
        );
      })}

      {cancelled ? (
        <motion.li
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 border-t pt-4"
        >
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-destructive">
              Cancelled
            </span>
            <span className="text-xs text-muted-foreground">
              {order.cancellationReason || "Cancelled"}
              {order.paymentState === "REFUNDED"
                ? " · payment refunded"
                : ""}
            </span>
          </span>
        </motion.li>
      ) : null}
    </ol>
  );
}

export function OrderMetaLine({ order }: { order: Order }) {
  return (
    <p className="text-xs text-muted-foreground">
      Placed {formatDateTime(order.createdAt)}
      {order.updatedAt ? ` · updated ${formatDateTime(order.updatedAt)}` : ""}
    </p>
  );
}
