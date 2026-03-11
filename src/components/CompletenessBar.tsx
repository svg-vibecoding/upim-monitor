interface CompletenessBarProps {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function CompletenessBar({ value, showLabel = true, size = "sm" }: CompletenessBarProps) {
  const fillClass =
    value > 75 ? "completeness-fill-high"
    : value > 50 ? "completeness-fill-medium"
    : value > 25 ? "completeness-fill-low"
    : "completeness-fill-critical";
  const height = size === "md" ? "h-3" : "h-2";

  return (
    <div className="flex items-center gap-2">
      <div className={`completeness-bar flex-1 ${height}`}>
        <div className={fillClass} style={{ width: `${value}%` }} />
      </div>
      {showLabel && <span className="text-sm font-medium tabular-nums w-10 text-right">{value}%</span>}
    </div>
  );
}
