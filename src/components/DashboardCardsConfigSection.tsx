import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  useDashboardCardsConfig,
  useUpdateDashboardCard,
  type Operation,
  type Card1Config,
  type Card2Config,
  type Card3Config,
} from "@/hooks/usePimData";
import type { PredefinedReport } from "@/data/mockData";

interface Props {
  operations: Operation[];
  reports: PredefinedReport[];
}

const NONE = "__none__";

export function DashboardCardsConfigSection({ operations, reports }: Props) {
  const { data: cardsConfig, isLoading } = useDashboardCardsConfig();
  const updateCard = useUpdateDashboardCard();

  const activeOps = operations.filter((o) => o.active);

  // Card 1 state
  const card1Raw = cardsConfig?.find((c) => c.card_key === "card_1");
  const card1Defaults: Card1Config = { main_value: "total", secondary_1: null, secondary_1_label: "Activos", secondary_2: null, secondary_2_label: "Inactivos" };
  const [c1Label, setC1Label] = useState("");
  const [c1MainValue, setC1MainValue] = useState("total");
  const [c1Sec1, setC1Sec1] = useState(NONE);
  const [c1Sec1Label, setC1Sec1Label] = useState("Activos");
  const [c1Sec2, setC1Sec2] = useState(NONE);
  const [c1Sec2Label, setC1Sec2Label] = useState("Inactivos");
  const [c1Saving, setC1Saving] = useState(false);

  // Card 2 state
  const card2Raw = cardsConfig?.find((c) => c.card_key === "card_2");
  const [c2Label, setC2Label] = useState("");
  const [c2MainOp, setC2MainOp] = useState(NONE);
  const [c2Sec1, setC2Sec1] = useState(NONE);
  const [c2Sec1Label, setC2Sec1Label] = useState("Visibles B2B");
  const [c2Sec2, setC2Sec2] = useState(NONE);
  const [c2Sec2Label, setC2Sec2Label] = useState("Visibles B2C");
  const [c2Saving, setC2Saving] = useState(false);

  // Card 3 state
  const card3Raw = cardsConfig?.find((c) => c.card_key === "card_3");
  const [c3Label, setC3Label] = useState("");
  const [c3ReportId, setC3ReportId] = useState(NONE);
  const [c3Saving, setC3Saving] = useState(false);

  // Populate from DB
  useEffect(() => {
    if (!cardsConfig) return;
    const c1 = cardsConfig.find((c) => c.card_key === "card_1");
    if (c1) {
      const cfg = c1.config as Card1Config;
      setC1Label(c1.label);
      setC1MainValue(cfg.main_value || "total");
      setC1Sec1(cfg.secondary_1 || NONE);
      setC1Sec1Label(cfg.secondary_1_label || "Activos");
      setC1Sec2(cfg.secondary_2 || NONE);
      setC1Sec2Label(cfg.secondary_2_label || "Inactivos");
    }
    const c2 = cardsConfig.find((c) => c.card_key === "card_2");
    if (c2) {
      const cfg = c2.config as Card2Config;
      setC2Label(c2.label);
      setC2MainOp(cfg.main_operation || NONE);
      setC2Sec1(cfg.secondary_1 || NONE);
      setC2Sec1Label(cfg.secondary_1_label || "Visibles B2B");
      setC2Sec2(cfg.secondary_2 || NONE);
      setC2Sec2Label(cfg.secondary_2_label || "Visibles B2C");
    }
    const c3 = cardsConfig.find((c) => c.card_key === "card_3");
    if (c3) {
      const cfg = c3.config as Card3Config;
      setC3Label(c3.label);
      setC3ReportId(cfg.report_id || NONE);
    }
  }, [cardsConfig]);

  const saveCard1 = async () => {
    setC1Saving(true);
    try {
      await updateCard.mutateAsync({
        cardKey: "card_1",
        label: c1Label,
        config: {
          main_value: c1MainValue,
          secondary_1: c1Sec1 === NONE ? null : c1Sec1,
          secondary_1_label: c1Sec1Label,
          secondary_2: c1Sec2 === NONE ? null : c1Sec2,
          secondary_2_label: c1Sec2Label,
        },
      });
      toast.success("Card 1 guardado");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setC1Saving(false);
    }
  };

  const saveCard2 = async () => {
    setC2Saving(true);
    try {
      await updateCard.mutateAsync({
        cardKey: "card_2",
        label: c2Label,
        config: {
          main_operation: c2MainOp === NONE ? null : c2MainOp,
          secondary_1: c2Sec1 === NONE ? null : c2Sec1,
          secondary_1_label: c2Sec1Label,
          secondary_2: c2Sec2 === NONE ? null : c2Sec2,
          secondary_2_label: c2Sec2Label,
        },
      });
      toast.success("Card 2 guardado");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setC2Saving(false);
    }
  };

  const saveCard3 = async () => {
    setC3Saving(true);
    try {
      await updateCard.mutateAsync({
        cardKey: "card_3",
        label: c3Label,
        config: { report_id: c3ReportId === NONE ? null : c3ReportId },
      });
      toast.success("Card 3 guardado");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setC3Saving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración de cards…
      </div>
    );
  }

  const opSelectItems = activeOps.map((op) => (
    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
  ));

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-3">Cards del Dashboard</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Configura el contenido de los 3 cards principales que se muestran en el dashboard.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Card 1: Total del PIM ── */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 1 — Total del PIM</p>
            <div>
              <Label className="text-xs">Label del card</Label>
              <Input value={c1Label} onChange={(e) => setC1Label(e.target.value)} placeholder="Catálogo" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Dato principal</Label>
              <Select value={c1MainValue} onValueChange={setC1MainValue}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Universo total</SelectItem>
                  {opSelectItems}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Secundario 1</Label>
                <Select value={c1Sec1} onValueChange={setC1Sec1}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>(Por defecto)</SelectItem>
                    {opSelectItems}
                  </SelectContent>
                </Select>
                <Input value={c1Sec1Label} onChange={(e) => setC1Sec1Label(e.target.value)} placeholder="Label" className="h-7 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">Secundario 2</Label>
                <Select value={c1Sec2} onValueChange={setC1Sec2}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>(Por defecto)</SelectItem>
                    {opSelectItems}
                  </SelectContent>
                </Select>
                <Input value={c1Sec2Label} onChange={(e) => setC1Sec2Label(e.target.value)} placeholder="Label" className="h-7 text-xs mt-1" />
              </div>
            </div>
            <Button onClick={saveCard1} size="sm" className="w-full gap-2" disabled={c1Saving}>
              {c1Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Guardar
            </Button>
          </CardContent>
        </Card>

        {/* ── Card 2: Universo configurable ── */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 2 — Universo configurable</p>
            <div>
              <Label className="text-xs">Label del card</Label>
              <Input value={c2Label} onChange={(e) => setC2Label(e.target.value)} placeholder="Base Digital" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Operación principal</Label>
              <Select value={c2MainOp} onValueChange={setC2MainOp}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(Por defecto)</SelectItem>
                  {opSelectItems}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Secundario 1</Label>
                <Select value={c2Sec1} onValueChange={setC2Sec1}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>(Por defecto)</SelectItem>
                    {opSelectItems}
                  </SelectContent>
                </Select>
                <Input value={c2Sec1Label} onChange={(e) => setC2Sec1Label(e.target.value)} placeholder="Label" className="h-7 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">Secundario 2</Label>
                <Select value={c2Sec2} onValueChange={setC2Sec2}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>(Por defecto)</SelectItem>
                    {opSelectItems}
                  </SelectContent>
                </Select>
                <Input value={c2Sec2Label} onChange={(e) => setC2Sec2Label(e.target.value)} placeholder="Label" className="h-7 text-xs mt-1" />
              </div>
            </div>
            <Button onClick={saveCard2} size="sm" className="w-full gap-2" disabled={c2Saving}>
              {c2Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Guardar
            </Button>
          </CardContent>
        </Card>

        {/* ── Card 3: Progreso ── */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 3 — Progreso</p>
            <div>
              <Label className="text-xs">Label del card</Label>
              <Input value={c3Label} onChange={(e) => setC3Label(e.target.value)} placeholder="Completitud General" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Informe para completitud</Label>
              <Select value={c3ReportId} onValueChange={setC3ReportId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(PIM General por defecto)</SelectItem>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button onClick={saveCard3} size="sm" className="w-full gap-2" disabled={c3Saving}>
              {c3Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Guardar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
