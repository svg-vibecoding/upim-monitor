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

/** Inverse severity: higher percentage = more critical (used for "focus" / "sin valor" cards) */
export function getFocusSeverity(pct: number): SeverityLevel {
  if (pct <= 0) return "excellent";
  if (pct < 25) return "good";
  if (pct < 50) return "medium";
  if (pct < 70) return "low";
  if (pct < 90) return "critical";
  return "critical";
}

/** Returns bg + text classes for focus severity cards (soft bg, colored text) */
export function focusSeverityColors(pct: number): { bg: string; text: string; label: string } {
  if (pct <= 0) return { bg: "bg-success/10", text: "text-success", label: "text-muted-foreground" };
  if (pct < 25) return { bg: "bg-success/10", text: "text-success", label: "text-muted-foreground" };
  if (pct < 50) return { bg: "bg-info/10", text: "text-info", label: "text-muted-foreground" };
  if (pct < 70) return { bg: "bg-caution/10", text: "text-caution", label: "text-muted-foreground" };
  if (pct < 90) return { bg: "bg-warning/10", text: "text-warning", label: "text-muted-foreground" };
  return { bg: "bg-destructive/10", text: "text-destructive", label: "text-muted-foreground" };
}
