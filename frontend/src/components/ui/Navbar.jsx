import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, LogOut, User, LayoutDashboard, BrainCircuit } from 'lucide-react';
import Button from './Button';

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const username = user?.username || 'Guest';
  const email = user?.email || '';
  const experience = user?.experience_level || 'BEGINNER';

  return (
    <header className="glass-panel sticky top-0 z-40 w-full px-6 py-4 flex items-center justify-between border-b border-white/5">
      {/* Brand Logo */}
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center border border-blue-500/20">
            <span className="text-white text-xs font-black tracking-wider">IQ</span>
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            Invest<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">IQ AI</span>
          </span>
        </Link>
      </div>

      {/* Navigation Right Actions */}
      <div className="flex items-center gap-4">
        {/* Light/Dark Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 text-slate-400 hover:text-white transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {user ? (
          <div className="relative">
            {/* User Profile Avatar Trigger */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pl-3 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-all text-left"
            >
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-semibold text-white">{username}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{experience}</span>
              </div>
              
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs uppercase select-none shadow-sm">
                {username[0]}
              </div>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2.5 w-60 bg-[#0a0f1d]/95 border border-white/8 rounded-xl shadow-2xl z-50 p-2.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-white/5 mb-2.5">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Account</p>
                    <p className="text-sm font-bold text-white mt-1 leading-none truncate">{username}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{email}</p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <Link
                      to="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-blue-400" />
                      Dashboard
                    </Link>
                    <Link
                      to="/workspace"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <BrainCircuit className="w-4 h-4 text-purple-400" />
                      Research Workspace
                    </Link>
                    
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/10 mt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/login')}
              className="font-semibold"
            >
              Log In
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate('/register')}
              className="font-semibold animate-glow"
            >
              Sign Up
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
