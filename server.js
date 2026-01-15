const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3080;

// Folders
const UPLOADS_DIR = './uploads';
const OUTPUTS_DIR = './outputs';

[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.json({ limit: '50mb' }));
app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: '🎵 ONLINE',
    message: 'Professional LoFi Remix API - YouTube Quality',
    version: '3.1.0',
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    effects: {
      'youtube_slowed': 'YouTube-style slowed + reverb (BEST)',
      'tiktok_slowed': 'TikTok viral slowed reverb',
      'ultra_slowed': 'Maximum slowed + deep reverb',
      'lofi_chill': 'Classic LoFi vibe',
      'bass_boost': 'Heavy bass boost',
      'nightcore': 'Fast & high pitch'
    },
    usage: {
      endpoint: 'POST /remix',
      body: {
        audioUrl: 'https://example.com/song.mp3',
        effect: 'youtube_slowed'
      }
    }
  });
});

// YOUTUBE-QUALITY EFFECT FILTERS
const effectFilters = {
  youtube_slowed: [
    'asetrate=44100*0.82',
    'aresample=44100',
    'atempo=0.92',
    'aecho=0.8:0.9:40:0.5',
    'aecho=0.8:0.88:100:0.4',
    'aecho=0.8:0.85:200:0.35',
    'aecho=0.8:0.82:400:0.25',
    'highpass=f=150',
    'lowpass=f=12000',
    'bass=g=7:f=90:w=0.7',
    'treble=g=-1:f=6000:w=0.5',
    'stereotools=mlev=0.015',
    'acompressor=threshold=-18dB:ratio=3.5:attack=8:release=100',
    'alimiter=limit=0.95',
    'volume=1.35'
  ],
  
  tiktok_slowed: [
    'asetrate=44100*0.80',
    'aresample=44100',
    'atempo=0.90',
    'aecho=0.8:0.9:50:0.6',
    'aecho=0.8:0.85:150:0.45',
    'aecho=0.8:0.80:350:0.3',
    'bass=g=9:f=85:w=0.8',
    'highpass=f=120',
    'acompressor=threshold=-16dB:ratio=4:attack=5:release=80',
    'volume=1.4'
  ],
  
  ultra_slowed: [
    'asetrate=44100*0.70',
    'aresample=44100',
    'atempo=0.85',
    'aecho=0.8:0.9:100:0.6',
    'aecho=0.8:0.85:250:0.5',
    'aecho=0.8:0.80:500:0.4',
    'bass=g=10:f=80:w=0.9',
    'highpass=f=100',
    'lowpass=f=10000',
    'acompressor=threshold=-20dB:ratio=4:attack=10:release=120',
    'volume=1.5'
  ],
  
  lofi_chill: [
    'lowpass=f=3000:p=1',
    'highpass=f=300:p=1',
    'acompressor=threshold=-12dB:ratio=3:attack=5:release=50',
    'equalizer=f=100:width_type=h:width=200:g=4',
    'equalizer=f=8000:width_type=h:width=2000:g=-3',
    'aecho=0.8:0.9:60:0.3',
    'volume=1.4'
  ],
  
  bass_boost: [
    'bass=g=15:f=70:w=0.8',
    'equalizer=f=50:width_type=h:width=50:g=10',
    'equalizer=f=100:width_type=h:width=100:g=8',
    'acompressor=threshold=-20dB:ratio=5:attack=3:release=60',
    'lowpass=f=5000',
    'volume=1.6'
  ],
  
  nightcore: [
    'asetrate=44100*1.15',
    'aresample=44100',
    'atempo=1.08',
    'treble=g=3:f=4000:w=0.5',
    'acompressor=threshold=-14dB:ratio=2.5:attack=3:release=40',
    'volume=1.3'
  ]
};

