import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { register } from '../api/auth.js';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await register(username, password, password2);
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div>
      <header className="header">
        <div className="logo">
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>SoundWave</Link>
        </div>
      </header>

      <main className="auth-wrapper">
        <div className="auth-card">
          <h1>Create Account</h1>

          {error ? (
            <ul className="errorlist">
              <li>{error}</li>
            </ul>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="register-username">Username</label>
              <input
                id="register-username"
                type="text"
                name="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password2">Repeat password</label>
              <input
                id="register-password2"
                type="password"
                name="password2"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Register</button>
              <Link to="/login" className="btn btn-secondary">Already have an account</Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
