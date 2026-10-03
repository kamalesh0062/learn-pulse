import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface EngagementTrendChartProps {
  data: { time: string; score: number; focus_state: string; samples?: number }[];
}

export const EngagementTrendChart: React.FC<EngagementTrendChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
          <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} />
          <Tooltip
            contentStyle={{ backgroundColor: '#151C2C', borderColor: '#1E293B', borderRadius: '12px', fontSize: '12px' }}
            formatter={(value: any, _name: any, item: any) => [`${value}% (mostly ${item?.payload?.focus_state})`, 'Engagement']}
          />
          <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorEngagement)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
