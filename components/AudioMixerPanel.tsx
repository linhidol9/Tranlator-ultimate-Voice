import React, { useState, useRef, useEffect } from 'react';
import { REVIEW_BEATS, MusicTrack } from '../utils/musicData';
import { PlayIcon, PauseIcon, MicrophoneIcon, StopIcon, SpeakerWaveIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import { MixerSettings } from '../types';

interface Props {
  settings: MixerSettings;
  onSettingsChange: (newSettings: MixerSettings) => void;
  onVoiceOverRecorded: (blob: Blob) => void;
  hasRecordedVoice: boolean;
}

export const AudioMixerPanel: React.FC<Props> = ({ settings, onSettingsChange, onVoiceOverRecorded, hasRecordedVoice }) => {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
      }
    };
  }, [previewAudio]);

  const handleMusicSelect = (id: number) => {
    if (previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    }
    
    if (id === -1) {
        onSettingsChange({ ...settings, selectedMusicId: null });
        return;
    }

    onSettingsChange({ ...settings, selectedMusicId: id });
  };

  const togglePreview = () => {
    if (!settings.selectedMusicId) return;

    const track = REVIEW_BEATS.find(b => b.id === settings.selectedMusicId);
    if (!track) return;

    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(track.url);
      audio.volume = 0.5;
      audio.loop = true;
      audio.play().catch(e => console.error("Preview play failed", e));
      setPreviewAudio(audio);
      setIsPlayingPreview(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onVoiceOverRecorded(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Không thể truy cập Microphone: " + err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6 border border-white/10">
      <div className="flex items-center space-x-2 text-indigo-200 uppercase text-xs font-bold tracking-widest mb-2">
        <MusicalNoteIcon className="w-4 h-4" />
        <span>Audio Mixer Studio</span>
      </div>

      {/* Volume Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
           <label className="text-xs text-indigo-300 flex justify-between">
              <span>TTS Voice Volume</span>
              <span>{Math.round(settings.ttsVolume * 100)}%</span>
           </label>
           <input 
             type="range" min="0" max="1" step="0.1"
             value={settings.ttsVolume}
             onChange={(e) => onSettingsChange({...settings, ttsVolume: parseFloat(e.target.value)})}
             className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
           />
        </div>
        <div className="space-y-2">
           <label className="text-xs text-orange-300 flex justify-between">
              <span>Background Music Volume</span>
              <span>{Math.round(settings.musicVolume * 100)}%</span>
           </label>
           <input 
             type="range" min="0" max="1" step="0.1"
             value={settings.musicVolume}
             onChange={(e) => onSettingsChange({...settings, musicVolume: parseFloat(e.target.value)})}
             className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-400"
           />
        </div>
      </div>

      {/* Music Selector */}
      <div className="space-y-3 p-4 bg-black/20 rounded-xl border border-white/5">
         <label className="text-xs text-white/60 font-bold block">Background Track (Kho Beat)</label>
         <div className="flex space-x-2">
             <select 
                className="flex-1 bg-black/40 text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-orange-500/50"
                value={settings.selectedMusicId || -1}
                onChange={(e) => handleMusicSelect(parseInt(e.target.value))}
             >
                 <option value={-1}>-- Không sử dụng nhạc nền --</option>
                 {REVIEW_BEATS.map(beat => (
                     <option key={beat.id} value={beat.id}>
                        {beat.title} ({beat.genre}) - {beat.duration}
                     </option>
                 ))}
             </select>
             
             {settings.selectedMusicId && (
                 <button 
                   onClick={togglePreview}
                   className={`p-2 rounded-lg border transition-all ${isPlayingPreview ? 'bg-orange-500/80 border-orange-500 text-white' : 'bg-white/10 border-white/10 text-orange-300 hover:bg-white/20'}`}
                 >
                    {isPlayingPreview ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                 </button>
             )}
         </div>
         
         {/* Fade Controls */}
         {settings.selectedMusicId && (
            <div className="flex space-x-4 pt-2">
               <label className="flex items-center space-x-2 text-xs text-indigo-200 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={settings.fadeIn}
                    onChange={(e) => onSettingsChange({...settings, fadeIn: e.target.checked})}
                    className="rounded border-white/20 bg-black/30 text-indigo-500 focus:ring-offset-0 focus:ring-0"
                  />
                  <span>Fade Music In</span>
               </label>
               <label className="flex items-center space-x-2 text-xs text-indigo-200 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={settings.fadeOut}
                    onChange={(e) => onSettingsChange({...settings, fadeOut: e.target.checked})}
                    className="rounded border-white/20 bg-black/30 text-indigo-500 focus:ring-offset-0 focus:ring-0"
                  />
                  <span>Fade Music Out</span>
               </label>
            </div>
         )}
      </div>

      {/* Voice Over Recorder */}
      <div className="p-4 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-xl border border-indigo-500/10 flex items-center justify-between">
          <div className="space-y-1">
             <div className="flex items-center space-x-2">
                <MicrophoneIcon className="w-4 h-4 text-pink-300" />
                <h4 className="text-sm font-bold text-white">Voice Over Recording</h4>
             </div>
             <p className="text-[10px] text-indigo-200/60">Ghi âm giọng của bạn để chèn vào đoạn nhạc.</p>
          </div>

          <div className="flex items-center space-x-3">
             {hasRecordedVoice && (
                <div className="text-xs text-emerald-400 font-bold bg-emerald-900/30 px-2 py-1 rounded border border-emerald-500/20">
                    Đã lưu
                </div>
             )}
             
             {!isRecording ? (
                 <button 
                   onClick={startRecording}
                   className="flex items-center space-x-1 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
                 >
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    <span>REC</span>
                 </button>
             ) : (
                 <button 
                   onClick={stopRecording}
                   className="flex items-center space-x-1 bg-white text-red-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
                 >
                    <StopIcon className="w-4 h-4" />
                    <span>STOP</span>
                 </button>
             )}
          </div>
      </div>
      
      {hasRecordedVoice && (
          <div className="space-y-2 px-1">
            <label className="text-xs text-pink-300 flex justify-between">
                <span>Voice Over Volume</span>
                <span>{Math.round(settings.voiceOverVolume * 100)}%</span>
            </label>
            <input 
                type="range" min="0" max="1.5" step="0.1"
                value={settings.voiceOverVolume}
                onChange={(e) => onSettingsChange({...settings, voiceOverVolume: parseFloat(e.target.value)})}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-400"
            />
          </div>
      )}

    </div>
  );
};