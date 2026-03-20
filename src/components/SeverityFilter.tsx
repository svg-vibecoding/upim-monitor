import { Filter } from "lucide-react";
import { type SeverityLevel, severityLevels, getSeverity, severityLabel, severityDot } from "@/lib/severity";

interface SeverityFilterProps {
  results: { completeness: number }[];
  activeFilter: SeverityLevel | null;
  onFilterChange: (level: SeverityLevel | null) => void;
}

export function SeverityFilter({ results, activeFilter, onFilterChange }: SeverityFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      {severityLevels.map((level) => {
        const count = results.filter((a) => getSeverity(a.completeness) === level).length;
        const isActive = activeFilter === level;
        return (
          <button
            key={level}
            onClick={() => onFilterChange(isActive ? null : level)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${isActive ? "bg-accent ring-1 ring-ring" : "hover:bg-muted"}`}
            title={severityLabel(level)}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${severityDot(level)}`} />
            <span className="tabular-nums text-muted-foreground">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
