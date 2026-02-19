/**
 * v4l2loopback output module (xvfb + x11grab version)
 * Uses Xvfb virtual display for stable capture
 */

const { spawn, exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class LoopbackOutput {
  constructor(config) {
    this.config = {
      device: config.device || '/dev/video0',
      width: config.width || 1280,
      height: config.height || 720,
      fps: config.fps || 30,
      browserUrl: config.browserUrl || 'http://localhost:8080',
      display: ':99',
      ...config
    };
    
    this.xvfbProcess = null;
    this.browserProcess = null;
    this.ffmpegProcess = null;
    this.isActive = false;
  }
  
  async initDevice() {
    console.log(`🎥 Initializing v4l2loopback device: ${this.config.device}`);
    
    try {
      await execPromise(`test -e ${this.config.device}`);
      console.log(`✅ Device ${this.config.device} exists`);
    } catch (error) {
      const videoNumber = this.config.device.replace('/dev/video', '');
      try {
        await execPromise(`modprobe v4l2loopback video_nr=${videoNumber} card_label="VRMAvatar" exclusive_caps=1`);
        console.log(`✅ Device ${this.config.device} created`);
      } catch (e) {
        throw new Error(`Failed to create video device: ${e.message}`);
      }
    }
  }
  
  async start() {
    if (this.isActive) return;
    
    try {
      await this.initDevice();
      
      console.log('🖥️ Starting Xvfb...');
      await this.startXvfb();
      
      console.log('🌐 Starting browser...');
      await this.startBrowser();
      
      console.log('🎬 Starting FFmpeg...');
      await this.startFFmpeg();
      
      this.isActive = true;
      console.log(`✅ Loopback output active: ${this.config.device}`);
    } catch (error) {
      console.error('❌ Failed:', error.message);
      await this.stop();
      throw error;
    }
  }
  
  async startXvfb() {
    // Start Xvfb
    this.xvfbProcess = spawn('Xvfb', [
      this.config.display,
      '-screen', '0',
      `${this.config.width}x${this.config.height}x24`
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`✅ Xvfb started on ${this.config.display}`);
  }
  
  async startBrowser() {
    const env = {
      ...process.env,
      DISPLAY: this.config.display
    };
    
    // Use google-chrome in kiosk mode
    this.browserProcess = spawn('google-chrome', [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=swiftshader',
      '--enable-features=Vulkan',
      '--kiosk',
      '--disable-infobars',
      '--disable-extensions',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      this.config.browserUrl
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Browser started');
  }
  
  async startFFmpeg() {
    const env = {
      ...process.env,
      DISPLAY: this.config.display
    };
    
    const ffmpegArgs = [
      '-f', 'x11grab',
      '-r', String(this.config.fps),
      '-s', `${this.config.width}x${this.config.height}`,
      '-i', this.config.display,
      '-f', 'v4l2',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'rawvideo',
      this.config.device
    ];
    
    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    this.ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('frame=') && Math.random() < 0.05) {
        console.log('📹', msg.trim());
      }
    });
    
    this.ffmpegProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`FFmpeg exited with code ${code}`);
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ FFmpeg started (x11grab mode)');
  }
  
  async stop() {
    console.log('🛑 Stopping...');
    
    this.isActive = false;
    
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    
    if (this.browserProcess) {
      this.browserProcess.kill('SIGTERM');
      this.browserProcess = null;
    }
    
    if (this.xvfbProcess) {
      this.xvfbProcess.kill('SIGTERM');
      this.xvfbProcess = null;
    }
    
    console.log('✅ Stopped');
  }
  
  getStatus() {
    return {
      active: this.isActive,
      device: this.config.device,
      resolution: `${this.config.width}x${this.config.height}`,
      fps: this.config.fps
    };
  }
}

module.exports = { LoopbackOutput };
