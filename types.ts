export interface Subtitle {
  id: number;
  startTime: string; // "00:00:01,500"
  endTime: string;   // "00:00:05,000"
  startTimeSeconds: number;
  endTimeSeconds: number;
  text: string;
  // Processing status fields
  status?: 'pending' | 'success' | 'warning' | 'error';
  speedFactor?: number; // 1.0 is normal, >1.0 is sped up
  generatedDuration?: number;
  errorMessage?: string; // Specific error details including proxy URL
}

export enum VoiceName {
  Kore = 'Kore',     // Often Female-leaning
  Zephyr = 'Zephyr', // Neutral/Female-leaning
  Puck = 'Puck',     // Male-leaning
  Charon = 'Charon', // Deep Male
  Fenrir = 'Fenrir', // Deep Male
}

export interface ProcessingState {
  totalLines: number;
  processedLines: number;
  isProcessing: boolean;
  isComplete: boolean;
  error: string | null;
  audioUrl: string | null;
  failedLines: number[]; // List of subtitle IDs that failed
  estimatedRemainingSeconds?: number;
}

export interface MixerSettings {
  ttsVolume: number;    // 0.0 to 1.0
  musicVolume: number;  // 0.0 to 1.0
  selectedMusicId: number | null;
  fadeIn: boolean;
  fadeOut: boolean;
  voiceOverVolume: number; // 0.0 to 1.0
}

export interface ProjectState {
  version: number;
  fileName: string;
  subtitles: Subtitle[];
  globalSpeed: number;
  mixerSettings: MixerSettings;
  timestamp: number;
}

// Declare global for lamejs included via script tag
declare global {
  interface Window {
    lamejs: any;
  }
}