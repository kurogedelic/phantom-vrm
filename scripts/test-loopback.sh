#!/bin/bash
# Test script for v4l2loopback integration

echo "🧪 Testing v4l2loopback Integration"
echo "=================================="
echo ""

# Test 1: Check module loads
echo "Test 1: Checking module syntax..."
node -c src/loopback.js
if [ $? -eq 0 ]; then
  echo "✅ loopback.js syntax OK"
else
  echo "❌ loopback.js has syntax errors"
  exit 1
fi

node -c src/server.js
if [ $? -eq 0 ]; then
  echo "✅ server.js syntax OK"
else
  echo "❌ server.js has syntax errors"
  exit 1
fi

# Test 2: Check module loads at runtime
echo ""
echo "Test 2: Checking runtime loading..."
node -e "require('./src/loopback'); console.log('✅ loopback.js loads')" || exit 1
node -e "require('./src/server'); console.log('✅ server.js loads')" || exit 1

# Test 3: Check config has loopback options
echo ""
echo "Test 3: Checking config.json..."
if grep -q '"output"' config.json; then
  echo "✅ config.json has 'output' field"
else
  echo "❌ config.json missing 'output' field"
  exit 1
fi

if grep -q '"loopback"' config.json; then
  echo "✅ config.json has 'loopback' config"
else
  echo "❌ config.json missing 'loopback' config"
  exit 1
fi

# Test 4: Check v4l2loopback (optional, requires root)
echo ""
echo "Test 4: Checking v4l2loopback kernel module..."
if lsmod | grep -q v4l2loopback; then
  echo "✅ v4l2loopback module loaded"
  if [ -e /dev/video0 ]; then
    echo "✅ /dev/video0 exists"
  else
    echo "⚠️  /dev/video0 not found (may need setup)"
  fi
else
  echo "⚠️  v4l2loopback not loaded (run setup-loopback.sh)"
fi

# Test 5: Check ffmpeg
echo ""
echo "Test 5: Checking ffmpeg..."
if command -v ffmpeg &> /dev/null; then
  echo "✅ ffmpeg installed: $(ffmpeg -version | head -1)"
else
  echo "⚠️  ffmpeg not found (needed for loopback mode)"
fi

echo ""
echo "=================================="
echo "✅ All core tests passed!"
echo ""
echo "Next steps:"
echo "1. Run: sudo ./scripts/setup-loopback.sh"
echo "2. Set \"output\": \"loopback\" in config.json"
echo "3. Run: npm start"
echo "4. Use VRMAvatar in Zoom/OBS/Meet"
