/**
 * VOICEVOX TTS Engine
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * VOICEVOX TTS エンジンを作成
 */
function createVoicevoxTTS(config) {
  const baseUrl = config.url || 'http://localhost:50021';
  const speaker = config.speaker || 1;
  
  // 音声パラメータ
  const pitchScale = config.pitchScale || 0.0;
  const speedScale = config.speedScale || 1.0;
  const intonationScale = config.intonationScale || 1.0;
  
  // VOICEVOXが利用可能かチェック
  let available = false;
  
  return {
    name: 'voicevox',
    
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.wav`);
      
      // キャッシュチェック
      if (fs.existsSync(outputFile)) {
        console.log(`🔊 VOICEVOX cached: ${text.substring(0, 30)}...`);
        return {
          audioUrl: `/audio/${hash}.wav`,
          duration: estimateDuration(text)
        };
      }
      
      try {
        // 1. audio_query
        const queryUrl = `${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
        const queryResult = await httpPost(queryUrl, {});
        
        // パラメータ適用
        if (queryResult) {
          queryResult.pitchScale = pitchScale;
          queryResult.speedScale = speedScale;
          queryResult.intonationScale = intonationScale;
          console.log(`🔊 VOICEVOX params: pitch=${pitchScale}, speed=${speedScale}, intonation=${intonationScale}`);
        }
        
        if (!queryResult) {
          throw new Error('audio_query failed');
        }
        
        // 2. synthesis
        const synthUrl = `${baseUrl}/synthesis?speaker=${speaker}`;
        const audioBuffer = await httpPostBinary(synthUrl, queryResult);
        
        if (audioBuffer) {
          fs.writeFileSync(outputFile, audioBuffer);
          console.log(`🔊 VOICEVOX generated: ${text.substring(0, 30)}...`);
          return {
            audioUrl: `/audio/${hash}.wav`,
            duration: estimateDuration(text)
          };
        }
      } catch (error) {
        console.error('VOICEVOX error:', error.message);
      }
      
      return {
        audioUrl: null,
        duration: estimateDuration(text)
      };
    }
  };
}

/**
 * HTTP POST (JSON)
 */
function httpPost(urlString, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * HTTP POST (Binary response)
 */
function httpPostBinary(urlString, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = typeof data === 'string' ? data : JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };
    
    const req = client.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * 発話時間推定
 */
function estimateDuration(text) {
  const charsPerSecond = 12;
  return Math.max(500, (text.length / charsPerSecond) * 1000);
}

module.exports = { createVoicevoxTTS };
