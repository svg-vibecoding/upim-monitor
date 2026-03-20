import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { getSeverity } from "@/lib/severity";
import { CompletenessCircle } from "@/components/CompletenessCircle";
import type { DimensionResult } from "@/data/mockData";

interface DimensionSummaryCardsProps {
  dimensionResults: DimensionResult[];
}

/** Map severity to text color for the average completeness card */
function severityTextColor(pct: number): string {
  const s = getSeverity(pct);
  switch (s) {
    case "critical": return "text-destructive";
    case "low": return "text-warning";
    case "medium": return "text-caution";
    case "good": return "text-good";
    case "excellent": return "text-success";
  }
}

export function DimensionSummaryCards({ dimensionResults }: DimensionSummaryCardsProps) {
  const realGroups = dimensionResults.filter(d => d.value !== "Sin valor asignado");
  const best = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness >= b.completeness ? a : b) : null;
  const worst = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness <= b.completeness ? a : b) : null;

  const avgCompleteness = realGroups.length > 0
    ? Math.round(realGroups.reduce((s, d) => s + d.completeness, 0) / realGroups.length)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card className="relative overflow-hidden">
        <CardContent className="pt-4 pb-4 px-4 relative z-10">
          <p className="text-xs text-muted-foreground mb-1">Grupos evaluados</p>
          <p className="text-3xl font-bold">{realGroups.length}</p>
          <p className="text-xs font-semibold truncate mt-0.5">Valores únicos</p>
        </CardContent>
        <Layers className="absolute bottom-2 right-2 h-12 w-12 text-primary/[0.06]" />
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <p className="text-xs text-muted-foreground mb-1">Mejor completitud</p>
          {best ? (
            <>
              <p className="text-3xl font-bold text-success">{best.completeness}%</p>
              <p className="text-xs font-semibold truncate mt-0.5">{best.value}</p>
            </>
          ) : (
            <p className="text-xl text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <p className="text-xs text-muted-foreground mb-1">Grupo a mejorar</p>
          {worst ? (
            <>
              <p className="text-3xl font-bold text-destructive">{worst.completeness}%</p>
              <p className="text-xs font-semibold truncate mt-0.5">{worst.value}</p>
            </>
          ) : (
            <p className="text-xl text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="pt-4 pb-4 px-4 relative z-10">
          <p className="text-xs text-muted-foreground mb-1">Completitud promedio de los grupos</p>
          <p className={`text-3xl font-bold ${severityTextColor(avgCompleteness)}`}>{avgCompleteness}%</p>
        </CardContent>
        <CompletenessCircle value={avgCompleteness} />
      </Card>
    </div>
  );
}
