/**
 * Config module with hot reload support
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

let config = {};
let configPath = null;
let onChangeCallbacks = [];

/**
 * Load config from file
 */
function loadConfig(filePath) {
  configPath = path.resolve(filePath);
  
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
    console.log('📝 Config loaded:', configPath);
    return config;
  } catch (error) {
    console.warn('⚠️ Config load failed, using defaults:', error.message);
    return getDefaultConfig();
  }
}

/**
 * Get default config
 */
function getDefaultConfig() {
  return {
    port: 8080,
    model: './models/avatar.vrm',
    idlePose: './poses/idle.json',
    vrma: {},
    expressions: {
      default: 'neutral',
      available: ['neutral', 'happy', 'sad', 'angry', 'relaxed', 'surprised']
    },
    tts: {
      engine: 'piper',
      piper: {
        command: 'piper',
        model: 'ja_JP-test-medium'
      }
    },
    mcp: {
      enabled: false,
      port: 8081
    },
    hotReload: true
  };
}

/**
 * Get current config
 */
function getConfig() {
  return { ...config };
}

/**
 * Watch config file for changes
 */
function watchConfig() {
  if (!configPath || !config.hotReload) return;
  
  const watcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true
  });
  
  watcher.on('change', () => {
    console.log('🔄 Config changed, reloading...');
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const newConfig = JSON.parse(content);
      config = newConfig;
      
      // Notify callbacks
      onChangeCallbacks.forEach(cb => {
        try {
          cb(config);
        } catch (e) {
          console.error('Config change callback error:', e);
        }
      });
      
      console.log('✅ Config reloaded');
    } catch (error) {
      console.error('❌ Config reload failed:', error.message);
    }
  });
  
  console.log('👀 Watching config for changes');
}

/**
 * Register callback for config changes
 */
function onConfigChange(callback) {
  onChangeCallbacks.push(callback);
}

/**
 * Resolve path relative to config file
 */
function resolvePath(relativePath) {
  if (!configPath) return path.resolve(relativePath);
  return path.resolve(path.dirname(configPath), relativePath);
}

module.exports = {
  loadConfig,
  getConfig,
  watchConfig,
  onConfigChange,
  resolvePath,
  getDefaultConfig
};
