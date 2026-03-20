import { Card, CardContent } from "@/components/ui/card";
import { Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import { focusSeverityColors } from "@/lib/severity";
import type { DimensionResult } from "@/data/mockData";
import type { DimensionResult } from "@/data/mockData";

interface DimensionSummaryCardsProps {
  dimensionResults: DimensionResult[];
}

export function DimensionSummaryCards({ dimensionResults }: DimensionSummaryCardsProps) {
  const realGroups = dimensionResults.filter(d => d.value !== "Sin valor asignado");
  const sinValor = dimensionResults.find(d => d.value === "Sin valor asignado");
  const sinValorSKUs = sinValor?.totalSKUs ?? 0;
  const totalSKUsInDim = dimensionResults.reduce((s, d) => s + d.totalSKUs, 0);
  const sinValorPct = totalSKUsInDim > 0 ? (sinValorSKUs / totalSKUsInDim) * 100 : 0;
  const best = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness >= b.completeness ? a : b) : null;
  const worst = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness <= b.completeness ? a : b) : null;

  const svBg = sinValorSKUs === 0 ? "bg-success text-white" : sinValorPct > 25 ? "bg-destructive/10" : "bg-warning/10";
  const svText = sinValorSKUs === 0 ? "text-white" : sinValorPct > 25 ? "text-destructive" : "text-warning";
  const svLabel = sinValorSKUs === 0 ? "text-white/80" : "text-muted-foreground";
  const SvIcon = sinValorSKUs === 0 ? CheckCircle2 : AlertTriangle;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card className="relative overflow-hidden">
        <CardContent className="pt-4 pb-4 px-4 relative z-10">
          <p className="text-xs text-muted-foreground mb-1">Grupos evaluados</p>
          <p className="text-3xl font-bold">{realGroups.length}</p>
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

      <Card className={`relative overflow-hidden border-0 ${svBg}`}>
        <CardContent className="pt-4 pb-4 px-4 relative z-10">
          <p className={`text-xs mb-1 ${svLabel}`}>SKUs sin valor asignado</p>
          {sinValorSKUs === 0 ? (
            <p className={`text-sm font-semibold ${svText}`}>Todos los SKUs tienen<br />valor asignado</p>
          ) : (
            <p className={`text-3xl font-bold ${svText}`}>{sinValorSKUs.toLocaleString()}</p>
          )}
        </CardContent>
        <SvIcon className={`absolute bottom-2 right-2 h-12 w-12 ${svText} opacity-[0.12]`} />
      </Card>
    </div>
  );
}
