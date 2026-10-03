import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({ message = "Loading analytics & learning metrics..." }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
    <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
    <div className="text-xs font-semibold text-slate-300">{message}</div>
    <div className="text-[11px] text-slate-400 mt-1 font-mono">Fetching real backend data from FastAPI database...</div>
  </div>
);
