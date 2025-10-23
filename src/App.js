import React, { useState, useRef } from 'react';
import axios from 'axios';

export default function App() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const transcribe = async () => {
    if (!file) return alert('Upload an audio file first');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await axios.post('https://languagelearn-server.onrender.com/api/transcribe', fd, {
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

  const playSegment = (i) => {
    const seg = segments[i];
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    }
    const a = audioRef.current;
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
          <ol>
            {segments.map((s, i) => (
              <li key={i} style={{ marginBottom: 12 }}>
                <div><strong>Original:</strong> {s.original}</div>
                <div><strong>Translation:</strong> {s.translation}</div>
                <button onClick={() => playSegment(i)} style={{ marginTop: 6 }}>
                  Play segment → Speak translation
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
