# Event Organizer System

A comprehensive full-stack community management and event organizing platform built for Indonesian neighborhood associations (RT/RW). It combines event lifecycle management, role-based access control, financial transparency, and online payment processing into a single cohesive system.

---

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Project Description

Neighborhood associations in Indonesia (RT – *Rukun Tetangga* / RW – *Rukun Warga*) manage community events, collect monthly dues, and maintain shared funds for the benefit of their members. These activities are often handled manually, making them prone to errors, lack of transparency, and administrative overhead.

**Event Organizer System** addresses this problem by providing a web-based platform that enables communities to:

- Plan, submit, and track community events through a multi-step approval workflow.
- Manage group wallets, collect monthly dues, and record financial transactions with double-entry bookkeeping.
- Process payments online through the Midtrans payment gateway.
- Provide full financial transparency to residents and enforce accountability through role-based access control.

---

## Features

### Event Management
- Create and manage community events with detailed budget estimates.
- Multi-step approval workflow: `DRAFT → SUBMITTED → APPROVED → FUNDED → COMPLETED → SETTLED`.
- Expense reporting and verification after event completion.
- Extend event deadlines and request additional funding from parent groups (RT → RW).

### Community & Access Control
- Hierarchical group structure: RT groups under RW groups.
- Four built-in system roles: **LEADER**, **ADMIN**, **TREASURER**, and **RESIDENT**.
- Customizable role labels per group for localized display names.
- Role-based dashboards and guarded API endpoints.

### Financial Management
- Dedicated wallet per community group with real-time balance tracking.
- Double-entry ledger system (DEBIT / CREDIT transactions).
- Monthly dues configuration, automatic billing, and per-member bill calculation.
- Cross-group fund requests with approval/rejection workflow.
- Public financial transparency views accessible to all residents.

### Payment Processing
- Midtrans payment gateway integration supporting:
  - Virtual Accounts (BCA, BNI, BRI, Mandiri, Permata)
  - E-wallets (GoPay, OVO, Dana, ShopeePay)
  - QRIS, Credit Cards, and Convenience Stores
- Automatic payment status synchronization via webhook notifications.
- Refund management with admin approval.

### Security & Reliability
- JWT authentication stored in HttpOnly cookies (XSS protection).
- Rate limiting: 3 requests/minute for login, burst and sustained limits for all endpoints.
- HTTP security headers via Helmet.
- GZIP response compression.
- Global exception handling with consistent JSON response formatting.
- Request ID tracking for end-to-end traceability.

