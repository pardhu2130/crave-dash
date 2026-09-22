import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Restaurants = lazy(() => import("./pages/Restaurants.tsx"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Orders = lazy(() => import("./pages/Orders.tsx"));
const OrderTracking = lazy(() => import("./pages/OrderTracking.tsx"));
const RestaurantAdmin = lazy(() => import("./pages/RestaurantAdmin.tsx"));
const Fulfillment = lazy(() => import("./pages/Fulfillment.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      {/* CraveDash authenticates against the Spring Boot auth-service (JWT),
          so the app is wrapped in the session + basket providers instead of
          Convex Auth. */}
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                  path="/auth"
                  element={<AuthPage redirectAfterAuth="/dashboard" />}
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth
                      title="Sign in to open your CraveDash workspace"
                      description="Live orders, order history and your basket live here."
                    >
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/restaurants"
                  element={
                    <RequireAuth
                      title="Sign in to browse kitchens"
                      description="Live menus and availability are available to signed-in customers."
                    >
                      <Restaurants />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/restaurants/:restaurantId"
                  element={
                    <RequireAuth
                      title="Sign in to view this menu"
                      description="Add dishes to your basket once you are signed in."
                    >
                      <RestaurantDetail />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <RequireAuth
                      title="Sign in to check out"
                      description="Your basket is saved on this device — sign in to place the order."
                    >
                      <Checkout />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireAuth
                      title="Sign in to see your orders"
                      description="Track every order from the kitchen to your door."
                    >
                      <Orders />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:orderId"
                  element={
                    <RequireAuth
                      title="Sign in to track this order"
                      description="Live order status is only visible to the account that placed it."
                    >
                      <OrderTracking />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth
                      title="Sign in to run your kitchen"
                      description="Menu publishing and the ticket queue are for restaurant partners."
                    >
                      <RestaurantAdmin />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/fulfillment"
                  element={
                    <RequireAuth
                      title="Sign in to open the dispatch board"
                      description="Couriers claim packed orders and close them out here."
                    >
                      <Fulfillment />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </CartProvider>
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
