import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimRecords, usePredefinedReports, useAttributeOrder,
  computeAttributeResults, getRecordsForReport, filterRealAttributes, getEvaluableAttributes,
} from "@/hooks/usePimData";
import { FileText } from "lucide-react";

export default function ReportsListPage() {
  const navigate = useNavigate();
  const { data: allRecords, isLoading: loadingRecords } = usePimRecords();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: attributeOrder } = useAttributeOrder();

  const isLoading = loadingRecords || loadingReports;
  const hasData = allRecords && allRecords.length > 0 && reports && reports.length > 0;

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
          {reports!.map((report) => {
            const records = getRecordsForReport(allRecords!, report);
            const validAttrs = getEvaluableAttributes(filterRealAttributes(report.attributes, attributeOrder || []));
            const attrResults = computeAttributeResults(records, validAttrs);
            const avgCompleteness = attrResults.length > 0
              ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
              : 0;

            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(`/informes/${report.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {report.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                  <p className="text-xs text-muted-foreground">{report.universe} · {records.length.toLocaleString()} SKUs</p>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Completitud promedio</span>
                      <span className="font-medium">{avgCompleteness}%</span>
                    </div>
                    <CompletenessBar value={avgCompleteness} showLabel={false} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
