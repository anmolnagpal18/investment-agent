import React from 'react';
import { Search } from 'lucide-react';
import Button from './Button';

export function EmptyState({ 
  icon: Icon = Search, 
  title = "No data found", 
  description = "Start by searching or analyzing a stock to generate reports.", 
  actionText, 
  onAction 
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-white/5 rounded-2xl bg-white/2 backdrop-blur-sm max-w-md mx-auto my-8">
      {/* Icon frame */}
      <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 mb-4 border border-blue-500/10">
        <Icon className="w-6 h-6" />
      </div>
      
      {/* Messages */}
      <h3 className="text-base font-semibold text-white tracking-wide">{title}</h3>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs">{description}</p>
      
      {/* Action Button */}
      {actionText && onAction && (
        <Button 
          variant="primary" 
          onClick={onAction}
          className="mt-6 font-semibold"
          size="sm"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