// Enhanced download with retry and proper headers
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);
    
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      },
      timeout: 60000 // 60 second timeout
    };
    
    const request = protocol.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`↪️ Redirecting to: ${redirectUrl}`);
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
          console.log(`📥 Download progress: ${progress}%`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Download complete: ${(downloadedSize / 1024 / 1024).toFixed(2)}MB`);
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      file.close();
      fs.unlink(dest, () => {});
      reject(new Error('Download timeout after 60s'));
    });
    
    request.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
    
    request.end();
  });
}

// Main remix endpoint with better error handling
app.post('/remix', async (req, res) => {
  let inputFile = null;
  let outputFile = null;
  const startTime = Date.now();
  
  try {
    const { audioUrl, effect = 'youtube_slowed' } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎵 NEW REQUEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📥 URL: ${audioUrl}`);
    console.log(`🎚️ Effect: ${effect}`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Validation
    if (!audioUrl) {
      console.log('❌ Missing audioUrl');
      return res.status(400).json({ 
        error: 'audioUrl is required',
        example: {
          audioUrl: 'https://example.com/song.mp3',
          effect: 'youtube_slowed'
        }
      });
    }
    
    if (!effectFilters[effect]) {
      console.log(`❌ Invalid effect: ${effect}`);
      return res.status(400).json({ 
        error: 'Invalid effect',
        available: Object.keys(effectFilters)
      });
    }
    
    // Download audio with timeout
    const timestamp = Date.now();
    inputFile = path.join(UPLOADS_DIR, `${timestamp}_input.mp3`);
    const outputFileName = `${timestamp}_${effect}.mp3`;
    outputFile = path.join(OUTPUTS_DIR, outputFileName);
    
    console.log('⏳ Starting download...');
    
    try {
      await Promise.race([
        downloadFile(audioUrl, inputFile),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout after 60s')), 60000)
        )
      ]);
    } catch (downloadError) {
      console.error('❌ Download failed:', downloadError.message);
      throw new Error(`Download failed: ${downloadError.message}`);
    }
    
    // Check file size
    const fileSize = fs.statSync(inputFile).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    console.log(`✅ Downloaded: ${fileSizeMB}MB`);
    
    if (fileSize < 1000) {
      throw new Error('Downloaded file is too small - might be invalid');
    }
    
    // Process with FFmpeg
    const filters = effectFilters[effect];
    console.log('🎚️ Starting FFmpeg processing...');
    
    await new Promise((resolve, reject) => {
      let lastProgress = 0;
      
      ffmpeg(inputFile)
        .audioFilters(filters)
        .audioBitrate('256k')
        .audioFrequency(44100)
        .audioCodec('libmp3lame')
        .audioQuality(0)
        .on('start', (cmd) => {
          console.log('🎚️ FFmpeg command:', cmd.substring(0, 100) + '...');
        })
        .on('progress', (progress) => {
          if (progress.percent && Math.floor(progress.percent) > lastProgress) {
            lastProgress = Math.floor(progress.percent);
            if (lastProgress % 10 === 0) {
              console.log(`⏳ Progress: ${lastProgress}%`);
            }
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg processing complete!');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err.message);
          reject(new Error(`FFmpeg processing failed: ${err.message}`));
        })
        .save(outputFile);
    });
    
    // Check output file
    const outputSize = fs.statSync(outputFile).size;
    const outputSizeMB = (outputSize / 1024 / 1024).toFixed(2);
    console.log(`✅ Output file: ${outputSizeMB}MB`);
    
    if (outputSize < 1000) {
      throw new Error('Output file is too small - processing might have failed');
    }
    
    // Success response
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const downloadUrl = `${req.protocol}://${req.get('host')}/outputs/${outputFileName}`;
    
    console.log(`✅ SUCCESS in ${processingTime}s`);
    console.log(`🔗 Download: ${downloadUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({
      success: true,
      effect: effect,
      quality: 'YouTube/TikTok Level',
      downloadUrl: downloadUrl,
      processingTime: `${processingTime}s`,
      fileSize: `${outputSizeMB}MB`,
      message: `🎵 ${effect} effect applied successfully!`,
      tips: {
        download: 'Click the downloadUrl to get your file',
        expires: 'File will be deleted after 1 hour'
      }
    });
    
    // Cleanup input file after 5 seconds
    setTimeout(() => {
      if (inputFile && fs.existsSync(inputFile)) {
        fs.unlink(inputFile, (err) => {
          if (!err) console.log(`🗑️ Cleaned input: ${path.basename(inputFile)}`);
        });
      }
    }, 5000);
    
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR after', processingTime + 's');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    console.error(error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Cleanup on error
    if (inputFile && fs.existsSync(inputFile)) {
      fs.unlink(inputFile, () => {});
    }
    if (outputFile && fs.existsSync(outputFile)) {
      fs.unlink(outputFile, () => {});
    }
    
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message,
      processingTime: `${processingTime}s`,
      tips: [
        'Make sure the audio URL is accessible',
        'Try using tmpfiles.org or 0x0.st for file hosting',
        'File should be under 50MB for best results'
      ]
    });
  }
});

// Cleanup old files every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  [UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlink(filePath, (err) => {
              if (!err) console.log(`🗑️ Deleted old file: ${file}`);
            });
          }
        });
      });
    });
  });
}, 60 * 60 * 1000);

// Health check
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({ 
    status: 'healthy',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      used: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 LoFi Remix API v3.1.0`);
  console.log(`🎵 Server running on port ${PORT}`);
  console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
