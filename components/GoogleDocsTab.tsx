import React, { useState } from 'react';
import { translateContent } from '../services/geminiService';
import { ClipboardDocumentListIcon, LanguageIcon, ArrowRightIcon, BoltIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Props {
  onImportToStudio: (text: string) => void;
}

export const GoogleDocsTab: React.FC<Props> = ({ onImportToStudio }) => {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    
    setIsTranslating(true);
    try {
      const result = await translateContent(sourceText);
      setTranslatedText(result);
    } catch (e: any) {
      alert("Lỗi dịch thuật: " + e.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleImport = () => {
    if (!translatedText.trim()) return;
    onImportToStudio(translatedText);
  };

  return (
    <div className="animate-fade-in space-y-6">
       {/* Header Info */}
       <div className="glass-panel p-6 rounded-3xl border border-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10">
             <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
                <DocumentTextIcon className="w-8 h-8 text-blue-300" />
             </div>
             <div>
                <h2 className="text-2xl font-bold text-white">Cương Trịnh Voice Ultimate - Dịch Không Ký Tự</h2>
                <p className="text-blue-200/60 text-sm mt-1">
                   Hỗ trợ mọi ngôn ngữ (Anh, Trung, Nhật...) • <span className="text-emerald-400 font-bold">Không giới hạn ký tự</span>
                </p>
             </div>
          </div>
       </div>

       {/* Main Translation Area */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[600px]">
          
          {/* Source Column */}
          <div className="glass-input rounded-2xl p-4 flex flex-col h-full border border-white/10 focus-within:border-blue-500/50 transition-colors">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                     <ClipboardDocumentListIcon className="w-4 h-4" />
                     Văn bản gốc / Google Docs
                  </span>
                  <span className="text-[10px] text-white/40 bg-white/10 px-2 py-0.5 rounded">Auto Detect</span>
              </div>
              <textarea 
                 className="flex-1 bg-transparent border-0 resize-none outline-none text-slate-200 text-sm leading-relaxed custom-scrollbar placeholder-white/20"
                 placeholder="Dán nội dung từ Google Docs, bài báo, hoặc văn bản nước ngoài vào đây..."
                 value={sourceText}
                 onChange={(e) => setSourceText(e.target.value)}
              />
          </div>

          {/* Target Column */}
          <div className="glass-input rounded-2xl p-4 flex flex-col h-full border border-white/10 relative">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                     <LanguageIcon className="w-4 h-4" />
                     Bản dịch Tiếng Việt (AI)
                  </span>
                  {translatedText && (
                      <span className="text-[10px] text-emerald-400 font-bold">Hoàn tất</span>
                  )}
              </div>
              
              {isTranslating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-emerald-200/50 animate-pulse gap-3">
                      <BoltIcon className="w-10 h-10 animate-bounce" />
                      <span className="text-sm">Đang phân tích & dịch thuật siêu tốc...</span>
                  </div>
              ) : (
                  <textarea 
                    className="flex-1 bg-transparent border-0 resize-none outline-none text-emerald-100 text-sm leading-relaxed custom-scrollbar placeholder-emerald-500/20"
                    placeholder="Bản dịch sẽ xuất hiện ở đây..."
                    value={translatedText}
                    onChange={(e) => setTranslatedText(e.target.value)}
                  />
              )}

              {/* Action Buttons Layer */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                 {!translatedText ? (
                     <button 
                        onClick={handleTranslate}
                        disabled={!sourceText.trim() || isTranslating}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                        <LanguageIcon className="w-4 h-4" />
                        Dịch Ngay
                     </button>
                 ) : (
                     <button 
                        onClick={handleImport}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 animate-bounce-subtle"
                     >
                        <span>Chuyển sang Studio</span>
                        <ArrowRightIcon className="w-4 h-4" />
                     </button>
                 )}
              </div>
          </div>
       </div>
    </div>
  );
};