/**
 * API-based TTS engines
 * Supports OpenAI, Google Cloud TTS, Azure TTS, etc.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * OpenAI TTS (text-to-speech)
 * Requires OPENAI_API_KEY environment variable
 */
function createOpenAITTS(config) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  const model = config.model || 'tts-1';
  const voice = config.voice || 'alloy';

  if (!apiKey) {
    console.warn('OpenAI API key not found. Set OPENAI_API_KEY environment variable or tts.openai.apiKey in config.');
    return createDummyTTS();
  }

  return {
    name: 'openai',
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text + voice).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.mp3`);

      // Check cache
      if (fs.existsSync(outputFile)) {
        return {
          audioUrl: `/audio/${hash}.mp3`,
          duration: getAudioDuration(outputFile)
        };
      }

      const url = new URL('https://api.openai.com/v1/audio/speech');

      const postData = JSON.stringify({
        model: model,
        input: text,
        voice: voice
      });

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              reject(new Error(`OpenAI API error: ${res.statusCode} - ${body}`));
            });
            return;
          }

          const fileStream = fs.createWriteStream(outputFile);
          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve({
              audioUrl: `/audio/${hash}.mp3`,
              duration: getAudioDuration(outputFile)
            });
          });

          fileStream.on('error', (err) => {
            reject(err);
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });
    }
  };
}

/**
 * Google Cloud Text-to-Speech
 * Requires GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_API_KEY
 */
function createGoogleTTS(config) {
  const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
  const languageCode = config.languageCode || 'en-US';
  const voiceName = config.voiceName || null;
  const ssmlGender = config.ssmlGender || 'NEUTRAL';

  if (!apiKey) {
    console.warn('Google API key not found. Set GOOGLE_API_KEY environment variable or tts.google.apiKey in config.');
    return createDummyTTS();
  }

  return {
    name: 'google',
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text + languageCode + (voiceName || '')).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.mp3`);

      if (fs.existsSync(outputFile)) {
        return {
          audioUrl: `/audio/${hash}.mp3`,
          duration: getAudioDuration(outputFile)
        };
      }

      const postData = JSON.stringify({
        input: { text: text },
        voice: {
          languageCode: languageCode,
          name: voiceName,
          ssmlGender: ssmlGender
        },
        audioConfig: { audioEncoding: 'MP3' }
      });

      const options = {
        hostname: 'texttospeech.googleapis.com',
        path: `/v1/text:synthesize?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              reject(new Error(`Google API error: ${res.statusCode} - ${body}`));
            });
            return;
          }

          let data = [];
          res.on('data', (chunk) => { data.push(chunk); });
          res.on('end', () => {
            const response = JSON.parse(Buffer.concat(data).toString());
            const audioBuffer = Buffer.from(response.audioContent, 'base64');
            fs.writeFileSync(outputFile, audioBuffer);
            resolve({
              audioUrl: `/audio/${hash}.mp3`,
              duration: getAudioDuration(outputFile)
            });
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });
    }
  };
}

/**
 * Azure Cognitive Services Speech Service
 * Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables
 */
function createAzureTTS(config) {
  const subscriptionKey = config.subscriptionKey || process.env.AZURE_SPEECH_KEY;
  const region = config.region || process.env.AZURE_SPEECH_REGION || 'eastus';
  const voice = config.voice || 'en-US-JennyNeural';

  if (!subscriptionKey) {
    console.warn('Azure Speech key not found. Set AZURE_SPEECH_KEY environment variable or tts.azure.subscriptionKey in config.');
    return createDummyTTS();
  }

  return {
    name: 'azure',
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text + voice).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.mp3`);

      if (fs.existsSync(outputFile)) {
        return {
          audioUrl: `/audio/${hash}.mp3`,
          duration: getAudioDuration(outputFile)
        };
      }

      const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' name='${voice}'>${text}</voice></speak>`;

      const options = {
        hostname: `${region}.tts.speech.microsoft.com`,
        path: '/cognitiveservices/v1',
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Azure API error: ${res.statusCode}`));
            return;
          }

          const fileStream = fs.createWriteStream(outputFile);
          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve({
              audioUrl: `/audio/${hash}.mp3`,
              duration: getAudioDuration(outputFile)
            });
          });

          fileStream.on('error', (err) => {
            reject(err);
          });
        });

        req.on('error', reject);
        req.write(ssml);
        req.end();
      });
    }
  };
}

/**
 * Generic HTTP API TTS
 * For custom API endpoints
 */
function createGenericAPITTS(config) {
  const url = config.url;
  const method = config.method || 'POST';
  const headers = config.headers || {};
  const bodyTemplate = config.body || null;
  const audioPathInResponse = config.audioPath || 'audio'; // JSON path to audio data
  const audioFormat = config.outputFormat || 'mp3'; // mp3, wav, etc.

  if (!url) {
    console.warn('Generic API TTS: url not configured');
    return createDummyTTS();
  }

  return {
    name: 'generic-api',
    async synthesize(text, outputDir) {
      const hash = crypto.createHash('md5').update(text + url).digest('hex');
      const outputFile = path.join(outputDir, `${hash}.${audioFormat}`);

      if (fs.existsSync(outputFile)) {
        return {
          audioUrl: `/audio/${hash}.${audioFormat}`,
          duration: getAudioDuration(outputFile)
        };
      }

      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      let postData = null;
      if (bodyTemplate) {
        postData = JSON.stringify(JSON.parse(bodyTemplate.replace('{text}', JSON.stringify(text))));
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: headers
      };

      if (postData) {
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      return new Promise((resolve, reject) => {
        const req = protocol.request(options, (res) => {
          let data = [];
          res.on('data', (chunk) => { data.push(chunk); });

          res.on('end', () => {
            const buffer = Buffer.concat(data);

            // Check if response is JSON or binary audio
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
              try {
                const json = JSON.parse(buffer.toString());
                // Extract audio data based on configured path
                const audioData = audioPathInResponse.split('.').reduce((obj, key) => obj?.[key], json);
                if (audioData) {
                  const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
                  fs.writeFileSync(outputFile, audioBuffer);
                } else {
                  reject(new Error('Audio data not found in response'));
                  return;
                }
              } catch (e) {
                reject(new Error(`Failed to parse JSON response: ${e.message}`));
                return;
              }
            } else {
              // Direct audio response
              fs.writeFileSync(outputFile, buffer);
            }

            resolve({
              audioUrl: `/audio/${hash}.${audioFormat}`,
              duration: getAudioDuration(outputFile)
            });
          });
        });

        req.on('error', reject);

        if (postData) {
          req.write(postData);
        }
        req.end();
      });
    }
  };
}

/**
 * Get audio file duration (estimation)
 * For accurate duration, you would need to use a library like music-metadata
 */
function getAudioDuration(filePath) {
  // Rough estimation based on file size
  // Average: 128kbps MP3 = 16KB/sec
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const estimatedSeconds = stats.size / 16000;
    return Math.round(estimatedSeconds * 1000);
  }
  return 0;
}

/**
 * Estimate duration from text
 */
function estimateDuration(text) {
  const charsPerSecond = 12;
  return Math.max(500, (text.length / charsPerSecond) * 1000);
}

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

module.exports = {
  createOpenAITTS,
  createGoogleTTS,
  createAzureTTS,
  createGenericAPITTS
};
