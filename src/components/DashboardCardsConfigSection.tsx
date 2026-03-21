import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDashboardCardsConfig,
  useUpdateDashboardCard,
  type Operation,
  type Card1Config,
  type Card2Config,
  type Card3Config,
  type CardColor,
} from "@/hooks/usePimData";
import type { PredefinedReport } from "@/data/mockData";

interface Props {
  operations: Operation[];
  reports: PredefinedReport[];
}

const NONE = "__none__";

const COLOR_OPTIONS: { value: CardColor; label: string; css: string }[] = [
  { value: "none", label: "Ninguno", css: "bg-transparent border border-dashed border-muted-foreground/30" },
  { value: "green", label: "Verde", css: "bg-success" },
  { value: "red", label: "Rojo", css: "bg-destructive" },
  { value: "yellow", label: "Amarillo", css: "bg-warning" },
  { value: "blue", label: "Azul", css: "bg-info" },
  { value: "gray", label: "Gris", css: "bg-muted-foreground/50" },
];

function ColorSelector({ value, onChange }: { value: CardColor; onChange: (v: CardColor) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {COLOR_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.label}
          onClick={() => onChange(opt.value)}
          className={`h-5 w-5 rounded-full shrink-0 transition-all ${opt.css} ${value === opt.value ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"}`}
        />
      ))}
    </div>
  );
}

