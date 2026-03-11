import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimKPIs, usePimRecords, usePredefinedReports, useAttributeOrder,
  computeFocusPoints,
} from "@/hooks/usePimData";
import { PlusCircle, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKPIs } = usePimKPIs();
  const { data: records, isLoading: loadingRecords } = usePimRecords();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: attributeOrder } = useAttributeOrder();

  const isLoading = loadingKPIs || loadingRecords || loadingReports;
  const hasData = kpis && kpis.total > 0;

  const focusPoints = records && records.length > 0 && reports && reports.length > 0
    ? computeFocusPoints(records, reports, attributeOrder || [])
    : [];

  const lastUpdateFormatted = kpis?.lastUpdated
    ? format(new Date(kpis.lastUpdated), "d 'de' MMMM yyyy, HH:mm", { locale: es })
    : "Sin datos cargados";

  const kpiCards = kpis ? [
    { label: "Total SKUs", value: kpis.total.toLocaleString() },
    { label: "Activos", value: kpis.active.toLocaleString() },
    { label: "Inactivos", value: kpis.inactive.toLocaleString() },
    { label: "Base Digital", value: kpis.digitalBase.toLocaleString() },
    { label: "Visibles B2B", value: kpis.visibleB2B.toLocaleString() },
    { label: "Visibles B2C", value: kpis.visibleB2C.toLocaleString() },
  ] : [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
          <p className="text-sm text-muted-foreground mt-1">Última actualización: {lastUpdateFormatted}</p>
        </div>
        <Button onClick={() => navigate("/nuevo-informe")} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Crear nuevo informe
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p className="text-sm">No hay datos PIM cargados. Ve a <strong>Administración → Base PIM</strong> para cargar tu archivo Excel.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiCards.map((k) => (
              <Card key={k.label}>
                <CardContent className="pt-4 pb-4 px-4">
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-xl font-bold text-foreground">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reports + Focus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Predefined Reports */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground mb-3">Informes predefinidos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reports && reports.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/informes/${r.id}`)}
                  >
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {r.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Focus Points */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-warning" /> Focos de atención
              </h2>
              <Card>
                <CardContent className="pt-4 pb-2 px-4 space-y-3">
                  {focusPoints.length > 0 ? focusPoints.map((fp) => (
                    <div key={fp.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-medium truncate mr-2">{fp.name}</span>
                        <span className="text-muted-foreground tabular-nums">{fp.completeness}%</span>
                      </div>
                      <CompletenessBar value={fp.completeness} showLabel={false} />
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground py-2">Sin datos suficientes para calcular focos.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
