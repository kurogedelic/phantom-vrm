/**
 * Piper TTS Engine
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Piper TTS エンジンを作成
 */
function createPiperTTS(config) {
  const command = config.command || 'piper';
  const model = config.model || 'ja_JP-test-medium';
  
  // piperが利用可能かチェック
  let available = false;
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    available = true;
  } catch {
    console.warn('⚠️ Piper not found, using fake lipsync');
  }
  
  return {
    name: 'piper',
    
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.wav`);
      
      // キャッシュチェック
      if (fs.existsSync(outputFile)) {
        console.log(`🔊 TTS cached: ${text.substring(0, 30)}...`);
        return {
          audioUrl: `/audio/${hash}.wav`,
          duration: estimateDuration(text)
        };
      }
      
      if (!available) {
        return {
          audioUrl: null,
          duration: estimateDuration(text)
        };
      }
      
      // piperで音声生成
      try {
        const escapedText = text.replace(/"/g, '\\"');
        execSync(`echo "${escapedText}" | ${command} --model ${model} --output_file "${outputFile}"`, {
          timeout: 30000
        });
        
        if (fs.existsSync(outputFile)) {
          console.log(`🔊 TTS generated: ${text.substring(0, 30)}...`);
          return {
            audioUrl: `/audio/${hash}.wav`,
            duration: estimateDuration(text)
          };
        }
      } catch (error) {
        console.error('Piper TTS error:', error.message);
      }
      
      return {
        audioUrl: null,
        duration: estimateDuration(text)
      };
    }
  };
}

/**
 * 発話時間推定
 */
function estimateDuration(text) {
  const charsPerSecond = 12;
  return Math.max(500, (text.length / charsPerSecond) * 1000);
}

module.exports = { createPiperTTS };