/** Renders a data-point config block: value selector, label, color, percentage toggle */
function DataPointConfig({
  title,
  valueId,
  onValueChange,
  label,
  onLabelChange,
  color,
  onColorChange,
  pct,
  onPctChange,
  opSelectItems,
  includeDefault,
  pctTooltip,
}: {
  title: string;
  valueId: string;
  onValueChange: (v: string) => void;
  label: string;
  onLabelChange: (v: string) => void;
  color: CardColor;
  onColorChange: (v: CardColor) => void;
  pct: boolean;
  onPctChange: (v: boolean) => void;
  opSelectItems: React.ReactNode;
  includeDefault?: boolean;
  pctTooltip?: string;
}) {
  return (
    <div className="space-y-2 p-3 rounded-md border border-border/50 bg-muted/30">
      <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{title}</p>
      <div>
        <Label className="text-xs">Valor</Label>
        <Select value={valueId} onValueChange={onValueChange}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {includeDefault && <SelectItem value={NONE}>(Por defecto)</SelectItem>}
            <SelectItem value="total">Universo total</SelectItem>
            {opSelectItems}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Label</Label>
        <Input value={label} onChange={(e) => onLabelChange(e.target.value)} placeholder="(vacío = sin label)" className="h-7 text-xs" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">Color</Label>
          <ColorSelector value={color} onChange={onColorChange} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Mostrar %</Label>
          {pctTooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {pctTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Switch checked={pct} onCheckedChange={onPctChange} />
        </div>
      </div>
    </div>
  );
}

export function DashboardCardsConfigSection({ operations, reports }: Props) {
  const { data: cardsConfig, isLoading } = useDashboardCardsConfig();
  const updateCard = useUpdateDashboardCard();

  const activeOps = operations.filter((o) => o.active);

  // ── Card 1 state ──
  const [c1Label, setC1Label] = useState("");
  const [c1MainValue, setC1MainValue] = useState("total");
  const [c1MainLabel, setC1MainLabel] = useState("");
  const [c1MainColor, setC1MainColor] = useState<CardColor>("none");
  const [c1MainPct, setC1MainPct] = useState(false);
  const [c1Sec1, setC1Sec1] = useState(NONE);
  const [c1Sec1Label, setC1Sec1Label] = useState("Activos");
  const [c1Sec1Color, setC1Sec1Color] = useState<CardColor>("green");
  const [c1Sec1Pct, setC1Sec1Pct] = useState(true);
  const [c1Sec2, setC1Sec2] = useState(NONE);
  const [c1Sec2Label, setC1Sec2Label] = useState("Inactivos");
  const [c1Sec2Color, setC1Sec2Color] = useState<CardColor>("red");
  const [c1Sec2Pct, setC1Sec2Pct] = useState(true);
  const [c1Saving, setC1Saving] = useState(false);

  // ── Card 2 state ──
  const [c2Label, setC2Label] = useState("");
  const [c2MainOp, setC2MainOp] = useState(NONE);
  const [c2MainLabel, setC2MainLabel] = useState("");
  const [c2MainColor, setC2MainColor] = useState<CardColor>("none");
  const [c2MainPct, setC2MainPct] = useState(true);
  const [c2Sec1, setC2Sec1] = useState(NONE);
  const [c2Sec1Label, setC2Sec1Label] = useState("Visibles B2B");
  const [c2Sec1Color, setC2Sec1Color] = useState<CardColor>("blue");
  const [c2Sec1Pct, setC2Sec1Pct] = useState(true);
  const [c2Sec2, setC2Sec2] = useState(NONE);
  const [c2Sec2Label, setC2Sec2Label] = useState("Visibles B2C");
  const [c2Sec2Color, setC2Sec2Color] = useState<CardColor>("blue");
  const [c2Sec2Pct, setC2Sec2Pct] = useState(true);
  const [c2Saving, setC2Saving] = useState(false);

  // ── Card 3 state ──
  const [c3Label, setC3Label] = useState("");
  const [c3Mode, setC3Mode] = useState<"dynamic" | "static">("dynamic");
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
      setC1MainLabel(cfg.main_label || "");
      setC1MainColor(cfg.main_color || "none");
      setC1MainPct(cfg.main_pct ?? false);
      setC1Sec1(cfg.secondary_1 || NONE);
      setC1Sec1Label(cfg.secondary_1_label || "Activos");
      setC1Sec1Color(cfg.secondary_1_color || "green");
      setC1Sec1Pct(cfg.secondary_1_pct ?? true);
      setC1Sec2(cfg.secondary_2 || NONE);
      setC1Sec2Label(cfg.secondary_2_label || "Inactivos");
      setC1Sec2Color(cfg.secondary_2_color || "red");
      setC1Sec2Pct(cfg.secondary_2_pct ?? true);
    }
    const c2 = cardsConfig.find((c) => c.card_key === "card_2");
    if (c2) {
      const cfg = c2.config as Card2Config;
      setC2Label(c2.label);
      setC2MainOp(cfg.main_operation || NONE);
      setC2MainLabel(cfg.main_label || "");
      setC2MainColor(cfg.main_color || "none");
      setC2MainPct(cfg.main_pct ?? true);
      setC2Sec1(cfg.secondary_1 || NONE);
      setC2Sec1Label(cfg.secondary_1_label || "Visibles B2B");
      setC2Sec1Color(cfg.secondary_1_color || "blue");
      setC2Sec1Pct(cfg.secondary_1_pct ?? true);
      setC2Sec2(cfg.secondary_2 || NONE);
      setC2Sec2Label(cfg.secondary_2_label || "Visibles B2C");
      setC2Sec2Color(cfg.secondary_2_color || "blue");
      setC2Sec2Pct(cfg.secondary_2_pct ?? true);
    }
    const c3 = cardsConfig.find((c) => c.card_key === "card_3");
    if (c3) {
      const cfg = c3.config as Card3Config;
      setC3Label(c3.label);
      setC3Mode(cfg.mode || (cfg.report_id ? "static" : "dynamic"));
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
          main_label: c1MainLabel,
          main_color: c1MainColor,
          main_pct: c1MainPct,
          secondary_1: c1Sec1 === NONE ? null : c1Sec1,
          secondary_1_label: c1Sec1Label,
          secondary_1_color: c1Sec1Color,
          secondary_1_pct: c1Sec1Pct,
          secondary_2: c1Sec2 === NONE ? null : c1Sec2,
          secondary_2_label: c1Sec2Label,
          secondary_2_color: c1Sec2Color,
          secondary_2_pct: c1Sec2Pct,
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
          main_label: c2MainLabel,
          main_color: c2MainColor,
          main_pct: c2MainPct,
          secondary_1: c2Sec1 === NONE ? null : c2Sec1,
          secondary_1_label: c2Sec1Label,
          secondary_1_color: c2Sec1Color,
          secondary_1_pct: c2Sec1Pct,
          secondary_2: c2Sec2 === NONE ? null : c2Sec2,
          secondary_2_label: c2Sec2Label,
          secondary_2_color: c2Sec2Color,
          secondary_2_pct: c2Sec2Pct,
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
        config: {
          mode: c3Mode,
          report_id: c3Mode === "static" && c3ReportId !== NONE ? c3ReportId : null,
        },
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
      <p className="text-sm text-muted-foreground mb-4">
        Configura el contenido de los 3 cards principales que se muestran en el dashboard.
      </p>

      <div className="space-y-4">
        {/* ── Card 1: Universo total ── */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 1 — Universo total</p>
            <div>
              <Label className="text-xs">Label del card</Label>
              <Input value={c1Label} onChange={(e) => setC1Label(e.target.value)} placeholder="Catálogo" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DataPointConfig
                title="Dato principal"
                valueId={c1MainValue}
                onValueChange={setC1MainValue}
                label={c1MainLabel}
                onLabelChange={setC1MainLabel}
                color={c1MainColor}
                onColorChange={setC1MainColor}
                pct={c1MainPct}
                onPctChange={setC1MainPct}
                opSelectItems={opSelectItems}
              />
              <DataPointConfig
                title="Secundario 1"
                valueId={c1Sec1}
                onValueChange={setC1Sec1}
                label={c1Sec1Label}
                onLabelChange={setC1Sec1Label}
                color={c1Sec1Color}
                onColorChange={setC1Sec1Color}
                pct={c1Sec1Pct}
                onPctChange={setC1Sec1Pct}
                opSelectItems={opSelectItems}
                includeDefault
              />
              <DataPointConfig
                title="Secundario 2"
                valueId={c1Sec2}
                onValueChange={setC1Sec2}
                label={c1Sec2Label}
                onLabelChange={setC1Sec2Label}
                color={c1Sec2Color}
                onColorChange={setC1Sec2Color}
                pct={c1Sec2Pct}
                onPctChange={setC1Sec2Pct}
                opSelectItems={opSelectItems}
                includeDefault
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveCard1} size="sm" className="gap-2" disabled={c1Saving}>
                {c1Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: Universo configurable ── */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 2 — Universo configurable</p>
            <div>
              <Label className="text-xs">Label del card</Label>
              <Input value={c2Label} onChange={(e) => setC2Label(e.target.value)} placeholder="Base Digital" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DataPointConfig
                title="Dato principal"
                valueId={c2MainOp}
                onValueChange={setC2MainOp}
                label={c2MainLabel}
                onLabelChange={setC2MainLabel}
                color={c2MainColor}
                onColorChange={setC2MainColor}
                pct={c2MainPct}
                onPctChange={setC2MainPct}
                opSelectItems={opSelectItems}
                includeDefault
                pctTooltip="El % se calcula sobre el Universo total de la base"
              />
              <DataPointConfig
                title="Secundario 1"
                valueId={c2Sec1}
                onValueChange={setC2Sec1}
                label={c2Sec1Label}
                onLabelChange={setC2Sec1Label}
                color={c2Sec1Color}
                onColorChange={setC2Sec1Color}
                pct={c2Sec1Pct}
                onPctChange={setC2Sec1Pct}
                opSelectItems={opSelectItems}
                includeDefault
                pctTooltip="El % se calcula sobre el universo definido en el Dato principal de este card"
              />
              <DataPointConfig
                title="Secundario 2"
                valueId={c2Sec2}
                onValueChange={setC2Sec2}
                label={c2Sec2Label}
                onLabelChange={setC2Sec2Label}
                color={c2Sec2Color}
                onColorChange={setC2Sec2Color}
                pct={c2Sec2Pct}
                onPctChange={setC2Sec2Pct}
                opSelectItems={opSelectItems}
                includeDefault
                pctTooltip="El % se calcula sobre el universo definido en el Dato principal de este card"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveCard2} size="sm" className="gap-2" disabled={c2Saving}>
                {c2Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 3: Completitud ── */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Card 3 — Completitud</p>
            <Tabs value={c3Mode} onValueChange={(v) => setC3Mode(v as "dynamic" | "static")}>
              <TabsList className="w-full bg-muted p-1 rounded-md">
                <TabsTrigger value="dynamic" className="flex-1 text-xs rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">Dinámico</TabsTrigger>
                <TabsTrigger value="static" className="flex-1 text-xs rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">Estático</TabsTrigger>
              </TabsList>
              <TabsContent value="dynamic" className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  El card refleja automáticamente el informe de Focos de atención que el usuario tiene seleccionado en el dashboard.
                </p>
                <div className="p-3 rounded-md border border-border/50 bg-muted/30">
                  <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1">Dato principal</p>
                  <p className="text-xs text-muted-foreground">Mostrando: según el informe seleccionado en Focos de atención</p>
                </div>
              </TabsContent>
              <TabsContent value="static" className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  El card siempre muestra el mismo informe, sin importar la navegación del usuario.
                </p>
                <div>
                  <Label className="text-xs">Label del card</Label>
                  <Input value={c3Label} onChange={(e) => setC3Label(e.target.value)} placeholder="Completitud Promedio" className="h-8 text-sm" />
                </div>
                <div className="space-y-2 p-3 rounded-md border border-border/50 bg-muted/30">
                  <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Dato principal</p>
                  <div>
                    <Label className="text-xs">Informe fijo</Label>
                    <Select value={c3ReportId} onValueChange={setC3ReportId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>(Seleccionar informe)</SelectItem>
                        {reports.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end">
              <Button onClick={saveCard3} size="sm" className="gap-2" disabled={c3Saving}>
                {c3Saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
