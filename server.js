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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: '🎵 ONLINE',
    message: 'Professional LoFi Remix API - YouTube Quality',
    version: '3.0.0',
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
  // YouTube-style slowed reverb (90% quality)
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
  
  // TikTok viral style
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
  
  // Ultra slowed (maximum emotion)
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
  
  // Classic LoFi
  lofi_chill: [
    'lowpass=f=3000:p=1',
    'highpass=f=300:p=1',
    'acompressor=threshold=-12dB:ratio=3:attack=5:release=50',
    'equalizer=f=100:width_type=h:width=200:g=4',
    'equalizer=f=8000:width_type=h:width=2000:g=-3',
    'aecho=0.8:0.9:60:0.3',
    'volume=1.4'
  ],
  
  // Bass boost
  bass_boost: [
    'bass=g=15:f=70:w=0.8',
    'equalizer=f=50:width_type=h:width=50:g=10',
    'equalizer=f=100:width_type=h:width=100:g=8',
    'acompressor=threshold=-20dB:ratio=5:attack=3:release=60',
    'lowpass=f=5000',
    'volume=1.6'
  ],
  
  // Nightcore
  nightcore: [
    'asetrate=44100*1.15',
    'aresample=44100',
    'atempo=1.08',
    'treble=g=3:f=4000:w=0.5',
    'acompressor=threshold=-14dB:ratio=2.5:attack=3:release=40',
    'volume=1.3'
  ]
};

// Download file helper
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Main remix endpoint
app.post('/remix', async (req, res) => {
  let inputFile = null;
  let outputFile = null;
  
  try {
    const { audioUrl, effect = 'youtube_slowed' } = req.body;
    
    // Validation
    if (!audioUrl) {
      return res.status(400).json({ 
        error: 'audioUrl is required',
        example: {
          audioUrl: 'https://example.com/song.mp3',
          effect: 'youtube_slowed'
        }
      });
    }
    
    if (!effectFilters[effect]) {
      return res.status(400).json({ 
        error: 'Invalid effect',
        available: Object.keys(effectFilters)
      });
    }
    
    console.log(`🎵 Processing: ${effect}`);
    console.log(`📥 URL: ${audioUrl}`);
    
    // Download audio
    const timestamp = Date.now();
    inputFile = path.join(UPLOADS_DIR, `${timestamp}_input.mp3`);
    const outputFileName = `${timestamp}_${effect}.mp3`;
    outputFile = path.join(OUTPUTS_DIR, outputFileName);
    
    console.log('⬇️ Downloading audio...');
    await downloadFile(audioUrl, inputFile);
    console.log('✅ Download complete!');
    
    // Process with FFmpeg
    const filters = effectFilters[effect];
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .audioFilters(filters)
        .audioBitrate('256k')
        .audioFrequency(44100)
        .audioCodec('libmp3lame')
        .audioQuality(0) // Highest quality
        .on('start', (cmd) => {
          console.log('🎚️ FFmpeg started');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ Processing complete!');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err.message);
          reject(err);
        })
        .save(outputFile);
    });
    
    // Success response
    const downloadUrl = `${req.protocol}://${req.get('host')}/outputs/${outputFileName}`;
    
    res.json({
      success: true,
      effect: effect,
      quality: 'YouTube/TikTok Level',
      downloadUrl: downloadUrl,
      message: `🎵 ${effect} effect applied successfully!`,
      tips: {
        download: 'Click the downloadUrl to get your file',
        expires: 'File will be deleted after 1 hour'
      }
    });
    
    // Cleanup input file
    setTimeout(() => {
      if (inputFile && fs.existsSync(inputFile)) {
        fs.unlink(inputFile, () => {});
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
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
      tip: 'Make sure the audio URL is valid and accessible'
    });
  }
});

// Cleanup old files (every hour)
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
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎵 YouTube Quality API Ready!`);
});
