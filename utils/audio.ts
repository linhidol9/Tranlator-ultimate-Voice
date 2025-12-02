// Helper to decode Base64 to ArrayBuffer
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Convert raw PCM 16-bit LE data to a WAV file Blob
export const pcmToWav = (pcmData: Int16Array, sampleRate: number = 24000, numChannels: number = 1): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + pcmData.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * numChannels * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, pcmData.length * 2, true);

  // Write PCM samples
  const offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset + i * 2, pcmData[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
};

// Convert raw PCM to MP3 Blob using lamejs
export const pcmToMp3 = async (
  pcmData: Int16Array, 
  sampleRate: number = 24000, 
  numChannels: number = 1,
  onProgress?: (percent: number) => void
): Promise<Blob> => {
  if (!window.lamejs) {
    throw new Error("Lamejs library not loaded");
  }

  const lib = window.lamejs;
  const mp3encoder = new lib.Mp3Encoder(numChannels, sampleRate, 128); // 128kbps
  const mp3Data: Int8Array[] = [];

  // Process in chunks to avoid blocking the main thread
  const chunkSize = 1152 * 10; // Process 10 frames at a time
  const totalSamples = pcmData.length;
  
  for (let i = 0; i < totalSamples; i += chunkSize) {
    const chunk = pcmData.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Yield to UI every few iterations
    if (i % (chunkSize * 5) === 0) {
      if (onProgress) {
        onProgress(Math.min(99, Math.round((i / totalSamples) * 100)));
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  if (onProgress) onProgress(100);

  return new Blob(mp3Data, { type: 'audio/mp3' });
};


const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Create silent Int16Array for a given duration
export const createSilence = (durationSeconds: number, sampleRate: number): Int16Array => {
  const length = Math.floor(durationSeconds * sampleRate);
  return new Int16Array(length); // Init with 0s
};

// Remove silence from start and end of PCM data
export const trimSilence = (pcmData: Int16Array, threshold: number = 500): Int16Array => {
  if (pcmData.length === 0) return pcmData;

  let start = 0;
  let end = pcmData.length - 1;

  // Find start (scan forward)
  while (start < pcmData.length && Math.abs(pcmData[start]) < threshold) {
    start++;
  }

  // If entire signal is silence
  if (start >= pcmData.length) return new Int16Array(0);

  // Find end (scan backward)
  while (end > start && Math.abs(pcmData[end]) < threshold) {
    end--;
  }

  return pcmData.subarray(start, end + 1);
};


// Merge multiple Int16Arrays
export const mergeBuffers = (buffers: Int16Array[]): Int16Array => {
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
};

// Adjust audio to fit targetDurationSeconds (Speed Up OR Slow Down).
// Uses OfflineAudioContext to change playbackRate (resampling).
export const adjustAudioToDuration = async (
  pcmData: Int16Array,
  targetDurationSeconds: number,
  sampleRate: number
): Promise<Int16Array> => {
  const currentDuration = pcmData.length / sampleRate;

  // Tiny tolerance to avoid unnecessary processing
  if (Math.abs(currentDuration - targetDurationSeconds) < 0.05) {
    return pcmData;
  }

  const ratio = currentDuration / targetDurationSeconds;
  
  // New length in samples
  const newLength = Math.floor(pcmData.length / ratio);

  // Safety check for environment
  const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineContext) {
    console.warn("OfflineAudioContext not supported. Returning original audio.");
    return pcmData;
  }

  // Create offline context with the NEW length
  const offlineCtx = new OfflineContext(1, newLength, sampleRate);
  
  const sourceBuffer = offlineCtx.createBuffer(1, pcmData.length, sampleRate);
  const channelData = sourceBuffer.getChannelData(0);
  
  // Int16 -> Float32
  for (let i = 0; i < pcmData.length; i++) {
    channelData[i] = pcmData[i] / 32768.0; 
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  
  // Set playback rate ( > 1 speeds up, < 1 slows down)
  source.playbackRate.value = ratio;
  
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const renderedData = renderedBuffer.getChannelData(0);
  
  // Float32 -> Int16
  const result = new Int16Array(renderedData.length);
  for (let i = 0; i < renderedData.length; i++) {
    const s = Math.max(-1, Math.min(1, renderedData[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return result;
};

// Helper for Blob -> Int16Array (used for Microphone recording processing)
export const blobToPcm = async (blob: Blob, targetSampleRate: number): Promise<Int16Array> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // Resample if necessary using OfflineAudioContext
    if (audioBuffer.sampleRate !== targetSampleRate) {
        const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);
        const resampled = await offlineCtx.startRendering();
        return float32ToInt16(resampled.getChannelData(0));
    }

    return float32ToInt16(audioBuffer.getChannelData(0));
};

const float32ToInt16 = (float32: Float32Array): Int16Array => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
};

// Apply Linear Fade In/Out
export const applyFade = (pcm: Int16Array, sampleRate: number, fadeIn: boolean, fadeOut: boolean): Int16Array => {
    const fadeDuration = 2.0; // 2 seconds fade
    const fadeSamples = Math.floor(fadeDuration * sampleRate);
    const output = new Int16Array(pcm); // Copy

    if (fadeIn) {
        for (let i = 0; i < Math.min(fadeSamples, output.length); i++) {
            const gain = i / fadeSamples;
            output[i] = output[i] * gain;
        }
    }

    if (fadeOut) {
        const start = Math.max(0, output.length - fadeSamples);
        for (let i = start; i < output.length; i++) {
            const gain = 1 - ((i - start) / fadeSamples);
            output[i] = output[i] * gain;
        }
    }
    return output;
};


// Advanced Mixing: TTS + Music + VoiceOver
export const mixMultiTrack = (
    ttsPcm: Int16Array, 
    musicPcm: Int16Array | null, 
    voiceOverPcm: Int16Array | null,
    ttsVol: number, 
    musicVol: number, 
    voiceOverVol: number
): Int16Array => {
    const ttsLen = ttsPcm.length;
    const voiceOverLen = voiceOverPcm ? voiceOverPcm.length : 0;
    
    // Total length determined by max of active main tracks
    const totalLen = Math.max(ttsLen, voiceOverLen);
    
    // Safety check
    if (totalLen === 0) return new Int16Array(0);

    const mixed = new Int16Array(totalLen);

    for (let i = 0; i < totalLen; i++) {
        let sample = 0;

        // 1. TTS Track
        if (i < ttsLen) {
            sample += ttsPcm[i] * ttsVol;
        }

        // 2. VoiceOver Track
        if (voiceOverPcm && i < voiceOverLen) {
            sample += voiceOverPcm[i] * voiceOverVol;
        }

        // 3. Music Track (Looping)
        if (musicPcm && musicPcm.length > 0 && musicVol > 0) {
            const musicIndex = i % musicPcm.length;
            sample += musicPcm[musicIndex] * musicVol;
        }

        // Hard Clipping prevention
        sample = Math.max(-32768, Math.min(32767, sample));
        mixed[i] = sample;
    }

    return mixed;
};