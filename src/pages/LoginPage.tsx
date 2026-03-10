import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login(email, password)) {
      setError("Credenciales inválidas o usuario inactivo.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">UPIM</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor de Completitud PIM</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@upim.com" required />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">Iniciar sesión</Button>
        </form>
        <div className="mt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>Demo: <strong>carlos@upim.com</strong> (UsuarioPRO)</p>
          <p>Demo: <strong>ana@upim.com</strong> (PIM Manager)</p>
          <p className="text-[10px]">Cualquier contraseña funciona en esta V1</p>
        </div>
      </div>
    </div>
  );
}
