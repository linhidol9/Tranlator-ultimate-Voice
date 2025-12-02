
import { splitTextForTts } from "../utils/textChunker";
import { mergeBuffers } from "../utils/audio";
import { getCachedChunk, saveCachedChunk } from "../utils/ttsCache";

// We use a fixed sample rate for consistency. Google TTS usually returns 24kHz.
export const GOOGLE_TTS_SAMPLE_RATE = 24000;

// Configurable timeout
let REQUEST_TIMEOUT_MS = 8000;

export const setRequestTimeout = (ms: number) => {
    REQUEST_TIMEOUT_MS = ms;
};

// Singleton AudioContext (lazy loaded)
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: GOOGLE_TTS_SAMPLE_RATE
    });
  }
  return audioCtx;
};

// Convert AudioBuffer to Int16Array (PCM)
const audioBufferToInt16 = (audioBuffer: AudioBuffer): Int16Array => {
  const pcmFloat = audioBuffer.getChannelData(0);
  const pcmInt16 = new Int16Array(pcmFloat.length);
  for (let i = 0; i < pcmFloat.length; i++) {
    // Clamp values to [-1, 1] then convert to Int16
    const s = Math.max(-1, Math.min(1, pcmFloat[i]));
    pcmInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcmInt16;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- PROXY MANAGER SYSTEM ---

interface ProxyEndpoint {
  id: string;
  name: string;
  urlTemplate: (encodedText: string) => string;
}

interface ProxyStats {
  failures: number;
  successes: number;
  lastUsed: number;
  cooldownUntil: number; // Timestamp when this proxy becomes available again
}

// Stats storage (in-memory)
const proxyStats = new Map<string, ProxyStats>();

// Base TTS Clients
// client=dict-chrome-ex is often less rate-limited
// client=t is another alternative
const TTS_CLIENTS = {
  gtx: (q: string) => `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${q}&tl=vi&client=gtx`,
  tw_ob: (q: string) => `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=vi&client=tw-ob`,
  webapp: (q: string) => `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=vi&client=webapp`,
  t: (q: string) => `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${q}&tl=vi&client=t`,
  dict: (q: string) => `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${q}&tl=vi&client=dict-chrome-ex`,
};

// Default Proxies
// Added timestamp to AllOrigins to bust proxy-side caching of errors
const DEFAULT_PROXY_ENDPOINTS: ProxyEndpoint[] = [
  // 1. AllOrigins (High availability, supports cache busting)
  { id: 'ao_gtx', name: 'AllOrigins + GTX', urlTemplate: (q) => `https://api.allorigins.win/raw?url=${encodeURIComponent(TTS_CLIENTS.gtx(q))}&d=${Date.now()}` },
  { id: 'ao_webapp', name: 'AllOrigins + WebApp', urlTemplate: (q) => `https://api.allorigins.win/raw?url=${encodeURIComponent(TTS_CLIENTS.webapp(q))}&d=${Date.now()}` },
  { id: 'ao_dict', name: 'AllOrigins + Dict', urlTemplate: (q) => `https://api.allorigins.win/raw?url=${encodeURIComponent(TTS_CLIENTS.dict(q))}&d=${Date.now()}` },
  { id: 'ao_t', name: 'AllOrigins + t', urlTemplate: (q) => `https://api.allorigins.win/raw?url=${encodeURIComponent(TTS_CLIENTS.t(q))}&d=${Date.now()}` },
  
  // 2. CorsProxy.io (Fast, but sometimes blocks headers)
  { id: 'cp_gtx', name: 'CorsProxy + GTX', urlTemplate: (q) => `https://corsproxy.io/?${encodeURIComponent(TTS_CLIENTS.gtx(q))}` },
  { id: 'cp_webapp', name: 'CorsProxy + WebApp', urlTemplate: (q) => `https://corsproxy.io/?${encodeURIComponent(TTS_CLIENTS.webapp(q))}` },
  { id: 'cp_dict', name: 'CorsProxy + Dict', urlTemplate: (q) => `https://corsproxy.io/?${encodeURIComponent(TTS_CLIENTS.dict(q))}` },
  
  // 3. CodeTabs (Fallback)
  { id: 'ct_gtx', name: 'CodeTabs + GTX', urlTemplate: (q) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(TTS_CLIENTS.gtx(q))}` },
  { id: 'ct_dict', name: 'CodeTabs + Dict', urlTemplate: (q) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(TTS_CLIENTS.dict(q))}` },
];

let customProxyEndpoints: ProxyEndpoint[] = [];

export const setCustomProxies = (urls: string[]) => {
  customProxyEndpoints = [];
  urls.forEach((url, index) => {
    const cleanUrl = url.trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) return;

    // For each custom proxy, we create variations to maximize success chance
    const variants = [
      { suffix: 'gtx', client: TTS_CLIENTS.gtx },
      { suffix: 'webapp', client: TTS_CLIENTS.webapp },
      { suffix: 'dict', client: TTS_CLIENTS.dict }
    ];

    variants.forEach(v => {
      const id = `custom_${index}_${v.suffix}`;
      customProxyEndpoints.push({
        id: id,
        name: `Custom ${index + 1} (${v.suffix})`,
        urlTemplate: (q) => `${cleanUrl}${encodeURIComponent(v.client(q))}`
      });

      // Initialize stats
      if (!proxyStats.has(id)) {
        proxyStats.set(id, { failures: 0, successes: 0, lastUsed: 0, cooldownUntil: 0 });
      }
    });
  });
};

