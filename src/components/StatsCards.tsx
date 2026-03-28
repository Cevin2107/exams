import { Trophy, Clock, FileText, CheckCircle2 } from "lucide-react";

interface StatsCardsProps {
  type: 'submission' | 'session';
  stats: {
    // For submission
    score?: number;
    maxScore?: number;
    durationSeconds?: number;
    submittedAt?: string;
    // For session
    questionsAnswered?: number;
    totalQuestions?: number;
    startedAt?: string;
    progress?: number;
  };
}

export function StatsCards({ type, stats }: StatsCardsProps) {
  if (type === 'submission') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-indigo-200/30 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Điểm số</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                {stats.score?.toFixed(1)}/{stats.maxScore || 10}
              </p>
            </div>
          </div>
        </div>

        {/* Duration Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-blue-200/30 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md shadow-blue-500/30">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Thời gian</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.durationSeconds ? Math.round(stats.durationSeconds / 60) : 0}p
              </p>
            </div>
          </div>
        </div>

        {/* Submitted At Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-slate-200/30 p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-md shadow-slate-500/30">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Nộp lúc</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">
                {stats.submittedAt
                  ? new Date(stats.submittedAt).toLocaleString("vi-VN", {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Session type
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Progress Card */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-amber-200/30 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/30">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Tiến độ</p>
            <p className="text-2xl font-bold text-amber-900">
              {stats.questionsAnswered || 0}/{stats.totalQuestions || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Percentage Card */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-emerald-200/30 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Hoàn thành</p>
            <p className="text-2xl font-bold text-emerald-900">
              {stats.progress !== undefined 
                ? `${stats.progress}%` 
                : stats.totalQuestions 
                  ? `${Math.round(((stats.questionsAnswered || 0) / stats.totalQuestions) * 100)}%`
                  : '0%'}
            </p>
          </div>
        </div>
      </div>

      {/* Time Card */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-blue-200/30 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md shadow-blue-500/30">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Thời gian</p>
            <p className="text-2xl font-bold text-slate-900">
              {stats.durationSeconds ? Math.round(stats.durationSeconds / 60) : 0}p
            </p>
          </div>
        </div>
      </div>

      {/* Started At Card */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 shadow-md shadow-slate-200/30 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-md shadow-slate-500/30">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Bắt đầu lúc</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              {stats.startedAt
                ? new Date(stats.startedAt).toLocaleString("vi-VN", {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
