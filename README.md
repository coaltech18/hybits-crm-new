# Hybits CRM - Rental Management System

A comprehensive Customer Relationship Management (CRM) system built specifically for Hybits company's internal operations. This modern web application streamlines rental management, inventory tracking, customer relationships, and business analytics.

## 🏢 About Hybits CRM

Hybits CRM is a full-featured internal software solution designed to manage all aspects of Hybits' rental business operations. The system provides real-time insights, automated workflows, and comprehensive management tools for inventory, customers, orders, and financial operations.

## 🚀 Key Features

### 📊 Executive Dashboard
- **Real-time KPI Monitoring**: Revenue tracking, active orders, customer satisfaction metrics
- **Interactive Charts**: Revenue trends, inventory utilization, and performance analytics
- **Quick Actions**: Fast access to critical business functions
- **Activity Feed**: Live updates on system activities and important events

### 🏪 Inventory Management System
- **Multi-location Inventory Tracking**: Manage inventory across multiple warehouses
- **Real-time Stock Monitoring**: Live updates on stock levels and movements
- **Category Management**: Organize items by categories and subcategories
- **Stock Alerts**: Automated notifications for low stock and reorder points
- **Bulk Operations**: Mass updates, imports, and exports
- **Barcode Integration**: Support for barcode scanning and management

### 👥 Customer Relationship Management
- **Customer Database**: Comprehensive customer profiles and history
- **Segmentation Tools**: Organize customers by various criteria
- **Communication Tracking**: Record and track all customer interactions
- **Customer Analytics**: Insights into customer behavior and preferences

### 📋 Order Management
- **Rental Order Processing**: Complete order lifecycle management
- **Order Tracking**: Real-time status updates and delivery tracking
- **Payment Management**: Integrated payment processing and tracking
- **Order Analytics**: Performance metrics and trend analysis

### 💰 GST Compliant Billing System
- **Automated GST Calculations**: Compliant with Indian tax regulations
- **Invoice Generation**: Professional invoice creation and management
- **Payment Tracking**: Monitor payments and outstanding amounts
- **GST Return Tools**: Simplified GST filing and compliance
- **Bulk Billing Operations**: Process multiple invoices efficiently

### 👤 User Management
- **Role-based Access Control**: Secure access based on user roles
- **Multi-user Support**: Support for multiple concurrent users
- **Permission Management**: Granular control over system access
- **User Activity Tracking**: Monitor user actions and system usage

### 📍 Location Management
- **Multi-location Support**: Manage multiple business locations
- **Location-specific Inventory**: Track inventory by location
- **Location Analytics**: Performance metrics by location

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern React with concurrent features and improved performance
- **TypeScript**: Type-safe JavaScript with enhanced developer experience
- **Vite**: Lightning-fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **React Router v6**: Declarative routing for single-page application
- **Recharts**: Powerful data visualization library for charts and graphs
- **Lucide React**: Beautiful, customizable SVG icons
- **Framer Motion**: Smooth animations and transitions

### Backend & Database
- **Supabase**: Backend-as-a-Service with PostgreSQL database
- **Real-time Subscriptions**: Live data updates across the application
- **Row Level Security**: Secure data access and user permissions
- **Authentication**: Built-in user authentication and session management

### State Management
- **React Context API**: Global state management for authentication and themes
- **Local State**: Component-level state with React hooks
- **Supabase Client**: Real-time data synchronization

### Development Tools
- **TypeScript**: Static type checking and enhanced IDE support
- **ESLint**: Code linting and quality assurance with TypeScript support
- **Prettier**: Code formatting and consistency
- **Git**: Version control and collaboration

## 📁 Project Structure

