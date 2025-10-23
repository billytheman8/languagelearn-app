import React, { useState, useRef } from 'react';
import axios from 'axios';

export default function App() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  // NEW: playback state
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const audioRef = useRef(null);

  const ensureAudio = () => {
    if (!audioRef.current && audioUrl) {
      audioRef.current = new Audio(audioUrl);
    }
    return audioRef.current;
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setSegments([]);
    const url = URL.createObjectURL(f);
    setAudioUrl(url);
  };

  const clearFile = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setSegments([]);
    setIsPlayingAll(false);
    setCurrentIndex(-1);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
  };

  const transcribe = async () => {
    if (!file) return alert('Upload an audio file first');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // ⬇️ KEEP your existing URL here (localhost OR your Render URL)
      const resp = await axios.post('https://listenlanguage.netlify.app/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSegments(resp.data.segments || []);
    } catch (e) {
      alert('Transcription failed. Check the server window for errors.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Existing single-segment play (kept for manual use)
  const playSegment = (i) => {
    const seg = segments[i];
    if (!seg) return;
    const a = ensureAudio();
    if (!a) return;

    // Stop any ongoing full play
    setIsPlayingAll(false);
    window.speechSynthesis.cancel();

    a.currentTime = Math.max(0, seg.start - 0.05);
    a.play();

    const onTime = () => {
      if (a.currentTime >= seg.end - 0.02) {
        a.pause();
        a.removeEventListener('timeupdate', onTime);
        const utter = new SpeechSynthesisUtterance(seg.translation);
        utter.lang = 'en-US';
        speechSynthesis.speak(utter);
      }
    };
    a.addEventListener('timeupdate', onTime);
  };

  // ---------- NEW: Continuous playback helpers ----------
  const waitForAudioSegment = (seg) => {
    return new Promise((resolve) => {
      const a = ensureAudio();
      if (!a) return resolve();

      // Seek slightly before segment start for smoothness
      a.currentTime = Math.max(0, seg.start - 0.05);
      a.play();

      const onTime = () => {
        if (a.currentTime >= seg.end - 0.02) {
          a.pause();
          a.removeEventListener('timeupdate', onTime);
          resolve();
        }
      };
      a.addEventListener('timeupdate', onTime);
    });
  };

  const speakTranslation = (text) => {
    return new Promise((resolve) => {
      // Cancel any queued speech before speaking the next translation
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      // NOTE: This is the browser voice. We can map voices to languages later.
      utter.lang = 'en-US';
      utter.onend = resolve;
      utter.onerror = resolve;
      speechSynthesis.speak(utter);
    });
  };

  const stopAll = () => {
    setIsPlayingAll(false);
    setCurrentIndex(-1);
    const a = audioRef.current;
    if (a) {
      a.pause();
    }
    window.speechSynthesis.cancel();
  };

  const playAll = async () => {
    if (!segments.length) return;
    // Clicking this button is a "user gesture", which allows audio to autoplay.
    setIsPlayingAll(true);
    const a = ensureAudio();
    if (!a) return;

    for (let i = 0; i < segments.length; i++) {
      if (!isPlayingAll && i > 0) break; // if stopped mid-run
      setCurrentIndex(i);

      // 1) Play Danish segment
      await waitForAudioSegment(segments[i]);
      if (!isPlayingAll) break;

      // 2) Speak English translation
      await speakTranslation(segments[i].translation);
      if (!isPlayingAll) break;
    }

    // Done
    setIsPlayingAll(false);
    setCurrentIndex(-1);
  };
  // ------------------------------------------------------

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Language App — MVP</h1>

      <label style={{ display: 'block', border: '2px dashed #ccc', padding: 24, borderRadius: 12, marginTop: 12, cursor: 'pointer' }}>
        <div>Upload an audio file</div>
        <div style={{ color: '#666', fontSize: 12 }}>MP3 / WAV — try a 10–30s clip</div>
        <input type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </label>

      {file && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{file.name}</div>
              <div style={{ color: '#666', fontSize: 12 }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
            </div>
            <div>
              <button onClick={clearFile} style={{ marginRight: 8 }}>Remove</button>
              <button onClick={transcribe} disabled={loading}>
                {loading ? 'Processing…' : 'Transcribe & Translate'}
              </button>
            </div>
          </div>

          {audioUrl && (
            <div style={{ marginTop: 12 }}>
              <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {segments.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <h2>Segments</h2>

          {/* NEW: Full-lesson controls */}
          <div style={{ marginBottom: 12 }}>
            <button onClick={playAll} disabled={isPlayingAll} style={{ marginRight: 8 }}>
              ▶️ Play full lesson (Danish → English)
            </button>
            <button onClick={stopAll} disabled={!isPlayingAll}>
              ⏹ Stop
            </button>
            {currentIndex >= 0 && (
              <span style={{ marginLeft: 12, color: '#666' }}>
                Now playing segment {currentIndex + 1} / {segments.length}
              </span>
            )}
          </div>

          <ol>
            {segments.map((s, i) => (
              <li key={i} style={{ marginBottom: 12 }}>
                <div><strong>Original:</strong> {s.original}</div>
                <div><strong>Translation:</strong> {s.translation}</div>
                <button onClick={() => playSegment(i)} style={{ marginTop: 6 }}>
                  ▶️ Play this segment only
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
