interface RealtimeIndicatorProps {
  isActive?: boolean;
  text?: string;
}

export function RealtimeIndicator({ 
  isActive = true, 
  text = "Cập nhật theo thời gian thực" 
}: RealtimeIndicatorProps) {
  if (!isActive) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 text-xs font-semibold text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <span>⚡ {text}</span>
    </div>
  );
}
