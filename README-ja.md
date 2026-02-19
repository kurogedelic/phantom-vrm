# Phantom-VRM

**AI制御可能なVRMアバター - TTS、ポーズ、表情対応**

VRMモデルをブラウザで描画し、HTTP API経由で制御できるサーバーです。
AIエージェントからの使用を想定し、GUIを使わずにJSON設定とCLIで完全に制御できます。

## プラットフォーム

- Linux
- macOS

## 特徴

- 🎭 **VRMモデル描画** - Three.js + @pixiv/three-vrm による高品質レンダリング
- 🔊 **TTSパイプライン** - APIベース (OpenAI/Google/Azure) / Piper / VOICEVOX / カスタムコマンド対応
- 👄 **リップシンク** - TTS音声に同期した自然な口の動き
- 🕺 **ポーズ制御** - VRMAアニメーション対応、スムーズなトランジション
- 😊 **表情制御** - 6種類の表情（happy, sad, angry, relaxed, surprised, neutral）
- 🎥 **仮想カメラ出力** - v4l2loopbackでZoom/OBS/Meetに対応（Linux, Beta）
- 🔥 **ホットリロード** - 設定ファイルの変更を即座に反映
- 🖥️ **CLI** - GUIを使わずコマンドラインから完全制御

## インストール

```bash
npm install phantom-vrm
```

または

```bash
git clone https://github.com/YOUR_USERNAME/phantom-vrm.git
cd phantom-vrm
npm install
```

## クイックスタート

### 1. 設定ファイル作成

```bash
cp config.example.json config.json
```

### 2. VRM/VRMAファイルの配置

自分のVRMモデルとVRMAアニメーションファイルを配置してください:

```bash
# VRMモデルファイルを配置
public/models/your-avatar.vrm

# VRMAアニメーションファイルを配置（オプション）
public/vrma/greeting.vrma
```

`config.json` を編集してパスを設定:

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

### 3. サーバー起動

```bash
# 基本起動
phantom-vrm start

# 設定ファイルを指定
phantom-vrm start --config config.json

# デバッグモードで起動
phantom-vrm start --debug

# 短縮オプション
phantom-vrm start -c config.json -d
```

または

```bash
npm start
```

### 4. ブラウザでアクセス

```
http://localhost:8080
```

デバッグモードの場合は `?debug` パラメータを付けてください:

```
http://localhost:8080?debug
```

## CLI使用方法

```bash
# サーバー起動
phantom-vrm start [--config <path>] [--debug]

# 発話
phantom-vrm speak "こんにちは！"

# ポーズ変更
phantom-vrm pose greeting

# 表情変更
phantom-vrm expression happy

# ステータス確認
phantom-vrm status
```

## API

### POST /api/speak

アバターに発話させます。

```bash
curl -X POST http://localhost:8080/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは！", "expression": "happy"}'
```

### POST /api/pose

ポーズを変更します。

```bash
curl -X POST http://localhost:8080/api/pose \
  -H "Content-Type: application/json" \
  -d '{"pose": "greeting"}'
```

### POST /api/expression

表情を変更します。

```bash
curl -X POST http://localhost:8080/api/expression \
  -H "Content-Type: application/json" \
  -d '{"expression": "happy"}'
```

### GET /api/status

ステータスを取得します。

```bash
curl http://localhost:8080/api/status
```

## TTS設定

### APIベースのTTS

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

環境変数 `OPENAI_API_KEY` でも設定可能です。

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

環境変数 `GOOGLE_API_KEY` でも設定可能です。

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

環境変数 `AZURE_SPEECH_KEY` と `AZURE_SPEECH_REGION` でも設定可能です。

#### 汎用HTTP API

カスタムのHTTP APIを使用する場合:

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

### ローカルTTS

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

#### カスタムコマンド

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

## 設定リファレンス

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `port` | number | サーバーポート (default: 8080) |
| `output` | string | 出力モード: "browser" または "loopback" (default: "browser") |
| `loopback` | object | ループバック出力設定（Linuxのみ、Beta機能） |
| `model` | string | VRMモデルファイルパス |
| `idlePose` | string | アイドルポーズJSONファイルパス |
| `vrma` | object | VRMAアニメーションファイルのマップ |
| `tts` | object | TTS設定 |
| `hotReload` | boolean | 設定ファイルのホットリロード (default: true) |

## ディレクトリ構成

```
phantom-vrm/
├── public/
│   ├── models/          # VRMモデルファイルを配置
│   ├── vrma/            # VRMAアニメーションファイルを配置
│   └── audio/           # TTS音声キャッシュ（自動生成）
├── poses/               # ポーズJSONファイル
├── config.json          # 設定ファイル（ユーザー作成）
└── config.example.json  # 設定ファイルテンプレート
```

## 仮想カメラ出力（Linux, Beta）

v4l2loopbackを使用して、Zoom、OBS、Google Meetなどでアバターを使用できます。

```bash
# セットアップ
sudo ./scripts/setup-loopback.sh

# config.jsonで出力モードを設定
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

詳細は [docs/loopback-output.md](docs/loopback-output.md) を参照。

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します！

## 関連プロジェクト

- [three.js](https://threejs.org/)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm-animation)
- [Piper TTS](https://github.com/rhasspy/piper)
- [VOICEVOX](https://voicevox.hiroshiba.jp/)
