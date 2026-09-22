import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FoodTile } from "@/components/FoodTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useBackendMode } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import type { Restaurant } from "@/lib/types";

/**
 * Kitchen directory. Reads `/api/restaurants` through the gateway (or the
 * offline demo backend) and filters in memory so typing stays instant.
 */
export default function Restaurants() {
  const mode = useBackendMode();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listRestaurants();
      setRestaurants(list);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return restaurants;
    return restaurants.filter((restaurant) =>
      [restaurant.name, restaurant.description ?? "", restaurant.address]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [restaurants, search]);

  return (
    <AppLayout
      title="Browse kitchens"
      subtitle={`${restaurants.length} partners accepting orders`}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by kitchen, dish or neighbourhood"
            className="pl-9"
            aria-label="Search restaurants"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
            <Store className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No kitchens match that search</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Try a different name or neighbourhood. Restaurant partners publish
              themselves from the kitchen console.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((restaurant, index) => (
              <motion.article
                key={restaurant.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                whileHover={{ y: -3 }}
                className="flex flex-col rounded-xl border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <FoodTile
                    name={restaurant.name}
                    category={restaurant.name}
                    imageUrl={restaurant.imageUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold tracking-tight">
                      {restaurant.name}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      <span className="truncate">{restaurant.address}</span>
                    </p>
                    {restaurant.phone ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {restaurant.phone}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {restaurant.description || "Menu published by the kitchen."}
                </p>

                <Button asChild className="mt-4 w-full gap-2">
                  <Link to={`/restaurants/${restaurant.id}`}>
                    View menu
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </motion.article>
            ))}
          </div>
        )}

        {mode === "demo" ? (
          <p className="text-xs text-muted-foreground">
            The API gateway is unreachable, so these kitchens come from the
            seeded local dataset. Start the Spring stack to switch to live data
            automatically.
          </p>
        ) : null}
      </div>
    </AppLayout>
  );
}
