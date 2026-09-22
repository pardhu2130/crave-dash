import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  FREE_DELIVERY_THRESHOLD,
  formatMoney,
  type MenuItem,
  type Restaurant,
} from "@/lib/types";

interface Draft {
  quantity: number;
  instructions: string;
}

const EMPTY_DRAFT: Draft = { quantity: 1, instructions: "" };

/**
 * Menu for one kitchen. Availability is honoured: sold-out dishes can't be
 * added, because order-service re-validates every line before charging.
 */
export default function RestaurantDetail() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const id = Number(restaurantId);
  const navigate = useNavigate();
  const cart = useCart();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError("That restaurant id is not valid.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [restaurantData, menuData] = await Promise.all([
        api.getRestaurant(id),
        api.getMenu(id),
      ]);
      setRestaurant(restaurantData);
      setMenu(menuData);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const key = item.category?.trim() || "Menu";
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [menu]);

  const draftFor = (itemId: number): Draft => drafts[itemId] ?? EMPTY_DRAFT;

  const setDraft = (itemId: number, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? EMPTY_DRAFT), ...patch },
    }));

  const cartHasThisRestaurant =
    cart.restaurantId === id && cart.lines.length > 0;
  const switchingFrom = cart.restaurantId !== null && cart.restaurantId !== id;

  const handleAdd = (item: MenuItem) => {
    const draft = draftFor(item.id);
    if (!restaurant) return;

    const outcome = cart.addItem(
      restaurant,
      item,
      draft.quantity,
      draft.instructions.trim() || undefined,
    );

    if (outcome === "replaced") {
      toast(`${restaurant.name} basket started`, {
        description: "Your previous basket was from another kitchen.",
      });
    } else {
      toast("Added to basket", {
        description: `${draft.quantity} × ${item.name}`,
      });
    }
    setDrafts((current) => ({ ...current, [item.id]: EMPTY_DRAFT }));
  };

  return (
    <AppLayout
      title={restaurant?.name ?? "Kitchen"}
      subtitle={restaurant?.address}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => navigate("/restaurants")}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">All kitchens</span>
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => navigate("/restaurants")}>
            Back to kitchens
          </Button>
        </div>
      ) : restaurant ? (
        <div className="flex flex-col gap-8">
          {/* Header */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="cravedash-ember rounded-2xl border p-6"
          >
            <div className="flex flex-wrap items-start gap-5">
              <FoodTile
                name={restaurant.name}
                category={restaurant.name}
                imageUrl={restaurant.imageUrl}
                className="size-24"
                emojiClassName="text-5xl"
              />
              <div className="min-w-[220px] flex-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  {restaurant.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {restaurant.description ||
                    "Dishes published by the kitchen, priced to the cent."}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {restaurant.address}
                  </span>
                  {restaurant.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {restaurant.phone}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <ShoppingBag className="size-3.5" />
                    {menu.filter((item) => item.available).length} of {menu.length}{" "}
                    dishes available
                  </span>
                </div>
              </div>
            </div>

            {!restaurant.active ? (
              <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                This kitchen is paused and is not accepting new orders.
              </p>
            ) : null}
          </motion.section>

          {switchingFrom && cart.lines.length > 0 ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              Your basket currently holds dishes from {cart.restaurantName}.
              Orders are single-kitchen, so adding something here starts a fresh
              basket.
            </p>
          ) : null}

          {/* Menu */}
          {grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              This kitchen has not published any dishes yet.
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <section key={category} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold tracking-tight">
                    {category}
                  </h3>
                  <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium">
                    {items.length}
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((item, index) => {
                    const draft = draftFor(item.id);
                    const inCart = cart.hasItem(item.id);
                    return (
                      <motion.article
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: index * 0.03 }}
                        className="flex flex-col rounded-xl border bg-card p-4"
                      >
                        <div className="flex gap-4">
                          <FoodTile
                            name={item.name}
                            category={item.category}
                            imageUrl={item.imageUrl}
                            className="size-14"
                            emojiClassName="text-2xl"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <h4 className="min-w-0 flex-1 text-sm font-semibold">
                                {item.name}
                                {inCart ? (
                                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                    <Check className="size-3" />
                                    In basket
                                  </span>
                                ) : null}
                              </h4>
                              <span className="text-sm font-bold">
                                {formatMoney(item.price)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {item.description || "Prepared to order."}
                            </p>
                          </div>
                        </div>

                        {item.available ? (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <div className="flex items-center rounded-lg border">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Reduce ${item.name}`}
                                onClick={() =>
                                  setDraft(item.id, {
                                    quantity: Math.max(1, draft.quantity - 1),
                                  })
                                }
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <span className="w-8 text-center text-sm font-semibold">
                                {draft.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Add another ${item.name}`}
                                onClick={() =>
                                  setDraft(item.id, {
                                    quantity: Math.min(50, draft.quantity + 1),
                                  })
                                }
                              >
                                <Plus className="size-3.5" />
                              </Button>
                            </div>

                            <Input
                              value={draft.instructions}
                              onChange={(event) =>
                                setDraft(item.id, {
                                  instructions: event.target.value,
                                })
                              }
                              placeholder="Notes for the kitchen (optional)"
                              className="h-8 min-w-[160px] flex-1 text-xs"
                              aria-label={`Kitchen notes for ${item.name}`}
                            />

                            <Button
                              type="button"
                              size="sm"
                              className="gap-2"
                              disabled={!restaurant.active}
                              onClick={() => handleAdd(item)}
                            >
                              <Plus className="size-3.5" />
                              Add
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                            <X className="size-3.5" />
                            Sold out — the kitchen removed this dish from sale
                          </p>
                        )}
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}

      {/* Basket bar */}
      {cart.lines.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 z-20 mt-8"
        >
          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="size-4 text-primary" />
              {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
              {cartHasThisRestaurant ? ` from ${cart.restaurantName}` : ""}
            </span>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="text-sm text-muted-foreground">
              Subtotal{" "}
              <span className="font-semibold text-foreground">
                {formatMoney(cart.subtotal)}
              </span>{" "}
              ·{" "}
              {cart.deliveryFee === 0
                ? "free delivery"
                : `${formatMoney(cart.deliveryFee)} delivery`}
              {cart.deliveryFee > 0
                ? ` (free over ${formatMoney(FREE_DELIVERY_THRESHOLD)})`
                : ""}
            </span>
            <Button asChild className="ml-auto gap-2">
              <Link to="/checkout">
                Go to checkout · {formatMoney(cart.total)}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AppLayout>
  );
}
