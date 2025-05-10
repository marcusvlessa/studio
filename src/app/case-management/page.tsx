// src/app/case-management/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, PlusCircle, Trash2, Edit3, ListChecks, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CaseAnalysis {
  id: string;
  type: string; // e.g., "Documento", "Áudio", "Imagem"
  summary: string;
  originalFileName?: string;
  analysisDate: string;
}

interface Case {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  status: "Aberto" | "Em Investigação" | "Resolvido" | "Fechado";
  relatedAnalyses: CaseAnalysis[];
}

export default function CaseManagementPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  const [caseName, setCaseName] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [caseStatus, setCaseStatus] = useState<Case["status"]>("Aberto");

  const { toast } = useToast();

  const resetForm = () => {
    setCaseName("");
    setCaseDescription("");
    setCaseStatus("Aberto");
    setEditingCase(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!caseName.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome do caso é obrigatório." });
      return;
    }

    const now = new Date().toISOString();

    if (editingCase) {
      setCases(cases.map(c => c.id === editingCase.id ? { ...editingCase, name: caseName, description: caseDescription, status: caseStatus, lastModified: now } : c));
      toast({ title: "Caso Atualizado", description: `O caso "${caseName}" foi atualizado com sucesso.` });
    } else {
      const newCase: Case = {
        id: crypto.randomUUID(),
        name: caseName,
        description: caseDescription,
        dateCreated: now,
        lastModified: now,
        status: caseStatus,
        relatedAnalyses: [],
      };
      setCases([newCase, ...cases]);
      toast({ title: "Caso Criado", description: `O caso "${caseName}" foi criado com sucesso.` });
    }
    
    resetForm();
    setIsFormOpen(false);
  };

  const handleEdit = (caseToEdit: Case) => {
    setEditingCase(caseToEdit);
    setCaseName(caseToEdit.name);
    setCaseDescription(caseToEdit.description);
    setCaseStatus(caseToEdit.status);
    setIsFormOpen(true);
  };

  const handleDelete = (caseId: string) => {
    setCases(cases.filter(c => c.id !== caseId));
    toast({ title: "Caso Excluído", description: "O caso foi excluído." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Casos Investigativos</h1>
          <p className="text-muted-foreground">Crie, visualize e gerencie seus casos de investigação.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if(!isOpen) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingCase(null); resetForm(); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Caso
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingCase ? "Editar Caso" : "Criar Novo Caso"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="caseName" className="text-right">Nome</Label>
                <Input id="caseName" value={caseName} onChange={(e) => setCaseName(e.target.value)} className="col-span-3" placeholder="Ex: Operação Fênix" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="caseDescription" className="text-right">Descrição</Label>
                <Textarea id="caseDescription" value={caseDescription} onChange={(e) => setCaseDescription(e.target.value)} className="col-span-3" placeholder="Breve descrição do caso..." />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="caseStatus" className="text-right">Status</Label>
                <select id="caseStatus" value={caseStatus} onChange={(e) => setCaseStatus(e.target.value as Case["status"])} className="col-span-3 border border-input rounded-md p-2 text-sm">
                    <option value="Aberto">Aberto</option>
                    <option value="Em Investigação">Em Investigação</option>
                    <option value="Resolvido">Resolvido</option>
                    <option value="Fechado">Fechado</option>
                </select>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancelar</Button></DialogClose>
                <Button type="submit">{editingCase ? "Salvar Alterações" : "Criar Caso"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {cases.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="flex flex-col items-center gap-4">
            <FolderKanban className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum caso criado ainda.</p>
            <p className="text-sm text-muted-foreground">Clique em "Novo Caso" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {c.name}
                     <span className={`text-xs px-2 py-1 rounded-full ${
                        c.status === "Aberto" ? "bg-blue-100 text-blue-700" :
                        c.status === "Em Investigação" ? "bg-yellow-100 text-yellow-700" :
                        c.status === "Resolvido" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                     }`}>{c.status}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">Criado em: {new Date(c.dateCreated).toLocaleDateString('pt-BR')} | Modificado: {new Date(c.lastModified).toLocaleDateString('pt-BR')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-3">{c.description || "Sem descrição."}</p>
                  <div className="mt-4">
                      <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase flex items-center"><ListChecks className="w-3.5 h-3.5 mr-1"/> Análises Vinculadas: ({c.relatedAnalyses.length})</h4>
                      {c.relatedAnalyses.length > 0 ? (
                        <ul className="text-xs list-disc list-inside pl-1 text-muted-foreground">
                          {c.relatedAnalyses.slice(0,3).map(an => <li key={an.id} className="truncate">{an.type}: {an.summary || an.originalFileName}</li>)}
                          {c.relatedAnalyses.length > 3 && <li>... e mais {c.relatedAnalyses.length - 3}.</li>}
                        </ul>
                      ) : <p className="text-xs text-muted-foreground italic">Nenhuma análise vinculada.</p>}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Excluir
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      <p className="text-xs text-muted-foreground text-center mt-4">Nota: A gestão de casos é atualmente client-side e os dados não são persistidos no servidor.</p>
    </div>
  );
}
