import React from 'react';
import { ProcessingState, Subtitle } from '../types';
import { ExclamationTriangleIcon, ClockIcon, BoltIcon, CheckCircleIcon, PauseCircleIcon } from '@heroicons/react/24/outline';

interface Props {
  state: ProcessingState;
  subtitles?: Subtitle[];
}

export const ProcessingStatus: React.FC<Props> = ({ state, subtitles }) => {
  const percentage = state.totalLines > 0 
    ? Math.round((state.processedLines / state.totalLines) * 100) 
    : 0;

  const hasFailures = state.failedLines.length > 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} giây`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs} giây`;
  };

  const processedList = subtitles 
    ? subtitles.filter(s => s.status && s.status !== 'pending').reverse().slice(0, 5)
    : [];
    
  const failedList = subtitles && hasFailures
    ? subtitles.filter(s => state.failedLines.includes(s.id))
    : [];

  return (
    <div className="glass-panel w-full max-w-2xl mx-auto rounded-3xl p-6 mt-8 animate-fade-in relative overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <span className="text-white font-semibold text-lg drop-shadow-sm">Tiến độ xử lý</span>
        <span className="text-indigo-200 text-sm bg-white/10 px-3 py-1 rounded-full border border-white/5">
          {state.processedLines} / {state.totalLines}
        </span>
      </div>
      
      {/* Progress Bar Container */}
      <div className="w-full bg-black/40 rounded-full h-5 mb-6 overflow-hidden border border-white/5 relative shadow-inner">
        {/* Animated Bar */}
        <div 
          className={`h-full transition-all duration-500 ease-out relative ${
            hasFailures && state.isComplete ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
          }`}
          style={{ width: `${percentage}%` }}
        >
            {/* Shimmer effect on bar */}
            <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]"></div>
        </div>
      </div>

      {state.isProcessing && (
        <div className="flex flex-col items-center space-y-3 relative z-10">
           <div className="flex items-center space-x-2 text-indigo-100/80 bg-indigo-900/30 px-4 py-2 rounded-xl border border-indigo-500/20">
              <svg className="animate-spin h-4 w-4 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              <span className="text-sm font-medium">Đang chạy đua với thời gian... ({percentage}%)</span>
           </div>
           
           {state.estimatedRemainingSeconds !== undefined && state.estimatedRemainingSeconds > 0 && (
             <div className="flex items-center space-x-1.5 text-indigo-300/60 text-xs font-mono bg-black/20 px-3 py-1 rounded-lg">
               <ClockIcon className="w-3.5 h-3.5" />
               <span>Còn khoảng: {formatTime(state.estimatedRemainingSeconds)}</span>
             </div>
           )}
        </div>
      )}

      {/* Live Log */}
      {processedList.length > 0 && state.isProcessing && (
        <div className="mt-6 border-t border-white/10 pt-4 relative z-10">
             <p className="text-[10px] text-indigo-300/50 uppercase font-bold mb-3 tracking-widest">Live Log</p>
             <div className="space-y-2">
                 {processedList.map(sub => {
                     const sf = sub.speedFactor || 1;
                     let colorClass = 'text-emerald-300';
                     let icon = <CheckCircleIcon className="w-3 h-3 mr-1"/>;
                     let text = `${sf}x`;
                     
                     if (sub.status === 'error') {
                         colorClass = 'text-red-300';
                         icon = <ExclamationTriangleIcon className="w-3 h-3 mr-1"/>;
                         text = 'Lỗi';
                     } else if (sf > 1.3) {
                         colorClass = 'text-yellow-300';
                         icon = <BoltIcon className="w-3 h-3 mr-1"/>;
                     } else if (sf < 0.95) {
                         colorClass = 'text-sky-300';
                         icon = <PauseCircleIcon className="w-3 h-3 mr-1"/>;
                     }

                     return (
                         <div key={sub.id} className="flex flex-col text-xs bg-black/20 border border-white/5 p-2 rounded-lg backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 truncate max-w-[70%]">
                                  <span className="text-indigo-400/70 font-mono">#{sub.id}</span>
                                  <span className="text-slate-200 truncate font-light">{sub.text}</span>
                              </div>
                              <div className={`flex items-center font-mono font-bold ${colorClass} bg-white/5 px-2 py-0.5 rounded`}>
                                  {icon}
                                  {text}
                              </div>
                            </div>
                            {sub.errorMessage && (
                              <div className="mt-2 text-[10px] text-red-200 font-mono break-all bg-red-500/10 p-2 rounded border border-red-500/20">
                                ! {sub.errorMessage}
                              </div>
                            )}
                         </div>
                     );
                 })}
             </div>
        </div>
      )}
      
      {state.isComplete && !state.error && !hasFailures && (
        <div className="text-center text-emerald-300 font-bold bg-emerald-500/10 py-3 rounded-xl border border-emerald-400/20 mt-6 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          ✨ Hoàn tất xuất sắc!
        </div>
      )}

      {hasFailures && (
        <div className="mt-6 bg-red-900/20 border border-red-500/20 rounded-xl p-4 max-h-56 overflow-y-auto custom-scrollbar relative z-10">
          <div className="flex items-center space-x-2 text-red-300 mb-3 font-bold text-sm sticky top-0 bg-black/40 backdrop-blur-md p-2 rounded-lg border border-red-500/10">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Thất bại ({failedList.length} dòng)</span>
          </div>
          <div className="space-y-2">
            {failedList.map(sub => (
              <div key={sub.id} className="flex flex-col space-y-1 p-3 bg-red-500/5 text-red-200 text-xs rounded-lg border border-red-500/10 hover:bg-red-500/10 transition-colors">
                <div className="font-bold flex justify-between">
                   <span>Line #{sub.id}</span>
                   <span className="opacity-50 font-mono">{sub.startTime}</span>
                </div>
                <div className="opacity-80 italic border-l-2 border-red-500/30 pl-2">{sub.text}</div>
                {sub.errorMessage && (
                  <div className="mt-1">
                    <div className="text-[10px] font-mono text-red-300/70 bg-black/30 p-2 rounded-md break-all">
                        {sub.errorMessage}
                    </div>
                    {(sub.errorMessage.includes("403") || sub.errorMessage.includes("429")) && (
                        <div className="text-[10px] text-yellow-300 mt-2 flex items-center bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                            <span className="mr-2">💡</span>
                            Gợi ý: Google chặn IP. Thêm Proxy hoặc chờ 5 phút.
                        </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {state.error && (
        <div className="text-center text-red-300 font-bold bg-red-500/10 py-3 rounded-xl border border-red-500/30 mt-4 shadow-lg">
          ❌ {state.error}
        </div>
      )}
    </div>
  );
};