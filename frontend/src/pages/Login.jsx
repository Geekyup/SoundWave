import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { login } from '../api/auth.js';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div>
      <header className="header">
        <div className="logo">
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>SoundWave</a>
        </div>
      </header>

      <main className="auth-wrapper">
        <div className="auth-card">
          <h1>Login</h1>

          {error ? (
            <ul className="errorlist">
              <li>{error}</li>
            </ul>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                name="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Login</button>
              <a href="/register" className="btn btn-secondary">Register</a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
