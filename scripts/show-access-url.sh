#!/bin/bash

# Show Access URL Script
# Displays the URL to access TIKETI from Windows browser

echo ""
echo "=========================================="
echo "  TIKETI - Access URL"
echo "=========================================="
echo ""

# Get WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')

if [ -z "$WSL_IP" ]; then
    echo "❌ Could not determine WSL IP address"
    exit 1
fi

echo "✅ WSL IP Address: $WSL_IP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Access TIKETI from Windows Browser:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Frontend:  http://$WSL_IP:3000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Backend Services:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Backend:   http://$WSL_IP:3001"
echo "  Auth:      http://$WSL_IP:3005"
echo "  Payment:   http://$WSL_IP:3003"
echo "  Ticket:    http://$WSL_IP:3002"
echo "  Stats:     http://$WSL_IP:3004"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Login Credentials:"
echo "  Email:    admin@tiketi.gg"
echo "  Password: admin123"
echo ""
echo "⚠️  Note: WSL IP may change after reboot"
echo "   Run this script again if the URL stops working"
echo ""
