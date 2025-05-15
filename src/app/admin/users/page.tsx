// src/app/admin/users/page.tsx
"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, PlusCircle, Loader2, Edit, Trash2 } from "lucide-react";
import type { RegisteredUser } from "@/types/user";

declare global {
  interface Window {
    electronAPI?: {
      registerUserElectron: (userData: Omit<RegisteredUser, 'id' | 'dateRegistered'>) => Promise<{ success: boolean; data?: RegisteredUser; error?: string }>;
      fetchRegisteredUsersElectron: () => Promise<RegisteredUser[]>;
      // deleteUserElectron: (userId: string) => Promise<{ success: boolean; error?: string }>; // Placeholder for future
    };
  }
}


export default function AdminUsersPage() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state for new user
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // Default role
  const [department, setDepartment] = useState("");

  const { toast } = useToast();

  const fetchUsers = async () => {
    if (!window.electronAPI?.fetchRegisteredUsersElectron) {
      toast({ variant: "destructive", title: "Erro", description: "API do Electron não disponível." });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedUsers = await window.electronAPI.fetchRegisteredUsersElectron();
      setUsers(fetchedUsers || []);
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao Carregar Usuários", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [toast]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("user");
    setDepartment("");
  };

  const handleSubmitNewUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !role.trim() || !department.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Todos os campos são obrigatórios." });
      return;
    }
    if (!window.electronAPI?.registerUserElectron) {
      toast({ variant: "destructive", title: "Erro", description: "API do Electron não disponível para registrar usuário." });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await window.electronAPI.registerUserElectron({ 
        name, 
        email, 
        password, // Sending plain text password for demo; DO NOT DO THIS IN PRODUCTION
        role, 
        department 
      });
      if (result.success) {
        toast({ title: "Usuário Registrado", description: `Usuário ${email} adicionado. A senha (simulada) foi logada no console do Electron.` });
        fetchUsers();
        resetForm();
        setIsFormOpen(false);
      } else {
        throw new Error(result.error || "Falha ao registrar usuário.");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao Registrar", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold flex items-center">
          <Users className="mr-3 h-6 w-6 text-primary" />
          Gerenciamento de Usuários Registrados
        </h2>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if(!isOpen) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Novo Usuário</DialogTitle>
               <CardDescription>Defina os dados e a senha inicial. A senha será mostrada ao administrador para repasse (simulação de envio de email).</CardDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitNewUser} className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="newUserName">Nome Completo</Label>
                <Input id="newUserName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do usuário" disabled={isSubmitting} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newUserEmail">Email Funcional</Label>
                <Input id="newUserEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" disabled={isSubmitting} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newUserPassword">Senha Inicial</Label>
                <Input id="newUserPassword" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Defina uma senha" disabled={isSubmitting} />
                 <p className="text-xs text-muted-foreground">Esta senha será mostrada ao administrador para repasse.</p>
              </div>
               <div className="space-y-1">
                <Label htmlFor="newUserRole">Função/Cargo</Label>
                <Input id="newUserRole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Analista, Agente" disabled={isSubmitting} />
              </div>
               <div className="space-y-1">
                <Label htmlFor="newUserDepartment">Lotação/Unidade</Label>
                <Input id="newUserDepartment" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: DEIC, DHPP" disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar Usuário
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Usuários registrados no sistema local. A persistência é feita via `electron-store`.
            Funcionalidades de edição e exclusão mais robustas seriam parte de uma implementação completa de backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Carregando usuários...</p>
            </div>
          ) : users.length === 0 ? (
             <p className="text-muted-foreground text-center py-4">Nenhum usuário registrado encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Lotação</TableHead>
                  <TableHead>Data Registro</TableHead>
                  {/* <TableHead>Ações</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>{new Date(user.dateRegistered).toLocaleDateString('pt-BR')}</TableCell>
                    {/* <TableCell className="space-x-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled><Edit className="h-3.5 w-3.5"/></Button>
                      <Button variant="destructive" size="icon" className="h-7 w-7" disabled><Trash2 className="h-3.5 w-3.5"/></Button>
                    </TableCell> */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        <div className="mt-8 p-4 border-dashed border-2 border-destructive/50 rounded-md bg-destructive/5">
          <h3 className="font-semibold text-destructive">Aviso de Segurança e Desenvolvimento:</h3>
          <ul className="list-disc list-inside text-sm text-destructive/90 mt-1 space-y-1">
            <li>O gerenciamento de usuários é **demonstrativo** e usa `electron-store`.</li>
            <li>**Senhas são armazenadas em texto plano**, o que é inseguro para produção.</li>
            <li>O envio de emails é simulado por logs no console.</li>
            <li>Funcionalidades avançadas como edição robusta, deleção segura, e controle de acesso baseado em papéis necessitam de um backend completo.</li>
          </ul>
        </div>
    </div>
  );
}
