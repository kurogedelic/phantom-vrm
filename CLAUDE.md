# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Phantom-VRM is an AI-controllable avatar system that renders VRM (Virtual Reality Model) 3D characters in browsers with HTTP API control. It's designed for AI agent usage, providing full control via JSON configuration and CLI without requiring a GUI.

**Platforms:** Linux, macOS

**Key Technologies:** Node.js (v18+), Express.js, Three.js, @pixiv/three-vrm

## Running the Server

```bash
# Start with default config
phantom-vrm start

# Start with specific config
phantom-vrm start --config ./config.json

# Debug mode (enables debug panel and verbose logging)
phantom-vrm start --debug

# Short options
phantom-vrm start -c config.json -d

# Or using npm
npm start
npm run dev  # debug mode with config.json
```

The server runs on port 8080 (HTTP). Access the browser at `http://localhost:8080` (add `?debug` for debug panel).

## Architecture

### Core Components

- **`src/server.js`** - Express HTTP server with REST API endpoints
- **`src/config.js`** - Configuration system with hot reload via chokidar
- **`src/tts/`** - TTS abstraction layer supporting API-based (OpenAI, Google, Azure), Piper, VOICEVOX, and custom commands
- **`src/loopback.js`** - Virtual camera output using v4l2loopback (Linux only, beta feature)

### Frontend

- **`public/index.html`** - Main HTML with Three.js VRM rendering
- Uses Three.js + @pixiv/three-vrm + @pixiv/three-vrm-animation
- Lip-sync animation synchronized with TTS audio
- Polls `/api/message` for queued commands

### Configuration System

Config is loaded from JSON file with these key sections:

- **`port`** - HTTP server port (default: 8080)
- **`output`** - "browser" or "loopback" (virtual camera, beta)
- **`model`** - Path to VRM file
- **`idlePose`** - Default pose JSON
- **`vrma`** - Map of pose names to VRMA animation files
- **`expressions`** - Available expressions (neutral, happy, sad, angry, relaxed, surprised)
- **`tts`** - TTS engine config (openai, google, azure, api, piper, voicevox, custom, none)
- **`hotReload`** - Watch config file for changes

Paths in config are resolved relative to the config file location.

**For distribution:** Users should copy `config.example.json` to `config.json` and place their VRM/VRMA files in `public/models/` and `public/vrma/`.

## API Endpoints

### HTTP API (port 8080)

- **POST /api/speak** - Make avatar speak with TTS and lip-sync
  - Body: `{"text": "...", "expression": "happy"}`
  - Returns: `{"success": true, "audioUrl": "/audio/..."}`

- **POST /api/pose** - Change pose (plays VRMA animation once)
  - Body: `{"pose": "greeting"}`
  - Available poses: standing, showBody, greeting, vSign, shoot, spin, modelPose, squat

- **POST /api/expression** - Change facial expression
  - Body: `{"expression": "happy"}`
  - Available: neutral, happy, sad, angry, relaxed, surprised

- **GET /api/status** - Get server status
- **GET /api/poses** - List available poses
- **GET /api/config** - Get current configuration
- **GET /api/message** - Poll for queued messages (frontend)

## CLI Commands

After starting the server, control via CLI:

```bash
phantom-vrm speak "Hello"
phantom-vrm pose greeting
phantom-vrm expression happy
phantom-vrm status
```

## TTS System

The TTS layer (`src/tts/index.js`) provides:

### API-based TTS
1. **OpenAI** - OpenAI Text-to-Speech API (requires `OPENAI_API_KEY` env var or config)
2. **Google** - Google Cloud Text-to-Speech (requires `GOOGLE_API_KEY` env var or config)
3. **Azure** - Azure Cognitive Services Speech (requires `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` env vars or config)
4. **Generic API** - Custom HTTP API endpoint with configurable request/response handling

### Local TTS
5. **Piper** - Command-line TTS (Japanese models)
6. **VOICEVOX** - Neural TTS server integration
7. **Custom** - Executable command support
8. **None** - Disable TTS

Audio is cached in `public/audio/` to avoid regeneration. Duration estimation is used for lip-sync timing.

## Loopback Output (Linux, Beta)

When `output: "loopback"`, the server creates a virtual camera:

**Note:** This is a beta feature.

- Uses Xvfb (virtual display) + FFmpeg pipeline
- Outputs to v4l2loopback device (e.g., `/dev/video0`)
- Configure resolution/fps in `loopback` section of config
- Setup script: `scripts/setup-loopback.sh` (requires root)

This allows the avatar to be used as a camera input in Zoom, OBS, Google Meet, etc.

## Development Notes

- Configuration hot-reloads when `config.json` changes (via chokidar)
- The frontend polls `/api/message` for new commands
- VRM models should be placed in `public/models/`
- VRMA animations should be placed in `public/vrma/`
- Audio cache is stored in `public/audio/`
- API keys can be set via environment variables or in config.json (use env vars for security)
- The project uses `.gitignore` to exclude user content (models, vrma, audio cache) and config.json

## Testing

```bash
# Test HTTP API
curl http://localhost:8080/api/status
curl -X POST http://localhost:8080/api/speak -H "Content-Type: application/json" -d '{"text": "test"}'
curl -X POST http://localhost:8080/api/pose -H "Content-Type: application/json" -d '{"pose": "greeting"}'
curl -X POST http://localhost:8080/api/expression -H "Content-Type: application/json" -d '{"expression": "happy"}'

# Test virtual camera (Linux, beta feature)
./scripts/test-loopback.sh
```

## External Dependencies

### For API-based TTS
- **OpenAI API** - Text-to-speech service
- **Google Cloud TTS** - Text-to-Speech API
- **Azure Speech Services** - Cognitive Services Speech

### For local TTS
- **Piper TTS** - Lightweight neural TTS
- **VOICEVOX** - Japanese neural TTS server

### For virtual camera (Linux, beta feature)
- **v4l2loopback** - Virtual camera device
- **Xvfb** - Virtual X display for headless rendering
- **FFmpeg** - Video encoding/capture
