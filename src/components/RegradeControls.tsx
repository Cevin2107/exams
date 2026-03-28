import { Save, X as CloseIcon, RefreshCw } from "lucide-react";

interface RegradeModalProps {
  isOpen: boolean;
  isRegrading: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function RegradeModal({ isOpen, isRegrading, onSave, onCancel }: RegradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="flex gap-3 items-center">
      <button
        onClick={onSave}
        disabled={isRegrading}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isRegrading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Đang lưu...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Lưu điểm mới
          </>
        )}
      </button>
      <button
        onClick={onCancel}
        disabled={isRegrading}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-700 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl hover:bg-slate-50 hover:shadow-md transition-all disabled:opacity-50"
      >
        <CloseIcon className="h-4 w-4" />
        Hủy
      </button>
    </div>
  );
}

interface RegradeInstructionProps {
  show: boolean;
}

export function RegradeInstruction({ show }: RegradeInstructionProps) {
  if (!show) return null;

  return (
    <p className="mt-3 text-xs text-amber-700 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-xl px-4 py-2 flex items-center gap-2">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Click vào nhãn đúng/sai để thay đổi. Điểm sẽ tự động cập nhật.
    </p>
  );
}
