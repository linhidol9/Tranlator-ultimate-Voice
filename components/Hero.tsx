import React from 'react';
import { SpeakerWaveIcon } from '@heroicons/react/24/outline';

export const Hero: React.FC = () => {
  return (
    <div className="text-center py-12 px-4 relative z-10 overflow-hidden">
      <div className="flex justify-center mb-6">
        <div className="glass-button p-4 rounded-3xl animate-float">
          <SpeakerWaveIcon className="w-12 h-12 text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.6)]" />
        </div>
      </div>
      
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight drop-shadow-lg leading-tight">
        Việt Nam Text to speech <br className="hidden md:block"/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-300 to-red-400 text-glow">
          Convert Premium Free
        </span>
      </h1>
      
      <div className="flex flex-col items-center space-y-4 mt-6">
          <div className="glass-panel px-6 py-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md max-w-3xl">
               <p className="text-indigo-100/90 text-lg font-light tracking-wide">
                Phiên bản Premium tự động sửa dòng line. Không giới hạn số lượng. <span className="font-semibold text-emerald-300">Chỉ xử lý đa luồng siêu nhanh.</span>
              </p>
          </div>

          <div className="flex items-center space-x-2 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 px-4 py-2 rounded-full border border-indigo-500/30 shadow-lg mt-6">
              <span className="text-indigo-200 text-xs uppercase tracking-widest font-bold">Tác giả</span>
              <span className="w-1 h-1 rounded-full bg-white/30"></span>
              <span className="text-cyan-300 font-bold font-mono">Cương Trịnh - 0396067987</span>
          </div>
      </div>
    </div>
  );
};