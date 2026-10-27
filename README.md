# TV Room - Your Ultimate Entertainment Hub

Created by **Vincent Ganiza** a.k.a **Lil Gaga Traxx09**

A comprehensive entertainment platform for streaming and downloading movies, series, K-dramas, anime, music, and live TV channels. Built with Next.js 15, React 19, and modern web technologies.

---

## 🎄 Special Holiday Theme

**Active until January 2, 2026** - Enjoy our festive Christmas and New Year theme with special decorations and snowfall effects!

---

## ✨ Key Features

### 🎬 Movies & Series
- **Full Movie Downloads** - Download complete movies in MP4 format with actual file sizes
- **Quality Options** - 1080p, 720p, 480p, 360p with real bitrate calculations
- **Genre Categories** - Kids & Family, Horror, Comedy, Action, Romance, and more
- **Movie Information** - Cast, ratings, duration, release year, and detailed descriptions
- **K-Drama Support** - Trending Korean dramas with season and episode information
- **Series Details** - Full season and episode counts for TV series

### 🎵 Music Library
- **Play Online First** - Listen to songs before downloading
- **Full MP3 Downloads** - Complete tracks with actual file sizes (not previews)
- **High Quality Audio** - 320kbps, 192kbps, 128kbps options
- **High-Resolution Artwork** - Album covers in maximum quality
- **Music Player** - Built-in player with playlist support

### 📺 Live TV Channels
- **Sports Channels** - SuperSport, Sky Sports, beIN Sports, NBA TV for football and all sports
- **Kids Channels** - Nickelodeon, Cartoon Network, Disney Channel
- **Entertainment** - HBO, Netflix, MTV, and more
- **Real-Time Streaming** - Live channel streaming with YouTube embeds

### 🎌 Anime
- **Popular Anime** - Trending and top-rated series
- **Episode Information** - Complete episode counts and ongoing status
- **Genre Tags** - Filter by your favorite anime genres
- **High-Quality Covers** - Beautiful anime artwork

### 📥 YouTube Downloader
- **Full Video Downloads** - Complete videos in MP4 format with actual file sizes
- **Audio Extraction** - Convert to MP3 with high quality (320kbps, 192kbps, 128kbps)
- **Shorts Filter** - Automatically rejects YouTube Shorts (only videos 60+ seconds)
- **Duration & Size Display** - Shows actual video duration and calculated file size
- **Multiple Services** - Y2Mate, SaveFrom.net, and 9xBuddy integration
- **Quality Selection** - Choose quality before downloading (1080p, 720p, 480p, 360p)

### 🤖 AI Assistant
- **Smart Help** - Ask questions about movies, music, K-dramas, and anime
- **Download Guidance** - Get help with downloading and quality selection
- **Content Recommendations** - Discover new content based on your interests
- **Real-Time Chat** - Instant responses to your queries

### 🎨 User Experience
- **Christmas Theme** - Festive colors and snowfall effects (until Jan 2, 2026)
- **Dark/Light Mode** - Toggle between themes
- **Responsive Design** - Works perfectly on all devices
- **Fast Loading** - Optimized performance with lazy loading
- **Cookie Consent** - GDPR-compliant (required for functionality)

---

## 🚀 Technology Stack

- **Framework**: Next.js 15.5.5 with App Router
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS v4 with custom Christmas theme
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **UI Components**: Radix UI primitives
- **Fonts**: Geist Sans & Mono
- **API Integrations**:
  - TMDb API (Movies, TV series, K-dramas)
  - iTunes API (Music)
  - YouTube Data API v3 (Videos & downloads)
  - AniList API (Anime)

---

## 📋 Environment Variables

Create a `.env.local` file with the following variables:

