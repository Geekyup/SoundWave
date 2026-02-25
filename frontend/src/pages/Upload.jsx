import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiFetch, getAccessToken } from '../api/client.js';
import { GENRE_CHOICES, SAMPLE_TYPE_CHOICES } from '../constants.js';
import Select from '../components/Select.jsx';

const initialLoop = {
  name: '',
  genre: 'other',
  bpm: 120,
  keywords: '',
  audio_file: null,
};

const initialSample = {
  name: '',
  sample_type: 'bass',
  genre: 'other',
  audio_file: null,
};

export default function Upload() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadType, setUploadType] = useState(searchParams.get('type') || 'loop');
  const [loopForm, setLoopForm] = useState(initialLoop);
  const [sampleForm, setSampleForm] = useState(initialSample);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const type = searchParams.get('type') || 'loop';
    setUploadType(type);
  }, [searchParams]);

  if (!getAccessToken()) {
    return (
      <main className="upload-container">
        <div className="upload-header">
          <h1>Upload content</h1>
          <p>Please log in to upload.</p>
        </div>
        <a href="/login" className="btn btn-primary">Login</a>
      </main>
    );
  }

  const setType = type => {
    const next = new URLSearchParams(searchParams);
    next.set('type', type);
    setSearchParams(next, { replace: true });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0] || null;
    if (type === 'loop') {
      setLoopForm(prev => ({
        ...prev,
        audio_file: file,
        name: prev.name || (file ? file.name.replace(/\.[^/.]+$/, '') : ''),
      }));
    } else {
      setSampleForm(prev => ({
        ...prev,
        audio_file: file,
        name: prev.name || (file ? file.name.replace(/\.[^/.]+$/, '') : ''),
      }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    if (uploadType === 'loop') {
      if (!loopForm.audio_file) {
        setMessage({ type: 'error', text: 'Please choose an audio file.' });
        return;
      }
      Object.entries(loopForm).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          formData.append(key, value);
        }
      });
    } else {
      if (!sampleForm.audio_file) {
        setMessage({ type: 'error', text: 'Please choose an audio file.' });
        return;
      }
      Object.entries(sampleForm).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          formData.append(key, value);
        }
      });
    }

    const endpoint = uploadType === 'loop' ? '/api/loops/' : '/api/samples/';
    const response = await apiFetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg = data.detail || 'Upload failed.';
      setMessage({ type: 'error', text: msg });
      return;
    }
    setMessage({ type: 'success', text: 'Upload successful!' });
    if (uploadType === 'loop') {
      setLoopForm(initialLoop);
    } else {
      setSampleForm(initialSample);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-header">
        <h1>Upload content</h1>
        <p>Share your music with the community</p>
      </div>

      <div className="upload-tabs">
        <button type="button" className={`tab-btn ${uploadType === 'loop' ? 'active' : ''}`} onClick={() => setType('loop')}>
          <span className="tab-label">Loop</span>
        </button>
        <button type="button" className={`tab-btn ${uploadType === 'sample' ? 'active' : ''}`} onClick={() => setType('sample')}>
          <span className="tab-label">Sample</span>
        </button>
      </div>

      {message ? (
        <div className={`alert alert-${message.type}`}>
          <span className="alert-icon">{message.type === 'success' ? '✓' : '✕'}</span>
          {message.text}
        </div>
      ) : null}

      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="form-section file-section">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="audio_file"
              name="audio_file"
              accept="audio/*"
              onChange={e => handleFileChange(e, uploadType)}
            />
            <label htmlFor="audio_file" className="file-input-label">
              <div className="file-input-content">
                <div className="file-input-text">
                  <span className="file-input-main">Choose a file or drag it here</span>
                  <span className="file-input-hint">MP3, WAV, OGG • max. 50MB</span>
                </div>
                <span className="file-input-name">
                  {uploadType === 'loop'
                    ? loopForm.audio_file?.name
                    : sampleForm.audio_file?.name}
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="form-section">
          {uploadType === 'loop' ? (
            <>
              <div className="form-group">
                <label className="form-label">Name<span className="required">*</span></label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={loopForm.name}
                    onChange={e => setLoopForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Genre</label>
                <div className="input-wrapper">
                  <Select
                    ariaLabel="Genre"
                    value={loopForm.genre}
                    onChange={value => setLoopForm(prev => ({ ...prev, genre: value }))}
                    options={GENRE_CHOICES}
                    direction="up"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">BPM</label>
                <div className="input-wrapper">
                  <input
                    type="number"
                    min="40"
                    max="300"
                    value={loopForm.bpm}
                    onChange={e => setLoopForm(prev => ({ ...prev, bpm: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Keywords</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={loopForm.keywords}
                    onChange={e => setLoopForm(prev => ({ ...prev, keywords: e.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Name<span className="required">*</span></label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={sampleForm.name}
                    onChange={e => setSampleForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Sample type</label>
                <div className="input-wrapper">
                  <Select
                    ariaLabel="Sample type"
                    value={sampleForm.sample_type}
                    onChange={value => setSampleForm(prev => ({ ...prev, sample_type: value }))}
                    options={SAMPLE_TYPE_CHOICES}
                    direction="up"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Genre</label>
                <div className="input-wrapper">
                  <Select
                    ariaLabel="Genre"
                    value={sampleForm.genre}
                    onChange={value => setSampleForm(prev => ({ ...prev, genre: value }))}
                    options={GENRE_CHOICES}
                    direction="up"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="form-section submit-section">
          <button type="submit" className="btn btn-primary btn-large">
            <span className="btn-text">Upload</span>
          </button>
          <a href="/" className="btn btn-secondary btn-large">
            <span className="btn-text">Cancel</span>
          </a>
        </div>
      </form>
    </div>
  );
}
