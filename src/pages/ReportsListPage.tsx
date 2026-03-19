import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimKPIs, usePredefinedReports, useReportCompleteness, useOperations,
  useAttributeOrder, getFullAttributeList, getEvaluableAttributes,
  NON_EVALUABLE_FIELDS, sortReportsByDisplayOrder,
} from "@/hooks/usePimData";
import { FileText } from "lucide-react";

function ReportCard({
  report,
  operationName,
  totalEvaluableAttrs,
  onClick,
}: {
  report: { id: string; name: string; description: string; universe: string; operationId: string | null; attributes: string[] };
  operationName: string | null;
  totalEvaluableAttrs: number;
  onClick: () => void;
}) {
  const { data: completenessData, isLoading } = useReportCompleteness(report.id);
  const universeLabel = report.universe || operationName || "Todos los productos";

  const attrResults = (completenessData || []).filter(a => !NON_EVALUABLE_FIELDS.includes(a.name));
  const avgCompleteness = attrResults.length > 0
    ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
    : 0;
  const totalSKUs = attrResults.length > 0 ? attrResults[0].totalSKUs : 0;
  const evaluatedAttrs = report.attributes.filter(a => !NON_EVALUABLE_FIELDS.includes(a)).length;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
      onClick={onClick}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {report.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{report.description}</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">{isLoading ? "…" : totalSKUs.toLocaleString()}</span>
            {" "}SKUs · {universeLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">{evaluatedAttrs}</span>
            {" "}Atributos evaluados{totalEvaluableAttrs > 0 && <span> de {totalEvaluableAttrs}</span>}
          </p>
        </div>
        <div>
          <div className="flex justify-between items-baseline text-xs mb-0.5">
            <span className="text-muted-foreground">Completitud promedio</span>
            <span className="text-base font-semibold text-foreground">{isLoading ? "…" : `${avgCompleteness}%`}</span>
          </div>
          <CompletenessBar value={avgCompleteness} showLabel={false} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsListPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKPIs } = usePimKPIs();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: operations = [] } = useOperations();
  const { data: attributeOrder } = useAttributeOrder();

  const totalEvaluableAttrs = useMemo(() => {
    if (!attributeOrder) return 0;
    return getEvaluableAttributes(getFullAttributeList(attributeOrder)).length;
  }, [attributeOrder]);

  const isLoading = loadingKPIs || loadingReports;
  const hasData = kpis && kpis.total > 0 && reports && reports.length > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Informes predefinidos</h1>
        <p className="text-sm text-muted-foreground">
          Cada informe mide qué tan completa está la información de un conjunto de productos (universo) en un grupo de atributos (características del producto) definidos. Cada uno representa la selección de un universo y los atributos relevantes para analizarlo.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
          <p className="text-sm text-muted-foreground text-center">Cargando informes...</p>
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p className="text-sm">No hay datos cargados para generar informes. (UsuarioPRO → Administración → Base PIM)</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortReportsByDisplayOrder(reports!).map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              operationName={report.operationId ? (operations.find(o => o.id === report.operationId)?.name || null) : null}
              totalEvaluableAttrs={totalEvaluableAttrs}
              onClick={() => navigate(`/informes/${report.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
