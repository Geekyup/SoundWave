import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe, updateMe } from '../api/me.js';
import { getAccessToken } from '../api/client.js';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    getMe()
      .then(profile => {
        setUsername(profile.username || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatar_url || '');
      })
      .catch(() => {
        setError('Failed to load profile');
      });
  }, [navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    const formData = new FormData();
    if (username) formData.append('username', username);
    formData.append('bio', bio || '');
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      await updateMe(formData);
      navigate('/profile');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    }
  };

  return (
    <main className="profile-edit-container">
      <div className="edit-card">
        <h1>Edit Profile</h1>

        <div className="avatar-preview-wrapper">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${username} avatar`} className="avatar-preview" />
          ) : (
            <div className="avatar-placeholder">{username.charAt(0).toUpperCase() || 'U'}</div>
          )}
        </div>

        {error ? <div className="errorlist">{error}</div> : null}

        <form onSubmit={handleSubmit} className="avatar-form">
          <div className="form-group">
            <label htmlFor="profile-username">Nickname</label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-bio">Description</label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="file-input-label" htmlFor="profile-avatar">
              <input
                type="file"
                name="avatar"
                id="profile-avatar"
                accept="image/*"
                onChange={e => setAvatarFile(e.target.files?.[0] || null)}
              />
              <span className="file-label-text">Choose Avatar</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Save</button>
            <a href="/profile" className="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </main>
  );
}
