import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe, updateMe } from '../api/me.js';
import { getAccessToken } from '../api/client.js';

const BIO_MAX_LENGTH = 280;

export default function ProfileEdit() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    let active = true;

    getMe()
      .then(profile => {
        if (!active) return;
        setUsername(profile.username || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatar_url || '');
      })
      .catch(() => {
        if (!active) return;
        setError('Failed to load profile');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [avatarFile]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (saving) return;

    setError('');
    setSaving(true);

    const formData = new FormData();
    const trimmedUsername = username.trim();

    if (trimmedUsername) formData.append('username', trimmedUsername);
    formData.append('bio', bio.trim());
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      await updateMe(formData);
      navigate('/profile');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="profile-edit-container">
        <div className="edit-card">
          <div className="loading-state">Loading profile settings...</div>
        </div>
      </main>
    );
  }

  const currentAvatar = avatarPreview || avatarUrl;
  const bioLength = bio.length;

  return (
    <main className="profile-edit-container">
      <div className="edit-card">
        <div className="edit-card-header">
          <p className="edit-kicker">Profile Settings</p>
          <h1>Edit Profile</h1>
          <p className="edit-subtitle">Update your public info and avatar.</p>
        </div>

        {error ? <div className="errorlist">{error}</div> : null}

        <form onSubmit={handleSubmit} className="avatar-form">
          <div className="edit-content">
            <section className="avatar-panel">
              <div className="avatar-preview-wrapper">
                {currentAvatar ? (
                  <img src={currentAvatar} alt={`${username} avatar`} className="avatar-preview" />
                ) : (
                  <div className="avatar-placeholder">{username.charAt(0).toUpperCase() || 'U'}</div>
                )}
              </div>
              <label className="file-input-label" htmlFor="profile-avatar">
                <input
                  type="file"
                  name="avatar"
                  id="profile-avatar"
                  accept="image/*"
                  onChange={e => {
                    setAvatarFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                />
                <span className="file-label-text">Choose avatar</span>
              </label>
              <p className="field-hint">
                {avatarFile ? `Selected file: ${avatarFile.name}` : 'PNG, JPG or WEBP'}
              </p>
            </section>

            <section className="fields-panel">
              <div className="form-group">
                <label htmlFor="profile-username">Nickname</label>
                <input
                  id="profile-username"
                  type="text"
                  value={username}
                  maxLength={150}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-bio">Description</label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  maxLength={BIO_MAX_LENGTH}
                  onChange={e => setBio(e.target.value)}
                />
                <div className="field-counter">{bioLength}/{BIO_MAX_LENGTH}</div>
              </div>
            </section>
          </div>

          <div className="form-actions">
            <a href="/profile" className="btn btn-secondary">Cancel</a>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
