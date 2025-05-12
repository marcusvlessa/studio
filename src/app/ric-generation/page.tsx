
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
import type { Case } from "@/types/case"; 
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function RicGenerationContent() {
  const searchParams = useSearchParams();
  const preselectedCaseId = searchParams.get("caseId");

  const [allCases, setAllCases] = useState<Case[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(preselectedCaseId || undefined);
  const [selectedCaseDetails, setSelectedCaseDetails] = useState<Case | null>(null);
  const [generatedRic, setGeneratedRic] = useState<GenerateRicOutput | null>(null);
  const [isLoadingRic, setIsLoadingRic] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCases = async () => {
      setIsLoadingCases(true);
      try {
        const response = await fetch('/api/cases');
        if (!response.ok) throw new Error('Falha ao buscar casos.');
        const data: Case[] = await response.json();
        setAllCases(data);
        if (preselectedCaseId && data.some(c => c.id === preselectedCaseId)) {
          setSelectedCaseId(preselectedCaseId);
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Erro ao Carregar Casos", description: error instanceof Error ? error.message : String(error) });
      } finally {
        setIsLoadingCases(false);
      }
    };
    fetchCases();
  }, [preselectedCaseId, toast]);
  
  useEffect(() => {
    // If preselectedCaseId changes (e.g. navigation), update selectedCaseId
    // and clear previous RIC and details
    if (preselectedCaseId && preselectedCaseId !== selectedCaseId) {
        setSelectedCaseId(preselectedCaseId);
        setSelectedCaseDetails(null);
        setGeneratedRic(null);
    }
  }, [preselectedCaseId, selectedCaseId]);

  useEffect(() => {
    const fetchCaseDetails = async () => {
      if (selectedCaseId) {
        setIsLoadingCases(true); // Use same loader for case details
        try {
          const response = await fetch(`/api/cases/${selectedCaseId}`);
          if (!response.ok) throw new Error('Falha ao buscar detalhes do caso.');
          const data: Case = await response.json();
          setSelectedCaseDetails(data);
        } catch (error) {
          toast({ variant: "destructive", title: "Erro ao Carregar Detalhes do Caso", description: error instanceof Error ? error.message : String(error) });
          setSelectedCaseDetails(null);
        } finally {
          setIsLoadingCases(false);
        }
      } else {
        setSelectedCaseDetails(null);
      }
    };
    fetchCaseDetails();
    setGeneratedRic(null); // Clear previous RIC if case selection changes
  }, [selectedCaseId, toast]);


  const handleGenerateRic = async () => {
    if (!selectedCaseId || !selectedCaseDetails) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, selecione um caso para gerar o RIC." });
      return;
    }
    if (selectedCaseDetails.relatedAnalyses.length === 0) {
      toast({ variant: "default", title: "Nenhuma Análise", description: "Este caso não possui análises vinculadas para gerar um RIC, mas um relatório básico será tentado." });
    }

    setIsLoadingRic(true);
    setGeneratedRic(null);

    try {
      const input: GenerateRicInput = {
        caseName: selectedCaseDetails.name,
        caseDescription: selectedCaseDetails.description,
        analyses: selectedCaseDetails.relatedAnalyses.map(analysis => ({
          type: analysis.type,
          summary: analysis.summary, // Using the concise summary from CaseAnalysis
          sourceFileName: analysis.originalFileName,
        })),
      };
      
      const result = await generateRic(input); // Corrected: use input variable
      setGeneratedRic(result);
      toast({ title: "RIC Gerado", description: `RIC para o caso "${selectedCaseDetails.name}" foi gerado com sucesso.` });

    } catch (error) {
      console.error("Erro ao gerar RIC:", error);
      toast({ variant: "destructive", title: "Falha na Geração do RIC", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
    } finally {
      setIsLoadingRic(false);
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

      {isLoadingCases && !selectedCaseId && (
         <ShadAlert variant="default" className="mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Carregando Casos...</AlertTitle>
          <AlertDescription>
            Buscando lista de casos investigativos.
          </AlertDescription>
        </ShadAlert>
      )}
      {!isLoadingCases && allCases.length === 0 && (
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
            onValueChange={(value) => {setSelectedCaseId(value);}} 
            value={selectedCaseId || ""}
            disabled={isLoadingCases || allCases.length === 0}
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
              {!isLoadingCases && allCases.length === 0 && <div className="p-2 text-sm text-muted-foreground text-center">Nenhum caso cadastrado. <Link href="/case-management?newCase=true" className="font-semibold underline">Crie um caso</Link>.</div>}
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
          <Button onClick={handleGenerateRic} disabled={!selectedCaseId || isLoadingRic || isLoadingCases}>
            {isLoadingRic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookText className="mr-2 h-4 w-4" />}
            {isLoadingRic ? "Gerando RIC..." : "Gerar RIC"}
          </Button>
        </CardFooter>
      </Card>

      {isLoadingRic && !generatedRic && (
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
       <p className="text-xs text-muted-foreground text-center mt-4">Nota: A gestão de casos utiliza uma API simulada com dados em memória. Para persistência real, seria necessária integração com banco de dados.</p>
    </div>
  );
}

export default function RicGenerationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <RicGenerationContent />
    </Suspense>
  )
}
