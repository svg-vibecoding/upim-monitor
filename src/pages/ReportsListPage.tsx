import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockPredefinedReports, getRecordsForReport, computeAttributeResults } from "@/data/mockData";
import { CompletenessBar } from "@/components/CompletenessBar";
import { FileText } from "lucide-react";

export default function ReportsListPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Informes predefinidos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockPredefinedReports.map((report) => {
          const records = getRecordsForReport(report.id);
          const attrResults = computeAttributeResults(records, report.attributes);
          const avgCompleteness = Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length);

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
    </div>
  );
}
