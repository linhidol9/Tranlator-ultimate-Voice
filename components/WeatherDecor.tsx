import React, { useEffect, useState } from 'react';
import { SunIcon, CloudIcon, BoltIcon, MoonIcon } from '@heroicons/react/24/solid';

type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export const WeatherDecor: React.FC = () => {
  const [season, setSeason] = useState<Season>('Spring');
  const [temp, setTemp] = useState<number>(25);
  const [particles, setParticles] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    // Determine season based on Vietnam months
    const month = new Date().getMonth() + 1; // 1-12
    let currentSeason: Season = 'Spring';
    
    // North Vietnam Seasons roughly:
    if (month >= 2 && month <= 4) currentSeason = 'Spring'; // Feb-Apr
    else if (month >= 5 && month <= 7) currentSeason = 'Summer'; // May-Jul
    else if (month >= 8 && month <= 10) currentSeason = 'Autumn'; // Aug-Oct
    else currentSeason = 'Winter'; // Nov-Jan

    setSeason(currentSeason);

    // Simulate Temp
    const baseTemp = {
        'Spring': 22,
        'Summer': 34,
        'Autumn': 26,
        'Winter': 16
    };
    const randomVariation = Math.floor(Math.random() * 5) - 2; // +/- 2
    setTemp(baseTemp[currentSeason] + randomVariation);

    // Create particles
    setParticles(Array.from({ length: 20 }, (_, i) => i));

    // Clock Timer
    const timer = setInterval(() => {
        setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);

  }, []);

  const getSeasonInfo = () => {
    switch(season) {
        case 'Spring': return { 
            name: 'Mùa Xuân', 
            icon: <SunIcon className="w-6 h-6 text-pink-300" />,
            color: 'text-pink-300',
            particleEmoji: '🌸',
            subText: 'Hà Nội - Mưa phùn nhẹ'
        };
        case 'Summer': return { 
            name: 'Mùa Hạ', 
            icon: <SunIcon className="w-6 h-6 text-yellow-400 animate-pulse" />,
            color: 'text-yellow-400',
            particleEmoji: '✨', // Fireflies or glimmer
            subText: 'Sài Gòn - Nắng đẹp'
        };
        case 'Autumn': return { 
            name: 'Mùa Thu', 
            icon: <CloudIcon className="w-6 h-6 text-orange-300" />,
            color: 'text-orange-300',
            particleEmoji: '🍁',
            subText: 'Đà Lạt - Se lạnh'
        };
        case 'Winter': return { 
            name: 'Mùa Đông', 
            icon: <MoonIcon className="w-6 h-6 text-cyan-200" />,
            color: 'text-cyan-200',
            particleEmoji: '❄️',
            subText: 'Sapa - Sương mù'
        };
    }
  };

  const info = getSeasonInfo();

  // Format Time: HH:mm:ss - DD/MM/YYYY
  const timeString = currentTime.toLocaleTimeString('vi-VN', { hour12: false });
  const dateString = currentTime.toLocaleDateString('vi-VN');

  return (
    <>
        {/* Fixed Widget */}
        <div className="fixed top-4 right-4 z-50 animate-fade-in hidden md:block">
            <div className="glass-panel px-4 py-3 rounded-2xl flex items-center space-x-3 border-l-4 border-l-white/20 hover:border-l-indigo-400 transition-all shadow-lg backdrop-blur-xl">
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-md shadow-inner">
                    {info.icon}
                </div>
                <div>
                    <div className={`font-bold text-sm ${info.color} uppercase tracking-wider`}>
                        {info.name} • {temp}°C
                    </div>
                    <div className="text-[10px] text-indigo-200/60 font-mono mb-1">
                        {info.subText}
                    </div>
                    <div className="text-[11px] text-white/90 font-mono font-bold bg-black/20 px-2 py-0.5 rounded border border-white/5 inline-block">
                        {timeString} <span className="text-white/40">|</span> {dateString}
                    </div>
                </div>
            </div>
        </div>

        {/* Background Effects Layer */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {season === 'Summer' && <div className="sun-ray"></div>}
            {season === 'Winter' && <div className="mist"></div>}
            
            {/* Particles */}
            {particles.map((_, i) => {
                const left = Math.random() * 100;
                const animDuration = 10 + Math.random() * 20; // 10-30s
                const delay = Math.random() * 20;
                const size = 10 + Math.random() * 15;

                return (
                    <div 
                        key={i}
                        className="weather-particle"
                        style={{
                            left: `${left}%`,
                            animationDuration: `${animDuration}s`,
                            animationDelay: `-${delay}s`,
                            fontSize: `${size}px`,
                            opacity: 0.6
                        }}
                    >
                        {info.particleEmoji}
                    </div>
                );
            })}
        </div>
    </>
  );
};