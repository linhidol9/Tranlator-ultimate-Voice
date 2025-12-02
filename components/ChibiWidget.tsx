
import React, { useEffect, useState } from 'react';

type Activity = 'school' | 'work' | 'play' | 'sleep';
type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

interface Props {
  scale?: number;
  mode?: 'button' | 'tab'; // Slight styling differences
}

export const ChibiWidget: React.FC<Props> = ({ scale = 1, mode = 'button' }) => {
  const [season, setSeason] = useState<Season>('Spring');
  const [activity, setActivity] = useState<Activity>('work');

  useEffect(() => {
    // 1. Determine Season
    const month = new Date().getMonth() + 1;
    if (month >= 2 && month <= 4) setSeason('Spring');
    else if (month >= 5 && month <= 7) setSeason('Summer');
    else if (month >= 8 && month <= 10) setSeason('Autumn');
    else setSeason('Winter');

    // 2. Determine Activity based on Time
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) setActivity('sleep'); // 10PM - 6AM
    else if (hour >= 6 && hour < 8) setActivity('school'); // 6AM - 8AM (Commute)
    else if (hour >= 8 && hour < 17) setActivity('work'); // 8AM - 5PM (Work)
    else setActivity('play'); // 5PM - 10PM (Evening)
  }, []);

  // Visual Configuration
  const getColors = () => {
    switch(season) {
      case 'Spring': return { hat: '#F472B6', shirt: '#A78BFA', accessory: '🌸' }; // Pink/Purple
      case 'Summer': return { hat: '#FACC15', shirt: '#38BDF8', accessory: '🕶️' }; // Yellow/Blue
      case 'Autumn': return { hat: '#F97316', shirt: '#78350F', accessory: '🍂' }; // Orange/Brown
      case 'Winter': return { hat: '#60A5FA', shirt: '#1E3A8A', accessory: '🧣' }; // Blue/Dark Blue
    }
  };

  const colors = getColors();

  // Animations
  const bounceAnim = "animate-[bounce_2s_infinite]";
  const walkAnim = "animate-[wiggle_1s_ease-in-out_infinite]";
  const sleepAnim = "animate-pulse";

  return (
    <div 
      className={`relative inline-flex items-end justify-center pointer-events-none ${mode === 'tab' ? '-mb-1' : ''}`}
      style={{ transform: `scale(${scale})` }}
    >
      {/* --- RENDER CHIBI SVG --- */}
      <svg width="40" height="40" viewBox="0 0 100 100" className={`overflow-visible ${activity === 'school' ? walkAnim : bounceAnim}`}>
        
        {/* SHADOW */}
        <ellipse cx="50" cy="95" rx="20" ry="5" fill="rgba(0,0,0,0.3)" />

        {/* ACTIVITY: WORK (Desk/Laptop) */}
        {activity === 'work' && (
           <g transform="translate(10, 10)">
              <rect x="20" y="60" width="60" height="40" rx="4" fill="#334155" /> {/* Desk */}
              <path d="M35,60 L65,60 L60,50 L40,50 Z" fill="#94A3B8" /> {/* Laptop Base */}
              <rect x="40" y="35" width="20" height="15" fill="#E2E8F0" /> {/* Screen */}
           </g>
        )}

        {/* BODY */}
        <g transform={activity === 'work' ? "translate(0, 5)" : ""}>
            {/* Legs */}
            {activity !== 'work' && (
                <path d="M40,85 L40,95 M60,85 L60,95" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
            )}
            
            {/* Torso */}
            <rect x="35" y="60" width="30" height="25" rx="5" fill={colors.shirt} />
            
            {/* Arms (Typing if work, waving if play) */}
            {activity === 'work' ? (
                <>
                  <path d="M35,65 Q25,75 40,80" stroke="#FCA5A5" strokeWidth="6" strokeLinecap="round" className="animate-[pulse_0.2s_infinite]" />
                  <path d="M65,65 Q75,75 60,80" stroke="#FCA5A5" strokeWidth="6" strokeLinecap="round" className="animate-[pulse_0.2s_infinite_0.1s]" />
                </>
            ) : activity === 'school' ? (
                 <path d="M35,65 L30,80" stroke="#FCA5A5" strokeWidth="6" strokeLinecap="round" /> 
            ) : (
                 <path d="M65,65 L75,50" stroke="#FCA5A5" strokeWidth="6" strokeLinecap="round" className="animate-[wave_1s_infinite]" /> 
            )}

            {/* Scarf (Winter) */}
            {season === 'Winter' && (
                <path d="M35,60 Q50,70 65,60 L65,65 Q50,75 35,65 Z" fill={colors.hat} />
            )}
        </g>

        {/* HEAD */}
        <g transform={activity === 'work' ? "translate(0, 5)" : ""}>
            <circle cx="50" cy="40" r="18" fill="#FCA5A5" /> {/* Skin */}
            
            {/* Hat / Hair */}
            <path d="M32,30 Q50,10 68,30" fill={colors.hat} stroke={colors.hat} strokeWidth="5" strokeLinecap="round" />
            
            {/* Eyes */}
            {activity === 'sleep' ? (
                <g stroke="#333" strokeWidth="2" fill="none">
                    <path d="M42,42 Q45,45 48,42" />
                    <path d="M52,42 Q55,45 58,42" />
                </g>
            ) : (
                <g fill="#333">
                    <circle cx="44" cy="40" r="2" />
                    <circle cx="56" cy="40" r="2" />
                </g>
            )}

            {/* Mouth */}
            {activity === 'work' ? (
                 <path d="M48,48 L52,48" stroke="#333" strokeWidth="1" />
            ) : (
                 <path d="M46,48 Q50,52 54,48" stroke="#333" strokeWidth="1" fill="none" />
            )}

            {/* Accessory (Sunglasses/Flower) */}
            {season === 'Summer' && activity !== 'sleep' && (
                <g opacity="0.8">
                   <rect x="40" y="38" width="8" height="4" rx="1" fill="black" />
                   <rect x="52" y="38" width="8" height="4" rx="1" fill="black" />
                   <line x1="48" y1="40" x2="52" y2="40" stroke="black" strokeWidth="1" />
                </g>
            )}
        </g>
        
        {/* EXTRAS */}
        {activity === 'school' && (
             // Backpack
             <rect x="28" y="62" width="8" height="20" rx="2" fill="#BE185D" />
        )}

        {activity === 'sleep' && (
             <text x="70" y="30" fontSize="10" className="animate-pulse">Zzz</text>
        )}

      </svg>
      
      {/* Floating Emoji Accessory */}
      <div className="absolute -top-1 -right-1 text-[10px] animate-bounce">
          {colors.accessory}
      </div>

    </div>
  );
};
