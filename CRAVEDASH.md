# CraveDash Mobility Services — run guide

Food ordering and fulfilment across three sides of one flow: **customers**,
**restaurant partners** and **couriers**. Six independent Spring Boot Maven
projects behind a Eureka-backed Spring Cloud Gateway, plus a React + Vite
frontend.

## Repository layout

```
.                       ← frontend (React + Vite + TypeScript + Tailwind + shadcn/ui)
├── index.html
├── package.json
├── vite.config.ts
└── src/                ← pages, components, contexts, api client

backend/                ← every Java service, one folder each
├── service-registry/   ← open any of these on its own in IntelliJ / VS Code
├── api-gateway/
├── auth-service/
├── restaurant-service/
├── order-service/
└── payment-service/
```

The two halves share nothing but HTTP: the frontend talks to `localhost:8080`,
the gateway talks to Eureka. The frontend stays at the repository root because
this project's bundler serves `index.html` from there; the backend is fully
self-contained under `backend/`.

```
frontend (React + Vite) ──▶ api-gateway :8080 ──▶ auth-service        :8081
                                      │            restaurant-service  :8082
                                      │            order-service       :8083
                                      │            payment-service     :8084
                                      └── discovers all of them in service-registry :8761
```

| Project | Port | Database | Responsibility |
| --- | --- | --- | --- |
| `backend/service-registry` | 8761 | — | Netflix Eureka server, the only service registry |
| `backend/api-gateway` | 8080 | — | Single entry point, JWT filter, `lb://` routes, CORS |
| `backend/auth-service` | 8081 | `cravedash_auth` | BCrypt accounts, JWT issue/validate, four roles |
| `backend/restaurant-service` | 8082 | `cravedash_restaurant` | Listings, menus, per-item availability |
| `backend/order-service` | 8083 | `cravedash_order` | Basket pricing, lifecycle state machine, Feign calls |
| `backend/payment-service` | 8084 | `cravedash_payment` | Charges, transaction ids, refunds |

## Prerequisites

- **JDK 17+** (`java -version`)
- **Maven 3.9+** (`mvn -version`)
- **PostgreSQL 14+** running on `localhost:5432`
- **Node 18+** and npm for the frontend

## 1. Create the databases

```sql
CREATE DATABASE cravedash_auth;
CREATE DATABASE cravedash_restaurant;
CREATE DATABASE cravedash_order;
CREATE DATABASE cravedash_payment;
```

Schema is created automatically (`spring.jpa.hibernate.ddl-auto=update`).

## 2. Start the backend, in this order

```bash
# 1 · registry first — every other service registers with it
cd backend/service-registry && mvn spring-boot:run

# 2 · gateway next
cd backend/api-gateway && mvn spring-boot:run

# 3 · the four business services, in any order, each in its own terminal
cd backend/auth-service       && mvn spring-boot:run
cd backend/restaurant-service && mvn spring-boot:run
cd backend/order-service      && mvn spring-boot:run
cd backend/payment-service    && mvn spring-boot:run
```

Eureka should show five registered instances at <http://localhost:8761>.

### Environment variables

Every property has a working local default, so the stack runs with PostgreSQL on
`localhost` and no configuration at all. Override them per service when needed.

| Variable | Services | Default |
| --- | --- | --- |
| `DB_URL` | auth, restaurant, order, payment | `jdbc:postgresql://localhost:5432/<service database>` |
| `DB_USERNAME` / `DB_PASSWORD` | auth, restaurant, order, payment | `postgres` / `postgres` |
| `EUREKA_URL` | all six | `http://localhost:8761/eureka/` |
| `JWT_SECRET` | auth-service, api-gateway | shared development secret — **set the same value on both** in any real deployment |
| `PAYMENT_SUCCESS_RATE` | payment-service | `100` (set lower to simulate declined cards and the refund path) |

`jwt.expiration` (24 h) and the delivery-fee rules live in each service's
`application.properties`.

## 3. Run the backend tests

```bash
cd backend/<any-service> && mvn test
```

