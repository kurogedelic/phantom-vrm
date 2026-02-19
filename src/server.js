/**
 * VRM Avatar Server
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { loadConfig, watchConfig, getConfig, onConfigChange, resolvePath } = require('./config');
const { createTTSEngine } = require('./tts');
const { LoopbackOutput } = require('./loopback');

// メッセージキュー（クライアント通信用）
const messageQueues = {};

// TTS エンジン
let ttsEngine = null;

// Loopback output
let loopbackOutput = null;

// サーバー状態
let serverStatus = {
  model: null,
  poses: [],
  expressions: []
};

/**
 * サーバー作成
 */
function createServer(options = {}) {
  const app = express();
  const config = { ...options };
  const port = config.port || 8080;
  const debug = config.debug || false;
  
  // ミドルウェア
  app.use(express.json());
  
  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // 静的ファイル配信
  const publicDir = path.resolve(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  
  // 音声キャッシュディレクトリ
  const audioDir = path.join(publicDir, 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  app.use('/audio', express.static(audioDir));
  
  // モデルパス（設定から）
  if (config.model) {
    const modelPath = resolvePath(config.model);
    const modelDir = path.dirname(modelPath);
    app.use('/models', express.static(modelDir));
    console.log('📂 Models:', modelDir);
  }
  
  // VRMAパス（設定から）
  if (config.vrma) {
    // 複数のVRMAディレクトリをサポート
    const vrmaDirs = new Set();
    Object.values(config.vrma).forEach(vrmaPath => {
      const fullPath = resolvePath(vrmaPath);
      vrmaDirs.add(path.dirname(fullPath));
    });
    vrmaDirs.forEach(dir => {
      app.use('/vrma', express.static(dir));
    });
    console.log('📂 VRMA directories:', Array.from(vrmaDirs));
  }
  
  // TTS エンジン初期化
  ttsEngine = createTTSEngine(config.tts || { engine: 'piper' });
  
  // ==================== API ====================
  
  // ステータス
  app.get('/api/status', (req, res) => {
    const status = {
      status: 'running',
      model: config.model,
      poses: Object.keys(config.vrma || {}),
      expressions: config.expressions?.available || [],
      output: config.output || 'browser'
    };
    
    if (loopbackOutput) {
      status.loopback = loopbackOutput.getStatus();
    }
    
    res.json(status);
  });
  
  // 発話
  app.post('/api/speak', async (req, res) => {
    const { clientId = 'phantom-vrm-client', text, expression } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }
    
    // 表情も同時に設定
    if (expression) {
      queueMessage(clientId, { expression });
    }
    
    // TTS処理
    try {
      const ttsResult = await ttsEngine.synthesize(text, audioDir);
      queueMessage(clientId, {
        text,
        audioUrl: ttsResult.audioUrl,
        duration: ttsResult.duration
      });
      console.log(`🗣️ Speak [${clientId}]:`, text.substring(0, 50));
      res.json({ success: true, audioUrl: ttsResult.audioUrl });
    } catch (error) {
      console.error('TTS error:', error);
      // TTS失敗時は疑似リップシンク
      const duration = estimateDuration(text);
      queueMessage(clientId, { text, duration });
      res.json({ success: true, duration });
    }
  });
  
  // 表情
  app.post('/api/expression', (req, res) => {
    const { clientId = 'phantom-vrm-client', expression } = req.body;
    
    if (!expression) {
      return res.status(400).json({ error: 'expression required' });
    }
    
    queueMessage(clientId, { expression });
    console.log(`😊 Expression [${clientId}]:`, expression);
    res.json({ success: true, expression });
  });
  
  // TTS (音声のみ生成、ブラウザから直接呼ばれる用)
  app.post('/api/tts', async (req, res) => {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }
    
    try {
      const ttsResult = await ttsEngine.synthesize(text, audioDir);
      console.log(`🔊 TTS:`, text.substring(0, 50), '→', ttsResult.audioUrl || 'pseudo');
      res.json({
        success: true,
        audioUrl: ttsResult.audioUrl,
        duration: ttsResult.duration
      });
    } catch (error) {
      console.error('TTS error:', error);
      const duration = estimateDuration(text);
      res.json({ success: true, duration });
    }
  });
  
  // ポーズ
  app.post('/api/pose', (req, res) => {
    const { clientId = 'phantom-vrm-client', pose } = req.body;
    
    if (!pose) {
      return res.status(400).json({ error: 'pose required' });
    }
    
    queueMessage(clientId, { pose });
    console.log(`🎭 Pose [${clientId}]:`, pose);
    res.json({ success: true, pose });
  });
  
  // メッセージ取得（ポーリング用）
  app.get('/api/message', (req, res) => {
    const { clientId = 'phantom-vrm-client' } = req.query;
    const messages = messageQueues[clientId] || [];
    messageQueues[clientId] = [];
    res.json({ messages });
  });
  
  // ポーズ一覧
  app.get('/api/poses', (req, res) => {
    res.json({
      poses: Object.keys(config.vrma || {}),
      descriptions: Object.fromEntries(
        Object.entries(config.vrma || {}).map(([k, v]) => [k, path.basename(v)])
      )
    });
  });
  
  // カメラ設定
  app.post('/api/camera', (req, res) => {
    const { clientId = 'phantom-vrm-client', distance, height, angleX, fov } = req.body;

    const settings = {};
    if (distance !== undefined) settings.distance = parseFloat(distance);
    if (height !== undefined) settings.height = parseFloat(height);
    if (angleX !== undefined) settings.angleX = parseFloat(angleX);
    if (fov !== undefined) settings.fov = parseFloat(fov);

    queueMessage(clientId, { camera: settings });
    console.log(`📷 Camera [${clientId}]:`, settings);
    res.json({ success: true, settings });
  });

  // 背景設定
  app.post('/api/background', (req, res) => {
    const { clientId = 'phantom-vrm-client', preset } = req.body;

    if (!preset) {
      return res.status(400).json({ error: 'preset required' });
    }

    queueMessage(clientId, { background: preset });
    console.log(`🎨 Background [${clientId}]:`, preset);
    res.json({ success: true, preset });
  });

  // ライト設定
  app.post('/api/lighting', (req, res) => {
    const { clientId = 'phantom-vrm-client', main, ambient } = req.body;

    const settings = {};
    if (main !== undefined) settings.main = parseFloat(main);
    if (ambient !== undefined) settings.ambient = parseFloat(ambient);

    queueMessage(clientId, { lighting: settings });
    console.log(`💡 Lighting [${clientId}]:`, settings);
    res.json({ success: true, settings });
  });

  // 設定取得
  app.get('/api/config', (req, res) => {
    // モデルパスを相対パスに変換（/models/xxx.vrm の形式）
    let modelPath = config.model || null;
    if (modelPath) {
      const modelDir = path.dirname(resolvePath(config.model));
      const modelName = path.basename(modelPath);
      modelPath = `/models/${modelName}`;
    }

    // VRMAパスも同様に変換
    const vrmaPaths = {};
    if (config.vrma) {
      for (const [key, vrmaPath] of Object.entries(config.vrma)) {
        const vrmaDir = path.dirname(resolvePath(vrmaPath));
        const vrmaName = path.basename(vrmaPath);
        vrmaPaths[key] = `/vrma/${vrmaName}`;
      }
    }

    res.json({
      model: modelPath,
      vrma: vrmaPaths,
      poses: Object.keys(config.vrma || {}),
      expressions: config.expressions?.available || []
    });
  });
  
  // 設定のホットリロード
  if (config.hotReload) {
    watchConfig();
    onConfigChange((newConfig) => {
      // TTSエンジン再初期化
      if (newConfig.tts) {
        ttsEngine = createTTSEngine(newConfig.tts);
      }
      // サーバー状態更新
      updateServerStatus(newConfig);
    });
  }
  
  // サーバー状態更新
  updateServerStatus(config);

  // サーバー起動
  const server = app.listen(port, '0.0.0.0', async () => {
    console.log(`👻 Phantom-VRM running at http://localhost:${port}`);
    console.log(`📂 Public: ${publicDir}`);
    console.log(`🔊 TTS: ${config.tts?.engine || 'none'}`);
    
    // Loopback output mode
    if (config.output === 'loopback') {
      try {
        const browserUrl = debug
          ? `http://localhost:${port}?debug`
          : `http://localhost:${port}`;
        loopbackOutput = new LoopbackOutput({
          ...config.loopback,
          browserUrl: browserUrl
        });
        await loopbackOutput.start();
      } catch (error) {
        console.error('❌ Failed to start loopback output:', error.message);
        console.log('💡 Falling back to browser mode');
      }
    }

    // Debug mode info
    if (debug) {
      console.log(`🐛 Debug mode enabled`);
      console.log(`🔗 Browser URL: http://localhost:${port}?debug`);
    } else {
      console.log(`🔗 Browser URL: http://localhost:${port}`);
    }

    // ブラウザを自動的に開く（ループバックモードでない場合のみ）
    if (config.openBrowser && config.output !== 'loopback') {
      const open = require('open');
      const url = config.browserUrl
        ? `http://localhost:${port}${config.browserUrl}`
        : (debug ? `http://localhost:${port}?debug` : `http://localhost:${port}`);
      setTimeout(() => {
        open(url).catch(err => console.log('ℹ️ Could not open browser:', err.message));
      }, 1000);
    }
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('📴 Shutting down...');
    if (loopbackOutput) {
      await loopbackOutput.stop();
    }
    server.close();
  });
  
  process.on('SIGINT', async () => {
    console.log('📴 Shutting down...');
    if (loopbackOutput) {
      await loopbackOutput.stop();
    }
    server.close();
    process.exit(0);
  });
  
  return app;
}

/**
 * サーバー状態更新
 */
function updateServerStatus(config) {
  serverStatus = {
    model: config.model ? path.basename(config.model) : null,
    poses: Object.keys(config.vrma || {}),
    expressions: config.expressions?.available || []
  };
}

/**
 * メッセージをキューに追加
 */
function queueMessage(clientId, message) {
  if (!messageQueues[clientId]) {
    messageQueues[clientId] = [];
  }
  messageQueues[clientId].push({
    ...message,
    timestamp: Date.now()
  });
}

/**
 * 発話時間推定
 */
function estimateDuration(text) {
  const charsPerSecond = 12;
  return Math.max(500, (text.length / charsPerSecond) * 1000);
}

module.exports = { createServer };
