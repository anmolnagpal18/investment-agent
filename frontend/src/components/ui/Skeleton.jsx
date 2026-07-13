import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className, variant = 'text' }) {
  const baseStyle = "animate-pulse bg-slate-800/60 rounded";
  
  const variants = {
    text: "h-4 w-full",
    title: "h-6 w-2/3 mb-4",
    avatar: "h-12 w-12 rounded-full",
    image: "h-40 w-full rounded-xl",
    button: "h-10 w-24 rounded-lg",
  };

  return (
    <div 
      className={twMerge(clsx(baseStyle, variants[variant], className))} 
    />
  );
}

// Convenient preset skeleton blocks
export function CardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6 border border-white/5 flex flex-col gap-4">
      <Skeleton variant="title" className="w-1/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-5/6" />
      <Skeleton variant="text" className="w-2/3" />
      <div className="flex gap-2 mt-2">
        <Skeleton variant="button" />
        <Skeleton variant="button" className="w-32" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
}

export default Skeleton;
