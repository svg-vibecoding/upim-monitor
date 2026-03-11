import { useState, useRef, useMemo } from "react";
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
import { mockDimensions, Dimension } from "@/data/mockData";
import { Plus, Pencil, Upload, FileUp, CheckCircle2, AlertCircle, Loader2, RefreshCw, Search, CheckSquare, Square, History, RotateCcw, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useInvalidatePimData,
  usePredefinedReports,
  useAttributeOrder,
  useUpdateReportAttributes,
  getEvaluableAttributes,
  getFullAttributeList,
  getAttributeClassification,
  isNonEvaluable,
  usePimUploadHistory,
  sortReportsByDisplayOrder,
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
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<DBUser[]> => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, email, active")
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
      }));
    },
    staleTime: 2 * 60 * 1000,
  });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const invalidatePimData = useInvalidatePimData();
  const queryClient = useQueryClient();

  // DB-driven data
  const { data: dbReports = [], isLoading: reportsLoading } = usePredefinedReports();
  const { data: attributeOrder = [], isLoading: attrsLoading } = useAttributeOrder();
  const { data: uploadHistory = [], isLoading: historyLoading } = usePimUploadHistory();
  const { data: dbUsers = [], isLoading: usersLoading } = useUsers();
  const updateReportAttrs = useUpdateReportAttributes();

  const [dimensions, setDimensions] = useState<Dimension[]>([...mockDimensions]);

  // User form
  const [userDialog, setUserDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<AppRole>("pim_manager");
  const [userActive, setUserActive] = useState(true);
  const [userSaving, setUserSaving] = useState(false);

  const openUserDialog = (user?: DBUser) => {
    if (user) {
      setEditingUserId(user.id);
      setUserName(user.name);
      setUserEmail(user.email);
      setUserPassword("");
      setUserRole(user.role);
      setUserActive(user.active);
    } else {
      setEditingUserId(null);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("pim_manager");
      setUserActive(true);
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
          userId: editingUserId, name: userName, email: userEmail, role: userRole, active: userActive,
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
          body: { name: userName, email: userEmail, password: userPassword, role: userRole, active: true },
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

  // --- Reports: open edit dialog with current attrs from DB ---
  const openReportDialog = (reportId: string) => {
    const report = dbReports.find((r) => r.id === reportId);
    if (!report) return;
    setEditingReportId(reportId);
    setAttrSearch("");

    // For PIM General, default to all evaluable attrs if empty
    const isPimGeneral = report.name.toLowerCase().includes("general");
    const evaluableAttrs = getEvaluableAttributes(attributeOrder);
    if (isPimGeneral && (report.attributes.length === 0 || report.attributes.some((a) => !attributeOrder.includes(a)))) {
      setReportAttrs([...evaluableAttrs]);
    } else {
      // Only keep evaluable attrs from saved selection
      setReportAttrs(report.attributes.filter((a) => evaluableAttrs.includes(a)));
    }
    setReportDialog(true);
  };

  const saveReportAttrs = async () => {
    if (!editingReportId) return;
    try {
      await updateReportAttrs.mutateAsync({ reportId: editingReportId, attributes: reportAttrs });
      toast.success("Atributos del informe actualizados");
      setReportDialog(false);
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

  // Full attribute list including fixed-column fields
  const fullAttributeList = useMemo(() => getFullAttributeList(attributeOrder), [attributeOrder]);

  // Filtered attributes for search in dialog — show all, tag non-evaluable
  const filteredAttrs = useMemo(() => {
    if (!attrSearch.trim()) return fullAttributeList;
    const q = attrSearch.toLowerCase();
    return fullAttributeList.filter((a) => a.toLowerCase().includes(q));
  }, [fullAttributeList, attrSearch]);

  const editingReport = dbReports.find((r) => r.id === editingReportId);

  const openDimDialog = () => {
    setDimName("");
    setDimField("");
    setDimDialog(true);
  };

  const saveDimension = () => {
    setDimensions((prev) => [...prev, { id: String(Date.now()), name: dimName, field: dimField }]);
    setDimDialog(false);
  };

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvProgress, setCsvProgress] = useState("");
  const [csvResult, setCsvResult] = useState<{
    success: boolean;
    totalRows?: number;
    uniqueRows?: number;
    inserted?: number;
    updated?: number;
    errors?: number;
    errorDetails?: string[];
    columnsDetected?: { fixed: string[]; attributes: string[] };
    error?: string;
  } | null>(null);

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
      const allRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

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
          body: JSON.stringify({ rows: chunk, isFirstChunk: i === 0 }),
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
      }

      setCsvResult({
        success: true,
        totalRows: allRows.length,
        uniqueRows: totalUnique,
        inserted: totalInserted,
        updated: totalUpdated,
        errors: totalErrors,
        errorDetails: allErrorDetails.slice(0, 20),
        columnsDetected,
      });

      // Register in upload history
      try {
        await supabase.from("pim_upload_history" as any).insert({
          file_name: file.name,
          total_rows: allRows.length,
          unique_rows: totalUnique,
          inserted: totalInserted,
          updated: totalUpdated,
          errors: totalErrors,
        });
        invalidatePimData();
      } catch {
        // Non-blocking: history registration failure shouldn't break the upload flow
      }
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
                  Sube un archivo Excel (.xlsx / .xls) con los registros del PIM. La columna <strong>"Código Jaivaná"</strong> es obligatoria y se usa como clave única.
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

                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            invalidatePimData();
                            toast.success("Datos actualizados correctamente");
                          }}
                        >
                          <RefreshCw className="h-4 w-4" /> Actualizar datos de la app
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bg-muted rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                 <p className="font-medium text-foreground text-sm">Formato esperado del archivo Excel:</p>
                 <p>• Formato: <strong>.xlsx</strong> o <strong>.xls</strong> (se lee la primera hoja)</p>
                 <p>• Columna obligatoria: <strong>Código Jaivaná</strong></p>
                 <p>• Columnas fijas reconocidas: Estado Global, Visibilidad B2B, Visibilidad B2C, Categoría N1 Comercial, Clasificación del Producto</p>
                 <p>• Cualquier otra columna se almacena como <strong>atributo</strong> evaluable en los informes</p>
                 <p>• Los códigos numéricos se preservan como texto</p>
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
                        <TableRow key={entry.id} className={entry.is_active ? "bg-primary/5" : ""}>
                          <TableCell>
                            {entry.is_active ? (
                              <Badge variant="default" className="text-xs">Activa</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Anterior</Badge>
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
                            {!entry.is_active && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" disabled>
                                      <RotateCcw className="h-3 w-3" /> Restablecer a esta versión
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Disponible próximamente</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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
          ) : (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {fullAttributeList.length} atributos detectados en la base PIM. La clasificación y evaluabilidad se aplican internamente en esta versión.
                </p>
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
                    {["Código Jaivaná", ...fullAttributeList].map((attr, idx) => {
                      const classification = getAttributeClassification(attr);
                      const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
                        base: "default",
                        funcional: "secondary",
                        "dimensión": "outline",
                        general: "outline",
                      };
                      return (
                        <TableRow key={attr}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{attr}</TableCell>
                          <TableCell>
                            <Badge variant={typeBadgeVariant[classification.type] || "outline"} className="text-xs">
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
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
              {/* Report attribute edit dialog */}
              <Dialog open={reportDialog} onOpenChange={setReportDialog}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>
                      Configurar atributos — {editingReport?.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar atributo..."
                          value={attrSearch}
                          onChange={(e) => setAttrSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Badge variant="secondary">{reportAttrs.length} seleccionados</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={selectAllAttrs}>
                        <CheckSquare className="h-3 w-3" /> Todos
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={deselectAllAttrs}>
                        <Square className="h-3 w-3" /> Ninguno
                      </Button>
                    </div>
                    <div className="border rounded-md p-2 overflow-auto flex-1 min-h-0 max-h-[50vh]">
                      {/* Código Jaivaná — always selected, not removable */}
                      <label className="flex items-center gap-2 text-sm py-1 px-1 rounded opacity-70">
                        <Checkbox checked={true} disabled />
                        <span className="truncate">Código Jaivaná</span>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">siempre visible</Badge>
                      </label>
                      {filteredAttrs.map((attr) => {
                        const classification = getAttributeClassification(attr);
                        const nonEvaluable = !classification.evaluable;
                        const showTypeBadge = classification.type !== "general";
                        return (
                          <label
                            key={attr}
                            className={`flex items-center gap-2 text-sm cursor-pointer py-1 px-1 rounded hover:bg-muted/50 ${nonEvaluable ? "opacity-60" : ""}`}
                          >
                            <Checkbox
                              checked={reportAttrs.includes(attr)}
                              onCheckedChange={() => toggleReportAttr(attr)}
                            />
                            <span className="truncate">{attr}</span>
                            <span className="ml-auto flex gap-1 shrink-0">
                              {showTypeBadge && (
                                <Badge variant="outline" className="text-[10px]">
                                  {classification.type}
                                </Badge>
                              )}
                              {nonEvaluable && (
                                <Badge variant="secondary" className="text-[10px]">
                                  no evaluable
                                </Badge>
                              )}
                            </span>
                          </label>
                        );
                      })}
                      {filteredAttrs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No se encontraron atributos</p>
                      )}
                    </div>
                    <Button
                      onClick={saveReportAttrs}
                      disabled={updateReportAttrs.isPending}
                      className="w-full gap-2"
                    >
                      {updateReportAttrs.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Guardar configuración
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Universo</TableHead>
                        <TableHead className="text-right">Atributos</TableHead>
                        <TableHead className="w-20">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortReportsByDisplayOrder(dbReports).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.universe}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={getEvaluableAttributes(r.attributes).length > 0 ? "secondary" : "destructive"}>
                              {getEvaluableAttributes(r.attributes).length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openReportDialog(r.id)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
            <Dialog open={dimDialog} onOpenChange={setDimDialog}>
              <DialogTrigger asChild>
                <Button onClick={openDimDialog} className="gap-2"><Plus className="h-4 w-4" /> Nueva dimensión</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva dimensión</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nombre</Label><Input value={dimName} onChange={(e) => setDimName(e.target.value)} /></div>
                  <div><Label>Campo asociado</Label><Input value={dimField} onChange={(e) => setDimField(e.target.value)} placeholder="ej: categoriaN1Comercial" /></div>
                  <Button onClick={saveDimension} className="w-full">Guardar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Campo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.field}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={userDialog} onOpenChange={setUserDialog}>
              <DialogTrigger asChild>
                <Button onClick={openUserDialog} className="gap-2"><UserPlus className="h-4 w-4" /> Nuevo usuario</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nombre</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nombre completo" /></div>
                  <div><Label>Correo electrónico</Label><Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="correo@empresa.com" /></div>
                  <div><Label>Contraseña inicial</Label><Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
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
                  <Button onClick={saveUser} className="w-full" disabled={userSaving}>
                    {userSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : "Crear usuario"}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserActive(u.id, u.active)}
                          >
                            {u.active ? "Desactivar" : "Activar"}
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
