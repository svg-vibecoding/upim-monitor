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

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Administración</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="reports">Informes</TabsTrigger>
          <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
        </TabsList>

        {/* USERS */}
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
