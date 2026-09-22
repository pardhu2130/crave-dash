import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChefHat,
  Clock,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { FoodTile } from "@/components/FoodTile";
import {
  ORDER_STATUS_META,
  formatMoney,
  type OrderStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    name: "service-registry",
    port: 8761,
    emoji: "🧭",
    detail: "Eureka server. Every service registers here; nothing is hardcoded.",
  },
  {
    name: "api-gateway",
    port: 8080,
    emoji: "🚪",
    detail:
      "One public entry point. Validates the JWT filter and routes with lb://.",
  },
  {
    name: "auth-service",
    port: 8081,
    emoji: "🔐",
    detail: "BCrypt accounts, JWT issuing and the four CraveDash roles.",
  },
  {
    name: "restaurant-service",
    port: 8082,
    emoji: "🍽️",
    detail: "Kitchen listings, menus and live availability toggles.",
  },
  {
    name: "order-service",
    port: 8083,
    emoji: "🧾",
    detail:
      "Prices the basket, enforces the lifecycle, calls the others with OpenFeign.",
  },
  {
    name: "payment-service",
    port: 8084,
    emoji: "💳",
    detail: "Charges, transaction ids and refunds for cancelled orders.",
  },
];

const LIFECYCLE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const PERSONAS = [
  {
    icon: ShoppingBag,
    title: "Customers",
    copy: "Browse live kitchens, build a basket priced to the cent, pay, then follow every hand-off until the doorbell rings.",
    points: [
      "Menus with sold-out items removed in real time",
      "Free delivery once the basket clears $30",
      "Order timeline with cancellation and refunds",
    ],
  },
  {
    icon: ChefHat,
    title: "Restaurant partners",
    copy: "Publish a menu, flip dishes in and out of stock, and push tickets through the kitchen from one console.",
    points: [
      "Menu CRUD with per-item availability",
      "Live ticket queue per kitchen",
      "Confirm, prepare and hand off to a courier",
    ],
  },
  {
    icon: Truck,
    title: "Couriers & dispatch",
    copy: "Claim packed orders, start the run, and close the loop with a delivered timestamp on the shared board.",
    points: [
      "Unassigned ready-order queue",
      "One-tap claim and pickup",
      "Network stats for operations",
    ],
  },
];

const QUOTES = [
  {
    name: "Maya Chen",
    role: "Regular customer",
    quote:
      "I can see the second the kitchen starts cooking. The timeline is more accurate than the phone calls I used to make.",
  },
  {
    name: "Ravi Patel",
    role: "Spice Vault",
    quote:
      "Marking a dish sold out takes one tap, and the ticket lands on my board the moment someone pays.",
  },
  {
    name: "Nora Silva",
    role: "Delivery agent",
    quote:
      "Packed orders show up in the dispatch queue with the address already attached. I claim one and go.",
  },
];

const STATS = [
  { icon: Zap, label: "Services in the mesh", value: "6" },
  { icon: Users, label: "Role types supported", value: "4" },
  { icon: Clock, label: "Dispatch target", value: "< 30 min" },
  { icon: CreditCard, label: "Flat delivery fee", value: "$2.99" },
];

/** Live-looking order card that cycles through the real lifecycle states. */
function LiveOrderCard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % LIFECYCLE.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  const status = LIFECYCLE[index];
  const meta = ORDER_STATUS_META[status];
  const progress = ((index + 1) / LIFECYCLE.length) * 100;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Order #1042
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            meta.badge,
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <FoodTile name="Butter Chicken" category="Curry" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Butter Chicken</p>
          <p className="text-xs text-muted-foreground">
            Spice Vault · No onions · Medium heat
          </p>
        </div>
        <span className="ml-auto text-sm font-semibold">{formatMoney(31.4)}</span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{meta.blurb}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
        {[
          { label: "Courier", value: "Nora S." },
          { label: "ETA", value: "18 min" },
          { label: "Payment", value: "Card" },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="text-sm font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const primaryTo = isAuthenticated
    ? user?.role === "DELIVERY_AGENT"
      ? "/fulfillment"
      : user?.role === "RESTAURANT_ADMIN"
        ? "/admin"
        : "/dashboard"
    : "/auth?returnTo=/restaurants";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
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

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {[
              { href: "#network", label: "Network" },
              { href: "#services", label: "Services" },
              { href: "#voices", label: "Voices" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {!isAuthenticated ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" className="gap-2">
              <Link to={primaryTo}>
                {isAuthenticated ? "Go to dashboard" : "Start an order"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="cravedash-ember relative overflow-hidden border-b">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col justify-center"
          >
            <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5 text-primary" />
              Spring Boot microservices · Eureka · Gateway · JWT
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Dinner dispatched like a
              <span className="text-primary"> logistics network</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              CraveDash connects customers, kitchens and couriers on one event
              flow. Orders are priced by the order service, charged by the
              payment service and tracked from the first tap to the delivered
              timestamp — each hop authenticated at the gateway.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to={primaryTo}>
                  {isAuthenticated ? "Open your dashboard" : "Order something"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <a href="#services">
                  See the service mesh
                  <PackageCheck className="size-4" />
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> BCrypt + JWT on every route
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3.5" /> Eureka service discovery
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-3.5" /> Load-balanced Feign calls
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="flex items-center"
          >
            <LiveOrderCard />
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border bg-background">
                <stat.icon className="size-4 text-primary" />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-bold tracking-tight">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section id="network" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="max-w-2xl"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Three sides of one flow
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every role signs in through the same auth service and sees only the
            part of the network it owns.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PERSONAS.map((persona, index) => (
            <motion.article
              key={persona.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col rounded-xl border bg-card p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                <persona.icon className="size-5 text-primary" />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">
                {persona.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {persona.copy}
              </p>
              <ul className="mt-4 flex flex-col gap-2 border-t pt-4 text-sm">
                {persona.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="relative overflow-hidden border-t">
        <div className="cravedash-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Six Spring Boot services, one Maven project each
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Import every folder from <span className="font-mono text-sm">backend/</span>{" "}
            into IntelliJ or VS Code as an existing Maven project, start the
            registry first, and the mesh finds itself.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, index) => (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="rounded-xl border bg-card/90 p-5 backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{service.emoji}</span>
                  <span className="font-mono text-sm font-semibold">
                    {service.name}
                  </span>
                  <span className="ml-auto rounded-md border bg-muted px-2 py-0.5 font-mono text-[11px]">
                    :{service.port}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {service.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voices */}
      <section id="voices" className="border-y bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            From the three sides
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {QUOTES.map((quote, index) => (
              <motion.figure
                key={quote.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="flex flex-col rounded-xl border bg-background p-6"
              >
                <blockquote className="text-sm leading-6">
                  “{quote.quote}”
                </blockquote>
                <figcaption className="mt-4 border-t pt-4">
                  <span className="block text-sm font-semibold">
                    {quote.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {quote.role}
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="cravedash-ember rounded-2xl border p-8 text-center sm:p-12"
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to place the first order?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Sign in as a customer, a kitchen admin or a courier. The same build
            serves all four roles, and the gateway keeps them apart.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to={primaryTo}>
                {isAuthenticated ? "Go to dashboard" : "Create an account"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have one</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            CraveDash Mobility Services — Spring Boot, PostgreSQL, React and
            Vite.
          </span>
          <span>
            Preview data is local when the API gateway at
            http://localhost:8080 is offline.
          </span>
        </div>
      </footer>
    </div>
  );
}