Unit tests use JUnit 5 + Mockito; the integration tests drive the real HTTP
layer with `@SpringBootTest` + `MockMvc`, mocking only the downstream Feign
clients so nothing else has to be running.

## 4. Start the frontend

From the repository root:

```bash
npm install     # only needed the first time
npm run dev     # Vite on http://localhost:5173
```

The frontend points at the gateway through `VITE_API_GATEWAY_URL`
(default `http://localhost:8080`). Set it in `.env.local` when the gateway lives
somewhere else.

### Offline demo mode

The UI pings the gateway on boot. If it cannot be reached — the usual case when
you are only previewing the frontend — every screen is served by an in-browser
demo backend (`src/lib/demo-backend.ts`) that applies the same rules as the real
services: single-restaurant baskets, the $30 free-delivery threshold, the order
state machine, refunds and per-role visibility. Data lives in `localStorage` and
can be reset from the sidebar. Start the Spring stack and the app switches to
live microservices automatically — no code change needed.

Seeded demo accounts (password `cravedash`):

| Role | Email |
| --- | --- |
| Customer | `maya@cravedash.dev` |
| Restaurant admin | `chef@cravedash.dev` |
| Delivery agent | `nora@cravedash.dev` |
| Platform admin | `admin@cravedash.dev` |

## Routes in the app

| Route | Who | What |
| --- | --- | --- |
| `/` | everyone | Landing page describing the service mesh |
| `/auth` | everyone | Sign in / register, honours `?returnTo=` |
| `/dashboard` | signed in | Live order, order history, basket |
| `/restaurants` | signed in | Kitchen directory |
| `/restaurants/:id` | signed in | Menu, availability, add to basket |
| `/checkout` | signed in | Delivery details, payment method, place order |
| `/orders`, `/orders/:id` | signed in | History and live tracking with cancellation |
| `/admin` | restaurant admin | Publish listing, menu CRUD, ticket queue |
| `/fulfillment` | delivery agent | Claim packed orders, deliver, history |

## API surface (all through the gateway)

| Method | Path | Service |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | auth-service |
| GET | `/api/auth/me` | auth-service |
| GET | `/api/restaurants`, `/api/restaurants/mine`, `/api/restaurants/{id}` | restaurant-service |
| POST / PUT / DELETE | `/api/restaurants`, `/api/restaurants/{id}` | restaurant-service |
| GET / POST | `/api/restaurants/{id}/menu` | restaurant-service |
| PUT / DELETE | `/api/restaurants/{id}/menu/{itemId}` | restaurant-service |
| PATCH | `/api/restaurants/{id}/menu/{itemId}/availability` | restaurant-service |
| POST | `/api/orders` | order-service |
| GET | `/api/orders/mine`, `/api/orders/{id}`, `/api/orders/{id}/items` | order-service |
| GET | `/api/orders/restaurant/{id}`, `/api/orders/stats` | order-service |
| GET | `/api/orders/agent/available`, `/api/orders/agent/mine` | order-service |
| PATCH | `/api/orders/{id}/status` | order-service |
| POST | `/api/orders/{id}/claim`, `/api/orders/{id}/cancel` | order-service |
| POST | `/api/payments` | payment-service |
| GET | `/api/payments`, `/api/payments/{id}`, `/api/payments/order/{orderId}`, `/api/payments/customer/{customerId}` | payment-service |
| POST | `/api/payments/{id}/refund` | payment-service |

Only `/api/auth/register` and `/api/auth/login` are public. Everything else
requires `Authorization: Bearer <JWT>`; the gateway validates the token and
forwards `X-User-Id`, `X-User-Email` and `X-User-Role` downstream, which is how
each service scopes its data.

## Order lifecycle

```
PENDING ─▶ CONFIRMED ─▶ PREPARING ─▶ READY_FOR_PICKUP ─▶ OUT_FOR_DELIVERY ─▶ DELIVERED
   └──────────┴───────────┴──────────────┘
             CANCELLED (payment refunded)
```

order-service rejects any other transition with `409 Conflict`, so a ticket can
never skip the kitchen. Couriers claim a `READY_FOR_PICKUP` order, which assigns
the delivery agent before the run starts.
