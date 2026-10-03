import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center glass-card rounded-2xl border border-dark-border">
    <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
      <Inbox className="w-6 h-6" />
    </div>
    <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
    <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button onClick={onAction} className="gradient-btn px-4 py-2 text-xs font-semibold text-white rounded-xl">
        {actionLabel}
      </button>
    )}
  </div>
);
