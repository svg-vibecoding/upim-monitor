import { getSeverity } from "@/lib/severity";

interface CompletenessCircleProps {
  value: number;
  size?: number;
}

const severityStroke = (pct: number): string => {
  const s = getSeverity(pct);
  switch (s) {
    case "critical": return "stroke-destructive";
    case "low": return "stroke-warning";
    case "medium": return "stroke-caution";
    case "good": return "stroke-good";
    case "excellent": return "stroke-success";
  }
};

export function CompletenessCircle({ value, size = 48 }: CompletenessCircleProps) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" className="absolute bottom-2 right-2 opacity-[0.15]">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted-foreground/20" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="4"
        className={severityStroke(value)}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}
