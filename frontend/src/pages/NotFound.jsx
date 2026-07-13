import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-6 text-center relative overflow-hidden">
      {/* Background Ambient Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/5 blur-[150px] rounded-full pointer-events-none mt-20 ml-20" />

      <div className="relative flex flex-col items-center justify-center max-w-md w-full bg-[#0a0f1d]/75 border border-white/5 rounded-2xl p-10 backdrop-blur-md shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 animate-pulse">
          <Compass className="w-7 h-7" />
        </div>

        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 leading-none">404</h1>
        <h2 className="text-xl font-bold text-white mt-4 tracking-tight">Page Not Found</h2>
        
        <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
          The research page or workspace route you are looking for does not exist or has been relocated.
        </p>

        <div className="flex gap-3 w-full mt-8">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)} 
            className="flex-1 font-semibold"
          >
            Go Back
          </Button>
          <Button 
            variant="primary" 
            onClick={() => navigate('/')} 
            className="flex-1 font-semibold"
          >
            Home Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
