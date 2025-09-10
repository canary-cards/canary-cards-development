#!/bin/bash

# Local Development Setup Script
# This script helps you set up the project locally and sync with your preferred database

set -e

echo "🚀 Setting up Canary Cards development environment..."

# Check if required tools are installed
echo "📋 Checking required tools..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "✅ All required tools are available"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment variables
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your actual values"
else
    echo "✅ .env.local already exists"
fi

# Ask user which database to connect to
echo ""
echo "🗄️  Which database would you like to connect to for development?"
echo "1) Staging database (recommended for development)"
echo "2) Production database (use with caution)"
echo "3) Local Supabase instance"
read -p "Choose (1-3): " db_choice

case $db_choice in
    1)
        echo "📡 Connecting to staging database..."
        echo "ℹ️  Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local point to your staging database"
        ;;
    2)
        echo "⚠️  Connecting to production database..."
        echo "🚨 WARNING: You're connecting to production. Be extremely careful!"
        echo "ℹ️  Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local point to your production database"
        ;;
    3)
        echo "🏠 Setting up local Supabase instance..."
        if [ ! -f "supabase/config.toml" ]; then
            supabase init
        fi
        supabase start
        echo "✅ Local Supabase is running"
        echo "ℹ️  Update .env.local to use local Supabase URLs"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Update .env.local with your actual values"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:5173 to see your app"
echo ""
echo "📚 Useful commands:"
echo "  npm run dev       - Start development server"
echo "  npm run build     - Build for production"
echo "  npm run lint      - Run linting"
echo "  supabase status   - Check Supabase status (if using local)"
echo ""