# VRM Avatar Server - AI Tool Documentation

AIエージェント/LLMが `vrm-avatar-server` を使用するための技術ドキュメント。

---

## 概要

VRM Avatar Serverは、VRMアバターを制御するためのHTTP/WebSocket APIサーバーです。
AIエージェントからの使用を前提に設計されており、GUIを使わずに完全制御可能です。

---

## エンドポイント

### HTTP API (ポート 8080)

#### POST /api/speak

アバターに発話させます。TTSで音声を生成し、リップシンクします。

**Request:**
```json
{
  "clientId": "default",
  "text": "こんにちは！元気ですか？",
  "expression": "happy"
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| text | string | ✅ | 発話内容 |
| clientId | string | | クライアントID (default: "default") |
| expression | string | | 発話時の表情 |

**Response:**
```json
{
  "success": true,
  "audioUrl": "/audio/abc123.wav"
}
```

**cURL:**
```bash
curl -X POST http://localhost:8080/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは！", "expression": "happy"}'
```

---

#### POST /api/pose

ポーズを変更します。ポーズは1回再生され、終了後にスムーズに立ち姿に戻ります。

**Request:**
```json
{
  "clientId": "default",
  "pose": "greeting"
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| pose | string | ✅ | ポーズ名 |
| clientId | string | | クライアントID |

**利用可能なポーズ:**
- `standing` - 立ち姿（デフォルト）
- `showBody` - 全身を見せる
- `greeting` - 挨拶
- `vSign` - Vサイン
- `shoot` - 撃つ
- `spin` - 回る
- `modelPose` - モデルポーズ
- `squat` - 屈伸運動

**Response:**
```json
{
  "success": true,
  "pose": "greeting"
}
```

**cURL:**
```bash
curl -X POST http://localhost:8080/api/pose \
  -H "Content-Type: application/json" \
  -d '{"pose": "greeting"}'
```

---

#### POST /api/expression

表情を変更します。

**Request:**
```json
{
  "clientId": "default",
  "expression": "happy"
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| expression | string | ✅ | 表情名 |
| clientId | string | | クライアントID |

**利用可能な表情:**
- `neutral` - 普通
- `happy` - 嬉しい
- `sad` - 悲しい
- `angry` - 怒り
- `relaxed` - リラックス
- `surprised` - 驚き

**Response:**
```json
{
  "success": true,
  "expression": "happy"
}
```

**cURL:**
```bash
curl -X POST http://localhost:8080/api/expression \
  -H "Content-Type: application/json" \
  -d '{"expression": "happy"}'
```

---

#### GET /api/status

サーバーのステータスを取得します。

**Response:**
```json
{
  "status": "running",
  "model": "avatar.vrm",
  "poses": ["greeting", "vSign", "showBody", ...],
  "expressions": ["neutral", "happy", "sad", "angry", "relaxed", "surprised"]
}
```

**cURL:**
```bash
curl http://localhost:8080/api/status
```

---

#### GET /api/poses

利用可能なポーズ一覧を取得します。

**Response:**
```json
{
  "poses": ["greeting", "vSign", ...],
  "descriptions": {
    "greeting": "VRMA_02.vrma",
    ...
  }
}
```

---

#### GET /api/config

現在の設定を取得します。

**Response:**
```json
{
  "model": "avatar.vrm",
  "poses": ["greeting", "vSign", ...],
  "expressions": ["neutral", "happy", ...]
}
```

---

#### GET /api/message

メッセージキューをポーリング（フロントエンド用）。

**Query Parameters:**
- `clientId` - クライアントID

**Response:**
```json
{
  "messages": [
    {
      "text": "こんにちは！",
      "expression": "happy",
      "timestamp": 1708123456789
    }
  ]
}
```

---

## MCP (Model Context Protocol)

MCPサーバーを有効にすると、WebSocket経由でツール呼び出しが可能です。

### 設定

```json
{
  "mcp": {
    "enabled": true,
    "port": 8081
  }
}
```

### 接続

```
ws://localhost:8081
```

### ツール一覧

#### vrm_speak

```json
{
  "name": "vrm_speak",
  "arguments": {
    "text": "こんにちは！",
    "expression": "happy"
  }
}
```

#### vrm_set_pose

```json
{
  "name": "vrm_set_pose",
  "arguments": {
    "name": "greeting"
  }
}
```

#### vrm_set_expression

```json
{
  "name": "vrm_set_expression",
  "arguments": {
    "name": "happy"
  }
}
```

#### vrm_get_status

```json
{
  "name": "vrm_get_status",
  "arguments": {}
}
```

---

## CLI

サーバー起動後にCLI経由で制御可能：

```bash
# 発話
vrm-avatar speak "こんにちは！"

# ポーズ
vrm-avatar pose greeting

# 表情
vrm-avatar expression happy

# ステータス
vrm-avatar status
```

---

## 使用例

### Python (HTTP API)

```python
import requests

API_URL = "http://localhost:8080"

def speak(text, expression=None):
    payload = {"text": text}
    if expression:
        payload["expression"] = expression
    return requests.post(f"{API_URL}/api/speak", json=payload).json()

def set_pose(name):
    return requests.post(f"{API_URL}/api/pose", json={"pose": name}).json()

def set_expression(name):
    return requests.post(f"{API_URL}/api/expression", json={"expression": name}).json()

# 使用
speak("こんにちは！私はAIアシスタントです。", "happy")
set_pose("greeting")
```

### Node.js (HTTP API)

```javascript
const API_URL = "http://localhost:8080";

async function speak(text, expression = null) {
  const body = { text };
  if (expression) body.expression = expression;
  const res = await fetch(`${API_URL}/api/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function setPose(name) {
  const res = await fetch(`${API_URL}/api/pose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pose: name })
  });
  return res.json();
}

// 使用
await speak("こんにちは！", "happy");
await setPose("greeting");
```

### WebSocket (MCP)

```javascript
const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  // ツール呼び出し
  ws.send(JSON.stringify({
    type: 'request',
    id: '1',
    method: 'vrm_speak',
    params: { text: 'こんにちは！', expression: 'happy' }
  }));
});

ws.on('message', (data) => {
  console.log('Response:', JSON.parse(data));
});
```

---

## 設定リファレンス

```json
{
  "port": 8080,
  "model": "./models/avatar.vrm",
  "idlePose": "./poses/idle.json",
  "vrma": {
    "poseName": "./path/to/animation.vrma"
  },
  "expressions": {
    "default": "neutral",
    "available": ["neutral", "happy", "sad", "angry", "relaxed", "surprised"]
  },
  "tts": {
    "engine": "piper",
    "piper": {
      "command": "piper",
      "model": "ja_JP-test-medium"
    },
    "voicevox": {
      "url": "http://localhost:50021",
      "speaker": 1
    }
  },
  "mcp": {
    "enabled": false,
    "port": 8081
  },
  "hotReload": true
}
```

---

## エラーレスポンス

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

一般的なエラー:
- `400` - パラメータ不足または無効
- `404` - リソースが見つからない
- `500` - サーバー内部エラー

---

## ライセンス

MIT License
