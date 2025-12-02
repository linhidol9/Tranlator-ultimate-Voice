import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon, BoltIcon } from '@heroicons/react/24/outline';
import { setCustomProxies } from '../services/googleTtsService';

interface ProxyItem {
  id: string;
  url: string;
  isValid: boolean;
  isActive: boolean;
}

export const ProxyManager: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [newProxyUrl, setNewProxyUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load saved proxies from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('custom_proxies');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProxies(parsed);
        updateService(parsed);
      } catch (e) {
        console.error("Failed to load proxies", e);
      }
    }
  }, []);

  const updateService = (currentProxies: ProxyItem[]) => {
    const validUrls = currentProxies.filter(p => p.isActive && p.isValid).map(p => p.url);
    setCustomProxies(validUrls);
    localStorage.setItem('custom_proxies', JSON.stringify(currentProxies));
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith('http');
    } catch {
      return false;
    }
  };

  const handleAddProxy = () => {
    setError(null);
    const trimmed = newProxyUrl.trim();
    
    if (!trimmed) return;
    
    if (!validateUrl(trimmed)) {
      setError("URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://");
      return;
    }

    if (proxies.some(p => p.url === trimmed)) {
      setError("Proxy này đã tồn tại trong danh sách.");
      return;
    }

    const newProxy: ProxyItem = {
      id: Date.now().toString(),
      url: trimmed,
      isValid: true,
      isActive: true
    };

    const updated = [...proxies, newProxy];
    setProxies(updated);
    updateService(updated);
    setNewProxyUrl('');
  };

  const handleRemove = (id: string) => {
    const updated = proxies.filter(p => p.id !== id);
    setProxies(updated);
    updateService(updated);
  };

  const toggleActive = (id: string) => {
    const updated = proxies.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    setProxies(updated);
    updateService(updated);
  };

  return (
    <div className="space-y-4">
       <div className="flex flex-col space-y-2">
         <label className="text-xs text-indigo-300/70 font-bold uppercase tracking-widest">
           Quản lý Custom Proxies
         </label>
         <div className="flex space-x-2">
           <input 
             type="text" 
             value={newProxyUrl}
             onChange={(e) => setNewProxyUrl(e.target.value)}
             placeholder="https://corsproxy.io/?"
             className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:border-indigo-400 outline-none transition-colors"
             onKeyDown={(e) => e.key === 'Enter' && handleAddProxy()}
           />
           <button 
             onClick={handleAddProxy}
             className="bg-indigo-600/50 hover:bg-indigo-600/80 text-white rounded-xl px-3 py-2 transition-colors border border-indigo-500/30"
           >
             <PlusIcon className="w-4 h-4" />
           </button>
         </div>
         {error && <span className="text-xs text-red-300">{error}</span>}
       </div>

       {proxies.length > 0 && (
         <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
           {proxies.map(proxy => (
             <div key={proxy.id} className={`flex items-center justify-between p-2 rounded-lg border ${proxy.isActive ? 'bg-white/5 border-white/10' : 'bg-black/20 border-white/5 opacity-60'}`}>
                <div className="flex items-center space-x-3 overflow-hidden">
                   <button onClick={() => toggleActive(proxy.id)} className="shrink-0">
                      {proxy.isActive ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/30" />
                      )}
                   </button>
                   <span className="text-xs font-mono text-indigo-100 truncate" title={proxy.url}>
                     {proxy.url}
                   </span>
                </div>
                <button 
                  onClick={() => handleRemove(proxy.id)}
                  className="text-red-300/50 hover:text-red-300 transition-colors ml-2"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
             </div>
           ))}
         </div>
       )}
       
       {proxies.length === 0 && (
         <div className="text-[10px] text-indigo-300/40 italic text-center py-2 border border-dashed border-white/10 rounded-lg">
           Chưa có proxy tùy chỉnh nào. Thêm proxy để tăng độ ổn định.
         </div>
       )}

       <div className="flex items-start space-x-2 text-[10px] text-indigo-300/60 bg-indigo-900/10 p-2 rounded border border-indigo-500/10">
          <BoltIcon className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Hệ thống sẽ tự động sử dụng các proxy này kết hợp với danh sách mặc định.
            Các proxy thất bại liên tục sẽ bị tạm khóa.
          </span>
       </div>
    </div>
  );
};
