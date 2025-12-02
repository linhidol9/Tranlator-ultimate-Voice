export interface MusicTrack {
  id: number;
  title: string;
  composer: string;
  genre: string;
  duration: string;
  url: string; // In a real app, this would be a real MP3/WAV url
}

// Mock Data - Movie Review Beats
// In a real app, these URLs would point to hosted audio files. 
// For this demo, we can't easily host files, so the mixer will largely simulate the *presence* of music 
// unless valid URLs are provided. 
export const REVIEW_BEATS: MusicTrack[] = [
  { id: 1, title: 'Dramatic Tension Builder', composer: 'Review Phim Hành Động', genre: 'Kịch Tính', duration: '3:20', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'Funny Sneaky Snitch', composer: 'Tóm Tắt Phim Hài', genre: 'Vui Nhộn', duration: '2:15', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'Sad Emotional Piano', composer: 'Phim Cảm Động', genre: 'Buồn/Sâu Lắng', duration: '4:10', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 4, title: 'Horror Dark Ambience', composer: 'Ma/Kinh Dị', genre: 'Rùng Rợn', duration: '5:00', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 5, title: 'Epic Action Trailer', composer: 'Bom Tấn Hollywood', genre: 'Hùng Tráng', duration: '2:45', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 6, title: 'Cyberpunk Sci-Fi Beat', composer: 'Phim Khoa Học Viễn Tưởng', genre: 'Điện Tử', duration: '3:30', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  { id: 7, title: 'Detective Mystery', composer: 'Phim Trinh Thám', genre: 'Bí Ẩn', duration: '3:10', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' },
  { id: 8, title: 'Romantic Date Night', composer: 'Phim Tình Cảm', genre: 'Lãng Mạn', duration: '2:50', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
];