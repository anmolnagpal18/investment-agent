import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, User, Mail, AlertCircle, Loader2, Award, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import authService from '../services/authService';

const SECTOR_OPTIONS = [
  'Technology', 'Finance', 'Healthcare', 'Energy', 
  'Consumer Goods', 'Industrials', 'Real Estate', 'Utilities'
];

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Beginner');
  const [favoriteSectors, setFavoriteSectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleSectorToggle = (sector) => {
    setFavoriteSectors(prev => 
      prev.includes(sector) 
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 1. Perform registration
      await authService.register(
        username.trim(),
        email.trim(),
        password,
        experienceLevel,
        favoriteSectors
      );
      
      success('Account created successfully! Logging you in…');
      
      // 2. Perform auto-login to create dynamic context session
      try {
        const loginData = await authService.login(username.trim(), password);
        login(loginData.access, loginData.refresh, null);
        navigate('/dashboard');
      } catch {
        // Fallback: If auto-login fails due to server sync, redirect to login page
        navigate('/login');
      }
    } catch (err) {
      if (err?.response?.data) {
        const data = err.response.data;
        const msg = Object.entries(data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' ');
        setError(msg || 'Registration failed.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0B0F19] p-6 relative overflow-hidden">
      {/* Ambient background blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-8 border border-white/10 w-full max-w-lg shadow-2xl relative z-10 my-8"
      >
        {/* Logo/Icon */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-500 mt-1">Begin your explainable investment analysis journey.</p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 mb-4 overflow-hidden"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password (min 8 chars)</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input w-full pl-10 pr-4 py-3 text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="border-t border-white/6 pt-4 space-y-4">
            {/* Experience Selection */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                <Award className="w-3.5 h-3.5 text-blue-400" /> Experience Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Beginner', 'Intermediate', 'Advanced'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setExperienceLevel(lvl)}
                    className={`py-2 px-3 text-xs font-semibold border rounded-lg transition-all
                      ${experienceLevel === lvl
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-400 shadow'
                        : 'bg-white/3 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector Preferences */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Favorite Sectors
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SECTOR_OPTIONS.map(sector => {
                  const selected = favoriteSectors.includes(sector);
                  return (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => handleSectorToggle(sector)}
                      className={`px-3 py-1.5 text-[11px] font-semibold border rounded-lg transition-all
                        ${selected
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow'
                          : 'bg-white/3 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      {sector}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
              text-white text-sm font-bold rounded-xl border border-blue-500/30 shadow-lg shadow-blue-500/20
              transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register'}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
