// src/app/financial-analysis/page.tsx
"use client";

import { useState, type ChangeEvent, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Landmark, Upload, RotateCcw, Search, Loader2, FileText, Info, AlertCircle, FolderKanban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeFinancialData, type AnalyzeFinancialDataInput, type AnalyzeFinancialDataOutput } from "@/ai/flows/analyze-financial-data-flow";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FinancialCaseAnalysis } from "@/types/case";
import { ScrollArea } from "@/components/ui/scroll-area";

function FinancialAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeFinancialDataOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caseContext, setCaseContext] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";

  const saveAnalysisToCase = async (aiOutput: AnalyzeFinancialDataOutput) => {
    if (!caseId || !selectedFile) return;

    const summary = `Análise Financeira (RIF): ${selectedFile.name}. Relatório gerado.`;

    const analysisEntry: Omit<FinancialCaseAnalysis, 'id' | 'analysisDate'> = {
      type: "Financeiro",
      summary: summary,
      originalFileName: selectedFile.name,
      data: aiOutput,
    };
    
    try {
      const response = await fetch(`/api/cases/${caseId}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar análise financeira no caso.');
      }
      toast({ title: "Análise Financeira Salva", description: `Resultados de "${selectedFile.name}" vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error("Erro ao salvar análise financeira:", error);
      toast({ variant: "destructive", title: "Falha ao Salvar Análise", description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        setSelectedFile(file);
        setAnalysisResult(null);
        setProgress(0);
        toast({ title: "Arquivo .txt Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie apenas arquivos .txt gerados pelo ExtratorIF." });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso antes de prosseguir." });
      return;
    }
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Selecionado", description: "Por favor, selecione um arquivo .txt para analisar." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setAnalysisResult(null);
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress <= 90) { 
        setProgress(currentProgress);
      }
    }, 500); // Slower interval for financial analysis

    try {
      const rifTextContent = await selectedFile.text();
      setProgress(30); 

      const input: AnalyzeFinancialDataInput = { 
        rifTextContent, 
        originalFileName: selectedFile.name,
        caseContext: caseContext || `Análise RIF para o caso: ${caseName}`,
       };
      const result = await analyzeFinancialData(input);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Análise Financeira Concluída", description: `Arquivo RIF "${selectedFile.name}" processado para o caso "${caseName}".` });
      await saveAnalysisToCase(result);

    } catch (error) {
      console.error("Erro na análise financeira:", error);
      toast({ variant: "destructive", title: "Falha na Análise Financeira", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    setCaseContext("");
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivos e resultados da análise financeira foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center"><Landmark className="mr-3 h-8 w-8 text-primary"/>Módulo de Análise Financeira (RIF/COAF)</h1>
        <p className="text-muted-foreground mt-1">
          Use a ferramenta <a href="https://admin.eforenses.kmdf.com.br/public/download/extratorif.exe" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">ExtratorIF.exe</a> para gerar um arquivo .txt a partir dos documentos RIF do COAF. Em seguida, envie o arquivo .txt gerado para análise.
        </p>
      </header>

      {!isCaseSelected && (
        <ShadAlert variant="destructive" className="mb-4">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>Nenhum Caso Selecionado!</AlertTitle>
          <AlertDescription>
            Por favor, vá para a página de <Link href="/case-management?newCase=true" className="font-semibold underline">Gestão de Casos</Link> para selecionar ou criar um caso antes de prosseguir.
          </AlertDescription>
        </ShadAlert>
      )}

      {isCaseSelected && (
         <ShadAlert variant="default" className="mb-4 bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Analisando para o Caso: {caseName}</AlertTitle>
            <AlertDescription>
              Qualquer análise financeira realizada aqui será vinculada a este caso.
            </AlertDescription>
          </ShadAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo .txt do RIF</CardTitle>
          <CardDescription>Selecione o arquivo .txt gerado pelo ExtratorIF para iniciar a análise financeira.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-md items-center gap-1.5">
            <Label htmlFor="rif-upload">Arquivo .txt (ExtratorIF)</Label>
            <Input id="rif-upload" type="file" accept=".txt,text/plain" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading || !isCaseSelected}/>
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileText className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="case-context">Contexto Adicional do Caso (Opcional)</Label>
            <Textarea 
              id="case-context" 
              value={caseContext} 
              onChange={(e) => setCaseContext(e.target.value)} 
              placeholder="Forneça informações contextuais sobre a investigação que podem ajudar a IA a focar a análise financeira (ex: suspeitos principais, tipo de crime investigado, período de maior interesse)..." 
              rows={3}
              disabled={isLoading || !isCaseSelected}
              className="max-w-xl"
            />
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise Financeira:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress <= 30 && "Lendo arquivo..."}
                {progress > 30 && progress < 100 && "Analisando dados financeiros com IA (pode levar alguns minutos)..."}
                {progress === 100 && "Concluído!"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !isCaseSelected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Dados..." : "Analisar Dados Financeiros"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Relatório de Inteligência Financeira (RIF)</CardTitle>
            {selectedFile && <CardDescription>Resultado da análise do arquivo: {selectedFile.name}</CardDescription>}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/50">
              <pre className="text-sm whitespace-pre-wrap font-sans">{analysisResult.financialIntelligenceReport}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
       {analysisResult && !analysisResult.financialIntelligenceReport && !isLoading && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center font-semibold">Nenhum relatório gerado.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  A IA pode não ter conseguido processar o arquivo ou gerar o relatório. Verifique o console para possíveis erros.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FinancialAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <FinancialAnalysisContent />
    </Suspense>
  )
}
