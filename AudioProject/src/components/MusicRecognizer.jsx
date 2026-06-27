import React, { useState, useRef, useCallback, useEffect} from 'react';

const STATUS = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  ANALYZING: 'ANALYZING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

const MicIcon = () => (
  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const RetryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

// useEffect(() => {
//   const handleKeyDown = (e) => {
//     if (e.code === 'Space' && status === STATUS.IDLE) {
//       e.preventDefault(); // stops page from scrolling
//       startScanning();
//     }
//   };

//   window.addEventListener('keydown', handleKeyDown);
//   return () => window.removeEventListener('keydown', handleKeyDown);
// }, [status, startScanning]);

export default function MusicRecognizer() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [countdown, setCountdown] = useState(5);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const countdownIntervalRef = useRef(null);

const sendAudioToBackend = useCallback(async (audioBlob) => {
  setStatus(STATUS.ANALYZING);

  try {
    const formData = new FormData();
    formData.append('audioFile', audioBlob, 'sample.mp3');

    const response = await fetch('http://localhost:5000/api/identify-and-map', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'No match found.');
    }

    setResult({ title: data.title, artist: data.artist, youtubeId: data.youtubeId });
    setStatus(STATUS.SUCCESS);
  } catch (err) {
    setErrorMsg(err.message);
    setStatus(STATUS.ERROR);
  }
}, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startScanning = useCallback(async () => {
    setErrorMsg('');
    setResult(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupStream();
        sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start();
      setStatus(STATUS.LISTENING);
      setCountdown(10);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setStatus(STATUS.ERROR);
      setErrorMsg('Microphone access denied. Please enable permissions and try again.');
      cleanupStream();
    }
  }, [cleanupStream, sendAudioToBackend]);

  const handleReset = useCallback(() => {
    cleanupStream();
    setStatus(STATUS.IDLE);
    setErrorMsg('');
    setResult(null);
  }, [cleanupStream]);

  const handleButtonClick = () => {
    if (status === STATUS.IDLE) {
      startScanning();
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl shadow-red-900/20 p-6 sm:p-10 flex flex-col items-center text-center transition-all duration-500">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-red-500 tracking-tight">
            Sonic Echo
          </h1>
          <p className="text-slate-400 text-sm mt-1">Discover what's playing around you</p>
        </div>

        {/* IDLE STATE */}
        {status === STATUS.IDLE && (
          <button
            onClick={handleButtonClick}
            className="group relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48 rounded-full transition-transform duration-300 hover:scale-105 active:scale-95"
          >
            <span className="absolute inset-0 rounded-full bg-red-700 opacity-75 transition-opacity duration-300"></span>
            <span className="absolute inset-0 rounded-full bg-red-600"></span>
            <span className="relative flex flex-col items-center justify-center text-white gap-2 z-10">
              <MicIcon />
              <span className="font-semibold text-sm sm:text-base tracking-wide">Tap to Listen</span>
            </span>
          </button>
        )}

        {/* LISTENING STATE */}
        {status === STATUS.LISTENING && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48 rounded-full">
              <span className="absolute inset-0 rounded-full bg-red-600 opacity-30 animate-ping"></span>
              <span className="absolute inset-2 rounded-full bg-red-600 opacity-40 animate-ping" style={{ animationDelay: '0.3s' }}></span>
              <span className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_50px_rgba(239,68,68,0.6)] text-white">
                <StopIcon />
              </span>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-white">Listening...</p>
              <p className="text-sm text-slate-400 mt-1">
                <span className="text-pink-400 font-semibold">{countdown}</span> second{countdown !== 1 ? 's' : ''} left
              </p>
            </div>
          </div>
        )}

        {/* ANALYZING STATE */}
        {status === STATUS.ANALYZING && (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="flex items-end gap-1.5 h-16">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-2.5 sm:w-3 rounded-full bg-gradient-to-t from-purple-500 to-pink-400 animate-bounce"
                  style={{
                    height: '100%',
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: '0.9s',
                  }}
                ></span>
              ))}
            </div>
            <div>
              <p className="text-lg font-medium text-white">Fingerprinting Audio...</p>
              <p className="text-sm text-slate-400 mt-1">Finding match on YouTube</p>
            </div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === STATUS.SUCCESS && result && (
          <div className="w-full flex flex-col items-center gap-5 animate-[fadeIn_0.5s_ease-in-out]">
            <div className="text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-pink-400 bg-pink-400/10 px-3 py-1 rounded-full mb-2">
                Match Found
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{result.title}</h2>
              <p className="text-slate-400 text-sm sm:text-base mt-1">{result.artist}</p>
            </div>

            <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-700/50 shadow-lg shadow-purple-900/30">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${result.youtubeId}`}
                title={`${result.title} by ${result.artist}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>

            <button
              onClick={handleReset}
              className="mt-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-transform duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-red-900/40"
            >
              Listen Again
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {status === STATUS.ERROR && (
          <div className="w-full flex flex-col items-center gap-5">
            <div className="w-full flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-left">
              <ErrorIcon />
              <p className="text-sm leading-relaxed">{errorMsg || 'Something went wrong. Please try again.'}</p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-transform duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-red-900/40"
            >
              <RetryIcon />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}