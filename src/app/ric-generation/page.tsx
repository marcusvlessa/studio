// src/app/ric-generation/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { NotebookText, Loader2, Download, FolderKanban, Info } from "lucide-react";
import { generateRic, type GenerateRicInput, type GenerateRicOutput } from "@/ai/flows/generate-ric-flow";
import type { Case } from "../case-management/page"; // Import Case interface
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CASE_STORAGE_KEY = "investigationCases";

const getCasesFromStorage = (): Case[] => {
  if (typeof window !== 'undefined') {
    const storedCases = localStorage.getItem(CASE_STORAGE_KEY);
    return storedCases ? JSON.parse(storedCases) : [];
  }
  return [];
};

function RicGenerationContent() {
  const searchParams = useSearchParams();
  const preselectedCaseId = searchParams.get("caseId");

  const [allCases, setAllCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(preselectedCaseId);
  const [generatedRic, setGeneratedRic] = useState<GenerateRicOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAllCases(getCasesFromStorage());
  }, []);
  
  useEffect(() => {
    // If preselectedCaseId changes (e.g. navigation), update selectedCaseId
    setSelectedCaseId(preselectedCaseId);
    setGeneratedRic(null); // Clear previous RIC if case changes
  }, [preselectedCaseId]);


  const selectedCaseDetails = allCases.find(c => c.id === selectedCaseId);

  const handleGenerateRic = async () => {
    if (!selectedCaseId || !selectedCaseDetails) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, selecione um caso para gerar o RIC." });
      return;
    }
    if (selectedCaseDetails.relatedAnalyses.length === 0) {
      toast({ variant: "default", title: "Nenhuma Análise", description: "Este caso não possui análises vinculadas para gerar um RIC." });
      // Optionally, still proceed to generate a basic RIC structure
    }

    setIsLoading(true);
    setGeneratedRic(null);

    try {
      const input: GenerateRicInput = {
        caseName: selectedCaseDetails.name,
        caseDescription: selectedCaseDetails.description,
        // Map CaseAnalysis to AnalysisItemSchema if necessary, current structures are compatible
        analyses: selectedCaseDetails.relatedAnalyses.map(analysis => ({
          type: analysis.type,
          summary: analysis.summary,
          sourceFileName: analysis.originalFileName,
        })),
      };
      
      const result = await generateRic(result);
      setGeneratedRic(result);
      toast({ title: "RIC Gerado", description: `RIC para o caso "${selectedCaseDetails.name}" foi gerado com sucesso.` });

    } catch (error) {
      console.error("Erro ao gerar RIC:", error);
      toast({ variant: "destructive", title: "Falha na Geração do RIC", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadRic = () => {
    if (!generatedRic || !selectedCaseDetails) return;
    const blob = new Blob([generatedRic.reportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `RIC_${selectedCaseDetails.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({title: "Download Iniciado", description: "O RIC está sendo baixado como arquivo de texto."});
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Geração de Relatório de Investigação Criminal (RIC)</h1>
        <p className="text-muted-foreground">Selecione um caso para consolidar as informações e gerar um RIC automaticamente.</p>
      </header>

      {!preselectedCaseId && allCases.length === 0 && (
         <ShadAlert variant="destructive" className="mb-4">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>Nenhum Caso Disponível!</AlertTitle>
          <AlertDescription>
            Não há casos na <Link href="/case-management?newCase=true" className="font-semibold underline">Gestão de Casos</Link>. Crie um caso primeiro.
          </AlertDescription>
        </ShadAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Caso</CardTitle>
          <CardDescription>Escolha um caso existente para iniciar a geração do relatório.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select 
            onValueChange={(value) => {setSelectedCaseId(value); setGeneratedRic(null);}} 
            value={selectedCaseId || undefined}
            disabled={allCases.length === 0}
          >
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Selecione um caso..." />
            </SelectTrigger>
            <SelectContent>
              {allCases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.relatedAnalyses.length} análises)
                </SelectItem>
              ))}
              {allCases.length === 0 && <div className="p-2 text-sm text-muted-foreground text-center">Nenhum caso cadastrado. <Link href="/case-management?newCase=true" className="font-semibold underline">Crie um caso</Link>.</div>}
            </SelectContent>
          </Select>
          {selectedCaseDetails && (
            <ShadAlert variant="default" className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Caso Selecionado: {selectedCaseDetails.name}</AlertTitle>
                <AlertDescription>
                    {selectedCaseDetails.description || "Sem descrição detalhada."}
                    <br/>
                    Análises vinculadas: {selectedCaseDetails.relatedAnalyses.length}
                </AlertDescription>
            </ShadAlert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateRic} disabled={!selectedCaseId || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookText className="mr-2 h-4 w-4" />}
            {isLoading ? "Gerando RIC..." : "Gerar RIC"}
          </Button>
        </CardFooter>
      </Card>

      {isLoading && !generatedRic && (
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Aguarde, o relatório está sendo gerado pela IA...</p>
          </CardContent>
        </Card>
      )}

      {generatedRic && (
        <Card>
          <CardHeader>
            <CardTitle>RIC Gerado para: {selectedCaseDetails?.name}</CardTitle>
            <CardDescription>Abaixo está o conteúdo do Relatório de Investigação Criminal. As análises são baseadas nos dados salvos no caso.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={generatedRic.reportContent} readOnly rows={25} className="bg-muted/50 text-sm font-mono" />
          </CardContent>
          <CardFooter>
            <Button onClick={handleDownloadRic}>
                <Download className="mr-2 h-4 w-4" /> Baixar RIC (TXT)
            </Button>
          </CardFooter>
        </Card>
      )}
       <p className="text-xs text-muted-foreground text-center mt-4">Nota: A funcionalidade de vincular e salvar análises de outros módulos aos casos é conceitual e usa LocalStorage. Para persistência real, seria necessária integração com backend.</p>
    </div>
  );
}

export default function RicGenerationPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RicGenerationContent />
    </Suspense>
  )
}
