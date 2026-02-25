import { Route, Routes } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import ProfileEdit from './pages/ProfileEdit.jsx';
import Upload from './pages/Upload.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home tab="loops" />} />
      <Route path="/loops" element={<Home tab="loops" />} />
      <Route path="/samples" element={<Home tab="samples" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/:username" element={<Profile />} />
      <Route path="/profile/edit" element={<ProfileEdit />} />
      <Route path="/upload" element={<Upload />} />
    </Routes>
  );
}
