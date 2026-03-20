export type SeverityLevel = "critical" | "low" | "medium" | "good" | "excellent";

export const severityLevels: SeverityLevel[] = ["critical", "low", "medium", "good", "excellent"];

export function getSeverity(pct: number): SeverityLevel {
  if (pct < 25) return "critical";
  if (pct < 50) return "low";
  if (pct < 70) return "medium";
  if (pct < 90) return "good";
  return "excellent";
}

export function severityLabel(s: SeverityLevel) {
  switch (s) {
    case "critical": return "0–25 %";
    case "low": return "25–50 %";
    case "medium": return "50–70 %";
    case "good": return "70–90 %";
    case "excellent": return "90–100 %";
  }
}

export function severityDot(s: SeverityLevel) {
  switch (s) {
    case "critical": return "bg-destructive";
    case "low": return "bg-warning";
    case "medium": return "bg-caution";
    case "good": return "bg-good";
    case "excellent": return "bg-success";
  }
}
