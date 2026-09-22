import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api, useBackendMode } from "@/lib/api";
import { describeError } from "@/lib/api-client";
import { DEMO_PASSWORD } from "@/lib/demo-seed";
import type { Role } from "@/lib/types";

interface AuthProps {
  redirectAfterAuth?: string;
}

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "CUSTOMER", label: "Customer", hint: "Order from kitchens" },
  { value: "RESTAURANT_ADMIN", label: "Restaurant admin", hint: "Run a kitchen" },
  { value: "DELIVERY_AGENT", label: "Delivery agent", hint: "Deliver orders" },
  { value: "ADMIN", label: "Platform admin", hint: "Watch the network" },
];

function resolveRedirect(returnTo: string | null, fallback?: string): string {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback ?? "/dashboard";
}

function Auth({ redirectAfterAuth }: AuthProps) {
  const { isLoading: authLoading, isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useBackendMode();
  const redirect = resolveRedirect(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [tab, setTab] = useState("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("CUSTOMER");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const session = await login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      toast(`Welcome back, ${session.name.split(" ")[0]}`);
      navigate(redirect, { replace: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const session = await register({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        role,
      });
      toast("Account created", {
        description: `Signed in as ${session.email}`,
      });
      navigate(redirect, { replace: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setPending(false);
    }
  };

  const quickSignIn = async (email: string) => {
    setPending(true);
    setError(null);
    try {
      await login({ email, password: DEMO_PASSWORD });
      toast("Signed in", { description: email });
      navigate(redirect, { replace: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
        {/* Story panel */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="hidden flex-col lg:flex"
        >
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-xl">
              🛎️
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight">
                CraveDash
              </span>
              <span className="text-xs text-muted-foreground">
                Mobility Services
              </span>
            </span>
          </Link>

          <h1 className="mt-10 text-4xl font-bold leading-tight tracking-tight">
            One account,
            <br />
            <span className="text-primary">four ways to work</span> the network.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            The auth service hashes your password with BCrypt and issues a JWT
            carrying your user id, email and role. The gateway validates it on
            every call, so each role only reaches its own part of CraveDash.
          </p>

          <ul className="mt-8 flex flex-col gap-4 text-sm">
            {[
              {
                icon: ShieldCheck,
                title: "JWT at the edge",
                copy: "Unsigned or expired tokens never reach a service.",
              },
              {
                icon: Utensils,
                title: "Role-aware surfaces",
                copy: "Customers order, kitchens cook, couriers deliver.",
              },
              {
                icon: LockKeyhole,
                title: "Nothing plain-text",
                copy: "Passwords are stored as BCrypt hashes only.",
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
                  <item.icon className="size-4 text-primary" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-muted-foreground">
                    {item.copy}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mx-auto w-full max-w-md"
        >
          <Card className="border-border/70">
            <CardHeader>
              <Link
                to="/"
                className="mb-2 flex items-center gap-3 lg:hidden"
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-lg">
                  🛎️
                </span>
                <span className="text-sm font-bold tracking-tight">
                  CraveDash
                </span>
              </Link>
              <CardTitle className="text-xl tracking-tight">
                Sign in to CraveDash
              </CardTitle>
              <CardDescription>
                {mode === "demo"
                  ? "The gateway is offline, so these accounts live in your browser."
                  : "Use the account you registered against the auth service."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin" className="cursor-pointer">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="cursor-pointer">
                    Create account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-5">
                  <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="you@cravedash.dev"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          name="password"
                          type="password"
                          required
                          minLength={6}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}

                    <Button type="submit" className="w-full gap-2" disabled={pending}>
                      {pending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                      Sign in
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-5">
                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signup-name">Full name</Label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          name="name"
                          required
                          minLength={2}
                          placeholder="Maya Chen"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          required
                          placeholder="you@cravedash.dev"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signup-phone">Phone (optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-phone"
                          name="phone"
                          placeholder="+1 415 555 0132"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          name="password"
                          type="password"
                          required
                          minLength={6}
                          placeholder="At least 6 characters"
                          className="pl-9"
                          disabled={pending}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Account type</Label>
                      <Select
                        value={role}
                        onValueChange={(value) => setRole(value as Role)}
                        disabled={pending}
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="cursor-pointer"
                            >
                              {option.label}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {option.hint}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}

                    <Button type="submit" className="w-full gap-2" disabled={pending}>
                      {pending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                      Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {mode === "demo" ? (
                <div className="mt-6 border-t pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quick sign-in · local demo data
                  </p>
                  <div className="mt-3 grid gap-2">
                    {api.demoAccounts().map((account) => (
                      <Button
                        key={account.email}
                        type="button"
                        variant="outline"
                        className="h-auto justify-between py-2"
                        disabled={pending}
                        onClick={() => quickSignIn(account.email)}
                      >
                        <span className="flex flex-col items-start">
                          <span className="text-sm font-medium">
                            {account.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {account.email}
                          </span>
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {account.role.replace("_", " ")}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                    Every demo account uses the password{" "}
                    <span className="font-mono">{DEMO_PASSWORD}</span>. Start the
                    Spring services and this list disappears.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to CraveDash keeping your order history
            against your account.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