\`\`\`env
# Required - TMDb API for movies, series, and K-dramas
TMDB_API_KEY=your_tmdb_api_key_here

# Required - YouTube Data API for video information and downloads
YOUTUBE_API_KEY=your_youtube_api_key_here
\`\`\`

### How to Get API Keys:

1. **TMDb API Key**:
   - Visit [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
   - Create a free account
   - Request an API key (instant approval)

2. **YouTube Data API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable "YouTube Data API v3"
   - Create credentials (API Key)

---

## 🛠️ Installation & Setup

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/tv-room-app.git

# Navigate to project directory
cd tv-room-app

# Install dependencies
npm install
# or
pnpm install
# or
yarn install

# Create environment file
cp .env.example .env.local
# Add your API keys to .env.local

# Run development server
npm run dev
# or
pnpm dev

# Open browser
# Visit http://localhost:3000
\`\`\`

---

## 📱 Features Overview

### Download System
- **Full Package Downloads** - Complete files only, no clips or previews
- **Actual File Sizes** - Real calculations: duration × bitrate ÷ 8 ÷ 1024
- **Quality Selection** - Choose before downloading
- **Download History** - Track all your downloads
- **Media Library** - Play downloaded content

### Content Categories
- Movies (All genres including Kids, Horror, Comedy)
- TV Series (All types)
- K-Dramas (Korean dramas with season/episode info)
- Anime (Japanese animation)
- Music (All genres, play before download)
- YouTube Videos (Full-length only, no Shorts)
- Live TV Channels (Sports, Kids, Entertainment)

### Search & Discovery
- **Global Search** - Find anything across all categories
- **Genre Filtering** - Filter by Kids, Horror, Comedy, Action, Romance
- **Trending Content** - See what's popular now
- **AI Recommendations** - Chat with AI assistant for suggestions

---

## 🎯 Important Notes

1. **Cookie Consent Required** - The app requires cookie acceptance to function. Required for GDPR compliance and storing preferences.

2. **No YouTube Shorts** - The downloader automatically rejects YouTube Shorts. Only full-length videos (60+ seconds) are supported.

3. **Actual File Sizes** - All sizes are calculated using: (bitrate in kbps × duration in seconds) ÷ 8 ÷ 1024 = MB. These are real, accurate file sizes.

4. **External Download Services** - YouTube downloads open trusted third-party services (Y2Mate, SaveFrom.net, 9xBuddy) in new tabs.

5. **Series Information** - TV series and K-dramas show complete season counts and total episodes.

6. **Music Playback** - Play songs online before downloading. Full player with queue and playlist support.

7. **Sports Channels** - SuperSport and other sports channels work for live football, basketball, and all sports events.

---

## 🎬 How to Use

### Download Movies
1. Browse movies by genre (Kids, Horror, Comedy, etc.)
2. Click on a movie to see details
3. Click "Download" and select quality (1080p - 360p)
4. See actual file size before downloading
5. Download service opens in new tab

### Download Music
1. Go to Music section
2. Play song online first to preview
3. Click "Download" button
4. Choose quality (320kbps, 192kbps, 128kbps)
5. Full MP3 downloads to your device

### Download YouTube Videos
1. Copy any YouTube video URL
2. Paste in YouTube Downloader
3. Click "Fetch Info" to see video details
4. Select format (MP4 video or MP3 audio)
5. Choose quality
6. Select download service and download

### Watch Live Channels
1. Go to Channels page
2. Browse by category (Sports, Kids, Entertainment)
3. Click "Watch Live" on any channel
4. Stream opens in full-screen player

### Chat with AI Assistant
1. Click AI Assistant button (bottom right)
2. Ask about movies, music, K-dramas, anime
3. Get download help and recommendations
4. Chat is context-aware and helpful

---

## 🤝 Credits

**Created by**: Vincent Ganiza (Lil Gaga Traxx09)

**Contact Information**:
- Email: traxxiontech@gmail.com
- WhatsApp: +263 71 685 7999
- Phone: +263 78 007 8177

**Company**: Powered by **Traxxion Tech Inc.**

Made in Zimbabwe 🇿🇼

**Built with**: Next.js, React, Tailwind CSS, and ❤️

---

## 📄 License

All rights reserved. Created by Vincent Ganiza.

This project is for educational and personal use. Please respect copyright laws and terms of service for all integrated APIs and services.

---

## 🎉 Special Thanks

- TMDb for comprehensive movie and TV data
- YouTube for video platform and API
- iTunes for extensive music database
- AniList for detailed anime information
- All the amazing open-source libraries used in this project

---

**Enjoy your entertainment! 🎬🎵📺🎮**

© 2026 TV Room. All rights reserved.
