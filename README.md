# Phantom-VRM

<img width="1115" height="691" alt="image" src="https://github.com/user-attachments/assets/e192917e-a04d-4eb3-88d5-6eab96e0a4c3" />


**AI-controllable VRM avatar with TTS, poses, and expressions**

Phantom-VRM renders VRM (Virtual Reality Model) 3D characters in browsers with HTTP API control. Designed for AI agent usage, it provides full control via JSON configuration and CLI without requiring a GUI.

## Platforms

- Linux
- macOS

## Features

- 🎭 **VRM Rendering** - High-quality rendering with Three.js + @pixiv/three-vrm
- 🔊 **TTS Pipeline** - API-based (OpenAI/Google/Azure) / Piper / VOICEVOX / Custom command support
- 👄 **Lip-sync** - Natural mouth movements synchronized with TTS audio
- 🕺 **Pose Control** - VRMA animation support with smooth transitions
- 😊 **Expression Control** - 6 expressions (happy, sad, angry, relaxed, surprised, neutral)
- 🎥 **Virtual Camera Output** - Works with Zoom/OBS/Meet via v4l2loopback (Linux, Beta)
- 🔥 **Hot Reload** - Config file changes take effect immediately
- 🖥️ **CLI** - Full control from command line without GUI

## Installation

```bash
npm install phantom-vrm
```

or

```bash
git clone https://github.com/YOUR_USERNAME/phantom-vrm.git
cd phantom-vrm
npm install
```

## Quick Start

### 1. Create Configuration File

```bash
cp config.example.json config.json
```

### 2. Place VRM/VRMA Files

Place your VRM model and VRMA animation files:

```bash
# Place VRM model file
public/models/your-avatar.vrm

# Place VRMA animation files (optional)
public/vrma/greeting.vrma
```

Edit `config.json` to set paths:

```json
{
  "port": 8080,
  "model": "./public/models/your-avatar.vrm",
  "idlePose": "./poses/idle.json",
  "vrma": {
    "greeting": "./public/vrma/greeting.vrma"
  },
  "tts": {
    "engine": "none"
  }
}
```

### 3. Start Server

```bash
# Basic start
phantom-vrm start

# With config file
phantom-vrm start --config config.json

# Debug mode
phantom-vrm start --debug

# Short options
phantom-vrm start -c config.json -d
```

or

```bash
npm start
```

### 4. Access in Browser

```
http://localhost:8080
```

For debug mode, add `?debug` parameter:

```
http://localhost:8080?debug
```

## CLI Usage

```bash
# Start server
phantom-vrm start [--config <path>] [--debug]

# Make avatar speak
phantom-vrm speak "Hello!"

# Change pose
phantom-vrm pose greeting

# Change expression
phantom-vrm expression happy

# Check status
phantom-vrm status
```

## API

### POST /api/speak

Make the avatar speak.

```bash
curl -X POST http://localhost:8080/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!", "expression": "happy"}'
```

### POST /api/pose

Change pose.

```bash
curl -X POST http://localhost:8080/api/pose \
  -H "Content-Type: application/json" \
  -d '{"pose": "greeting"}'
```

### POST /api/expression

Change expression.

```bash
curl -X POST http://localhost:8080/api/expression \
  -H "Content-Type: application/json" \
  -d '{"expression": "happy"}'
```

### GET /api/status

Get server status.

```bash
curl http://localhost:8080/api/status
```

## TTS Configuration

### API-based TTS

#### OpenAI

```json
{
  "tts": {
    "engine": "openai",
    "openai": {
      "apiKey": "sk-...",
      "model": "tts-1",
      "voice": "alloy"
    }
  }
}
```

Can also be set via `OPENAI_API_KEY` environment variable.

#### Google Cloud Text-to-Speech

```json
{
  "tts": {
    "engine": "google",
    "google": {
      "apiKey": "...",
      "languageCode": "en-US",
      "voiceName": null,
      "ssmlGender": "NEUTRAL"
    }
  }
}
```

Can also be set via `GOOGLE_API_KEY` environment variable.

#### Azure Cognitive Services

```json
{
  "tts": {
    "engine": "azure",
    "azure": {
      "subscriptionKey": "...",
      "region": "eastus",
      "voice": "en-US-JennyNeural"
    }
  }
}
```

Can also be set via `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` environment variables.

#### Generic HTTP API

For custom HTTP API endpoints:

```json
{
  "tts": {
    "engine": "api",
    "api": {
      "url": "https://your-tts-api.com/synthesize",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      },
      "body": "{\"text\": {text}}",
      "audioPath": "audio",
      "outputFormat": "mp3"
    }
  }
}
```

### Local TTS

#### Piper

```json
{
  "tts": {
    "engine": "piper",
    "piper": {
      "command": "piper",
      "model": "ja_JP-test-medium"
    }
  }
}
```

#### VOICEVOX

```json
{
  "tts": {
    "engine": "voicevox",
    "voicevox": {
      "url": "http://localhost:50021",
      "speaker": 1
    }
  }
}
```

#### Custom Command

```json
{
  "tts": {
    "engine": "custom",
    "custom": {
      "command": "echo '{text}' | my-tts --output {output}"
    }
  }
}
```

## Configuration Reference

| Property | Type | Description |
|-----------|-----|-------------|
| `port` | number | Server port (default: 8080) |
| `output` | string | Output mode: "browser" or "loopback" (default: "browser") |
| `loopback` | object | Loopback output settings (Linux only, beta feature) |
| `model` | string | Path to VRM model file |
| `idlePose` | string | Path to idle pose JSON file |
| `vrma` | object | Map of pose names to VRMA animation files |
| `tts` | object | TTS configuration |
| `hotReload` | boolean | Watch config file for changes (default: true) |

## Directory Structure

```
phantom-vrm/
├── public/
│   ├── models/          # Place VRM model files here
│   ├── vrma/            # Place VRMA animation files here
│   └── audio/           # TTS audio cache (auto-generated)
├── poses/               # Pose JSON files
├── config.json          # Configuration file (user-created)
└── config.example.json  # Configuration template
```

## Virtual Camera Output (Linux, Beta)

Use v4l2loopback to use your avatar in Zoom, OBS, Google Meet, etc.

```bash
# Setup
sudo ./scripts/setup-loopback.sh

# Set output mode in config.json
{
  "output": "loopback",
  "loopback": {
    "device": "/dev/video0",
    "width": 1280,
    "height": 720,
    "fps": 30
  }
}
```

See [docs/loopback-output.md](docs/loopback-output.md) for details.

## License

MIT License

## Contributing

Pull requests are welcome!

## Related Projects

- [three.js](https://threejs.org/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- [Piper TTS](https://github.com/rhasspy/piper)
- [VOICEVOX](https://voicevox.hiroshiba.jp/)
