import React from 'react';
import { motion } from 'framer-motion';

export function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030712]/90 backdrop-blur-md">
      {/* Animated Glowing Ambient Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none mt-10 ml-10" />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo/Ring loader */}
        <div className="relative w-16 h-16">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="absolute inset-0 border-t-2 border-r-2 border-b-2 border-transparent border-t-blue-500 border-r-blue-500 rounded-full"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
            className="absolute inset-2 border-t border-l border-b border-transparent border-t-emerald-400 border-l-emerald-400 rounded-full"
          />
          <div className="absolute inset-4 bg-[#0a0f1e] rounded-full border border-white/5 shadow-inner flex items-center justify-center">
            <span className="text-[10px] font-extrabold text-blue-400 tracking-wider">IQ</span>
          </div>
        </div>

        {/* Loading text with slide/fade micro-animations */}
        <div className="text-center">
          <h3 className="text-base font-semibold text-white tracking-wide">InvestIQ AI</h3>
          <p className="text-xs text-slate-400 mt-1.5 animate-pulse">Running advanced market analysis...</p>
        </div>
      </div>
    </div>
  );
}

export default GlobalLoading;
