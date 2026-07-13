import React from 'react';
import clsx from 'clsx';

export default function Input({ label, type = 'text', placeholder, value, onChange, className, error, ...props }) {
  return (
    <div className={clsx("flex flex-col gap-1 w-full", className)}>
      {label && (
        <label className="text-sm font-medium text-gray-400">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={clsx(
          "w-full bg-gray-950/40 border rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none transition-all duration-200",
          error 
            ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30" 
            : "border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
        )}
        {...props}
      />
      {error && (
        <span className="text-xs text-red-400 mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
}
