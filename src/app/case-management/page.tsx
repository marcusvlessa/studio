// src/app/case-management/page.tsx
"use client";

import { useState, type FormEvent, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, PlusCircle, Trash2, Edit3, ListChecks, FileText, FileSearch, Mic, GitFork, ImageIcon, NotebookText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "next/navigation";

interface CaseAnalysis {
  id: string;
  type: string; // e.g., "Documento", "Áudio", "Imagem", "Vínculo"
  summary: string;
  originalFileName?: string;
  analysisDate: string;
}

export interface Case {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  status: "Aberto" | "Em Investigação" | "Resolvido" | "Fechado";
  relatedAnalyses: CaseAnalysis[];
}

// Simple client-side storage for cases
const CASE_STORAGE_KEY = "investigationCases";

const getCasesFromStorage = (): Case[] => {
  if (typeof window !== 'undefined') {
    const storedCases = localStorage.getItem(CASE_STORAGE_KEY);
    return storedCases ? JSON.parse(storedCases) : [];
  }
  return [];
};

const saveCasesToStorage = (cases: Case[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(cases));
  }
};


export default function CaseManagementPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  const [caseName, setCaseName] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [caseStatus, setCaseStatus] = useState<Case["status"]>("Aberto");

  const { toast } = useToast();
  const searchParams = useSearchParams();
  const newCaseTrigger = searchParams.get('newCase');

  useEffect(() => {
    setCases(getCasesFromStorage());
  }, []);

  useEffect(() => {
    if (newCaseTrigger === 'true') {
      setIsFormOpen(true);
    }
  }, [newCaseTrigger]);

  useEffect(() => {
    saveCasesToStorage(cases);
  }, [cases]);


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
    let updatedCases;

    if (editingCase) {
      updatedCases = cases.map(c => c.id === editingCase.id ? { ...editingCase, name: caseName, description: caseDescription, status: caseStatus, lastModified: now } : c);
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
      updatedCases = [newCase, ...cases];
      toast({ title: "Caso Criado", description: `O caso "${caseName}" foi criado com sucesso.` });
    }
    setCases(updatedCases);
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
    const updatedCases = cases.filter(c => c.id !== caseId);
    setCases(updatedCases);
    toast({ title: "Caso Excluído", description: "O caso foi excluído." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Casos Investigativos</h1>
          <p className="text-muted-foreground">Crie, visualize e gerencie seus casos de investigação. Selecione um caso para vincular análises.</p>
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
                 <Select value={caseStatus} onValueChange={(value) => setCaseStatus(value as Case["status"])}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberto">Aberto</SelectItem>
                    <SelectItem value="Em Investigação">Em Investigação</SelectItem>
                    <SelectItem value="Resolvido">Resolvido</SelectItem>
                    <SelectItem value="Fechado">Fechado</SelectItem>
                  </SelectContent>
                </Select>
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
        <ScrollArea className="h-[calc(100vh-280px)]"> {/* Adjusted height */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate" title={c.name}>{c.name}</span>
                     <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        c.status === "Aberto" ? "bg-blue-100 text-blue-700" :
                        c.status === "Em Investigação" ? "bg-yellow-100 text-yellow-700" :
                        c.status === "Resolvido" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                     }`}>{c.status}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">Criado: {new Date(c.dateCreated).toLocaleDateString('pt-BR')} | Modif.: {new Date(c.lastModified).toLocaleDateString('pt-BR')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3 h-12">{c.description || "Sem descrição."}</p>
                  <div>
                      <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase flex items-center"><ListChecks className="w-3.5 h-3.5 mr-1"/> Análises Vinculadas: ({c.relatedAnalyses.length})</h4>
                      {c.relatedAnalyses.length > 0 ? (
                        <ul className="text-xs list-disc list-inside pl-1 text-muted-foreground">
                          {c.relatedAnalyses.slice(0,2).map(an => <li key={an.id} className="truncate" title={an.summary}>{an.type}: {an.summary || an.originalFileName}</li>)}
                          {c.relatedAnalyses.length > 2 && <li>... e mais {c.relatedAnalyses.length - 2}.</li>}
                        </ul>
                      ) : <p className="text-xs text-muted-foreground italic">Nenhuma análise vinculada.</p>}
                  </div>
                   <div className="grid grid-cols-2 gap-2 mt-auto pt-3">
                     <Button variant="outline" size="sm" asChild>
                        <Link href={`/document-analysis?caseId=${c.id}&caseName=${encodeURIComponent(c.name)}`}><FileSearch className="mr-1 h-3 w-3"/>Doc</Link>
                     </Button>
                     <Button variant="outline" size="sm" asChild>
                        <Link href={`/audio-analysis?caseId=${c.id}&caseName=${encodeURIComponent(c.name)}`}><Mic className="mr-1 h-3 w-3"/>Áudio</Link>
                     </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/image-analysis?caseId=${c.id}&caseName=${encodeURIComponent(c.name)}`}><ImageIcon className="mr-1 h-3 w-3"/>Imagem</Link>
                     </Button>
                     <Button variant="outline" size="sm" asChild>
                        <Link href={`/link-analysis?caseId=${c.id}&caseName=${encodeURIComponent(c.name)}`}><GitFork className="mr-1 h-3 w-3"/>Vínculo</Link>
                     </Button>
                   </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center gap-2 border-t pt-4">
                  <Button variant="default" size="sm" asChild>
                     <Link href={`/ric-generation?caseId=${c.id}`}><NotebookText className="mr-1 h-3 w-3"/>Gerar RIC</Link>
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                        <Edit3 className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      <p className="text-xs text-muted-foreground text-center mt-4">Nota: A gestão de casos utiliza o LocalStorage do navegador. Os dados não são persistidos no servidor.</p>
    </div>
  );
}

