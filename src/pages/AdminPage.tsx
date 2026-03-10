import { useState, useRef } from "react";
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
import {
  mockUsers, mockPredefinedReports, mockDimensions,
  AppUser, UserRole, PredefinedReport, Dimension,
} from "@/data/mockData";
import { Plus, Pencil, Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ALL_ATTRIBUTES = [
  "Nombre Comercial", "Descripción Corta", "Descripción Larga", "Marca", "EAN",
  "Unidad de Medida", "Contenido Neto", "País de Origen", "Peso Bruto", "Alto",
  "Ancho", "Profundidad", "Material", "Color Principal", "Vida Útil",
  "Descripción Corta Web", "Descripción Larga Web", "Imagen Principal", "Imagen 2",
  "Imagen 3", "Ficha Técnica PDF", "Palabras Clave SEO", "Meta Description",
  "Categoría Web B2B", "Categoría Web B2C", "Precio Sugerido B2B", "Precio Sugerido B2C",
  "Unidad de Venta B2B", "Video Producto", "Información Nutricional", "Ingredientes",
  "Código Proveedor", "Nombre Proveedor", "Referencia Proveedor", "Unidad de Compra",
  "Factor de Conversión", "Lead Time", "MOQ", "País Origen Compra", "Incoterm", "Moneda Compra",
];

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([...mockUsers]);
  const [reports, setReports] = useState<PredefinedReport[]>([...mockPredefinedReports]);
  const [dimensions, setDimensions] = useState<Dimension[]>([...mockDimensions]);

  // User form
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("PIM Manager");

  // Report form
  const [reportDialog, setReportDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<PredefinedReport | null>(null);
  const [reportName, setReportName] = useState("");
  const [reportUniverse, setReportUniverse] = useState("");
  const [reportAttrs, setReportAttrs] = useState<string[]>([]);

  // Dimension form
  const [dimDialog, setDimDialog] = useState(false);
  const [dimName, setDimName] = useState("");
  const [dimField, setDimField] = useState("");

  const openUserDialog = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setUserName(user.name);
      setUserEmail(user.email);
      setUserRole(user.role);
    } else {
      setEditingUser(null);
      setUserName("");
      setUserEmail("");
      setUserRole("PIM Manager");
    }
    setUserDialog(true);
  };

  const saveUser = () => {
    if (editingUser) {
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, name: userName, email: userEmail, role: userRole } : u));
    } else {
      setUsers((prev) => [...prev, { id: String(Date.now()), name: userName, email: userEmail, role: userRole, active: true }]);
    }
    setUserDialog(false);
  };

  const toggleUserActive = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !u.active } : u));
  };

  const openReportDialog = (report?: PredefinedReport) => {
    if (report) {
      setEditingReport(report);
      setReportName(report.name);
      setReportUniverse(report.universe);
      setReportAttrs([...report.attributes]);
    } else {
      setEditingReport(null);
      setReportName("");
      setReportUniverse("");
      setReportAttrs([]);
    }
    setReportDialog(true);
  };

  const saveReport = () => {
    if (editingReport) {
      setReports((prev) => prev.map((r) => r.id === editingReport.id
        ? { ...r, name: reportName, universe: reportUniverse, attributes: reportAttrs } : r));
    } else {
      setReports((prev) => [...prev, {
        id: String(Date.now()), name: reportName, description: "", universe: reportUniverse, attributes: reportAttrs,
      }]);
    }
    setReportDialog(false);
  };

  const toggleReportAttr = (attr: string) => {
    setReportAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  };

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

  const handleCsvUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-pim-csv`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      setCsvResult(data);
    } catch (err) {
      setCsvResult({ success: false, error: `Error de conexión: ${(err as Error).message}` });
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Administración</h1>

      <Tabs defaultValue="pim-upload">
        <TabsList>
          <TabsTrigger value="pim-upload">Base PIM</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="reports">Informes</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
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
                    </>
                  )}
                </div>
              )}

              <div className="bg-muted rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                 <p className="font-medium text-foreground text-sm">Formato esperado del archivo Excel:</p>
                 <p>• Formato: <strong>.xlsx</strong> o <strong>.xls</strong> (se lee la primera hoja)</p>
                 <p>• Columna obligatoria: <strong>Código Jaivaná</strong></p>
                 <p>• Columnas fijas reconocidas: Estado Global, Código SumaGo, Visibilidad B2B, Visibilidad B2C, Categoría N1 Comercial, Clasificación del Producto</p>
                 <p>• Cualquier otra columna se almacena como <strong>atributo</strong> evaluable en los informes</p>
                 <p>• Los códigos numéricos se preservan como texto</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={userDialog} onOpenChange={setUserDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openUserDialog()} className="gap-2"><Plus className="h-4 w-4" /> Nuevo usuario</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingUser ? "Editar usuario" : "Nuevo usuario"}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nombre</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} /></div>
                  <div><Label>Correo</Label><Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} /></div>
                  {!editingUser && <div><Label>Contraseña inicial</Label><Input type="password" placeholder="••••••••" /></div>}
                  <div>
                    <Label>Rol</Label>
                    <Select value={userRole} onValueChange={(v) => setUserRole(v as UserRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIM Manager">PIM Manager</SelectItem>
                        <SelectItem value="UsuarioPRO">UsuarioPRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveUser} className="w-full">Guardar</Button>
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
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell><Badge variant={u.role === "UsuarioPRO" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "outline" : "destructive"} className={u.active ? "border-success text-success" : ""}>
                          {u.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openUserDialog(u)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleUserActive(u.id)} className="text-xs">
                            {u.active ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={reportDialog} onOpenChange={setReportDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openReportDialog()} className="gap-2"><Plus className="h-4 w-4" /> Nuevo informe</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                <DialogHeader><DialogTitle>{editingReport ? "Editar informe" : "Nuevo informe"}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Nombre</Label><Input value={reportName} onChange={(e) => setReportName(e.target.value)} /></div>
                  <div><Label>Universo / criterio base</Label><Input value={reportUniverse} onChange={(e) => setReportUniverse(e.target.value)} /></div>
                  <div>
                    <Label>Atributos ({reportAttrs.length})</Label>
                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-auto mt-1 border rounded-md p-2">
                      {ALL_ATTRIBUTES.map((attr) => (
                        <label key={attr} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                          <Checkbox checked={reportAttrs.includes(attr)} onCheckedChange={() => toggleReportAttr(attr)} />
                          <span className="truncate">{attr}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button onClick={saveReport} className="w-full">Guardar</Button>
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
                    <TableHead>Universo</TableHead>
                    <TableHead className="text-right">Atributos</TableHead>
                    <TableHead className="w-20">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.universe}</TableCell>
                      <TableCell className="text-right">{r.attributes.length}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openReportDialog(r)}><Pencil className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}
