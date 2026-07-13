import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Star, 
  Scale, 
  History, 
  LogOut,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuSections = [
    {
      title: "Workspace",
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Research Center', path: '/workspace', icon: BrainCircuit },
      ]
    },
    {
      title: "Insights",
      items: [
        { name: 'Watchlist', path: '/watchlist', icon: Star },
        { name: 'Stock Comparator', path: '/compare', icon: Scale },
        { name: 'Research Logs', path: '/reports', icon: History },
      ]
    }
  ];

  const username = user?.username || 'Guest';
  const experience = user?.experience_level || 'BEGINNER';

  return (
    <aside className="glass-panel w-64 min-h-[calc(100vh-73px)] p-5 flex flex-col justify-between border-r border-white/5 bg-[#070b15]/60">
      <div className="flex flex-col gap-6">
        {menuSections.map((section, sIdx) => (
          <div key={sIdx} className="flex flex-col gap-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3.5 mb-1">
              {section.title}
            </div>
            
            <nav className="flex flex-col gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide border border-transparent transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 transition-colors group-hover:text-white" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* User Footer Panel */}
      <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-extrabold text-xs uppercase shadow-sm">
            {username[0]}
          </div>
          <div className="flex flex-col text-left truncate">
            <span className="text-xs font-bold text-white leading-none truncate">{username}</span>
            <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-1">{experience}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-red-400/90 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/10 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