// Initialize stats for defaults
DEFAULT_PROXY_ENDPOINTS.forEach(p => {
  if (!proxyStats.has(p.id)) {
    proxyStats.set(p.id, { failures: 0, successes: 0, lastUsed: 0, cooldownUntil: 0 });
  }
});

const getPrioritizedEndpoints = (): ProxyEndpoint[] => {
  const now = Date.now();
  // Prioritize User Custom Proxies first, then Defaults
  const allEndpoints = [...customProxyEndpoints, ...DEFAULT_PROXY_ENDPOINTS];
  
  return allEndpoints
    .filter(p => {
      const stats = proxyStats.get(p.id);
      return stats && now > stats.cooldownUntil; // Only return proxies NOT in cooldown
    })
    .sort((a, b) => {
      const statsA = proxyStats.get(a.id)!;
      const statsB = proxyStats.get(b.id)!;
      
      // 1. Success Rate (Higher is better)
      const rateA = statsA.successes / (statsA.successes + statsA.failures + 1);
      const rateB = statsB.successes / (statsB.successes + statsB.failures + 1);
      if (Math.abs(rateA - rateB) > 0.1) {
          return rateB - rateA;
      }
      
      // 2. Failures (Lower is better)
      if (statsA.failures !== statsB.failures) {
        return statsA.failures - statsB.failures;
      }

      // 3. Last used (Rotate to avoid spamming same one)
      return statsA.lastUsed - statsB.lastUsed;
    });
};

const recordOutcome = (id: string, success: boolean, statusCode: number = 0) => {
  const stats = proxyStats.get(id);
  if (!stats) return;

  stats.lastUsed = Date.now();

  if (success) {
    stats.successes++;
    // Gradually heal failure count on success
    if (stats.failures > 0) stats.failures = Math.max(0, stats.failures - 1);
    stats.cooldownUntil = 0; 
  } else {
    stats.failures++;
    
    // --- ROBUST BANNING LOGIC ---
    if (statusCode === 403 || statusCode === 429) {
      // HARD BAN: 5 Minutes for Rate Limits / Forbidden
      // This prevents the app from hammering a blocked proxy
      stats.cooldownUntil = Date.now() + 5 * 60 * 1000;
      console.warn(`Proxy [${id}] HARD BANNED for 5m (Status ${statusCode})`);
    } else if (stats.failures >= 3) {
      // SOFT BAN: 1 Minute for repeated connectivity issues
      // Gives the proxy time to recover
      stats.cooldownUntil = Date.now() + 60 * 1000;
      console.warn(`Proxy [${id}] SOFT BANNED for 1m (Too many failures)`);
    }
  }
};

