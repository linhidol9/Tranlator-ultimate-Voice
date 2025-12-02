
import React, { useEffect, useRef, useState } from 'react';
import { MusicalNoteIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export const BackgroundLofi: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(30); // Default volume 30% to be gentle
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initPlayer = () => {
        // Prevent double initialization
        if (playerRef.current) return;

        // Check if YT API is truly loaded
        if (!window.YT || !window.YT.Player) return;

        try {
            playerRef.current = new window.YT.Player('lofi-player', {
                height: '0',
                width: '0',
                videoId: 'LotVZGX7uDk', // The requested Lofi Video
                playerVars: {
                    'playsinline': 1,
                    'controls': 0,
                    'loop': 1,
                    'playlist': 'LotVZGX7uDk', // Required for loop to work
                    'disablekb': 1,
                    'origin': window.location.origin,
                    'autoplay': 1, // Try forceful autoplay param
                    'allow': 'autoplay'
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    // FIX: Log only data, not the full event object which contains circular DOM references
                    'onError': (e: any) => console.warn("Lofi Player Error Code:", e.data)
                }
            });
        } catch (e) {
            console.error("Failed to init YT player", e);
        }
    };

    if (!window.YT) {
        // 1. Load YouTube IFrame API if not present
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        // 2. Init Player when API is ready
        window.onYouTubeIframeAPIReady = initPlayer;
    } else {
        // API already loaded (e.g. from cache or previous mount), init immediately
        // Need a slight delay to ensure DOM is ready
        setTimeout(initPlayer, 100);
    }

    return () => {
       // Cleanup not strictly necessary for singleton bg music, but good practice
    };
  }, []);

  const onPlayerReady = (event: any) => {
    // CRITICAL FIX: Ensure ref points to the ready event target
    playerRef.current = event.target;
    setIsReady(true);
    
    if (typeof event.target.setVolume === 'function') {
        event.target.setVolume(volume);
    }
    
    // Attempt Auto-play immediately
    try {
        if (typeof event.target.playVideo === 'function') {
            event.target.playVideo();
        }
    } catch(e) {}
  };

  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
    }
  };

  // Browser Autoplay Policy Workaround:
  // Listen for ANY interaction (move mouse, scroll, touch, key, click) to start music.
  useEffect(() => {
      const handleFirstInteraction = () => {
          if (playerRef.current && isReady && !isPlaying) {
              if (typeof playerRef.current.playVideo === 'function') {
                  playerRef.current.playVideo();
              }
          }
      };

      const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll', 'wheel'];
      
      if (!isPlaying) {
        events.forEach(evt => window.addEventListener(evt, handleFirstInteraction, { passive: true }));
      } else {
        events.forEach(evt => window.removeEventListener(evt, handleFirstInteraction));
      }

      return () => {
          events.forEach(evt => window.removeEventListener(evt, handleFirstInteraction));
      };
  }, [isReady, isPlaying]);


  // Controls
  const togglePlay = () => {
    if (!playerRef.current) return;
    // Safety check for method existence
    if (typeof playerRef.current.playVideo !== 'function') return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current || typeof playerRef.current.mute !== 'function') return;
    
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseInt(e.target.value);
      setVolume(newVol);
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
          playerRef.current.setVolume(newVol);
      }
  };

  return (
    <>
      {/* Hidden Div for YouTube Player */}
      <div id="lofi-player" style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none', visibility: 'hidden' }}></div>

      {/* Floating Control Widget (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 group">
         {/* Main Toggle Button */}
         <button 
           onClick={togglePlay}
           className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]
             ${isPlaying 
                ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300 animate-[spin_10s_linear_infinite]' 
                : 'bg-black/40 border-white/10 text-white/40 animate-pulse'
             }`}
           title={isPlaying ? "Dừng nhạc nền" : "Phát nhạc nền Lofi"}
         >
            <MusicalNoteIcon className="w-5 h-5" />
         </button>

         {/* Expanded Controls (Visible on Hover/Active) */}
         <div className={`flex items-center space-x-2 glass-panel px-3 py-2 rounded-xl transition-all duration-300 origin-left ${isPlaying || 'opacity-0 -translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto'}`}>
             
             {/* Visualizer bars */}
             <div className="flex items-end space-x-0.5 h-4 w-8">
                 <div className="w-1 bg-indigo-400 rounded-t animate-[bounce_1s_infinite] h-[60%]"></div>
                 <div className="w-1 bg-pink-400 rounded-t animate-[bounce_1.2s_infinite] h-[80%]"></div>
                 <div className="w-1 bg-cyan-400 rounded-t animate-[bounce_0.8s_infinite] h-[40%]"></div>
                 <div className="w-1 bg-purple-400 rounded-t animate-[bounce_1.5s_infinite] h-[70%]"></div>
             </div>

             <button onClick={toggleMute} className="text-white/80 hover:text-white">
                {isMuted ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
             </button>
             
             <input 
               type="range" 
               min="0" 
               max="100" 
               value={volume}
               onChange={changeVolume}
               className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-400"
             />
         </div>
      </div>
    </>
  );
};
