
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Hero } from './components/Hero';
import { ProcessingStatus } from './components/ProcessingStatus';
import { MidiRepository } from './components/MidiRepository';
import { GoogleDocsTab } from './components/GoogleDocsTab';
import { ProxyManager } from './components/ProxyManager';
import { AudioMixerPanel } from './components/AudioMixerPanel';
import { WeatherDecor } from './components/WeatherDecor';
import { ChibiWidget } from './components/ChibiWidget'; // Import Chibi
import { BackgroundLofi } from './components/BackgroundLofi'; // Import Lofi
import { parseSRT } from './utils/srtParser';
import { pcmToWav, pcmToMp3, createSilence, mergeBuffers, adjustAudioToDuration, trimSilence, mixMultiTrack, applyFade, blobToPcm } from './utils/audio';
import { generateGoogleVoice, GOOGLE_TTS_SAMPLE_RATE, setRequestTimeout } from './services/googleTtsService';
import { clearCache } from './utils/ttsCache';
import { REVIEW_BEATS } from './utils/musicData';
import { Subtitle, ProcessingState, MixerSettings, ProjectState } from './types';
import { ArrowDownTrayIcon, DocumentTextIcon, PencilSquareIcon, BoltIcon, ClockIcon, TrashIcon, Cog6ToothIcon, SwatchIcon, MicrophoneIcon, FolderOpenIcon, FolderArrowDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

// Maximum concurrent requests. Increased to 30 for maximum throughput.
const MAX_CONCURRENCY = 30;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'srt' | 'midi' | 'gdocs'>('srt');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [status, setStatus] = useState<ProcessingState>({
    totalLines: 0,
    processedLines: 0,
    isProcessing: false,
    isComplete: false,
    error: null,
    audioUrl: null,
    failedLines: [],
    estimatedRemainingSeconds: 0,
  });

  const [fileName, setFileName] = useState<string>('');
  const [globalSpeed, setGlobalSpeed] = useState<number>(1.0);
  const [requestTimeoutVal, setRequestTimeoutVal] = useState<number>(8000);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mixer State
  const [mixerSettings, setMixerSettings] = useState<MixerSettings>({
      ttsVolume: 1.0,
      musicVolume: 0.3,
      selectedMusicId: null,
      fadeIn: true,
      fadeOut: true,
      voiceOverVolume: 1.0
  });
  
  // Refs for Audio Data
  const finalPcmRef = useRef<Int16Array | null>(null); // Raw TTS
  const mixedPcmRef = useRef<Int16Array | null>(null); // Post-Mix
  const recordedVoicePcmRef = useRef<Int16Array | null>(null); // Voice Over

  const [isConvertingMp3, setIsConvertingMp3] = useState(false);
  const [mp3Progress, setMp3Progress] = useState(0);

  // --- SAVE / LOAD PROJECT ---
  const saveProject = () => {
    if (subtitles.length === 0) return;
    const project: ProjectState = {
        version: 1,
        fileName,
        subtitles,
        globalSpeed,
        mixerSettings,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem('vn_tts_project', JSON.stringify(project));
        alert("Đã lưu dự án thành công!");
    } catch (e) {
        alert("Không thể lưu dự án (Có thể do dung lượng localStorage).");
    }
  };

  const loadProject = () => {
      const saved = localStorage.getItem('vn_tts_project');
      if (!saved) {
          alert("Không tìm thấy dự án đã lưu.");
          return;
      }
      try {
          const project: ProjectState = JSON.parse(saved);
          setFileName(project.fileName);
          setSubtitles(project.subtitles);
          setGlobalSpeed(project.globalSpeed);
          setMixerSettings(project.mixerSettings);
          
          setStatus({
              totalLines: project.subtitles.length,
              processedLines: 0,
              isProcessing: false,
              isComplete: false,
              error: null,
              audioUrl: null,
              failedLines: [],
              estimatedRemainingSeconds: 0
          });
          finalPcmRef.current = null;
          mixedPcmRef.current = null;
          alert("Đã tải lại dự án cũ.");
      } catch (e) {
          alert("File dự án bị lỗi.");
      }
  };

  // --- HANDLERS ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const parsed = parseSRT(text);
          setSubtitles(parsed);
          setStatus(prev => ({ 
            ...prev, 
            totalLines: parsed.length, 
            processedLines: 0,
            error: null, 
            isComplete: false, 
            audioUrl: null,
            failedLines: [],
            estimatedRemainingSeconds: 0
          }));
          finalPcmRef.current = null;
        } catch (err) {
          setStatus(prev => ({ ...prev, error: "Không thể đọc file SRT. Vui lòng kiểm tra định dạng." }));
        }
      };
      reader.readAsText(file);
    }
  };

  // Helper to convert plain translated text into Subtitle structure
  const handleImportTranslatedText = (text: string) => {
      // Split by newlines or periods followed by spaces to create roughly sentence-based chunks
      const chunks = text.split(/(?<=[.!?])\s+|\n+/).filter(c => c.trim().length > 0);
      
      const newSubtitles: Subtitle[] = [];
      let currentTime = 0;
      
      chunks.forEach((chunk, index) => {
          // Estimate duration: approx 15 chars per second for speaking
          const estimatedDuration = Math.max(2, chunk.length / 12); 
          const start = currentTime;
          const end = start + estimatedDuration;
          
          // Format HH:MM:SS,ms (simple helper)
          const format = (s: number) => {
             const date = new Date(s * 1000);
             const hh = String(Math.floor(s/3600)).padStart(2, '0');
             const mm = String(date.getUTCMinutes()).padStart(2, '0');
             const ss = String(date.getUTCSeconds()).padStart(2, '0');
             const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
             return `${hh}:${mm}:${ss},${ms}`;
          };

          newSubtitles.push({
              id: index + 1,
              startTime: format(start),
              endTime: format(end),
              startTimeSeconds: start,
              endTimeSeconds: end,
              text: chunk.trim()
          });

          currentTime = end;
      });

      setSubtitles(newSubtitles);
      setFileName("Translated_Project.srt");
      setActiveTab('srt'); // Switch back to studio
      
      setStatus({
          totalLines: newSubtitles.length,
          processedLines: 0,
          isProcessing: false,
          isComplete: false,
          error: null,
          audioUrl: null,
          failedLines: [],
          estimatedRemainingSeconds: 0
      });
      finalPcmRef.current = null;
  };

  const handleVoiceOverRecorded = async (blob: Blob) => {
      try {
          const pcm = await blobToPcm(blob, GOOGLE_TTS_SAMPLE_RATE);
          recordedVoicePcmRef.current = pcm;
          alert("Đã ghi âm và lưu vào bộ nhớ tạm. Sẵn sàng hòa âm!");
          // Trigger re-mix if TTS is already done
          if (finalPcmRef.current) {
              handleFinalMix();
          }
      } catch (e) {
          console.error("Failed to process voice over", e);
      }
  };

  const handleSubtitleTextChange = (id: number, newText: string) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, text: newText } : sub
    ));
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      setRequestTimeoutVal(val);
      setRequestTimeout(val);
  };

  const handleClearCache = async () => {
      if (confirm("Bạn có chắc chắn muốn xóa bộ nhớ đệm (Cache) không? Điều này sẽ xóa các file âm thanh đã tải trước đó.")) {
          const count = await clearCache();
          alert(`Đã xóa ${count} mục trong bộ nhớ đệm.`);
      }
  };

  // Helper to process a single subtitle
  const processSingleSubtitle = async (sub: Subtitle): Promise<{ 
    pcm: Int16Array | null, 
    speedFactor: number, 
    generatedDuration: number, 
    error?: string 
  }> => {
    try {
      let rawPcm = await generateGoogleVoice(sub.text);
      rawPcm = trimSilence(rawPcm);

      const rawDuration = rawPcm.length / GOOGLE_TTS_SAMPLE_RATE;
      
      let processedPcm = rawPcm;
      // Only change speed if USER explicitly requested it via the slider
      if (globalSpeed !== 1.0) {
          const desiredDuration = rawDuration / globalSpeed;
          processedPcm = await adjustAudioToDuration(rawPcm, desiredDuration, GOOGLE_TTS_SAMPLE_RATE);
      }

      const currentDuration = processedPcm.length / GOOGLE_TTS_SAMPLE_RATE;
      const targetDuration = sub.endTimeSeconds - sub.startTimeSeconds;
      
      let finalPcm = processedPcm;

      // STRICTLY PRESERVE NATURAL VOICE QUALITY
      // If audio is shorter than slot, fill with silence to keep timeline sync for NEXT line
      if (currentDuration < targetDuration) {
          const silenceDuration = targetDuration - currentDuration;
          const silencePcm = createSilence(silenceDuration, GOOGLE_TTS_SAMPLE_RATE);
          finalPcm = mergeBuffers([processedPcm, silencePcm]);
      }

      const finalDuration = finalPcm.length / GOOGLE_TTS_SAMPLE_RATE;
      
      return { pcm: finalPcm, speedFactor: globalSpeed, generatedDuration: finalDuration };
    } catch (e: any) {
      return { pcm: null, speedFactor: 0, generatedDuration: 0, error: e.message };
    }
  };

  const processSubtitles = useCallback(async () => {
    if (subtitles.length === 0) return;

    setStatus({
      totalLines: subtitles.length,
      processedLines: 0,
      isProcessing: true,
      isComplete: false,
      error: null,
      audioUrl: null,
      failedLines: [],
      estimatedRemainingSeconds: 0,
    });
    finalPcmRef.current = null;
    mixedPcmRef.current = null;

    setSubtitles(prev => prev.map(s => ({ ...s, status: 'pending', speedFactor: undefined, errorMessage: undefined })));

    const audioResults = new Array(subtitles.length).fill(null);
    let completedCount = 0;
    const failedIds: number[] = [];
    const startTime = Date.now();

    const queue = subtitles.map((sub, index) => ({ sub, index }));
    const totalTasks = queue.length;

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const { sub, index } = item;
        let result = await processSingleSubtitle(sub);

        if (!result.pcm) {
           // Fast retry delay for high optimization
           await new Promise(r => setTimeout(r, 500));
           result = await processSingleSubtitle(sub);
        }

        if (result.pcm) {
          audioResults[index] = result.pcm;
          setSubtitles(prev => {
            const newSubs = [...prev];
            newSubs[index] = {
              ...newSubs[index],
              status: 'success',
              speedFactor: result.speedFactor,
              generatedDuration: result.generatedDuration,
              errorMessage: undefined
            };
            return newSubs;
          });
        } else {
          failedIds.push(sub.id);
          setSubtitles(prev => {
            const newSubs = [...prev];
            newSubs[index] = { ...newSubs[index], status: 'error', errorMessage: result.error };
            return newSubs;
          });
        }

        completedCount++;
        
        if (completedCount % 5 === 0 || completedCount === totalTasks) {
           const elapsedMs = Date.now() - startTime;
           const avgMsPerLine = elapsedMs / completedCount;
           const remainingLines = totalTasks - completedCount;
           const estimatedSeconds = Math.ceil((avgMsPerLine * remainingLines) / 1000);

           setStatus(prev => ({ 
             ...prev, 
             processedLines: completedCount,
             failedLines: [...failedIds], 
             estimatedRemainingSeconds: estimatedSeconds
           }));
        }
      }
    };

    const activeWorkers = Array(Math.min(MAX_CONCURRENCY, totalTasks))
      .fill(null)
      .map(() => worker());

    try {
      await Promise.all(activeWorkers);

      const finalChunks: Int16Array[] = [];
      let currentSamplePointer = 0;

      for (let i = 0; i < subtitles.length; i++) {
        const sub = subtitles[i];
        const audioData = audioResults[i];
        
        const targetStartSample = Math.floor(sub.startTimeSeconds * GOOGLE_TTS_SAMPLE_RATE);
        
        if (currentSamplePointer < targetStartSample) {
            const silenceSamples = targetStartSample - currentSamplePointer;
            finalChunks.push(createSilence(silenceSamples / GOOGLE_TTS_SAMPLE_RATE, GOOGLE_TTS_SAMPLE_RATE));
            currentSamplePointer += silenceSamples;
        }
        
        if (audioData) {
          finalChunks.push(audioData);
          currentSamplePointer += audioData.length;
        }
      }

      const finalBuffer = mergeBuffers(finalChunks);
      finalPcmRef.current = finalBuffer;

      // Trigger Final Mixing immediately
      await handleFinalMix();

    } catch (err: any) {
      setStatus(prev => ({
        ...prev,
        isProcessing: false,
        error: err.message || "Đã xảy ra lỗi không xác định."
      }));
    }
  }, [subtitles, globalSpeed]);

  // Separate function for Final Mixing (called after TTS or when mixer settings change)
  const handleFinalMix = async () => {
      if (!finalPcmRef.current) return;

      let musicPcm: Int16Array | null = null;
      if (mixerSettings.selectedMusicId) {
          const track = REVIEW_BEATS.find(b => b.id === mixerSettings.selectedMusicId);
          if (track) {
              try {
                  const resp = await fetch(track.url);
                  const arrayBuf = await resp.arrayBuffer();
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: GOOGLE_TTS_SAMPLE_RATE});
                  const decoded = await audioCtx.decodeAudioData(arrayBuf);
                  
                  // Convert Float32 to Int16
                  const floatData = decoded.getChannelData(0);
                  musicPcm = new Int16Array(floatData.length);
                  for(let i=0; i<floatData.length; i++) {
                      const s = Math.max(-1, Math.min(1, floatData[i]));
                      musicPcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  }
                  
                  // Apply Fade to Music Track if requested
                  if (mixerSettings.fadeIn || mixerSettings.fadeOut) {
                      musicPcm = applyFade(musicPcm, GOOGLE_TTS_SAMPLE_RATE, mixerSettings.fadeIn, mixerSettings.fadeOut);
                  }
              } catch (e) {
                  console.warn("Failed to load BG music", e);
              }
          }
      }

      const mixed = mixMultiTrack(
          finalPcmRef.current,
          musicPcm,
          recordedVoicePcmRef.current,
          mixerSettings.ttsVolume,
          mixerSettings.musicVolume,
          mixerSettings.voiceOverVolume
      );

      mixedPcmRef.current = mixed;
      const wavBlob = pcmToWav(mixed, GOOGLE_TTS_SAMPLE_RATE);
      const url = URL.createObjectURL(wavBlob);

      setStatus(prev => ({
        ...prev,
        isProcessing: false,
        isComplete: true,
        audioUrl: url,
        estimatedRemainingSeconds: 0,
      }));
  };

  // Re-mix when mixer settings change (if audio is already generated)
  useEffect(() => {
      if (status.isComplete && finalPcmRef.current && !status.isProcessing) {
          // Debounce the remix to avoid lagging on slider drag
          const timer = setTimeout(() => {
              handleFinalMix();
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [mixerSettings]);


  const handleDownloadMp3 = async () => {
    if (!mixedPcmRef.current) return;
    setIsConvertingMp3(true);
    setMp3Progress(0);
    try {
      await new Promise(r => setTimeout(r, 100));
      const mp3Blob = await pcmToMp3(
        mixedPcmRef.current, 
        GOOGLE_TTS_SAMPLE_RATE, 
        1, 
        (pct) => setMp3Progress(pct)
      );
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace('.srt', '')}_mixed_master.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Lỗi khi tạo MP3: " + error.message);
    } finally {
      setIsConvertingMp3(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 font-sans relative">
      <WeatherDecor />
      <BackgroundLofi /> {/* Mount the hidden Lofi Player */}
      <Hero />
      
      {/* TAB NAVIGATION */}
      <div className="container mx-auto px-4 max-w-4xl relative z-10 mb-6">
         <div className="flex p-1 space-x-1 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md overflow-x-auto">
            <button 
              onClick={() => setActiveTab('srt')}
              className={`relative flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-3 text-xs md:text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200 overflow-hidden
                ${activeTab === 'srt' 
                  ? 'bg-indigo-500/80 text-white shadow shadow-indigo-500/30 ring-1 ring-white/20' 
                  : 'text-indigo-200 hover:bg-white/[0.08] hover:text-white'
                }`}
            >
              <div className="flex items-center space-x-2 relative z-10">
                <MicrophoneIcon className="w-5 h-5 opacity-80" />
                <span>SRT Mixer Studio</span>
                <div className="hidden md:block">
                    <ChibiWidget scale={0.6} mode="tab" />
                </div>
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('midi')}
              className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-3 text-xs md:text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200
                ${activeTab === 'midi' 
                  ? 'bg-pink-500/80 text-white shadow shadow-pink-500/30 ring-1 ring-white/20' 
                  : 'text-pink-200 hover:bg-white/[0.08] hover:text-white'
                }`}
            >
              <SwatchIcon className="w-5 h-5 opacity-80" />
              <span>Kho Beat</span>
            </button>
            <button 
              onClick={() => setActiveTab('gdocs')}
              className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-3 text-xs md:text-sm font-medium leading-5 rounded-lg focus:outline-none transition-all duration-200
                ${activeTab === 'gdocs' 
                  ? 'bg-blue-500/80 text-white shadow shadow-blue-500/30 ring-1 ring-white/20' 
                  : 'text-blue-200 hover:bg-white/[0.08] hover:text-white'
                }`}
            >
              <GlobeAltIcon className="w-5 h-5 opacity-80" />
              <span>Cương Trịnh Voice Ultimate</span>
            </button>
         </div>
      </div>

      <main className="container mx-auto px-4 max-w-4xl relative z-10">
        
        {activeTab === 'midi' ? (
           <MidiRepository />
        ) : activeTab === 'gdocs' ? (
           <GoogleDocsTab onImportToStudio={handleImportTranslatedText} />
        ) : (
          /* SRT CONVERTER UI */
          <>
            <div className="flex justify-end space-x-2 mb-4">
                 <button onClick={saveProject} className="text-xs flex items-center bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-indigo-200 transition-colors">
                     <FolderArrowDownIcon className="w-4 h-4 mr-1" /> Lưu dự án
                 </button>
                 <button onClick={loadProject} className="text-xs flex items-center bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-indigo-200 transition-colors">
                     <FolderOpenIcon className="w-4 h-4 mr-1" /> Tải dự án
                 </button>
            </div>

            <div className="glass-panel rounded-3xl p-1 overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(79,70,229,0.3)]">
              <div className="bg-gradient-to-br from-white/5 to-transparent p-6 md:p-10 space-y-8 rounded-3xl">
                
                {/* Step 1: Upload */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-sm backdrop-blur-md shadow-inner">1</span>
                    <h2 className="text-xl font-semibold text-white tracking-wide drop-shadow-md">Tải lên file SRT</h2>
                  </div>
                  
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".srt"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ease-out
                        ${fileName 
                          ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.2)]' 
                          : 'border-white/20 hover:border-indigo-400 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(129,140,248,0.2)]'
                        }`}
                    >
                      {fileName ? (
                        <div className="flex items-center space-x-3 text-emerald-300 animate-pulse">
                          <DocumentTextIcon className="w-8 h-8" />
                          <span className="font-medium text-lg truncate max-w-xs">{fileName}</span>
                        </div>
                      ) : (
                        <div className="text-center group-hover:scale-105 transition-transform duration-300">
                          <p className="text-indigo-100 font-medium text-lg">Chọn file .srt</p>
                          <p className="text-indigo-300/60 text-sm mt-2">Kéo thả hoặc click để tải lên</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Step 2: Config & Mixing */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-sm backdrop-blur-md shadow-inner">2</span>
                    <h2 className="text-xl font-semibold text-white tracking-wide drop-shadow-md">Studio Hòa Âm & Cấu hình</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                     {/* Base Config */}
                     <div className="glass-input p-5 rounded-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center space-x-2">
                                <ClockIcon className="w-5 h-5 text-cyan-300" />
                                <h3 className="text-indigo-100 font-medium">Tốc độ đọc chung</h3>
                            </div>
                            <span className="text-cyan-300 font-bold bg-cyan-500/20 px-3 py-1 rounded-lg text-sm border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                                {globalSpeed}x
                            </span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={globalSpeed}
                            onChange={(e) => setGlobalSpeed(parseFloat(e.target.value))}
                            className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                        />
                    </div>

                    {/* NEW MIXER PANEL */}
                    <AudioMixerPanel 
                        settings={mixerSettings} 
                        onSettingsChange={setMixerSettings} 
                        onVoiceOverRecorded={handleVoiceOverRecorded}
                        hasRecordedVoice={!!recordedVoicePcmRef.current}
                    />

                    {/* Advanced Settings */}
                    <details className="glass-input p-4 rounded-2xl group transition-all duration-300 open:bg-black/40">
                        <summary className="cursor-pointer text-indigo-200 font-medium flex items-center outline-none select-none hover:text-white transition-colors">
                           <Cog6ToothIcon className="w-5 h-5 mr-2 text-indigo-400 group-open:text-indigo-300 group-open:rotate-90 transition-transform duration-300" />
                           Cài đặt Hệ thống (Proxy / Cache)
                        </summary>
                        <div className="mt-6 space-y-6 pl-2 border-l border-white/10 ml-2">
                          
                          {/* Timeout Config */}
                          <div>
                              <label className="text-xs text-indigo-300/70 font-bold uppercase mb-2 block tracking-widest">
                                  Proxy Request Timeout ({requestTimeoutVal}ms)
                              </label>
                              <input 
                                type="range" 
                                min="2000" 
                                max="30000" 
                                step="1000" 
                                value={requestTimeoutVal}
                                onChange={handleTimeoutChange}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                              />
                          </div>

                          {/* Custom Proxy Manager */}
                          <ProxyManager />

                          {/* Clear Cache */}
                          <div className="pt-2">
                              <button 
                                onClick={handleClearCache}
                                className="flex items-center space-x-2 text-xs text-red-300/80 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/20"
                              >
                                 <TrashIcon className="w-4 h-4" />
                                 <span>Xóa Cache</span>
                              </button>
                          </div>

                        </div>
                    </details>

                  </div>
                </div>

                {/* Subtitle Preview (Editable) */}
                {subtitles.length > 0 && (
                  <div className="glass-input rounded-2xl p-4">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider">
                          Chỉnh sửa nội dung ({subtitles.length} dòng)
                        </h3>
                        <span className="text-xs text-cyan-300 flex items-center bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/20">
                          <PencilSquareIcon className="w-3 h-3 mr-1"/>
                          Sửa văn bản
                        </span>
                     </div>
                     
                     <div className="h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {subtitles.map((sub) => (
                          <div key={sub.id} className="flex flex-col space-y-1 p-3 bg-white/5 rounded-xl border border-white/5 relative hover:bg-white/10 transition-colors">
                            <div className="flex justify-between items-center">
                                <span className="text-indigo-300 font-mono text-[10px] opacity-70">
                                #{sub.id} | {sub.startTime}
                                </span>
                                 {/* Show status if available */}
                                {sub.speedFactor !== undefined && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${
                                        sub.status === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                                    }`}>
                                        {sub.status === 'error' 
                                          ? 'Failed' 
                                          : `${sub.speedFactor}x`
                                        }
                                    </span>
                                )}
                            </div>
                            <textarea 
                              className="bg-transparent border-0 focus:ring-0 text-slate-100 text-sm resize-none h-auto w-full p-0 leading-relaxed"
                              rows={Math.max(1, Math.ceil(sub.text.length / 50))}
                              value={sub.text}
                              onChange={(e) => handleSubtitleTextChange(sub.id, e.target.value)}
                            />
                          </div>
                        ))}
                     </div>
                  </div>
                )}

                {/* Action Button - NEON GRADIENT */}
                <button
                  onClick={processSubtitles}
                  disabled={subtitles.length === 0 || status.isProcessing}
                  className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300 transform active:scale-[0.98] border border-white/20 relative overflow-hidden group
                    ${subtitles.length === 0 
                      ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                      : status.isProcessing 
                        ? 'bg-indigo-900/50 text-indigo-200 cursor-wait'
                        : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]'
                    }`}
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                     {status.isProcessing ? (
                         <>
                            <svg className="animate-spin h-5 w-5 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Đang xử lý {MAX_CONCURRENCY} luồng...</span>
                         </>
                     ) : (
                         <>
                            <BoltIcon className="w-5 h-5 group-hover:animate-pulse" />
                            <span>Bắt đầu chuyển đổi & Hòa âm</span>
                            {/* Insert Chibi Here */}
                            <div className="absolute right-4 bottom-1 transform translate-y-1">
                                <ChibiWidget scale={0.7} mode="button" />
                            </div>
                         </>
                     )}
                  </span>
                  {!status.isProcessing && subtitles.length > 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  )}
                </button>

              </div>
            </div>

            {/* Status Section */}
            {(status.isProcessing || status.isComplete || status.error || status.failedLines.length > 0) && (
              <ProcessingStatus state={status} subtitles={subtitles} />
            )}

            {/* Result Section (Glass Modal Look) */}
            {status.isComplete && status.audioUrl && (
              <div className="mt-8 glass-panel rounded-3xl p-8 border border-white/10 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-fade-in text-center relative overflow-hidden">
                {/* Background glow for success */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"></div>
                
                <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-md">🎉 Xong rồi!</h2>
                
                <audio controls className="w-full mb-8 h-12 rounded-lg opacity-90" src={status.audioUrl}>
                  Trình duyệt của bạn không hỗ trợ thẻ audio.
                </audio>

                <div className="flex flex-col md:flex-row justify-center items-center gap-5">
                  <a
                    href={status.audioUrl}
                    download={`${fileName.replace('.srt', '')}_master.wav`}
                    className="glass-button w-full md:w-auto flex items-center justify-center space-x-2 text-white font-bold py-4 px-8 rounded-2xl hover:bg-white/10 transition-all active:scale-95"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>Tải WAV (Gốc)</span>
                  </a>

                  <button
                    onClick={handleDownloadMp3}
                    disabled={isConvertingMp3}
                    className={`w-full md:w-auto flex items-center justify-center space-x-2 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg border border-white/20 active:scale-95
                      ${isConvertingMp3 
                        ? 'bg-emerald-900/50 cursor-wait' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                      }`}
                  >
                    {isConvertingMp3 ? (
                      <>
                         <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                         <span>Đang nén MP3... {mp3Progress}%</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        <span>Tải MP3 (Nhẹ)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
