import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimKPIs, usePredefinedReports, useReportCompleteness, useOperations, NON_EVALUABLE_FIELDS,
  sortReportsByDisplayOrder,
} from "@/hooks/usePimData";
import { FileText } from "lucide-react";

function ReportCard({ report, onClick }: { report: { id: string; name: string; description: string; universe: string }; onClick: () => void }) {
  const { data: completenessData, isLoading } = useReportCompleteness(report.id);

  const attrResults = (completenessData || []).filter(a => !NON_EVALUABLE_FIELDS.includes(a.name));
  const avgCompleteness = attrResults.length > 0
    ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
    : 0;
  const totalSKUs = attrResults.length > 0 ? attrResults[0].totalSKUs : 0;

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {report.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{report.description}</p>
        <p className="text-xs text-muted-foreground">
          {report.universe} · {isLoading ? "…" : `${totalSKUs.toLocaleString()} SKUs`}
        </p>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Completitud promedio</span>
            <span className="font-medium">{isLoading ? "…" : `${avgCompleteness}%`}</span>
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

  const isLoading = loadingKPIs || loadingReports;
  const hasData = kpis && kpis.total > 0 && reports && reports.length > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Informes predefinidos</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p className="text-sm">No hay datos PIM cargados. Ve a <strong>Administración → Base PIM</strong> para cargar tu archivo Excel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortReportsByDisplayOrder(reports!).map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={() => navigate(`/informes/${report.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
