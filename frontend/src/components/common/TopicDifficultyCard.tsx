import React from 'react';
import { Link } from 'react-router-dom';
import { DifficultTopic, DifficultyLabel } from '../../types';

export const difficultyBadgeClass = (label: DifficultyLabel | string): string => {
  switch (label) {
    case 'Very Difficult':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'Difficult':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Moderate':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
};

/** One topic's difficulty with the signals behind it. Signals not observed yet show as "—". */
export const TopicDifficultyCard: React.FC<{ topic: DifficultTopic; showActions?: boolean }> = ({ topic, showActions = true }) => (
  <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-white">{topic.topic_title}</h4>
        {topic.lecture_title && <span className="text-[11px] text-slate-400 truncate block">{topic.lecture_title}</span>}
      </div>
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${difficultyBadgeClass(topic.difficulty_label)}`}>
        {topic.difficulty_label} ({topic.difficulty_score})
      </span>
    </div>

    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-dark-border text-center">
      <div className="bg-dark-card p-2 rounded-xl border border-dark-border">
        <div className="text-[10px] text-slate-400">Quiz</div>
        <div className="text-xs font-bold text-purple-400">{topic.quiz_score === null ? '—' : `${topic.quiz_score}%`}</div>
      </div>
      <div className="bg-dark-card p-2 rounded-xl border border-dark-border">
        <div className="text-[10px] text-slate-400">Engagement</div>
        <div className="text-xs font-bold text-blue-400">{topic.engagement_score === null ? '—' : `${topic.engagement_score}%`}</div>
      </div>
      <div className="bg-dark-card p-2 rounded-xl border border-dark-border">
        <div className="text-[10px] text-slate-400">Replays</div>
        <div className="text-xs font-bold text-amber-400">{topic.replay_count}</div>
      </div>
      <div className="bg-dark-card p-2 rounded-xl border border-dark-border">
        <div className="text-[10px] text-slate-400">Pauses</div>
        <div className="text-xs font-bold text-amber-400">{topic.pause_count}</div>
      </div>
    </div>

    {showActions && (
      <div className="flex items-center gap-3 text-[11px] font-semibold">
        <Link to={`/player/${topic.lecture_id}`} className="text-brand-400 hover:underline">Rewatch</Link>
        <Link to={`/quiz?lecture=${topic.lecture_id}&topic=${topic.topic_id}`} className="text-brand-400 hover:underline">Take quiz</Link>
        <Link to={`/revision?topic=${topic.topic_id}`} className="text-purple-400 hover:underline">Revision kit</Link>
      </div>
    )}
  </div>
);
