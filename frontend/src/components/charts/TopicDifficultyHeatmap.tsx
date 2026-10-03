import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { TopicSummary } from '../../types';

interface HeatmapProps {
  topics: TopicSummary[];
}

export const TopicDifficultyHeatmap: React.FC<HeatmapProps> = ({ topics }) => {
  // Same thresholds as ml/difficulty_engine.py
  const getBarColor = (score: number) => {
    if (score > 75) return '#EF4444'; // Very Difficult
    if (score > 55) return '#F59E0B'; // Difficult
    if (score > 30) return '#3B82F6'; // Moderate
    return '#10B981'; // Easy
  };

  // Topics nobody has touched yet have no score and are left off the chart
  const scored = topics.filter((t) => t.avg_difficulty !== null);

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={scored} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
          <XAxis dataKey="topic_title" stroke="#64748B" fontSize={10} interval={0} angle={-15} textAnchor="end" />
          <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} label={{ value: 'Difficulty Score', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#151C2C', borderColor: '#1E293B', borderRadius: '12px', fontSize: '12px' }}
            formatter={(value: any) => [`${value} / 100`, 'Difficulty Score']}
          />
          <Bar dataKey="avg_difficulty" radius={[8, 8, 0, 0]}>
            {scored.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.avg_difficulty as number)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
