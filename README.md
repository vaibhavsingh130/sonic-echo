# 🎵 Sonic Echo

A web-based music recognition app — like Shazam for the browser. Records 10 seconds of audio from your microphone, identifies the song via ACRCloud, and displays an embedded YouTube player with the result.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS v4
- **Backend:** Node.js, Express, Multer, Axios
- **APIs:** ACRCloud (audio fingerprinting), YouTube Data API v3

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/vaibhavsingh130/sonic-echo.git
cd sonic-echo
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your API keys
npm run dev            # runs on http://localhost:5000
```

### 3. Setup Frontend
```bash
cd AudioProject
npm install
npm run dev            # runs on http://localhost:5173
```

---

## Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=5000
ACR_HOST=identify-ap-southeast-1.acrcloud.com
ACR_ACCESS_KEY=your_acrcloud_access_key
ACR_SECRET=your_acrcloud_secret
YOUTUBE_API_KEY=your_youtube_api_key
CLIENT_ORIGIN=http://localhost:5173
```

---

## How It Works

1. Click **Tap to Listen** (or press **Space**)
2. Hold your device near the audio source
3. App records 10 seconds of audio
4. ACRCloud identifies the song
5. YouTube player loads the matched track

---

## Project Structure

```
audiorecog/
├── AudioProject/        # React frontend
│   └── src/
│       └── components/
│           └── MusicRecognizer.jsx
└── backend/             # Express backend
    ├── server.js
    └── src/
        ├── config.js
        ├── acrcloud.js
        └── routes.js
```

---