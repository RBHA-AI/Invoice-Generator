#!/bin/bash

echo "================================================"
echo "R Bhargava & Associates - Invoice Generator"
echo "Deployment Script"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Install root dependencies
echo "📦 Installing server dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install server dependencies"
    exit 1
fi
echo "✓ Server dependencies installed"
echo ""

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi
echo "✓ Client dependencies installed"
echo ""

# Build the React app
echo "🔨 Building React application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build React application"
    exit 1
fi
echo "✓ React application built successfully"
cd ..
echo ""

echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "The server will run on: http://localhost:5000"
echo ""
echo "For development mode (hot reload):"
echo "  npm run dev"
echo ""
echo "================================================"
