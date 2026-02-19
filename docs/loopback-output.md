# v4l2loopback Output Mode

VRM Avatar Serverを仮想カメラデバイスとして出力する機能です。
Zoom, OBS, Google Meetなどのビデオ会議・配信ソフトでVRMアバターを使用できます。

## 必要条件

- Linux (カーネル 4.x以上推奨)
- v4l2loopback-dkms
- ffmpeg
- X11 display server

## セットアップ

### 1. v4l2loopbackのインストール

```bash
# Ubuntu/Debian
sudo apt install v4l2loopback-dkms ffmpeg

# Arch Linux
sudo pacman -S v4l2loopback-dkms ffmpeg
```

または、セットアップスクリプトを使用:

```bash
sudo ./scripts/setup-loopback.sh
```

### 2. カーネルモジュールのロード

```bash
# 手動でロード
sudo modprobe v4l2loopback video_nr=0 card_label="VRMAvatar" exclusive_caps=1

# 起動時に自動ロード（オプション）
echo "v4l2loopback" | sudo tee -a /etc/modules
echo "options v4l2loopback video_nr=0 card_label=VRMAvatar exclusive_caps=1" | \
  sudo tee /etc/modprobe.d/v4l2loopback.conf
```

### 3. 設定ファイルの変更

`config.json`を編集:

```json
{
  "output": "loopback",
  "loopback": {
    "device": "/dev/video0",
    "width": 1280,
    "height": 720,
    "fps": 30
  },
  ...
}
```

### 4. サーバー起動

```bash
npm start
```

サーバーは以下の順序で起動します:
1. VRM Avatar Server (http://localhost:8080)
2. Headless browser (バックグラウンドで描画)
3. FFmpeg (キャプチャして /dev/video0 に出力)

### 5. アプリケーションで使用

Zoom, OBS, Google Meetなどで「VRMAvatar」または「/dev/video0」を選択。

## 設定オプション

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `output` | string | "browser" | 出力モード ("browser" または "loopback") |
| `loopback.device` | string | "/dev/video0" | v4l2loopbackデバイスパス |
| `loopback.width` | number | 1280 | 解像度（幅） |
| `loopback.height` | number | 720 | 解像度（高さ） |
| `loopback.fps` | number | 30 | フレームレート |

## トラブルシューティング

### デバイスが作成されない

```bash
# モジュールがロードされているか確認
lsmod | grep v4l2

# デバイスファイルの確認
ls -la /dev/video*

# 手動でデバイスを作成
sudo modprobe v4l2loopback video_nr=0 card_label="VRMAvatar" exclusive_caps=1
```

### ffmpegエラー

```bash
# ffmpegがインストールされているか確認
ffmpeg -version

# X11ディスプレイにアクセスできるか確認
echo $DISPLAY
```

### パフォーマンス問題

- 解像度を下げる (width/height)
- フレームレートを下げる (fps)
- Puppeteerをインストール (より効率的なキャプチャ)

```bash
npm install puppeteer
```

## API

### GET /api/status

ループバック出力の状態を確認:

```bash
curl http://localhost:8080/api/status
```

Response:
```json
{
  "status": "running",
  "output": "loopback",
  "loopback": {
    "active": true,
    "device": "/dev/video0",
    "resolution": "1280x720",
    "fps": 30
  }
}
```

## アーキテクチャ

```
┌─────────────────────┐
│  VRM Avatar Server  │
│  (Express + API)    │
└──────────┬──────────┘
           │
           ├─ browser mode → http://localhost:8080
           │
           └─ loopback mode
                  │
                  ├─ Puppeteer/Chromium (headless)
                  │   └─ Renders canvas at localhost:8080
                  │
                  └─ FFmpeg
                      └─ Captures X11 → /dev/video0
```

## 使用例

### OBSでの使用

1. ソース → ビデオ入力デバイスを追加
2. デバイス: "VRMAvatar" を選択
3. アバターがOBSに表示される

### Zoomでの使用

1. 設定 → ビデオ
2. カメラ: "VRMAvatar" を選択
3. アバターがZoomに表示される

### Google Meetでの使用

1. 設定 → ビデオ
2. カメラ: "VRMAvatar" を選択
3. アバターがMeetに表示される

## 制限事項

- Linuxのみ対応
- root権限が必要な場合がある（モジュールロード時）
- X11ディスプレイが必要（Waylandは未サポート）
- オーディオは別途仮想オーディオデバイスが必要

## 関連

- [v4l2loopback](https://github.com/umlaeute/v4l2loopback)
- [FFmpeg](https://ffmpeg.org/)
- [Puppeteer](https://pptr.dev/)
