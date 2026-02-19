#!/usr/bin/env node

/**
 * Phantom-VRM CLI
 *
 * Usage:
 *   phantom-vrm start [options]       Start server
 *   phantom-vrm creation              Start server & open creation mode
 *   phantom-vrm speak "text"          Make avatar speak
 *   phantom-vrm pose <name>           Change pose
 *   phantom-vrm expression <name>     Change expression
 *   phantom-vrm status                Show status
 */

const path = require('path');
const fs = require('fs');

// CLI引数解析
const args = process.argv.slice(2);
const command = args[0];

// ヘルプ
if (!command || command === '--help' || command === '-h') {
  console.log(`
Phantom-VRM - AI-controllable VRM avatar

Usage:
  phantom-vrm start [options]         Start server
  phantom-vrm creation                Start server & open creation mode
  phantom-vrm speak "text"            Make avatar speak
  phantom-vrm pose <name>             Change pose
  phantom-vrm expression <name>       Change expression
  phantom-vrm status                  Show status

Start Options:
  --config, -c <path>    Config file path (default: ./config.json)
  --port, -p <port>      Server port (default: from config or 8080)
  --debug, -d            Enable debug mode
  --no-browser           Don't open browser automatically
  --help, -h             Show this help

Examples:
  phantom-vrm start --config config.json
  phantom-vrm creation                    # Open creation mode
  phantom-vrm start -c myconfig.json --debug
  phantom-vrm speak "こんにちは"
  phantom-vrm pose greeting
  phantom-vrm expression happy
`);
  process.exit(0);
}

// 設定ファイル読み込み
function loadConfig(configPath) {
  const fullPath = path.resolve(configPath || './config.json');
  if (fs.existsSync(fullPath)) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  }
  return {};
}

// サーバー起動
function startServer(openCreationMode = false, openBrowser = true) {
  let configPath = './config.json';
  let port = null;
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'start' || args[i] === 'creation') {
      // start/creationコマンドはスキップ
      continue;
    } else if ((args[i] === '--config' || args[i] === '-c') && args[i + 1]) {
      configPath = args[i + 1];
      i++;
    } else if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      port = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--debug' || args[i] === '-d') {
      debug = true;
    } else if (args[i] === '--no-browser') {
      openBrowser = false;
    }
  }

  const config = loadConfig(configPath);
  if (port) {
    config.port = port;
  }
  config.debug = debug;

  // ブラウザを開く設定を追加
  if (openCreationMode) {
    config.openBrowser = true;
    config.browserUrl = '?creation';
  } else if (openBrowser) {
    config.openBrowser = true;
  }

  // サーバー起動
  const { createServer } = require('../src/server.js');
  createServer(config);
}

// API呼び出し（CLIから）
async function callApi(endpoint, method = 'GET', body = null) {
  const http = require('http');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: endpoint,
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// コマンド実行
async function runCommand() {
  try {
    let result;

    switch (command) {
      case 'creation':
        // クリエイションモードでサーバー起動
        startServer(true, true);
        return;

      case 'speak':
        const text = args[1];
        if (!text) {
          console.error('Error: text required');
          process.exit(1);
        }
        result = await callApi('/api/speak', 'POST', { text });
        console.log('🗣️ Speaking:', text);
        break;

      case 'pose':
        const poseName = args[1];
        if (!poseName) {
          console.error('Error: pose name required');
          process.exit(1);
        }
        result = await callApi('/api/pose', 'POST', { pose: poseName });
        console.log('🎭 Pose:', poseName);
        break;

      case 'expression':
        const exprName = args[1];
        if (!exprName) {
          console.error('Error: expression name required');
          process.exit(1);
        }
        result = await callApi('/api/expression', 'POST', { expression: exprName });
        console.log('😊 Expression:', exprName);
        break;

      case 'status':
        result = await callApi('/api/status');
        console.log('📊 Status:', JSON.stringify(result, null, 2));
        break;

      default:
        // 不明なコマンドはサーバー起動として扱う
        startServer(false, true);
        return;
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Is the server running? Start with: phantom-vrm start');
    process.exit(1);
  }
}

// メイン
if (['speak', 'pose', 'expression', 'status', 'creation'].includes(command)) {
  runCommand();
} else {
  // startコマンドか、直接オプション指定の場合はサーバー起動
  startServer(false, true);
}
