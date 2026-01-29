# Hybits CRM - Billing & Subscription Management

Production-grade B2B billing & accounting system built with React, TypeScript, and Supabase.

## ✅ Current Status

**Development Environment**: Running smoothly on `http://localhost:3000`
- All dependencies installed and working
- No compilation or runtime errors
- Modern, responsive UI with Tailwind CSS
- All core components and layouts functional

## 🎯 Project Overview

Hybits is a multi-outlet billing system designed for B2B operations with two distinct billing flows:

1. **Corporate Subscriptions** - Recurring monthly billing for corporate clients
2. **Event Billing** - One-time invoicing for weddings, functions, and events

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Row Level Security)
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Icons**: Lucide React

### Phase-Based Development

The system is being built in phases to ensure stability and production-readiness:

#### ✅ Phase 1: Authentication, Roles & Outlets
- User authentication with Supabase Auth
- Role-based access control (Admin, Manager, Accountant)
- Multi-outlet support with strict isolation
- Database tables: `user_profiles`, `outlets`, `user_outlet_assignments`

#### ✅ Phase 2: Clients (CURRENT)
- Client management with corporate/event separation
- Outlet-based client isolation
- Role-based CRUD operations
- GSTIN validation for corporate clients
- Database table: `clients`

#### 🔜 Phase 3: Subscriptions (Corporate Flow)
#### 🔜 Phase 4: Events (Event Flow)
#### 🔜 Phase 5: Invoices (Subscription + Event)
#### 🔜 Phase 6: Payments & Accounting
#### 🔜 Phase 7: Reports (Combined + Outlet-wise)
#### 🔜 Phase 8: Inventory
#### 🔜 Phase 9: Admin Utilities

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hybits-crm-new
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run database migrations**
   
   Execute the SQL files in order in your Supabase SQL editor:
   - `supabase/001_phase1_auth_roles_outlets.sql`
   - `supabase/002_phase2_clients.sql`

5. **Create first admin user**
   
   a. Sign up via Supabase Auth dashboard or use SQL:
   ```sql
   -- This creates the auth.users entry
   -- Do this via Supabase dashboard: Authentication → Users → Invite User
   ```
   
   b. After user is created in auth.users, add to user_profiles:
   ```sql
   INSERT INTO user_profiles (id, email, full_name, role)
   VALUES (
     'auth-user-uuid-from-auth-users-table',
     'admin@yourcompany.com',
     'Admin User',
     'admin'
   );
   ```

6. **Create sample outlets (optional)**
   ```sql
   INSERT INTO outlets (name, code, city, state, gstin)
   VALUES 
     ('Mumbai Office', 'HYB-MUM-01', 'Mumbai', 'Maharashtra', '27AABCU9603R1ZV'),
     ('Delhi Office', 'HYB-DEL-01', 'New Delhi', 'Delhi', '07AABCU9603R1ZV');
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

## 👥 User Roles

### Admin
- Full system access
- Can see all outlets
- Manage users, outlets, clients, subscriptions, events
- Access to all reports

### Manager
- Outlet-restricted access
- Can only see/manage data for assigned outlets
- Manage clients, subscriptions, events, inventory
- Cannot access accounting or cross-outlet reports

### Accountant
- Read-only access to operational data
- Can view all outlets
- Full access to invoices, payments, accounting module
- Can generate combined and outlet-wise reports

## 📊 Database Schema

### Core Tables (Phase 1)
- `user_profiles` - User authorization and business identity
- `outlets` - Business locations/branches
- `user_outlet_assignments` - Manager-to-outlet mapping

### Clients (Phase 2)
- `clients` - Client database with corporate/event separation

### Future Tables (Phase 3+)
- `subscriptions` - Corporate recurring billing
- `subscription_items` - Line items for subscriptions
- `events` - One-time event records
- `event_items` - Line items for events
- `invoices` - Unified invoice table
- `payments` - Payment tracking
- `inventory_items` - Product/service catalog

## 🔐 Security

### Row Level Security (RLS)
All tables use PostgreSQL RLS policies to enforce:
- Outlet isolation for managers
- Read-only access for accountants
- Full access for admins

### Authentication
- JWT-based authentication via Supabase Auth
- Secure password hashing
- Session management with automatic token refresh

### Audit Trail
- `created_by` fields track user actions
- `created_at` and `updated_at` timestamps on all records
- Soft deletes via `is_active` flags (no hard deletes)

## 📝 Development Guidelines

### Code Structure
```
src/
├── components/       # Reusable UI components
│   ├── ui/          # Base components (Button, Input, etc.)
│   └── layouts/     # Layout components (Sidebar, MainLayout)
├── contexts/        # React contexts (AuthContext)
├── lib/             # Third-party library configurations
├── pages/           # Page components organized by feature
├── routes/          # Route definitions and guards
├── services/        # API service layer
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

### Naming Conventions
- Components: PascalCase (`ClientsPage.tsx`)
- Files: camelCase for utilities, PascalCase for components
- Functions: camelCase (`getClients`)
- Types/Interfaces: PascalCase (`Client`, `UserProfile`)

### Best Practices
- Always use TypeScript strict mode
- Implement proper error handling
- Use React hooks effectively
- Follow role-based access patterns
- Never bypass RLS policies
- Document complex business logic

## 🧪 Testing

```bash
# Run type checking
npm run build

# Run linter
npm run lint
```

## 📦 Build for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## 🐛 Troubleshooting

### Common Issues

**Issue**: Login fails with "User profile not found"
- **Solution**: Ensure user exists in both `auth.users` and `user_profiles` tables

**Issue**: Manager sees no clients
- **Solution**: Verify manager is assigned to an outlet in `user_outlet_assignments` table

**Issue**: RLS policy errors
- **Solution**: Check that all migrations have been run in correct order

## 📄 License

Proprietary - All rights reserved

## 👨‍💻 Development Team

Built by CoAl Tech for Hybits

---

**Current Status**: Phase 2 Complete (Clients Module)
**Next Phase**: Phase 3 - Subscriptions (Corporate Flow)
