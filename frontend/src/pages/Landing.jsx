import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Shield, BarChart2, Newspaper, Scale, Target, ArrowRight, CheckCircle2, ChevronRight, Zap, Play } from 'lucide-react';

const FEATURES = [
  {
    title: 'LangGraph Multi-Agent Engine',
    description: 'A cooperative multi-node pipeline that researches, analyzes, and screens stocks in parallel.',
    icon: Brain,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20'
  },
  {
    title: '100% Explainable Scoring',
    description: 'Deterministic formulas rate financial health, growth, valuation, risk, and sentiment.',
    icon: Scale,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20'
  },
  {
    title: 'Sentiment Intelligence',
    description: 'Aggregates global financial news and breaks them down into positive vs. risk signals.',
    icon: Newspaper,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20'
  },
  {
    title: 'Financial Chart Integration',
    description: 'Interactive visualization for net income, ROE, cash flows, and debt metrics.',
    icon: BarChart2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20'
  }
];

const STEPS = [
  { step: '01', title: 'Company Resolver', desc: 'Fuzzy resolution detects correct international tickers.' },
  { step: '02', title: 'LangGraph Pipeline', desc: 'Cooperative nodes fetch financials and analyze news.' },
  { step: '03', title: 'Deterministic Scoring', desc: 'Weights aggregate signals into a clean final AI score.' },
  { step: '04', title: 'Explainable Verdicts', desc: 'Query AI dynamically on specific category metrics.' }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white overflow-x-hidden selection:bg-blue-600/30">
      
      {/* ── TOP HEADER / NAVIGATION ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white">
              IQ
            </div>
            <span className="font-black text-lg tracking-tight text-white">InvestIQ</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
            <a href="#stats" className="hover:text-white transition-colors">Metrics</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow blobs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/3 w-[300px] h-[300px] bg-purple-600/8 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-400">
            <Zap className="w-3.5 h-3.5 fill-blue-400/20" /> LangGraph-Powered Stock Analysis
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none text-white">
            Next-Gen AI Agency for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Equity Research
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Automate qualitative and quantitative research. Leverage cooperative AI agents to fetch stock profile details, parse balance sheets, analyze news sentiment, and score verdicts deterministically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link to="/register" className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
              Get Started for Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold border border-white/10 transition-all">
              <Play className="w-4 h-4 fill-white/10" /> Live Demo
            </Link>
          </div>
        </motion.div>

        {/* ── Mockup Dashboard Preview ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-5xl mt-16 rounded-2xl border border-white/10 bg-[#0c101d]/60 p-4 shadow-2xl relative"
        >
          <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/40" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <div className="w-3 h-3 rounded-full bg-green-500/40" />
            </div>
            <span className="text-xs text-slate-500 font-mono">https://investiq.ai/workspace?q=NVDA</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 text-left">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/3 border border-white/5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">BUY</span>
                  <span className="text-xs text-slate-500">AI Score: 85/100</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[85%]" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-xs">
                  <p className="text-slate-500 font-bold uppercase tracking-wider mb-1">Financial Health</p>
                  <p className="text-sm font-bold text-white">92 / 100</p>
                </div>
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-xs">
                  <p className="text-slate-500 font-bold uppercase tracking-wider mb-1">Risk Safety</p>
                  <p className="text-sm font-bold text-white">78 / 100</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-600/5 border border-blue-500/10 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
                <Brain className="w-4 h-4 animate-pulse" /> Live Agent Log
              </div>
              <p className="text-slate-300">✓ Resolved ticker to NVDA</p>
              <p className="text-slate-300">✓ Parsed 2024 quarterly sheets</p>
              <p className="text-slate-300">● Analyzing news controversy signals…</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section id="features" className="py-20 bg-white/2 border-t border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <h2 className="text-3xl font-black text-white">Equipped with Institutional Tools</h2>
            <p className="text-sm text-slate-400">Robust, explainable models designed to replace black-box predictions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#0c101d] border border-white/5 hover:border-white/10 transition-all space-y-4">
                <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center`}>
                  <feat.icon className={`w-5 h-5 ${feat.color}`} />
                </div>
                <h3 className="text-base font-bold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW SECTION ── */}
      <section id="workflow" className="py-20 max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-white">How InvestIQ Works</h2>
          <p className="text-sm text-slate-400">Step-by-step pipeline sequence that structures every stock analysis.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white/3 border border-white/5 relative">
              <span className="absolute top-4 right-4 text-xs font-black text-slate-600">{step.step}</span>
              <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── METRICS SECTION ── */}
      <section id="stats" className="py-20 bg-white/2 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '100%', label: 'Scoring Transparency' },
            { value: '2.5s',  label: 'Fuzzy Resolver Speed' },
            { value: '12K+',  label: 'Analyses Run' },
            { value: '0',     label: 'Black-box Guessing' }
          ].map((st, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">{st.value}</p>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{st.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#0B0F19] py-12 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-black text-white text-[10px]">IQ</div>
            <span className="font-bold text-white">InvestIQ</span>
          </div>
          <p>© {new Date().getFullYear()} InvestIQ. All rights reserved. Professional financial research tool.</p>
        </div>
      </footer>

    </div>
  );
}
