import React, { useState } from 'react';
import { generateGoogleVoice } from '../services/googleTtsService';
import { pcmToWav } from '../utils/audio';
import { GOOGLE_TTS_SAMPLE_RATE } from '../services/googleTtsService';
import { REVIEW_BEATS } from '../utils/musicData';
import { MagnifyingGlassIcon, PlayCircleIcon, ArrowDownTrayIcon, FireIcon } from '@heroicons/react/24/outline';

export const MidiRepository: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleGenerateVocal = async (song: any) => {
    setProcessingId(song.id);
    try {
        // Mock generating vocal for the song title as demo
        const pcm = await generateGoogleVoice(`Đây là bản demo giọng đọc cho beat ${song.title}`);
        const wav = pcmToWav(pcm, GOOGLE_TTS_SAMPLE_RATE);
        const url = URL.createObjectURL(wav);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${song.title.replace(/\s+/g, '_')}_vocal_demo.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e: any) {
        alert("Lỗi tạo vocal: " + e.message);
    } finally {
        setProcessingId(null);
    }
  };

  const filteredSongs = REVIEW_BEATS.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.composer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.genre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-10 animate-fade-in min-h-[500px]">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FireIcon className="w-6 h-6 text-orange-500 animate-pulse" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">
                        Kho Beat Review Phim Hot
                    </span>
                </h2>
                <p className="text-indigo-200/60 text-sm mt-1">Tổng hợp nhạc nền Review Phim, Tóm Tắt Phim thịnh hành nhất</p>
            </div>
            
            <div className="relative w-full md:w-64">
                <input 
                    type="text" 
                    placeholder="Tìm beat, thể loại..." 
                    className="w-full bg-black/30 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <MagnifyingGlassIcon className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
            </div>
        </div>

        <div className="grid gap-4">
            {filteredSongs.map(song => (
                <div key={song.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-orange-500/30 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            <PlayCircleIcon className="w-6 h-6 text-orange-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg group-hover:text-orange-300 transition-colors">{song.title}</h3>
                            <p className="text-xs text-indigo-200/70">{song.composer} • <span className="text-orange-400/80 font-bold">{song.genre}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/30 hidden md:block bg-black/20 px-2 py-1 rounded">{song.duration}</span>
                        <button 
                            onClick={() => handleGenerateVocal(song)}
                            disabled={processingId === song.id}
                            className="glass-button px-4 py-2 rounded-xl text-xs font-bold text-orange-200 flex items-center gap-2 hover:bg-orange-500/20 transition-colors border-orange-500/20"
                        >
                            {processingId === song.id ? (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <ArrowDownTrayIcon className="w-3 h-3" />
                            )}
                            Tải & Tạo Vocal
                        </button>
                    </div>
                </div>
            ))}
            
            {filteredSongs.length === 0 && (
                <div className="text-center py-12 text-white/30 italic border border-dashed border-white/10 rounded-2xl">
                    Không tìm thấy beat phù hợp.
                </div>
            )}
        </div>
        
        <div className="mt-8 p-4 rounded-xl bg-orange-900/10 border border-orange-500/10 text-center">
            <p className="text-xs text-orange-300/80">
                ✨ Mẹo: Kết hợp giọng đọc Chị Google với nhạc nền kịch tính để tạo video triệu view!
            </p>
        </div>
    </div>
  );
};