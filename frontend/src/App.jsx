import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import ProfileEdit from './pages/ProfileEdit.jsx';
import Upload from './pages/Upload.jsx';
import DrumKits from './pages/DrumKits.jsx';
import DrumKitDetail from './pages/DrumKitDetail.jsx';

function RouteAudioGuard() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.__swStopAll === 'function') {
      window.__swStopAll({ destroy: true });
    }
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <>
      <RouteAudioGuard />
      <Routes>
        <Route path="/" element={<Home tab="loops" />} />
        <Route path="/loops" element={<Home tab="loops" />} />
        <Route path="/samples" element={<Home tab="samples" />} />
        <Route path="/drum-kits" element={<DrumKits />} />
        <Route path="/drum-kits/:slug" element={<DrumKitDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/upload" element={<Upload />} />
      </Routes>
    </>
  );
}
