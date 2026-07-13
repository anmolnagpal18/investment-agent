import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Search stock ticker or name...",
  className,
  disabled = false
}) {
  const inputRef = useRef(null);

  // Ctrl + K key shortcut to focus the input box
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      e.preventDefault();
      onSearch(value);
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange('');
    }
    inputRef.current?.focus();
  };

  return (
    <div className={twMerge(clsx("relative w-full flex items-center", className))}>
      {/* Search icon prefix */}
      <div className="absolute left-3.5 text-slate-400 pointer-events-none">
        <Search className="w-5 h-5" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pl-11 pr-20 py-3 bg-[#0e1325]/60 hover:bg-[#0e1325]/90 focus:bg-[#0e1325]/95 border border-white/8 rounded-xl outline-none transition-all text-slate-100 placeholder-slate-500 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/10 text-sm leading-none"
      />

      {/* Control keyboard shortcut / Clear button */}
      <div className="absolute right-3.5 flex items-center gap-1.5">
        {value && (
          <button
            onClick={handleClear}
            className="p-1 hover:bg-white/5 rounded-md text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium bg-white/5 text-slate-400 rounded-md border border-white/5 font-sans pointer-events-none uppercase">
          Ctrl K
        </kbd>
      </div>
    </div>
  );
}

export default SearchInput;
