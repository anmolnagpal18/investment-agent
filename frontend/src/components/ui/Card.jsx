import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ children, className, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={twMerge(
        clsx(
          "glass-card rounded-xl p-6 shadow-xl",
          onClick && "cursor-pointer active:scale-[0.99]",
          className
        )
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={twMerge(clsx("mb-4 flex flex-col gap-1.5", className))}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h3 className={twMerge(clsx("text-lg font-semibold text-white tracking-tight", className))}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }) {
  return (
    <p className={twMerge(clsx("text-sm text-slate-400", className))}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }) {
  return (
    <div className={twMerge(clsx("text-slate-300 text-sm leading-relaxed", className))}>
      {children}
    </div>
  );
}

export default Card;
