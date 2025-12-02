import { Subtitle } from '../types';

const timeToSeconds = (timeString: string): number => {
  const [hours, minutes, seconds] = timeString.split(':');
  const [secs, ms] = seconds.split(',');
  
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(secs, 10) +
    parseInt(ms, 10) / 1000
  );
};

export const parseSRT = (data: string): Subtitle[] => {
  // Normalize line endings
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.trim().split('\n\n');
  
  const subtitles: Subtitle[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      const timeLine = lines[1];
      
      // Regex to match "00:00:00,000 --> 00:00:00,000"
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      
      if (timeMatch) {
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];
        // Combine remaining lines as text
        const text = lines.slice(2).join(' ').replace(/<[^>]*>/g, ''); // Remove HTML tags if any

        if (text.trim()) {
           subtitles.push({
            id: isNaN(id) ? subtitles.length + 1 : id,
            startTime,
            endTime,
            startTimeSeconds: timeToSeconds(startTime),
            endTimeSeconds: timeToSeconds(endTime),
            text: text.trim(),
          });
        }
      }
    }
  });

  return subtitles;
};