/**
 * TTS Engine Abstraction Layer
 */

const { createPiperTTS } = require('./piper');
const { createVoicevoxTTS } = require('./voicevox');
const {
  createOpenAITTS,
  createGoogleTTS,
  createAzureTTS,
  createGenericAPITTS
} = require('./api');

/**
 * TTS エンジンを作成
 */
function createTTSEngine(config) {
  const engine = config?.engine || 'none';

  switch (engine) {
    case 'piper':
      return createPiperTTS(config?.piper || {});
    case 'voicevox':
      return createVoicevoxTTS(config?.voicevox || {});
    case 'openai':
      return createOpenAITTS(config?.openai || {});
    case 'google':
      return createGoogleTTS(config?.google || {});
    case 'azure':
      return createAzureTTS(config?.azure || {});
    case 'api':
      return createGenericAPITTS(config?.api || {});
    case 'custom':
      return createCustomTTS(config?.custom || {});
    case 'none':
      return createDummyTTS();
    default:
      console.warn(`Unknown TTS engine: ${engine}, using none`);
      return createDummyTTS();
  }
}

/**
 * カスタムTTS（任意コマンド）
 */
function createCustomTTS(config) {
  if (!config.command) {
    return createDummyTTS();
  }
  
  const { execSync } = require('child_process');
  
  return {
    name: 'custom',
    async synthesize(text, outputDir) {
      const hash = require('crypto').createHash('md5').update(text).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.wav`);
      
      // コマンドを実行（テキストをstdinか引数で渡す）
      const cmd = config.command.replace('{text}', `"${text}"`).replace('{output}', outputFile);
      execSync(cmd, { timeout: 30000 });
      
      return {
        audioUrl: `/audio/${hash}.wav`,
        duration: estimateDuration(text)
      };
    }
  };
}

/**
 * ダミーTTS（音声生成なし）
 */
function createDummyTTS() {
  return {
    name: 'none',
    async synthesize(text) {
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

module.exports = {
  createTTSEngine,
  createDummyTTS
};
