import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import Home from './pages/Home.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit.jsx'));
const Upload = lazy(() => import('./pages/Upload.jsx'));
const DrumKits = lazy(() => import('./pages/DrumKits.jsx'));
const DrumKitDetail = lazy(() => import('./pages/DrumKitDetail.jsx'));
const MyDownloads = lazy(() => import('./pages/MyDownloads.jsx'));

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
      <Suspense fallback={null}>
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
          <Route path="/my-downloads" element={<MyDownloads />} />
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </Suspense>
    </>
  );
}
