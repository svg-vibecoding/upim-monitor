import { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Upload, FileUp, CheckCircle2, AlertCircle, Loader2, RefreshCw, Search, CheckSquare, Square, History, RotateCcw, UserPlus, Trash2, ChevronRight, Inbox, Settings2, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OperationBuilder } from "@/components/OperationBuilder";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useInvalidatePimData,
  usePredefinedReports,
  useAttributeOrder,
  useUpdateReportAttributes,
  useUpdateReportOperation,
  useRefreshComputed,
  getEvaluableAttributes,
  getFullAttributeList,
  getAttributeClassification,
  isNonEvaluable,
  usePimUploadHistory,
  useDimensions,
  sortReportsByDisplayOrder,
  useProtectedAttributes,
  useOperations,
  LINKED_KPI_LABELS,
  getValidOperationRefs,
  type AttributeType,
  type Operation,
  type Condition,
  type ConditionSourceType,
  type OperatorType,
  type LogicMode,
  type LinkedKpi,
} from "@/hooks/usePimData";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";

interface DBUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: AppRole;
  track_insights: boolean;
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<DBUser[]> => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, email, active, track_insights")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map<string, AppRole>();
      (roles || []).forEach((r) => roleMap.set(r.user_id, r.role as AppRole));

      return (profiles || []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        active: p.active,
        role: roleMap.get(p.id) || "pim_manager",
        track_insights: p.track_insights ?? true,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const invalidatePimData = useInvalidatePimData();
  const queryClient = useQueryClient();
  const { refreshAll, refreshForOperation, refreshForReport } = useRefreshComputed();

  // DB-driven data
  const { data: dbReports = [], isLoading: reportsLoading } = usePredefinedReports();
  const { data: attributeOrder = [], isLoading: attrsLoading } = useAttributeOrder();
  const { data: uploadHistory = [], isLoading: historyLoading } = usePimUploadHistory();
  const { data: dbUsers = [], isLoading: usersLoading } = useUsers();
  const { data: dbDimensions = [], isLoading: dimensionsLoading } = useDimensions();
  const { data: operations = [], isLoading: operationsLoading } = useOperations();
  const updateReportAttrs = useUpdateReportAttributes();
  const updateReportOp = useUpdateReportOperation();
  

  // --- Operations state ---
  const [opDialog, setOpDialog] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [opName, setOpName] = useState("");
  const [opDescription, setOpDescription] = useState("");
  const [opLogicMode, setOpLogicMode] = useState<LogicMode>("all");
  const [opConditions, setOpConditions] = useState<Condition[]>([{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }]);
  const [opLinkedKpi, setOpLinkedKpi] = useState<LinkedKpi | "none">("none");
  const [opSaving, setOpSaving] = useState(false);
  const [deleteOpId, setDeleteOpId] = useState<string | null>(null);

  const openOpDialog = useCallback((op?: Operation) => {
    if (op) {
      setEditingOpId(op.id);
      setOpName(op.name);
      setOpDescription(op.description);
      setOpLogicMode(op.logicMode);
      setOpConditions(op.conditions.length > 0 ? op.conditions : [{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }]);
      setOpLinkedKpi(op.linkedKpi || "none");
    } else {
      setEditingOpId(null);
      setOpName("");
      setOpDescription("");
      setOpLogicMode("all");
      setOpConditions([{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }]);
      setOpLinkedKpi("none");
    }
    setOpDialog(true);
  }, []);

  const saveOperation = async () => {
    if (!opName.trim()) { toast.error("El nombre es obligatorio"); return; }
    const validConditions = opConditions.filter((c) => c.attribute.trim() !== "");
    if (validConditions.length === 0) { toast.error("Agrega al menos una condición válida"); return; }

    const linkedKpiValue = opLinkedKpi === "none" ? null : opLinkedKpi;

    // Validate uniqueness of linked_kpi (only one active op per KPI)
    if (linkedKpiValue) {
      const conflict = operations.find((o) => o.linkedKpi === linkedKpiValue && o.active && o.id !== editingOpId);
      if (conflict) {
        // Unlink the conflicting operation
        await supabase.from("operations" as any).update({ linked_kpi: null }).eq("id", conflict.id);
      }
    }

    setOpSaving(true);
    try {
      const payload = {
        name: opName.trim(),
        description: opDescription.trim(),
        logic_mode: opLogicMode,
        conditions: validConditions,
        linked_kpi: linkedKpiValue,
      };

      if (editingOpId) {
        const { error } = await supabase.from("operations" as any).update(payload).eq("id", editingOpId);
        if (error) throw error;
        toast.success("Operación actualizada");
      } else {
        const { error } = await supabase.from("operations" as any).insert(payload);
        if (error) throw error;
        toast.success("Operación creada");
      }
      setOpDialog(false);
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      // Refresh computed results for this operation and affected reports
      if (editingOpId) {
        refreshForOperation(editingOpId, dbReports).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err.message || "Error guardando operación");
    } finally {
      setOpSaving(false);
    }
  };

  const toggleOpActive = async (op: Operation) => {
    try {
      const { error } = await supabase.from("operations" as any).update({ active: !op.active }).eq("id", op.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      refreshForOperation(op.id, dbReports).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Error cambiando estado");
    }
  };

  const deleteOperation = async (opId: string) => {
    try {
      const { error } = await supabase.from("operations" as any).delete().eq("id", opId);
      if (error) throw error;
      toast.success("Operación eliminada");
      queryClient.invalidateQueries({ queryKey: ["operations"] });
    } catch (err: any) {
      toast.error(err.message || "Error eliminando operación");
    }
    setDeleteOpId(null);
  };

  const updateCondition = (idx: number, field: keyof Condition, value: string) => {
    setOpConditions((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      if (field === "operator") {
        const op = value as OperatorType;
        return { ...c, operator: op, value: (op === "has_value" || op === "no_value" || op === "meets_operation" || op === "not_meets_operation") ? null : c.value };
      }
      return { ...c, [field]: value };
    }));
  };

  const updateConditionSourceType = (idx: number, newSource: ConditionSourceType) => {
    setOpConditions((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      // Reset attribute and operator when switching source type
      return {
        ...c,
        sourceType: newSource,
        attribute: "",
        operator: newSource === "operation" ? "meets_operation" : "has_value",
        value: null,
      };
    }));
  };

  const addCondition = () => setOpConditions((prev) => [...prev, { sourceType: "attribute", attribute: "", operator: "has_value", value: null }]);
  const removeCondition = (idx: number) => setOpConditions((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));

  // KPI assignment info for the select
  const kpiAssignments = useMemo(() => {
    const map: Partial<Record<LinkedKpi, string>> = {};
    for (const op of operations) {
      if (op.linkedKpi && op.active && op.id !== editingOpId) {
        map[op.linkedKpi] = op.name;
      }
    }
    return map;
  }, [operations, editingOpId]);

  // User form
  const [userDialog, setUserDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<AppRole>("pim_manager");
  const [userActive, setUserActive] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [userTrackInsights, setUserTrackInsights] = useState(true);
  const openUserDialog = (user?: DBUser) => {
    if (user) {
      setEditingUserId(user.id);
      setUserName(user.name);
      setUserEmail(user.email);
      setUserPassword("");
      setUserRole(user.role);
      setUserActive(user.active);
      setUserTrackInsights(user.track_insights);
    } else {
      setEditingUserId(null);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("pim_manager");
      setUserActive(true);
      setUserTrackInsights(true);
    }
    setUserDialog(true);
  };

  const saveUser = async () => {
    if (editingUserId) {
      if (!userName || !userEmail) {
        toast.error("Nombre y correo son obligatorios");
        return;
      }
      setUserSaving(true);
      try {
        const body: Record<string, unknown> = {
          userId: editingUserId, name: userName, email: userEmail, role: userRole, active: userActive, track_insights: userTrackInsights,
        };
        if (userPassword) body.password = userPassword;
        const { data, error } = await supabase.functions.invoke("update-user", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Usuario actualizado");
        setUserDialog(false);
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      } catch (err: any) {
        toast.error(err.message || "Error actualizando usuario");
      } finally {
        setUserSaving(false);
      }
    } else {
      if (!userName || !userEmail || !userPassword) {
        toast.error("Completa todos los campos");
        return;
      }
      setUserSaving(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { name: userName, email: userEmail, password: userPassword, role: userRole, active: true, track_insights: userTrackInsights },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success(`Usuario ${userEmail} creado exitosamente`);
        setUserDialog(false);
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      } catch (err: any) {
        toast.error(err.message || "Error creando usuario");
      } finally {
        setUserSaving(false);
      }
    }
  };

  // Report edit state
  const [reportDialog, setReportDialog] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportAttrs, setReportAttrs] = useState<string[]>([]);
  const [reportOperationId, setReportOperationId] = useState<string | null>(null);
  const [attrSearch, setAttrSearch] = useState("");
  const [attrTypeFilter, setAttrTypeFilter] = useState("todos");

  // Report create — now handled by dedicated page (/admin/nuevo-informe)



  // --- Reports: open edit dialog with current attrs from DB ---
  const openReportDialog = (reportId: string) => {
    const report = dbReports.find((r) => r.id === reportId);
    if (!report) return;
    setEditingReportId(reportId);
    setAttrSearch("");
    setReportOperationId(report.operationId);
    const isPimGeneral = report.name.toLowerCase().includes("general");
    const evaluableAttrs = getEvaluableAttributes(attributeOrder);
    if (isPimGeneral && (report.attributes.length === 0 || report.attributes.some((a) => !attributeOrder.includes(a)))) {
      setReportAttrs([...evaluableAttrs]);
    } else {
      setReportAttrs(report.attributes.filter((a) => evaluableAttrs.includes(a)));
    }
    setReportDialog(true);
  };

  const saveReportConfig = async () => {
    if (!editingReportId) return;
    try {
      // Save operation and attributes
      await updateReportOp.mutateAsync({ reportId: editingReportId, operationId: reportOperationId });
      await updateReportAttrs.mutateAsync({ reportId: editingReportId, attributes: reportAttrs });
      toast.success("Configuración del informe actualizada");
      setReportDialog(false);
      // Refresh computed results for this report
      refreshForReport(editingReportId).catch(() => {});
    } catch (err) {
      toast.error(`Error al guardar: ${(err as Error).message}`);
    }
  };

  const toggleReportAttr = (attr: string) => {
    setReportAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  };

  const selectAllAttrs = () => {
    setReportAttrs(getEvaluableAttributes(getFullAttributeList(attributeOrder)));
  };

  const deselectAllAttrs = () => {
    setReportAttrs([]);
  };

  const fullAttributeList = useMemo(() => getFullAttributeList(attributeOrder), [attributeOrder]);

  const filteredAttrs = useMemo(() => {
    if (!attrSearch.trim()) return fullAttributeList;
    const q = attrSearch.toLowerCase();
    return fullAttributeList.filter((a) => a.toLowerCase().includes(q));
  }, [fullAttributeList, attrSearch]);

  const editingReport = dbReports.find((r) => r.id === editingReportId);

  const [dimDialog, setDimDialog] = useState(false);
  const [dimName, setDimName] = useState("");
  const [dimField, setDimField] = useState("");
  const [editingDimId, setEditingDimId] = useState<string | null>(null);
  const [dimSaving, setDimSaving] = useState(false);

  const openDimDialog = (dim?: { id: string; name: string; field: string }) => {
    if (dim) {
      setEditingDimId(dim.id);
      setDimName(dim.name);
      setDimField(dim.field);
    } else {
      setEditingDimId(null);
      setDimName("");
      setDimField("");
    }
    setDimDialog(true);
  };

  // Attributes available for dimensions (all real attributes from PIM)
  const availableAttrsForDim = useMemo(() => {
    const full = getFullAttributeList(attributeOrder);
    // Exclude Código Jaivaná (it's the PK, not useful as dimension)
    return full.filter((a) => a !== "Código Jaivaná");
  }, [attributeOrder]);

  // Dimension unique values — fetched via lightweight server query instead of loading all records
  const dimensionUniqueValues: Record<string, string[]> = {};

  const saveDimension = async () => {
    if (!dimName || !dimField) {
      toast.error("Selecciona un nombre y un atributo");
      return;
    }
    setDimSaving(true);
    try {
      if (editingDimId) {
        const { error } = await supabase
          .from("dimensions")
          .update({ name: dimName, field: dimField })
          .eq("id", editingDimId);
        if (error) throw error;
        toast.success("Dimensión actualizada");
      } else {
        const { error } = await supabase
          .from("dimensions")
          .insert({ name: dimName, field: dimField });
        if (error) throw error;
        toast.success("Dimensión creada");
      }
      setDimDialog(false);
      queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    } catch (err: any) {
      toast.error(err.message || "Error guardando dimensión");
    } finally {
      setDimSaving(false);
    }
  };

  const deleteDimension = async (dimId: string) => {
    try {
      const { error } = await supabase.from("dimensions").delete().eq("id", dimId);
      if (error) throw error;
      toast.success("Dimensión eliminada");
      queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    } catch (err: any) {
      toast.error(err.message || "Error eliminando dimensión");
    }
  };

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvProgress, setCsvProgress] = useState("");
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [pendingAttributeOrder, setPendingAttributeOrder] = useState<string[]>([]);
  const [activating, setActivating] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    success: boolean;
    totalRows?: number;
    uniqueRows?: number;
    inserted?: number;
    updated?: number;
    errors?: number;
    errorDetails?: string[];
    columnsDetected?: { fixed: string[]; attributes: string[] };
    attributeOrder?: string[];
    uploadId?: string;
    error?: string;
  } | null>(null);

  // Dynamic protected attributes (replaces hardcoded MANDATORY_ATTRIBUTES)
  const protectedAttributes = useProtectedAttributes();

  const missingProtected = useMemo(() => {
    if (!csvResult?.success || !csvResult.attributeOrder) return [];
    const uploadedSet = new Set(csvResult.attributeOrder);
    // Código Jaivaná is validated by row existence, not by attribute_order
    return protectedAttributes
      .filter((p) => p.attr !== "Código Jaivaná")
      .filter((p) => !uploadedSet.has(p.attr));
  }, [csvResult, protectedAttributes]);

  const canActivate = csvResult?.success && missingProtected.length === 0 && (csvResult.uniqueRows || 0) > 0 && !!pendingUploadId;

  const CHUNK_SIZE = 2000;

  const handleCsvUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setCsvResult(null);
    setCsvProgress("Leyendo archivo...");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setCsvResult({ success: false, error: "El archivo no contiene hojas." });
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const allRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      if (allRows.length === 0) {
        setCsvResult({ success: false, error: "El archivo no tiene datos." });
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/upload-pim-csv`;

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      const allErrorDetails: string[] = [];
      let columnsDetected: { fixed: string[]; attributes: string[] } | undefined;
      let totalUnique = 0;

      const totalChunks = Math.ceil(allRows.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = allRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        setCsvProgress(`Enviando lote ${i + 1} de ${totalChunks} (${chunk.length} filas)...`);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, isFirstChunk: i === 0, fileName: file.name }),
        });

        const data = await res.json();

        if (!data.success) {
          totalErrors += chunk.length;
          allErrorDetails.push(`Lote ${i + 1}: ${data.error || "Error desconocido"}`);
          continue;
        }

        totalInserted += data.inserted || 0;
        totalUpdated += data.updated || 0;
        totalErrors += data.errors || 0;
        totalUnique += data.uniqueRows || 0;
        if (data.errorDetails) allErrorDetails.push(...data.errorDetails);
        if (!columnsDetected && data.columnsDetected) columnsDetected = data.columnsDetected;
        // Capture uploadId and attributeOrder from first chunk response
        if (i === 0 && data.uploadId) {
          setPendingUploadId(data.uploadId);
          setPendingAttributeOrder(data.attributeOrder || []);
        }
      }

      const attrOrder = pendingAttributeOrder.length > 0 ? pendingAttributeOrder : undefined;

      setCsvResult({
        success: true,
        totalRows: allRows.length,
        uniqueRows: totalUnique,
        inserted: totalInserted,
        updated: totalUpdated,
        errors: totalErrors,
        errorDetails: allErrorDetails.slice(0, 20),
        columnsDetected,
        attributeOrder: attrOrder,
      });

      // Refresh upload history
      queryClient.invalidateQueries({ queryKey: ["pim-upload-history"] });
    } catch (err) {
      setCsvResult({ success: false, error: `Error: ${(err as Error).message}` });
    } finally {
      setCsvUploading(false);
      setCsvProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Administración</h1>

      <Tabs defaultValue="pim-upload">
        <TabsList>
          <TabsTrigger value="pim-upload">Base PIM</TabsTrigger>
          <TabsTrigger value="attributes">Atributos</TabsTrigger>
          <TabsTrigger value="reports">Informes</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
          <TabsTrigger value="operations">Operaciones</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
        </TabsList>

        {/* PIM UPLOAD */}
        <TabsContent value="pim-upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Actualizar base PIM
                </h3>
                 <p className="text-sm text-muted-foreground mt-1">
                  Sube un archivo Excel para actualizar la base del PIM. La columna <strong>"Código Jaivaná"</strong> es obligatoria y se usa como clave única.
                 </p>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="max-w-sm"
                  disabled={csvUploading}
                />
                <Button onClick={handleCsvUpload} disabled={csvUploading} className="gap-2">
                  {csvUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {csvUploading ? "Procesando..." : "Cargar Excel"}
                </Button>
              </div>

              {csvUploading && csvProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{csvProgress}</span>
                </div>
              )}

              {csvResult && (
                <div className={`rounded-lg border p-4 space-y-2 ${csvResult.success ? "border-success bg-success/5" : "border-destructive bg-destructive/5"}`}>
                  <div className="flex items-center gap-2">
                    {csvResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-semibold text-foreground">
                      {csvResult.success ? "Carga completada" : "Error en la carga"}
                    </span>
                  </div>

                  {csvResult.error && (
                    <p className="text-sm text-destructive">{csvResult.error}</p>
                  )}

                  {csvResult.success && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                        <div className="text-center p-2 rounded-md bg-muted">
                          <div className="text-lg font-bold text-foreground">{csvResult.totalRows}</div>
                          <div className="text-xs text-muted-foreground">Filas en archivo</div>
                        </div>
                        <div className="text-center p-2 rounded-md bg-muted">
                          <div className="text-lg font-bold text-foreground">{csvResult.uniqueRows}</div>
                          <div className="text-xs text-muted-foreground">Códigos únicos</div>
                        </div>
                        <div className="text-center p-2 rounded-md bg-muted">
                          <div className="text-lg font-bold text-success">{csvResult.inserted}</div>
                          <div className="text-xs text-muted-foreground">Insertados</div>
                        </div>
                        <div className="text-center p-2 rounded-md bg-muted">
                          <div className="text-lg font-bold text-primary">{csvResult.updated}</div>
                          <div className="text-xs text-muted-foreground">Actualizados</div>
                        </div>
                        <div className="text-center p-2 rounded-md bg-muted">
                          <div className="text-lg font-bold text-destructive">{csvResult.errors}</div>
                          <div className="text-xs text-muted-foreground">Errores</div>
                        </div>
                      </div>

                      {csvResult.columnsDetected && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <p><strong>Columnas fijas detectadas:</strong> {csvResult.columnsDetected.fixed.join(", ")}</p>
                          <p><strong>Atributos detectados:</strong> {csvResult.columnsDetected.attributes.length} columnas adicionales</p>
                        </div>
                      )}

                      {csvResult.errorDetails && csvResult.errorDetails.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-destructive">Detalle de errores:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {csvResult.errorDetails.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </div>
                      )}

                      {missingProtected.length > 0 && (
                        <div className="rounded-md border border-destructive bg-destructive/5 p-3 mt-2">
                          <p className="text-xs font-medium text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> Faltan atributos requeridos por lógica activa del sistema:
                          </p>
                          <ul className="text-xs text-destructive list-none mt-1 space-y-0.5">
                            {missingProtected.map((p) => (
                              <li key={p.attr} className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] shrink-0">{p.type}</Badge>
                                <span className="font-medium">{p.attr}</span>
                                <span className="text-muted-foreground">— {p.reason}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2">
                            No se puede activar esta versión. Para continuar sin estos atributos, primero elimina o ajusta la lógica que los utiliza (informes o dimensiones).
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          disabled={!canActivate || activating}
                          onClick={async () => {
                            
                            setActivating(true);
                            try {
                              const { data: latestPending, error: pendingError } = await supabase
                                .from("pim_upload_history")
                                .select("id")
                                .eq("status", "pending")
                                .order("uploaded_at", { ascending: false })
                                .limit(1)
                                .maybeSingle();

                              if (pendingError) throw pendingError;

                              const uploadIdToActivate = (latestPending as { id: string } | null)?.id || pendingUploadId;
                              if (!uploadIdToActivate) {
                                throw new Error("No hay una carga pendiente para activar");
                              }

                              const { data, error } = await supabase.functions.invoke("activate-pim-version", {
                                body: { upload_id: uploadIdToActivate },
                              });

                              if (error) {
                                let detailedMessage = error.message;
                                const response = (error as any)?.context;
                                if (response && typeof response.json === "function") {
                                  const parsed = await response.json().catch(() => null);
                                  if (parsed?.error) detailedMessage = parsed.error;
                                }
                                throw new Error(detailedMessage);
                              }

                              if (data?.error) throw new Error(data.error);
                              invalidatePimData();
                              // Refresh all computed results after PIM activation
                              refreshAll().catch(() => {});
                              setCsvResult(null);
                              setPendingUploadId(null);
                              setPendingAttributeOrder([]);
                              toast.success("Base PIM activada correctamente");
                            } catch (err: any) {
                              toast.error(err.message || "Error activando la base PIM");
                            } finally {
                              setActivating(false);
                            }
                          }}
                        >
                          {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          {activating ? "Activando..." : "Actualizar datos de la app"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={activating}
                          onClick={async () => {
                            if (pendingUploadId) {
                              try {
                                await supabase
                                  .from("pim_upload_history" as any)
                                  .update({ status: "discarded" })
                                  .eq("id", pendingUploadId);
                              } catch { /* non-blocking */ }
                            }
                            setCsvResult(null);
                            setPendingUploadId(null);
                            setPendingAttributeOrder([]);
                            queryClient.invalidateQueries({ queryKey: ["pim-upload-history"] });
                            toast.info("Carga descartada. Los datos de la app no fueron modificados.");
                          }}
                        >
                          Descartar esta actualización
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bg-muted rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                 <p className="font-medium text-foreground text-sm">Formato esperado del archivo Excel:</p>
                 <p>• Formato permitido: <strong>.xlsx</strong> o <strong>.xls</strong> (se procesa la primera hoja)</p>
                 <p>• El archivo cargado se toma como la versión completa y vigente de la Base PIM</p>
                 <p>• Se generará un reporte de control sobre el archivo cargado. La actualización se aplica al confirmar "Actualizar datos en la app"</p>
                 <p>• Columna obligatoria de identificación: <strong>Código Jaivaná</strong></p>
                 <p>• La base debe incluir también los atributos requeridos por las funcionalidades activas de la app (atributos funcionales y/o dimensiones en uso)</p>
                 <p>• Cualquier otra columna se almacena como <strong>atributo</strong> evaluable en los informes</p>
              </div>
            </CardContent>
          </Card>

          {/* HISTÓRICO DE BASES PIM */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Histórico de Bases PIM
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Registro de las cargas realizadas. La versión más reciente se marca como activa.
                </p>
              </div>

              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando histórico...
                </div>
              ) : uploadHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground border rounded-lg p-6 text-center">
                  No se han registrado cargas todavía. Sube un archivo Excel para ver el histórico aquí.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Fecha y hora</TableHead>
                        <TableHead className="text-right">Filas</TableHead>
                        <TableHead className="text-right">Únicos</TableHead>
                        <TableHead className="text-right">Insertados</TableHead>
                        <TableHead className="text-right">Actualizados</TableHead>
                        <TableHead className="text-right">Errores</TableHead>
                        <TableHead className="w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadHistory.map((entry) => (
                        <TableRow key={entry.id} className={entry.status === "active" ? "bg-primary/5" : ""}>
                          <TableCell>
                            {entry.status === "active" ? (
                              <Badge variant="default" className="text-xs">Activa</Badge>
                            ) : entry.status === "pending" ? (
                              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">Pendiente</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Descartada</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate" title={entry.file_name}>
                            {entry.file_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(entry.uploaded_at).toLocaleString("es-CO", {
                              year: "numeric", month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-right text-sm">{entry.total_rows}</TableCell>
                          <TableCell className="text-right text-sm">{entry.unique_rows}</TableCell>
                          <TableCell className="text-right text-sm text-success">{entry.inserted}</TableCell>
                          <TableCell className="text-right text-sm text-primary">{entry.updated}</TableCell>
                          <TableCell className="text-right text-sm text-destructive">{entry.errors}</TableCell>
                          <TableCell>
                            {/* Empty - actions removed for V1 */}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTRIBUTES */}
        <TabsContent value="attributes" className="space-y-4">
          {attrsLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando atributos...
            </div>
          ) : fullAttributeList.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No se han detectado atributos. Sube un archivo Excel en la pestaña "Base PIM" para cargar los atributos disponibles.
                </p>
              </CardContent>
            </Card>
          ) : (() => {
            const ATTR_TYPE_DESCRIPTIONS: Record<string, string> = {
              todos: "Visualiza todos los atributos del PIM y su clasificación dentro de la app.",
              base: "Se usa para identificar de forma única los registros del PIM. Estos atributos son esenciales para la integridad de la base y siempre deben estar presentes en una actualización.",
              funcional: "Corresponde a atributos usados por alguna lógica activa de la app. Por ejemplo, informes predefinidos, reglas de visibilidad o universos de análisis.",
              "dimensión": "Agrupa atributos usados para distribuir y analizar la completitud en informes. Permiten segmentar resultados por categorías, marcas u otros ejes de análisis definidos en la app.",
              general: "Incluye todos los atributos del PIM que no cumplen una función estructural ni operativa dentro de la app. Son evaluables en informes, pero no sostienen lógica activa del sistema.",
            };

            const allAttrsWithBase = ["Código Jaivaná", ...fullAttributeList];
            const classifiedAttrs = allAttrsWithBase.map((attr) => ({
              attr,
              classification: getAttributeClassification(attr, dbReports, dbDimensions, operations),
            }));
            const filteredAttrs = attrTypeFilter === "todos"
              ? classifiedAttrs
              : classifiedAttrs.filter((a) => a.classification.type === attrTypeFilter);

            const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
              base: "default",
              funcional: "secondary",
              "dimensión": "outline",
              general: "outline",
            };

            return (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-col gap-3 mb-4">
                    <ToggleGroup
                      type="single"
                      value={attrTypeFilter}
                      onValueChange={(v) => { if (v) setAttrTypeFilter(v); }}
                      className="justify-start gap-1"
                    >
                      {["todos", "base", "funcional", "dimensión", "general"].map((t) => (
                        <ToggleGroupItem
                          key={t}
                          value={t}
                          size="sm"
                          className="rounded-full px-3 py-1 text-xs capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          {t === "todos" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className="text-xs text-muted-foreground">
                      Mostrando {filteredAttrs.length} de {allAttrsWithBase.length} atributos
                    </p>
                    <div className="mt-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {attrTypeFilter === "todos" ? "Todos" : attrTypeFilter === "base" ? "Atributos base" : attrTypeFilter === "funcional" ? "Atributos funcionales" : attrTypeFilter === "dimensión" ? "Atributos de dimensión" : "Atributos generales"}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ATTR_TYPE_DESCRIPTIONS[attrTypeFilter]}
                      </p>
                    </div>
                  </div>

                  {filteredAttrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No hay atributos clasificados como <span className="font-medium capitalize">{attrTypeFilter}</span>.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Atributo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Evaluable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAttrs.map(({ attr, classification }, idx) => (
                          <TableRow key={attr}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-sm">{attr}</TableCell>
                            <TableCell>
                              <Badge
                                variant={typeBadgeVariant[classification.type] || "outline"}
                                className="text-xs"
                                style={
                                  classification.type === "dimensión"
                                    ? { backgroundColor: "#3366FF", color: "#fff", borderColor: "#3366FF" }
                                    : undefined
                                }
                              >
                                {classification.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {classification.evaluable ? (
                                <span className="text-xs text-success font-medium">Sí</span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium">No evaluable</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* REPORTS - now DB-driven */}
        <TabsContent value="reports" className="space-y-4">
          {attrsLoading || reportsLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando informes...
            </div>
          ) : attributeOrder.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No se han detectado atributos. Sube un archivo Excel en la pestaña "Base PIM" para cargar los atributos disponibles.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={() => navigate("/admin/nuevo-informe")} className="gap-2">
                  <Plus className="h-4 w-4" /> Nuevo informe
                </Button>
              </div>

              {/* Edit is now handled by /admin/editar-informe/:reportId */}

              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Operación (universo)</TableHead>
                        <TableHead className="text-right">Atributos</TableHead>
                        <TableHead className="w-20">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortReportsByDisplayOrder(dbReports).map((r) => {
                        const linkedOp = r.operationId ? operations.find((op) => op.id === r.operationId) : null;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {linkedOp ? (
                                <Badge variant="outline" className="text-xs font-normal">{linkedOp.name}</Badge>
                              ) : (
                                <span className="text-xs italic">Todos los SKUs</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={getEvaluableAttributes(r.attributes).length > 0 ? "secondary" : "destructive"}>
                                {getEvaluableAttributes(r.attributes).length}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/editar-informe/${r.id}`)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {dbReports.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay informes predefinidos
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* DIMENSIONS */}
        <TabsContent value="dimensions" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openDimDialog()} className="gap-2"><Plus className="h-4 w-4" /> Nueva dimensión</Button>
          </div>

          {/* Dimension create/edit dialog */}
          <Dialog open={dimDialog} onOpenChange={setDimDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingDimId ? "Editar dimensión" : "Nueva dimensión"}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Nombre de la dimensión</Label>
                  <Input value={dimName} onChange={(e) => setDimName(e.target.value)} placeholder="Ej: Categoría Comercial" />
                </div>
                <div>
                  <Label>Atributo asociado</Label>
                  <Select value={dimField} onValueChange={setDimField}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un atributo del PIM" /></SelectTrigger>
                    <SelectContent>
                      {availableAttrsForDim.map((attr) => (
                        <SelectItem key={attr} value={attr}>{attr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Este atributo se usará como eje de distribución en los informes.</p>
                </div>
                <Button onClick={saveDimension} className="w-full" disabled={dimSaving}>
                  {dimSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : editingDimId ? "Guardar cambios" : "Crear dimensión"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {dimensionsLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando dimensiones...
            </div>
          ) : dbDimensions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>No hay dimensiones definidas.</p>
                <p className="text-sm mt-1">Crea una dimensión para agrupar los informes por un atributo del PIM.</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {dbDimensions.map((dim) => {
                const uniqueVals = dimensionUniqueValues[dim.id] || [];
                return (
                  <AccordionItem key={dim.id} value={dim.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="font-medium text-foreground">{dim.name}</span>
                        <Badge variant="outline" className="text-xs">{dim.field}</Badge>
                        <Badge variant="secondary" className="text-xs">{uniqueVals.length + 1} grupos</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDimDialog(dim)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar dimensión "{dim.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. La dimensión dejará de estar disponible en los informes.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteDimension(dim.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Valores únicos encontrados en la base ({uniqueVals.length + 1})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {uniqueVals.map((val) => (
                              <Badge key={val} variant="outline" className="text-xs font-normal">{val}</Badge>
                            ))}
                            <Badge variant="secondary" className="text-xs font-normal italic">Sin valor asignado</Badge>
                          </div>
                          {uniqueVals.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">No se encontraron valores poblados para este atributo en la base actual.</p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        {/* OPERATIONS */}
        <TabsContent value="operations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openOpDialog()} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva operación
            </Button>
          </div>

          {operationsLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando operaciones...
            </div>
          ) : operations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Settings2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p>No hay operaciones definidas.</p>
                <p className="text-sm mt-1">Crea una operación para definir reglas reutilizables sobre atributos del PIM.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-28">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((op) => (
                      <TableRow key={op.id} className={!op.active ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{op.name}</span>
                            <Badge variant="outline" className="text-[10px]">{op.conditions.length} cond.</Badge>
                            {op.linkedKpi && (
                              <Badge variant="secondary" className="text-[10px]">{LINKED_KPI_LABELS[op.linkedKpi]}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{op.description || "—"}</TableCell>
                        <TableCell>
                          <Switch checked={op.active} onCheckedChange={() => toggleOpActive(op)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openOpDialog(op)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpId(op.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Operation CRUD Dialog */}
          <Dialog open={opDialog} onOpenChange={setOpDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOpId ? "Editar operación" : "Nueva operación"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={opName} onChange={(e) => setOpName(e.target.value)} placeholder="Ej: Base Digital" />
                </div>
                <div>
                  <Label>Descripción (opcional)</Label>
                  <Textarea value={opDescription} onChange={(e) => setOpDescription(e.target.value)} placeholder="Breve descripción de esta operación" rows={2} />
                </div>

                <OperationBuilder
                  idPrefix="admin-op"
                  logicMode={opLogicMode}
                  onLogicModeChange={(v) => setOpLogicMode(v)}
                  conditions={opConditions}
                  onConditionsChange={setOpConditions}
                  attributeList={fullAttributeList}
                  allOperations={operations}
                  editingOperationId={editingOpId}
                />

                {/* Link to KPI */}
                <div>
                  <Label className="mb-2 block">Vincular a indicador del dashboard</Label>
                  <Select value={opLinkedKpi} onValueChange={(v) => setOpLinkedKpi(v as LinkedKpi | "none")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(Ninguno)</SelectItem>
                      {(Object.entries(LINKED_KPI_LABELS) as [LinkedKpi, string][]).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                          {kpiAssignments[key] ? ` (actual: ${kpiAssignments[key]})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si se vincula, el conteo del dashboard usará esta operación en lugar de la lógica predeterminada.
                  </p>
                </div>

                <Button onClick={saveOperation} className="w-full" disabled={opSaving}>
                  {opSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : editingOpId ? "Guardar cambios" : "Crear operación"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <AlertDialog open={!!deleteOpId} onOpenChange={(open) => !open && setDeleteOpId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar operación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Si la operación está vinculada a un indicador del dashboard, este volverá a su lógica predeterminada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteOpId && deleteOperation(deleteOpId)}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={userDialog} onOpenChange={setUserDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openUserDialog()} className="gap-2"><UserPlus className="h-4 w-4" /> Nuevo usuario</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingUserId ? "Editar usuario" : "Crear usuario"}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nombre</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nombre completo" /></div>
                  <div><Label>Correo electrónico</Label><Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="correo@empresa.com" /></div>
                  <div>
                    <Label>{editingUserId ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña inicial"}</Label>
                    <Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder={editingUserId ? "Sin cambios" : "Mínimo 6 caracteres"} />
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <Select value={userRole} onValueChange={(v) => setUserRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pim_manager">PIM Manager</SelectItem>
                        <SelectItem value="usuario_pro">UsuarioPRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editingUserId && (
                    <div className="flex items-center gap-2">
                      <Label>Estado</Label>
                      <Select value={userActive ? "active" : "inactive"} onValueChange={(v) => setUserActive(v === "active")}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 pb-1">
                    <div>
                      <Label htmlFor="track-insights">Capturar insights de uso</Label>
                      <p className="text-xs text-muted-foreground">Registrar actividad de este usuario en el módulo de Insights</p>
                    </div>
                    <Switch id="track-insights" checked={userTrackInsights} onCheckedChange={setUserTrackInsights} />
                  </div>
                  <Button onClick={saveUser} className="w-full" disabled={userSaving}>
                    {userSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {editingUserId ? "Guardando..." : "Creando..."}</> : editingUserId ? "Guardar cambios" : "Crear usuario"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-4">
              {usersLoading ? (
                <div className="flex items-center gap-2 p-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-28">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbUsers.map((u) => (
                      <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "usuario_pro" ? "default" : "secondary"}>
                            {u.role === "usuario_pro" ? "UsuarioPRO" : "PIM Manager"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.active ? "outline" : "destructive"}>
                            {u.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openUserDialog(u)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dbUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No hay usuarios registrados</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
