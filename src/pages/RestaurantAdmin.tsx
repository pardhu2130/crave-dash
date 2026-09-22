import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChefHat,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import {
  formatDateTime,
  formatMoney,
  type MenuItem,
  type MenuItemPayload,
  type Order,
  type OrderStatus,
  type Restaurant,
  type RestaurantPayload,
} from "@/lib/types";

/** Only the kitchen owns these transitions; pickup and delivery are the courier's. */
const KITCHEN_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY_FOR_PICKUP",
};

const KITCHEN_ACTIVE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
];

const EMPTY_RESTAURANT: RestaurantPayload = {
  name: "",
  description: "",
  address: "",
  phone: "",
  email: "",
  active: true,
};

const EMPTY_ITEM: MenuItemPayload = {
  name: "",
  description: "",
  price: 0,
  category: "",
  available: true,
};

/**
 * Restaurant partner console: publish the listing, manage the menu and work the
 * ticket queue. Talks to restaurant-service (`/api/restaurants/**`) plus the
 * order-service queue for this kitchen.
 */
export default function RestaurantAdmin() {
  const { user, hasRole } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [restaurantDraft, setRestaurantDraft] =
    useState<RestaurantPayload>(EMPTY_RESTAURANT);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(
    null,
  );

  const [itemOpen, setItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<MenuItemPayload>(EMPTY_ITEM);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const allowed = hasRole("RESTAURANT_ADMIN", "ADMIN");

  const loadMenuAndOrders = useCallback(async (restaurantId: number) => {
    const [menuItems, restaurantOrders] = await Promise.all([
      api.getMenu(restaurantId),
      api.ordersForRestaurant(restaurantId),
    ]);
    setMenu(menuItems);
    setOrders(restaurantOrders);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await api.myRestaurants();
      setRestaurants(mine);
      const first = mine[0]?.id ?? null;
      setSelectedId((current) => {
        const next = current && mine.some((r) => r.id === current) ? current : first;
        return next;
      });
      if (first) await loadMenuAndOrders(first);
      else {
        setMenu([]);
        setOrders([]);
      }
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [loadMenuAndOrders]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const selected = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedId) ?? null,
    [restaurants, selectedId],
  );

  const queue = useMemo(
    () => orders.filter((order) => KITCHEN_ACTIVE.includes(order.status)),
    [orders],
  );

  const revenue = useMemo(
    () =>
      orders
        .filter((order) => order.paymentState === "PAID")
        .reduce((sum, order) => sum + order.totalAmount, 0),
    [orders],
  );

  async function pickRestaurant(id: number) {
    setSelectedId(id);
    setLoading(true);
    try {
      await loadMenuAndOrders(id);
    } catch (cause) {
      toast("Could not load that kitchen", {
        description: describeError(cause),
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId(-1);
    try {
      const payload: RestaurantPayload = {
        ...restaurantDraft,
        name: restaurantDraft.name.trim(),
        address: restaurantDraft.address.trim(),
      };
      if (editingRestaurant) {
        await api.updateRestaurant(editingRestaurant.id, payload);
        toast("Listing updated");
      } else {
        const created = await api.createRestaurant(payload);
        toast("Kitchen published", { description: created.name });
        setSelectedId(created.id);
      }
      setRestaurantOpen(false);
      setEditingRestaurant(null);
      setRestaurantDraft(EMPTY_RESTAURANT);
      await load();
    } catch (cause) {
      toast("Could not save the listing", {
        description: describeError(cause),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function submitItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusyId(-2);
    try {
      const payload: MenuItemPayload = {
        ...itemDraft,
        name: itemDraft.name.trim(),
        price: Number(itemDraft.price),
      };
      if (editingItem) {
        const updated = await api.updateMenuItem(selected.id, editingItem.id, payload);
        setMenu((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        toast("Dish updated", { description: updated.name });
      } else {
        const created = await api.addMenuItem(selected.id, payload);
        setMenu((current) => [...current, created]);
        toast("Dish added", { description: created.name });
      }
      setItemOpen(false);
      setEditingItem(null);
      setItemDraft(EMPTY_ITEM);
    } catch (cause) {
      toast("Could not save the dish", { description: describeError(cause) });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAvailability(item: MenuItem, available: boolean) {
    if (!selected) return;
    setBusyId(item.id);
    try {
      const updated = await api.setAvailability(selected.id, item.id, available);
      setMenu((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      toast(available ? "Back on sale" : "Marked sold out", {
        description: updated.name,
      });
    } catch (cause) {
      toast("Availability not changed", {
        description: describeError(cause),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item: MenuItem) {
    if (!selected) return;
    setBusyId(item.id);
    try {
      await api.deleteMenuItem(selected.id, item.id);
      setMenu((current) => current.filter((candidate) => candidate.id !== item.id));
      toast("Dish removed", { description: item.name });
    } catch (cause) {
      toast("Could not remove the dish", {
        description: describeError(cause),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function advance(order: Order, next: OrderStatus) {
    setBusyId(order.id);
    try {
      const updated = await api.updateOrderStatus(order.id, next);
      setOrders((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      toast(`#${order.id} → ${next.replaceAll("_", " ").toLowerCase()}`);
    } catch (cause) {
      toast("Status not changed", { description: describeError(cause) });
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(order: Order) {
    setBusyId(order.id);
    try {
      const updated = await api.cancelOrder(order.id, "Cancelled by the kitchen");
      setOrders((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      toast(`#${order.id} cancelled`, {
        description: "payment-service refunds a captured charge.",
      });
    } catch (cause) {
      toast("Could not cancel", { description: describeError(cause) });
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <AppLayout title="Kitchen console" subtitle="Restaurant partners only">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <ChefHat className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            This console is for RESTAURANT_ADMIN accounts
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            You are signed in as {user?.role.replace("_", " ").toLowerCase()}.
            Register or sign in with a restaurant admin account to publish a
            kitchen.
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
      title={selected ? selected.name : "Kitchen console"}
      subtitle={
        selected
          ? `${menu.length} dishes · ${queue.length} live tickets`
          : "Publish your first kitchen to start selling"
      }
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
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditingRestaurant(null);
              setRestaurantDraft(EMPTY_RESTAURANT);
              setRestaurantOpen(true);
            }}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New kitchen</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {restaurants.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
            <Store className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No kitchen published yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Create a listing and it becomes visible in the customer directory
              immediately.
            </p>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                setEditingRestaurant(null);
                setRestaurantDraft(EMPTY_RESTAURANT);
                setRestaurantOpen(true);
              }}
            >
              <Plus className="size-4" />
              Publish a kitchen
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="queue">
            <div className="flex flex-wrap items-center gap-3">
              <TabsList>
                <TabsTrigger value="queue" className="cursor-pointer gap-2">
                  Tickets
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                    {queue.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="menu" className="cursor-pointer gap-2">
                  Menu
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                    {menu.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="listing" className="cursor-pointer">
                  Listing
                </TabsTrigger>
              </TabsList>

              {restaurants.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {restaurants.map((restaurant) => (
                    <Button
                      key={restaurant.id}
                      type="button"
                      size="sm"
                      variant={
                        restaurant.id === selectedId ? "default" : "outline"
                      }
                      onClick={() => void pickRestaurant(restaurant.id)}
                    >
                      {restaurant.name}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Tickets */}
            <TabsContent value="queue" className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                  <UtensilsCrossed className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">The queue is clear</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    New orders land here the moment payment is captured.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {queue.map((order, index) => {
                    const next = KITCHEN_NEXT[order.status];
                    return (
                      <motion.article
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: index * 0.03 }}
                        className="rounded-xl border bg-card p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                #{order.id}
                              </span>
                              <OrderStatusBadge status={order.status} />
                              {order.paymentState === "PAID" ? (
                                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                  Paid
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold">
                              {order.customerName} · {formatMoney(order.totalAmount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.deliveryAddress}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDateTime(order.createdAt)}
                              {order.notes ? ` · “${order.notes}”` : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {next ? (
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2"
                                disabled={busyId === order.id}
                                onClick={() => void advance(order, next)}
                              >
                                {busyId === order.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <ArrowRight className="size-3.5" />
                                )}
                                {next.replaceAll("_", " ").toLowerCase()}
                              </Button>
                            ) : (
                              <span className="rounded-lg border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                Waiting for a courier to claim
                              </span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={busyId === order.id}
                              onClick={() => void cancel(order)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>

                        <ul className="mt-4 flex flex-col gap-2 border-t pt-4">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-3">
                              <FoodTile
                                name={item.itemName}
                                className="size-10"
                                emojiClassName="text-lg"
                              />
                              <span className="min-w-0 flex-1 text-sm">
                                {item.quantity} × {item.itemName}
                                {item.specialInstructions ? (
                                  <span className="ml-2 text-[11px] italic text-muted-foreground">
                                    “{item.specialInstructions}”
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-sm font-medium">
                                {formatMoney(item.lineTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Menu */}
            <TabsContent value="menu" className="mt-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Toggle a dish off and it disappears from the customer menu
                    immediately.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    disabled={!selected}
                    onClick={() => {
                      setEditingItem(null);
                      setItemDraft(EMPTY_ITEM);
                      setItemOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add dish
                  </Button>
                </div>

                {menu.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                    No dishes published for this kitchen yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {menu.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
                      >
                        <FoodTile
                          name={item.name}
                          category={item.category}
                          imageUrl={item.imageUrl}
                          className="size-12"
                          emojiClassName="text-xl"
                        />
                        <div className="min-w-[160px] flex-1">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.category || "Uncategorised"} ·{" "}
                            {formatMoney(item.price)}
                          </p>
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>

                        <label className="flex items-center gap-2 text-xs font-medium">
                          <Switch
                            checked={item.available}
                            disabled={busyId === item.id}
                            onCheckedChange={(checked) =>
                              void toggleAvailability(item, checked === true)
                            }
                          />
                          {item.available ? "On sale" : "Sold out"}
                        </label>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => {
                              setEditingItem(item);
                              setItemDraft({
                                name: item.name,
                                description: item.description ?? "",
                                price: item.price,
                                category: item.category ?? "",
                                imageUrl: item.imageUrl ?? "",
                                available: item.available,
                              });
                              setItemOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${item.name}`}
                            disabled={busyId === item.id}
                            onClick={() => void removeItem(item)}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Listing */}
            <TabsContent value="listing" className="mt-6">
              {selected ? (
                <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">
                        {selected.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selected.address}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        selected.active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {selected.active ? "Accepting orders" : "Paused"}
                    </span>
                  </div>

                  <Separator />

                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Orders
                      </dt>
                      <dd className="font-semibold">{orders.length}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Captured revenue
                      </dt>
                      <dd className="font-semibold">{formatMoney(revenue)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Awaiting courier
                      </dt>
                      <dd className="font-semibold">
                        {
                          orders.filter(
                            (order) =>
                              order.status === "READY_FOR_PICKUP" &&
                              !order.deliveryAgentId,
                          ).length
                        }
                      </dd>
                    </div>
                  </dl>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setEditingRestaurant(selected);
                        setRestaurantDraft({
                          name: selected.name,
                          description: selected.description ?? "",
                          address: selected.address,
                          phone: selected.phone ?? "",
                          email: selected.email ?? "",
                          imageUrl: selected.imageUrl ?? "",
                          active: selected.active,
                        });
                        setRestaurantOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit listing
                    </Button>
                    <Button
                      type="button"
                      variant={selected.active ? "outline" : "default"}
                      className="gap-2"
                      disabled={busyId === -1}
                      onClick={async () => {
                        setBusyId(-1);
                        try {
                          const updated = await api.updateRestaurant(selected.id, {
                            name: selected.name,
                            description: selected.description ?? "",
                            address: selected.address,
                            phone: selected.phone ?? "",
                            email: selected.email ?? "",
                            imageUrl: selected.imageUrl ?? "",
                            active: !selected.active,
                          });
                          setRestaurants((current) =>
                            current.map((candidate) =>
                              candidate.id === updated.id ? updated : candidate,
                            ),
                          );
                          toast(
                            updated.active
                              ? "Kitchen is accepting orders again"
                              : "Kitchen paused",
                          );
                        } catch (cause) {
                          toast("Could not update", {
                            description: describeError(cause),
                          });
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {busyId === -1 ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {selected.active ? "Pause orders" : "Resume orders"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Restaurant dialog */}
      <Dialog
        open={restaurantOpen}
        onOpenChange={(open) => {
          setRestaurantOpen(open);
          if (!open) setEditingRestaurant(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRestaurant ? "Edit listing" : "Publish a kitchen"}
            </DialogTitle>
            <DialogDescription>
              Restaurant-service stores this listing, and customers see it in the
              directory straight away.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitRestaurant} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-name">Kitchen name</Label>
              <Input
                id="admin-name"
                required
                value={restaurantDraft.name}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Spice Vault"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-address">Address</Label>
              <Input
                id="admin-address"
                required
                value={restaurantDraft.address}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="14 Lantern Street, SoMa"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-phone">Phone</Label>
                <Input
                  id="admin-phone"
                  value={restaurantDraft.phone ?? ""}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+1 415 555 0101"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-email">Contact email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={restaurantDraft.email ?? ""}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="chef@spicevault.dev"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-description">Description</Label>
              <Textarea
                id="admin-description"
                rows={3}
                value={restaurantDraft.description ?? ""}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Slow-simmered curries and tandoor plates."
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-image">Hero image URL (optional)</Label>
              <Input
                id="admin-image"
                value={restaurantDraft.imageUrl ?? ""}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://…"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={restaurantDraft.active ?? true}
                onCheckedChange={(checked) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    active: checked === true,
                  }))
                }
              />
              Accepting orders
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRestaurantOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busyId === -1}>
                {busyId === -1 ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {editingRestaurant ? "Save listing" : "Publish kitchen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Menu item dialog */}
      <Dialog
        open={itemOpen}
        onOpenChange={(open) => {
          setItemOpen(open);
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit dish" : "Add a dish"}</DialogTitle>
            <DialogDescription>
              Prices are stored to the cent and validated again when an order is
              placed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitItem} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name">Dish name</Label>
              <Input
                id="item-name"
                required
                value={itemDraft.name}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Butter Chicken"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="item-price">Price (USD)</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={itemDraft.price}
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      price: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="item-category">Category</Label>
                <Input
                  id="item-category"
                  value={itemDraft.category ?? ""}
                  onChange={(event) =>
                    setItemDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Curry"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                rows={3}
                value={itemDraft.description ?? ""}
                onChange={(event) =>
                  setItemDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Tandoor chicken folded into tomato-fenugreek cream."
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="item-image">Image URL (optional)</Label>
              <Input
                id="item-image"
                value={itemDraft.imageUrl ?? ""}
                onChange={(event) =>
                  setItemDraft((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://…"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={itemDraft.available ?? true}
                onCheckedChange={(checked) =>
                  setItemDraft((current) => ({
                    ...current,
                    available: checked === true,
                  }))
                }
              />
              Available for sale
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busyId === -2}>
                {busyId === -2 ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {editingItem ? "Save dish" : "Add dish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
