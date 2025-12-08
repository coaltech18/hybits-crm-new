# Setup Instructions for Another Computer

## Prerequisites
- Git installed
- Node.js 18+ installed
- npm or yarn installed

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd hybits-crm-new

# Or if you have SSH set up:
# git clone git@github.com:YOUR_USERNAME/hybits-crm-new.git
```

## Step 2: Install Dependencies

```bash
npm ci
```

## Step 3: Set Up Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 4: Build and Run

```bash
# Build the project
npm run build

# Start development server
npm start
```

## Step 5: Access the Application

Open your browser and navigate to:
- Development: `http://localhost:4028` (or the port shown in terminal)
- Production build: Use `npm run serve` after building

## Troubleshooting

### If you get authentication errors:
```bash
# Make sure you're logged into GitHub
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### If dependencies fail to install:
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### If build fails:
```bash
# Check Node.js version (should be 18+)
node --version

# Update if needed, then:
npm ci
npm run build
```

## Quick Commands Reference

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm ci

# Build for production
npm run build

# Run development server
npm start

# Type check
npm run type-check

# Lint code
npm run lint
```

