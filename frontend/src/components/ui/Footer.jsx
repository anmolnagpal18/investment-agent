import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/5 bg-[#030712]/50 py-5 px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-medium">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-400">InvestIQ</span>
        <span>© {currentYear} Platform. All rights reserved.</span>
      </div>
      
      {/* Disclaimer */}
      <div className="max-w-md text-center md:text-left leading-relaxed">
        Disclaimer: All analysis is fully automated. Content is for educational purposes only and does not constitute financial advice.
      </div>
      
      {/* API/System Status Check */}
      <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-full px-3 py-1 text-emerald-400 text-[9px] font-bold tracking-wide">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Research Engine: Operational</span>
      </div>
    </footer>
  );
}

export default Footer;