```
hybits-crm-new/
├── public/                          # Static assets and images
│   ├── assets/images/              # Application images
│   ├── favicon.ico                 # Site favicon
│   ├── manifest.json               # PWA manifest
│   └── robots.txt                  # SEO robots file
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                    # Base UI components
│   │   │   ├── Button.jsx         # Custom button component
│   │   │   ├── Input.jsx          # Form input component
│   │   │   ├── Select.jsx         # Dropdown select component
│   │   │   ├── Header.jsx         # Application header
│   │   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   │   ├── Breadcrumb.jsx     # Navigation breadcrumbs
│   │   │   └── ...
│   │   ├── AppIcon.jsx            # Icon component wrapper
│   │   ├── AppImage.jsx           # Image component wrapper
│   │   ├── ErrorBoundary.jsx      # Error handling component
│   │   ├── ProtectedRoute.jsx     # Route protection component
│   │   └── ScrollToTop.jsx        # Scroll behavior component
│   ├── contexts/                   # React Context providers
│   │   ├── AuthContext.jsx        # Authentication context
│   │   └── ThemeContext.jsx       # Theme management context
│   ├── pages/                      # Page components
│   │   ├── executive-dashboard/   # Executive dashboard module
│   │   ├── inventory-management-system/ # Inventory management
│   │   ├── customer-relationship-management/ # Customer management
│   │   ├── rental-order-management/ # Order management
│   │   ├── gst-compliant-billing-system/ # Billing system
│   │   ├── user-management/       # User management
│   │   ├── location-management/   # Location management
│   │   └── authentication-role-selection/ # Authentication
│   ├── services/                   # API and service layer
│   │   ├── authService.js         # Authentication services
│   │   ├── customerService.js     # Customer data services
│   │   ├── inventoryService.js    # Inventory data services
│   │   ├── locationService.js     # Location data services
│   │   └── orderService.js        # Order data services
│   ├── styles/                     # Global styles
│   │   ├── index.css              # Global CSS styles
│   │   └── tailwind.css           # Tailwind CSS configuration
│   ├── utils/                      # Utility functions
│   │   ├── cn.js                  # Class name utility
│   │   └── importExport.js        # Import/export utilities
│   ├── lib/                        # External library configurations
│   │   └── supabase.js            # Supabase client configuration
│   ├── App.jsx                     # Main application component
│   ├── Routes.jsx                  # Application routing
│   └── index.jsx                   # Application entry point
├── supabase/                       # Database migrations
│   └── migrations/                 # SQL migration files
├── package.json                    # Project dependencies
├── tailwind.config.js              # Tailwind CSS configuration
├── vite.config.mjs                 # Vite build configuration
└── README.md                       # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16.x or higher)
- **npm** or **yarn** package manager
- **TypeScript** (v4.9.x or higher)
- **Supabase Account** (for backend services)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd hybits-crm-new
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory:
   ```env
   # Client-side public keys (safe to expose in client bundle)
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Server-only key (NEVER expose in client code or client bundle)
   # Only use in server-side code, Supabase Edge Functions, or API routes
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   **Important Security Notes:**
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — Public (client-safe) keys that can be used in browser code
   - `SUPABASE_SERVICE_ROLE_KEY` — Server-only, never in client repo or client bundle. Only use in:
     - Supabase Edge Functions
     - Server-side API routes
     - Backend services
     - Database migrations/scripts

4. **Database Setup:**
   - Run the SQL migrations in the `supabase/migrations/` directory
   - Set up Row Level Security policies
   - Configure authentication settings

5. **Start the development server:**
   ```bash
   npm start
   # or
   yarn start
   ```

6. **Type checking (optional):**
   ```bash
   npm run type-check
   # or
   yarn type-check
   ```

6. **Access the application:**
   Open [http://localhost:4028](http://localhost:4028) in your browser

## 🎨 Design System

### Color Palette
- **Primary**: Vibrant green (#1E40AF) for main actions and branding
- **Secondary**: Soft gray (#220 14% 96%) for sections and backgrounds
- **Success**: Green (#10B981) for positive actions and states
- **Warning**: Amber (#F59E0B) for caution and attention
- **Error**: Red (#EF4444) for errors and destructive actions
- **Muted**: Gray tones for secondary text and elements

### Typography
- **Font Family**: Inter (primary), JetBrains Mono (code)
- **Responsive Typography**: Fluid scaling across device sizes
- **Font Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Components
- **Consistent Spacing**: 4px base unit with consistent spacing scale
- **Border Radius**: Rounded corners with consistent radius values
- **Shadows**: Subtle, pronounced, and luxury shadow variants
- **Transitions**: Smooth 300ms transitions for interactive elements

## 🔐 Authentication & Security

### User Roles
- **Super Admin**: Full system access and configuration
- **Admin**: Management access to all modules
- **Manager**: Department-specific access and oversight
- **Operator**: Day-to-day operational access
- **Viewer**: Read-only access for reporting

### Security Features
- **Row Level Security**: Database-level access control
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Automatic session handling and refresh
- **Input Validation**: Client and server-side validation
- **XSS Protection**: Sanitized inputs and outputs

## 📊 Data Management

### Real-time Features
- **Live Updates**: Real-time data synchronization across users
- **WebSocket Integration**: Instant notifications and updates
- **Conflict Resolution**: Automatic handling of concurrent edits
- **Offline Support**: Local caching with sync when reconnected

### Data Export/Import
- **CSV Export**: Export data in CSV format for external analysis
- **Excel Integration**: Import/export Excel files
- **Bulk Operations**: Mass data operations and updates
- **Data Backup**: Automated backup and recovery systems

## 🚀 Deployment

### Production Build
```bash
npm run build
```

## 🙏 Acknowledgments

- Powered by React and Vite
- Styled with Tailwind CSS

Built with ❤️ for Hybits

## Database migrations

Run supabase/migrations/001_full_production_schema.sql then 002_entity_sequences_and_triggers.sql in Supabase SQL Editor (see supabase/README_RUN_MIGRATIONS.md for details).