### Developer Experience
- Swagger/OpenAPI documentation available at `/api/docs`.
- Prisma ORM with auto-generated migrations.
- Comprehensive seed data: 62 test accounts across 1 RW and 5 RT groups.
- Full TypeScript across the entire stack.

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| [NestJS](https://nestjs.com/) | 11.x | REST API framework |
| TypeScript | 5.x | Language |
| [Prisma ORM](https://www.prisma.io/) | 5.x | Database access & migrations |
| PostgreSQL | — | Relational database |
| Passport.js + JWT | — | Authentication |
| [Midtrans Client](https://github.com/midtrans/midtrans-nodejs-client) | 1.4.x | Payment gateway |
| Helmet | — | HTTP security headers |
| express-rate-limit | — | Rate limiting |
| Swagger/OpenAPI | — | API documentation |
| Jest + Supertest | — | Testing |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| [React](https://react.dev/) | 19.x | UI framework |
| TypeScript | 5.x | Language |
| [Vite](https://vitejs.dev/) | 7.x | Build tool & dev server |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Utility-first styling |
| [Shadcn/UI](https://ui.shadcn.com/) + Radix UI | — | Component library |
| React Router DOM | 7.x | Client-side routing |
| React Hook Form + Zod | — | Form management & validation |
| Axios | 1.x | HTTP client |
| Sonner | — | Toast notifications |
| next-themes | — | Dark/light theme switching |
| date-fns | — | Date formatting |
| lucide-react | — | Icon library |

---

## Project Architecture

```
project_eo/                          # Monorepo root
│
├── backend/                         # NestJS REST API
│   ├── src/
│   │   ├── common/                  # Shared utilities
│   │   │   ├── constants/           # App-wide constants
│   │   │   ├── decorators/          # Custom decorators
│   │   │   ├── dto/                 # Shared DTOs
│   │   │   ├── filters/             # Global exception filters
│   │   │   ├── guards/              # Auth & role guards
│   │   │   ├── interceptors/        # Response & logging interceptors
│   │   │   └── interfaces/          # Shared TypeScript interfaces
│   │   ├── config/                  # App, database, and Midtrans config
│   │   ├── database/                # Prisma client setup
│   │   ├── modules/
│   │   │   ├── auth/                # Login, logout, JWT strategy
│   │   │   ├── community/           # Users and group management
│   │   │   ├── events/              # Event lifecycle management
│   │   │   ├── finance/             # Wallets, transactions, dues
│   │   │   ├── payment/             # Midtrans integration
│   │   │   └── settings/            # Role label configuration
│   │   └── providers/
│   │       ├── mail/                # Email service
│   │       └── storage/             # File upload service
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   ├── migrations/              # Auto-generated migrations
│   │   └── seed.ts                  # Seed data (62 test accounts)
│   ├── uploads/                     # Local file storage
│   ├── .env.example                 # Environment variable template
│   └── package.json
│
└── frontend/                        # React + Vite SPA
    ├── src/
    │   ├── app/                     # App entry & routing
    │   ├── layouts/                 # Dashboard layout
    │   ├── features/
    │   │   ├── auth/                # Login page & auth service
    │   │   ├── dashboard/           # Role-based dashboards
    │   │   ├── event/               # Event pages & services
    │   │   ├── organization/        # Group management pages
    │   │   ├── finance/             # Wallet & transaction pages
    │   │   ├── payment/             # Payment UI & services
    │   │   ├── profile/             # User profile page
    │   │   └── settings/            # App settings page
    │   └── shared/                  # Reusable components & utilities
    │       └── ui/                  # Shadcn/UI + custom components
    └── package.json
```

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [PostgreSQL](https://www.postgresql.org/) v14 or later
- [npm](https://www.npmjs.com/) v9 or later

### 1. Clone the Repository

```bash
git clone https://github.com/VindSkiee/project_eo.git
cd project_eo
```

### 2. Set Up the Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, and Midtrans keys

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with test accounts
npm run prisma:seed
```

### 3. Set Up the Frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

### 4. Start Development Servers

**Backend** (runs on `http://localhost:3000`):
```bash
cd backend
npm run dev
```

**Frontend** (runs on `http://localhost:5173`):
```bash
cd frontend
npm run dev
```

---

## Usage

### Accessing the Application

| Service | URL |
|---|---|
| Frontend (SPA) | http://localhost:5173 |
| Backend API | http://localhost:3000/api |
| API Documentation (Swagger) | http://localhost:3000/api/docs |
| Prisma Studio (DB GUI) | `npx prisma studio` |

### Available Roles & Default Seed Accounts

The seed script creates **62 accounts** across one RW and five RT groups.

| Role | Description |
|---|---|
| **LEADER** | RW-level leader with full system access |
| **ADMIN** | RT-level administrator managing members and events |
| **TREASURER** | Manages wallet transactions and dues |
| **RESIDENT** | Regular community member |

Refer to `backend/prisma/seed.ts` for the complete list of seeded credentials.

### Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend end-to-end tests
cd backend && npm run test:e2e

# Frontend lint check
cd frontend && npm run lint
```

### Building for Production

```bash
# Backend
cd backend && npm run build && npm run start:prod

# Frontend
cd frontend && npm run build
# Serve the dist/ folder with your preferred static file host or reverse proxy
```

---

## Environment Variables

Create a `.env` file inside the `backend/` directory based on `.env.example`:

```env
# ─── Application ─────────────────────────────────────────────────────────────
APP_NAME="Event Organizer System"
NODE_ENV=development
APP_PORT=3000
APP_URL=http://localhost:3000

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/event_organizer?schema=public"

# ─── Authentication ──────────────────────────────────────────────────────────
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="1d"
BCRYPT_SALT_ROUNDS=10

# ─── Role Defaults ────────────────────────────────────────────────────────────
DEFAULT_ROLE=RESIDENT

# ─── Finance ─────────────────────────────────────────────────────────────────
CURRENCY=IDR
MAX_EVENT_BUDGET=100000000

# ─── Midtrans Payment Gateway ─────────────────────────────────────────────────
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY="SB-Mid-server-xxxxx"
MIDTRANS_CLIENT_KEY="SB-Mid-client-xxxxx"
MIDTRANS_API_URL="https://api.sandbox.midtrans.com"

# ─── File Storage ────────────────────────────────────────────────────────────
UPLOAD_PROVIDER=local
UPLOAD_MAX_SIZE=5242880           # 5 MB in bytes

# ─── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL=debug
```

> **Note:** Never commit your `.env` file. The `.gitignore` already excludes it.

---

## API Endpoints

Base path: `/api`  
Interactive documentation: `GET /api/docs`

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/login` | Authenticate and receive JWT cookie | — |
| `POST` | `/auth/logout` | Invalidate session | ✓ |

### Users

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `POST` | `/users` | Create a new user | ADMIN |
| `GET` | `/users` | List users (filtered by group) | ADMIN+ |
| `GET` | `/users/me` | Get current user profile | Any |
| `GET` | `/users/:id` | Get user details | ADMIN+ |
| `PATCH` | `/users/:id` | Update user (admin) | ADMIN |
| `PATCH` | `/users/profile` | Update own profile | Any |
| `PATCH` | `/users/profile/avatar` | Upload profile avatar | Any |
| `PATCH` | `/users/change-password` | Change own password | Any |
| `DELETE` | `/users/:id` | Soft-delete user | ADMIN |

### Groups

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `POST` | `/groups` | Create a group | LEADER |
| `GET` | `/groups` | List all groups | Any |
| `GET` | `/groups/hierarchy` | Get hierarchical group tree | Any |
| `GET` | `/groups/:id` | Get group details | Any |
| `PATCH` | `/groups/:id` | Update group | LEADER |
| `DELETE` | `/groups/:id` | Delete group | LEADER |

### Events

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `POST` | `/events` | Create an event | ADMIN |
| `GET` | `/events` | List events (role-filtered) | Any |
| `GET` | `/events/:id` | Get event details | Any |
| `PATCH` | `/events/:id` | Update event | ADMIN |
| `DELETE` | `/events/:id` | Delete event | ADMIN |
| `POST` | `/events/:id/submit` | Submit event for approval | ADMIN |
| `POST` | `/events/:id/approve` | Process approval step | LEADER/TREASURER |
| `POST` | `/events/:id/cancel` | Cancel event | ADMIN/LEADER |
| `POST` | `/events/:id/expense-report` | Submit post-event expenses | ADMIN |
| `PATCH` | `/events/:id/extend-date` | Extend event deadline | ADMIN |
| `POST` | `/events/:id/settle` | Settle and close event | TREASURER |
| `POST` | `/events/:id/request-additional-fund` | Request extra funding | ADMIN |
| `POST` | `/events/:id/review-additional-fund` | Review fund request | LEADER |

### Fund Requests

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `POST` | `/fund-requests` | Create a fund request | ADMIN |
| `GET` | `/fund-requests` | List fund requests | ADMIN+ |
| `GET` | `/fund-requests/:id` | Get request details | Any |
| `POST` | `/fund-requests/:id/approve` | Approve request | LEADER |
| `POST` | `/fund-requests/:id/reject` | Reject request | LEADER |

### Finance

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `GET` | `/finance/wallet` | Get group wallet balance | ADMIN+ |
| `GET` | `/finance/transactions` | Get transaction history | ADMIN+ |
| `POST` | `/finance/transactions` | Create manual transaction | TREASURER |
| `POST` | `/finance/dues/config` | Configure monthly dues | TREASURER |
| `GET` | `/finance/dues/config` | Get dues configuration | ADMIN+ |
| `GET` | `/finance/dues/my-bill` | Get personal monthly bill | Any |
| `GET` | `/finance/children-wallets` | Get child group wallets | LEADER |
| `GET` | `/finance/transparency/balance` | Public balance view | Any |
| `GET` | `/finance/transparency/history` | Public transaction history | Any |

### Payments

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `POST` | `/payment/pay-dues` | Initiate monthly dues payment | Any |
| `POST` | `/payment/create` | Create a payment transaction | Any |
| `GET` | `/payment/history` | Get own payment history | Any |
| `GET` | `/payment/status/:orderId` | Check transaction status | Any |
| `GET` | `/payment/all-transactions` | List all transactions | TREASURER |
| `POST` | `/payment/refund/:refundId/process` | Process a refund | TREASURER |
| `POST` | `/payment/notification` | Midtrans webhook receiver | — |

### Settings

| Method | Endpoint | Description | Role |
|---|---|---|---|
| `GET` | `/settings/role-labels` | Get role labels for group | Any |
| `GET` | `/settings/role-labels/map` | Get full label mapping | Any |
| `POST` | `/settings/role-labels` | Create or update label | LEADER |
| `DELETE` | `/settings/role-labels/:roleType` | Delete a role label | LEADER |

---

## Future Improvements

- **Email Notifications** – Automated emails for event approvals, dues reminders, and payment confirmations.
- **Push Notifications** – Browser/mobile push alerts for important community updates.
- **PDF Report Generation** – Downloadable financial reports and event summaries (pdfkit is already a dependency).
- **Cloud File Storage** – Replace local `uploads/` with AWS S3 or similar object storage.
- **Mobile Application** – React Native companion app for on-the-go access.
- **Multi-language Support** – Internationalization (i18n) for Bahasa Indonesia and English.
- **Analytics Dashboard** – Charts and graphs for community financial trends over time.
- **Automated Dues Reminders** – Scheduled tasks to notify members of unpaid dues (NestJS Schedule is already installed).
- **Audit Log Viewer** – UI for browsing the full history of administrative actions.
- **Docker Support** – Containerized deployment with Docker Compose for easier setup.

---

## Author

**VindSkiee**  
GitHub: [@VindSkiee](https://github.com/VindSkiee)

---

> This project is intended for educational and community use. Contributions and feedback are welcome.