const fetchAudioChunkWithRetry = async (text: string): Promise<ArrayBuffer> => {
  const cachedBuffer = await getCachedChunk(text);
  if (cachedBuffer) return cachedBuffer;

  if (!navigator.onLine) {
    throw new Error("No internet connection and audio chunk not found in cache.");
  }

  const encodedText = encodeURIComponent(text);
  const candidates = getPrioritizedEndpoints();
  
  if (candidates.length === 0) {
     throw new Error("All proxies (Default & Custom) are currently unavailable/banned. Please wait a few minutes or add custom proxies.");
  }

  let lastError: any = null;
  const attemptLimit = Math.min(10, candidates.length); // Try up to 10 best candidates
  let attempts = 0;

  for (const proxy of candidates) {
    if (attempts >= attemptLimit) break;
    attempts++;

    const url = proxy.urlTemplate(encodedText);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); 

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        recordOutcome(proxy.id, false, response.status);
        
        // 429 Backoff Strategy: 
        // If we hit a rate limit, pause briefly before hitting the next proxy
        if (response.status === 429) {
            console.warn(`Hit 429 on ${proxy.id}, backing off for 2s...`);
            await delay(2000);
        }

        throw new Error(`HTTP Status [${response.status}]`);
      }

      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        recordOutcome(proxy.id, false, 0);
        throw new Error("Empty response buffer");
      }

      // Check for Text/JSON error responses disguised as 200 OK
      if (buffer.byteLength < 150) {
         const textDecoder = new TextDecoder();
         const textStart = textDecoder.decode(buffer.slice(0, 50));
         if (textStart.includes('Error') || textStart.includes('Exception') || textStart.trim().startsWith('{')) {
             recordOutcome(proxy.id, false, 500); // Treat content error as server error
             throw new Error("Invalid audio content (Error message received)");
         }
      }

      // --- VALIDATION STEP ---
      // Try to decode audio to ensure it's valid before accepting it.
      // This catches cases where proxy returns 200 OK but with garbage/HTML data.
      try {
          const ctx = getAudioContext();
          // We MUST clone the buffer because decodeAudioData detaches (empties) it.
          // We need the original buffer intact to return it or cache it.
          const validationBuffer = buffer.slice(0);
          await ctx.decodeAudioData(validationBuffer);
      } catch (decodeError) {
          recordOutcome(proxy.id, false, 0);
          throw new Error("Proxy returned invalid audio data (Unable to decode)");
      }

      // If we reach here, data is valid.
      recordOutcome(proxy.id, true);
      
      // CRITICAL FIX: Explicitly deep clone buffer before caching.
      // AudioContext.decodeAudioData (called later by consumer) will detach the buffer.
      // We must save a copy to IDB.
      const cacheBuffer = new Uint8Array(buffer).slice().buffer;
      
      // Fire and forget cache save, but attach a catch to prevent "Uncaught (in promise)" errors
      saveCachedChunk(text, cacheBuffer).catch(cacheErr => {
        console.warn("Background cache save failed", cacheErr);
      });

      return buffer;

    } catch (err: any) {
      if (!err.message.includes('HTTP Status')) {
         recordOutcome(proxy.id, false, 0); // Network/Timeout error
      }
      
      // Store full error message with URL for the user
      // This is crucial for the "Show URL" feature in ProcessingStatus
      const errorMsg = `Proxy [${proxy.name}] failed: ${err.message}. URL: [${url}]`;
      lastError = new Error(errorMsg);
      console.warn(errorMsg);

      await delay(100 + Math.random() * 200); // Small jitter
    }
  }

  throw lastError || new Error("All attempts to fetch TTS failed.");
};

export const generateGoogleVoice = async (text: string): Promise<Int16Array> => {
  const ctx = getAudioContext();
  const chunks = splitTextForTts(text);
  const pcmChunks: Int16Array[] = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const arrayBuffer = await fetchAudioChunkWithRetry(chunk);
      // decodeAudioData detaches the buffer here. This is why we MUST have cached a clone above.
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const pcm = audioBufferToInt16(audioBuffer);
      pcmChunks.push(pcm);
    } catch (error: any) {
      console.error(`Failed chunk: "${chunk}"`, error);
      // Propagate the specific error message containing the URL
      throw new Error(error.message); 
    }
  }

  return mergeBuffers(pcmChunks);
};
