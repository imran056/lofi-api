from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
import subprocess
import os
import uuid
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LoFi Remix API", version="1.0.0")

# Temp directory for processing
TEMP_DIR = Path("/tmp/audio")
TEMP_DIR.mkdir(exist_ok=True, parents=True)

@app.get("/")
def home():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "🎵 LoFi Remix API is running!",
        "version": "1.0.0",
        "endpoints": {
            "process": "/process (POST)",
            "health": "/ (GET)"
        }
    }

@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    preset: str = Form(...)
):
    """
    Process audio file with selected preset
    
    Parameters:
    - file: Audio file (MP3/M4A/WAV)
    - preset: Effect preset (lofi, reverb, nightcore, 8d_audio, vaporwave)
    
    Returns:
    - Processed audio file (M4A format, 320kbps)
    """
    
    file_id = str(uuid.uuid4())
    input_path = TEMP_DIR / f"{file_id}_input.mp3"
    output_path = TEMP_DIR / f"{file_id}_output.m4a"
    
    try:
        # Save uploaded file
        logger.info(f"📥 Receiving file: {file.filename}")
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"✅ File saved: {input_path}")
        
        # Get FFmpeg command based on preset
        ffmpeg_cmd = get_ffmpeg_command(preset, str(input_path), str(output_path))
        
        logger.info(f"🎛️ Processing with preset: {preset}")
        logger.info(f"⚙️ Command: {ffmpeg_cmd}")
        
        # Run FFmpeg
        result = subprocess.run(
            ffmpeg_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes max
        )
        
        if result.returncode != 0:
            logger.error(f"❌ FFmpeg error: {result.stderr}")
            return {
                "status": "error",
                "message": "Processing failed",
                "error": result.stderr
            }
        
        logger.info(f"✅ Processing complete: {output_path}")
        
        # Check if output exists
        if not output_path.exists():
            logger.error("❌ Output file not created")
            return {
                "status": "error",
                "message": "Output file not created"
            }
        
        # Return processed file
        return FileResponse(
            path=str(output_path),
            media_type="audio/mp4",
            filename=f"{preset}_{file.filename.rsplit('.', 1)[0]}.m4a"
        )
        
    except subprocess.TimeoutExpired:
        logger.error("❌ Processing timeout (5 minutes)")
        return {
            "status": "error",
            "message": "Processing timeout"
        }
    
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }
    
    finally:
        # Cleanup input file
        try:
            if input_path.exists():
                input_path.unlink()
        except Exception as e:
            logger.warning(f"⚠️ Cleanup error: {e}")


def get_ffmpeg_command(preset: str, input_path: str, output_path: str) -> str:
    """
    Generate FFmpeg command based on preset
    """
    
    if preset == "lofi" or preset == "tiktok_lofi" or preset == "chill_lofi":
        # 🎵 LOFI: Bass boost + Lowpass + Warmth
        return (
            f'ffmpeg -i "{input_path}" '
            f'-filter_complex "'
            f'lowpass=f=3000,'
            f'highpass=f=200,'
            f'equalizer=f=60:width_type=h:width=100:g=10,'
            f'vibrato=f=0.25:d=0.3,'
            f'asetrate=44100*0.97,aresample=44100'
            f'" '
            f'-c:a aac -b:a 320k "{output_path}"'
        )
    
    elif preset == "reverb":
        # 🌊 SLOWED + REVERB: Actual slow down + deep reverb
        return (
            f'ffmpeg -i "{input_path}" '
            f'-filter_complex "'
            f'atempo=0.85,'
            f'asetrate=44100*0.95,aresample=44100,'
            f'reverb=roomsize=0.8:wet=0.45:dry=0.55,'
            f'equalizer=f=60:width_type=h:width=100:g=12'
            f'" '
            f'-c:a aac -b:a 320k "{output_path}"'
        )
    
    elif preset == "nightcore":
        # ⚡ NIGHTCORE: Speed up + pitch up
        return (
            f'ffmpeg -i "{input_path}" '
            f'-filter_complex "'
            f'atempo=1.25,'
            f'asetrate=44100*1.1,aresample=44100,'
            f'highpass=f=100,'
            f'equalizer=f=8000:width_type=h:width=2000:g=8'
            f'" '
            f'-c:a aac -b:a 320k "{output_path}"'
        )
    
    elif preset == "8d_audio":
        # 🎧 8D AUDIO: Spatial panning
        return (
            f'ffmpeg -i "{input_path}" '
            f'-filter_complex "'
            f'apulsator=hz=0.35:width=0.5,'
            f'stereotools=mlev=0.5:phase=0.25,'
            f'extrastereo=m=2.0,'
            f'reverb=roomsize=0.5:wet=0.3'
            f'" '
            f'-c:a aac -b:a 320k "{output_path}"'
        )
    
    elif preset == "vaporwave":
        # 🌴 VAPORWAVE: Slow + pitch down + reverb
        return (
            f'ffmpeg -i "{input_path}" '
            f'-filter_complex "'
            f'atempo=0.90,'
            f'asetrate=44100*0.93,aresample=44100,'
            f'reverb=roomsize=0.6:wet=0.35,'
            f'equalizer=f=60:width_type=h:width=100:g=10'
            f'" '
            f'-c:a aac -b:a 320k "{output_path}"'
        )
    
    else:
        # Default: High quality encode
        return f'ffmpeg -i "{input_path}" -c:a aac -b:a 320k "{output_path}"'


@app.get("/presets")
def get_presets():
    """Get available presets"""
    return {
        "presets": [
            {
                "id": "lofi",
                "name": "Ultimate Lo-fi",
                "description": "TikTok viral breathing + deep bass"
            },
            {
                "id": "reverb",
                "name": "Slowed + Reverb",
                "description": "Actually slows down with reverb"
            },
            {
                "id": "nightcore",
                "name": "Nightcore",
                "description": "Fast + energetic + high pitch"
            },
            {
                "id": "8d_audio",
                "name": "8D Audio",
                "description": "360° immersive surround sound"
            },
            {
                "id": "vaporwave",
                "name": "Vaporwave",
                "description": "A E S T H E T I C vibes"
            }
        ]
    }


# Run server
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
