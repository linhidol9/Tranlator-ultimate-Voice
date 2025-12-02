import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

// Note: Sample Rate for this model is typically 24kHz
export const TTS_SAMPLE_RATE = 24000; 

// Lazy load API Key check to prevent crash on import
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSpeechSegment = async (
  text: string, 
  voice: VoiceName = VoiceName.Kore
): Promise<string> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error("No audio data returned from Gemini.");
    }

    return audioData;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const translateContent = async (text: string): Promise<string> => {
  const ai = getAiClient();
  try {
    // Gemini 2.5 Flash has a massive context window, perfect for "Unlimited" translation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{ 
            text: `Bạn là một chuyên gia dịch thuật đa ngôn ngữ cao cấp. Hãy dịch văn bản sau sang Tiếng Việt một cách tự nhiên, trôi chảy, văn phong phù hợp để làm lời bình (voiceover) cho video. Giữ nguyên ý nghĩa nhưng diễn đạt lại cho thuần Việt.
            
            Văn bản gốc:
            ${text}` 
        }],
      },
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Translation Error:", error);
    throw new Error("Không thể dịch văn bản. Vui lòng kiểm tra kết nối hoặc API Key.");
  }
};