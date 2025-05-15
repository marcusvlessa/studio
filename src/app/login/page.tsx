// src/app/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, LogIn, Loader2, ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/config/site";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth(); // Use login from AuthContext
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!email || !password) {
      toast({ variant: "destructive", title: "Erro de Login", description: "Email e senha são obrigatórios." });
      setIsLoading(false);
      return;
    }
    
    try {
      const success = await login(email, password); // Call login from AuthContext
      if (success) {
        toast({ title: "Login Bem-sucedido", description: "Redirecionando para o painel..." });
        router.push("/dashboard");
      } else {
        // Error toast is handled within AuthContext's login or by electronAPI response
      }
    } catch (error) {
      // This catch might be redundant if AuthContext handles it, but good for safety
      console.error("Erro no login:", error);
      toast({ variant: "destructive", title: "Erro de Login", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrainCircuit className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Login - {APP_NAME}</CardTitle>
          <CardDescription>
            Acesse sua conta para utilizar as ferramentas de inteligência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Funcional</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu.email@instituicao.gov.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Sua senha" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-center">
          <Link href="/request-access" className="mt-4">
            <Button variant="link" className="text-sm text-muted-foreground">
              Não tem uma conta? Solicite acesso aqui.
            </Button>
          </Link>
          <Link href="/" className="mt-2">
            <Button variant="link" size="sm" className="text-xs text-muted-foreground">
              <ArrowLeft className="mr-1 h-3 w-3" /> Voltar para a página inicial
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-6">
            Problemas para acessar? Contate o administrador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
