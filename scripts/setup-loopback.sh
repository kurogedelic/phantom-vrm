#!/bin/bash
# Setup script for v4l2loopback output mode

set -e

echo "🎥 VRM Avatar Server - v4l2loopback Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  This script requires root privileges for some operations"
  echo "   Run with: sudo $0"
  exit 1
fi

# Detect OS
if [ -f /etc/debian_version ]; then
  OS="debian"
  echo "📦 Detected Debian/Ubuntu system"
elif [ -f /etc/arch-release ]; then
  OS="arch"
  echo "📦 Detected Arch Linux system"
else
  echo "❌ Unsupported OS. Please install v4l2loopback manually."
  exit 1
fi

# Install v4l2loopback
echo ""
echo "📦 Installing v4l2loopback..."
case $OS in
  debian)
    apt-get update
    apt-get install -y v4l2loopback-dkms ffmpeg
    ;;
  arch)
    pacman -S v4l2loopback-dkms ffmpeg
    ;;
esac

# Load module
echo ""
echo "🔧 Loading v4l2loopback module..."
modprobe v4l2loopback video_nr=0 card_label="VRMAvatar" exclusive_caps=1

# Check device
echo ""
echo "🎥 Checking video device..."
if [ -e /dev/video0 ]; then
  echo "✅ /dev/video0 created successfully"
  v4l2-ctl --list-devices 2>/dev/null || true
else
  echo "❌ Failed to create /dev/video0"
  exit 1
fi

# Check ffmpeg
echo ""
echo "🎬 Checking ffmpeg..."
if command -v ffmpeg &> /dev/null; then
  echo "✅ ffmpeg installed: $(ffmpeg -version | head -1)"
else
  echo "❌ ffmpeg not found"
  exit 1
fi

# Optional: Install puppeteer for better capture
echo ""
echo "🎭 Optional: Install Puppeteer for better capture?"
read -p "   Install Puppeteer? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📦 Installing Puppeteer..."
  cd "$(dirname "$0")/.."
  npm install puppeteer
  echo "✅ Puppeteer installed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 To use loopback output mode:"
echo "   1. Update config.json: set \"output\": \"loopback\""
echo "   2. Start server: npm start"
echo "   3. Check /dev/video0 in video apps (OBS, Zoom, etc.)"
echo ""
