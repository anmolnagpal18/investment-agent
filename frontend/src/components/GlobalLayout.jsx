import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './ui/Navbar';
import Sidebar from './ui/Sidebar';
import Footer from './ui/Footer';

export function GlobalLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* 2. Main Flex Container */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Glow ambient background graphics */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/5 blur-[150px] rounded-full pointer-events-none" />

        {/* Left Sidebar navigation */}
        <Sidebar />

        {/* Right main panel */}
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
          <main className="flex-1 p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          
          {/* Footer content */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default GlobalLayout;
