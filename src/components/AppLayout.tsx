import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  RotateCcw,
  ShoppingBag,
  Store,
  Truck,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/context/CartContext";
import { gatewayUrl, useBackendMode } from "@/lib/api";
import { resetDemoBackend } from "@/lib/demo-backend";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL: Role[] = ["CUSTOMER", "RESTAURANT_ADMIN", "ADMIN", "DELIVERY_AGENT"];
const STAFF: Role[] = ["RESTAURANT_ADMIN", "ADMIN"];
const COURIER: Role[] = ["DELIVERY_AGENT", "ADMIN"];

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { to: "/restaurants", label: "Browse kitchens", icon: Store, roles: ALL },
  { to: "/checkout", label: "Checkout", icon: ShoppingBag, roles: ALL },
  { to: "/admin", label: "Kitchen console", icon: ChefHat, roles: STAFF },
  { to: "/fulfillment", label: "Dispatch board", icon: Truck, roles: COURIER },
];

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  RESTAURANT_ADMIN: "Restaurant admin",
  ADMIN: "Platform admin",
  DELIVERY_AGENT: "Delivery agent",
};

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-lg">
        🛎️
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight">CraveDash</span>
        <span className="text-[11px] text-muted-foreground">
          Mobility Services
        </span>
      </span>
    </Link>
  );
}

function BackendStatus() {
  const mode = useBackendMode();
  const live = mode === "live";

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        {live ? (
          <Wifi className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <WifiOff className="size-3.5 text-amber-600 dark:text-amber-400" />
        )}
        {mode === "checking"
          ? "Checking gateway…"
          : live
            ? "Live microservices"
            : "Offline demo data"}
      </div>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
        {live
          ? "Requests flow through the API Gateway to the Spring Boot services."
          : `Gateway at ${gatewayUrl} is unreachable, so seeded local data is used. Start the stack to switch automatically.`}
      </p>
      {!live && mode !== "checking" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full gap-2"
          onClick={() => {
            resetDemoBackend();
            toast("Demo data reset", {
              description: "Orders, menus and accounts are back to the seed.",
            });
          }}
        >
          <RotateCcw className="size-3.5" />
          Reset demo data
        </Button>
      ) : null}
    </div>
  );
}

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = () => {
    signOut();
    toast("Signed out");
    navigate("/");
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )
          }
        >
          <item.icon className="size-4" />
          {item.label}
          {item.to === "/checkout" && itemCount > 0 ? (
            <span className="ml-auto rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-semibold">
              {itemCount}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarBody = (
    <div className="flex h-full flex-col gap-5 p-4">
      <Brand onNavigate={() => setDrawerOpen(false)} />
      <Separator />
      {nav}
      <div className="mt-auto flex flex-col gap-3">
        <BackendStatus />
        <Separator />
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {user?.name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {user ? ROLE_LABEL[user.role] : ""}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Sign out"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r lg:block">
          {sidebarBody}
        </aside>

        <AnimatePresence>
          {drawerOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {drawerOpen ? (
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-background lg:hidden"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-3"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-4" />
              </Button>
              {sidebarBody}
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {actions}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate("/checkout")}
              >
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">Cart</span>
                {itemCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {itemCount}
                  </span>
                ) : null}
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-auto w-full max-w-5xl"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
