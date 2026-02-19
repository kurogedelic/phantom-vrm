# v4l2loopback Quick Reference

## One-Time Setup

```bash
# Install dependencies
sudo apt install v4l2loopback-dkms ffmpeg

# Load kernel module
sudo modprobe v4l2loopback video_nr=0 card_label="VRMAvatar" exclusive_caps=1

# Verify
ls -la /dev/video0
```

## Configuration

Edit `config.json`:

```json
{
  "output": "loopback",  // ← Change this
  "loopback": {
    "device": "/dev/video0",
    "width": 1280,
    "height": 720,
    "fps": 30
  },
  ...
}
```

## Run

```bash
npm start
```

Server will:
1. Start VRM Avatar Server (http://localhost:8080)
2. Launch headless browser
3. Start FFmpeg stream to /dev/video0

## Use in Applications

Select "VRMAvatar" camera in:
- OBS Studio
- Zoom
- Google Meet
- Discord
- Any video app

## Troubleshooting

**No video device:**
```bash
sudo modprobe v4l2loopback video_nr=0 card_label="VRMAvatar" exclusive_caps=1
```

**No DISPLAY:**
```bash
export DISPLAY=:0
```

**Performance issues:**
- Lower resolution (640x480)
- Lower fps (15)
- Install puppeteer: `npm install puppeteer`

## Switch Back to Browser Mode

```json
{
  "output": "browser",  // ← Change back
  ...
}
```

Then open http://localhost:8080 in browser.
