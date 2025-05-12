
// src/app/audio-analysis/page.tsx
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
import { Mic, FileAudio, RotateCcw, Loader2, List, AlertCircle, CheckCircle, Files, Combine, BookText, FolderKanban, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { transcribeAudio, type TranscribeAudioInput, type TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";
import { consolidateAudioAnalyses, type ConsolidateAudioAnalysesInput, type ConsolidateAudioAnalysesOutput } from "@/ai/flows/consolidate-audio-analyses-flow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AudioCaseAnalysis, AudioConsolidatedCaseAnalysis } from "@/types/case";


interface AudioFileResult {
  id: string;
  file: File;
  dataUri?: string;
  output?: TranscribeAudioOutput;
  error?: string;
  status: "pending" | "reading" | "analyzing" | "completed" | "failed";
  progress: number;
}

function AudioAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [audioFileResults, setAudioFileResults] = useState<AudioFileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidatedReport, setConsolidatedReport] = useState<string | null>(null);
  const [caseContext, setCaseContext] = useState(""); 
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";
  const allFilesAnalyzed = audioFileResults.length > 0 && audioFileResults.every(f => f.status === "completed" || f.status === "failed");
  const atLeastOneSuccess = audioFileResults.some(f => f.status === "completed" && f.output);

  useEffect(() => {
    if (audioFileResults.length === 0 && consolidatedReport) {
      setConsolidatedReport(null);
    }
  }, [audioFileResults, consolidatedReport]);

  const saveAnalysisToCase = async (
    type: "Áudio" | "Áudio Consolidado",
    fileName: string | undefined,
    summary: string,
    data: TranscribeAudioOutput | ConsolidateAudioAnalysesOutput
  ) => {
    if (!caseId) return;

    let analysisEntry: Omit<AudioCaseAnalysis | AudioConsolidatedCaseAnalysis, 'id' | 'analysisDate'>;

    if (type === "Áudio") {
      analysisEntry = {
        type: "Áudio",
        summary: summary,
        originalFileName: fileName,
        data: data as TranscribeAudioOutput,
      };
    } else {
      analysisEntry = {
        type: "Áudio Consolidado",
        summary: summary,
        originalFileName: "Consolidado", // Or a more descriptive name
        data: data as ConsolidateAudioAnalysesOutput,
      };
    }
    
    try {
      const response = await fetch(`/api/cases/${caseId}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Falha ao salvar análise de ${type} no caso.`);
      }
      toast({ title: `Análise de ${type} Salva`, description: `Resultados de "${fileName || type}" vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error(`Erro ao salvar análise de ${type}:`, error);
      toast({ variant: "destructive", title: `Falha ao Salvar Análise de ${type}`, description: error instanceof Error ? error.message : String(error) });
    }
  };


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newAudioFiles: AudioFileResult[] = Array.from(files)
        .filter(file => file.type.startsWith("audio/"))
        .map(file => ({
          id: crypto.randomUUID(),
          file,
          status: "pending",
          progress: 0,
        }));

      if (newAudioFiles.length === 0 && files.length > 0) {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie apenas arquivos de áudio." });
      }
      
      setAudioFileResults(prevResults => {
        const allFiles = [...prevResults, ...newAudioFiles];
        const uniqueFiles = allFiles.filter((fileResult, index, self) =>
          index === self.findIndex((f) => (
            f.file.name === fileResult.file.name && f.file.size === fileResult.file.size
          ))
        );
        return uniqueFiles;
      });
      
      if (newAudioFiles.length > 0) {
        toast({ title: `${newAudioFiles.length} Arquivo(s) de Áudio Selecionado(s)`, description: "Pronto para análise." });
        setConsolidatedReport(null); 
      }
       if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const updateFileStatus = (id: string, updates: Partial<AudioFileResult>) => {
    setAudioFileResults(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleAnalyzeAll = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso." });
      return;
    }
    const filesToProcess = audioFileResults.filter(f => f.status === 'pending' || f.status === 'failed');
    if (filesToProcess.length === 0) {
      toast({ variant: "default", title: "Nenhum Arquivo Novo para Analisar", description: "Todos os arquivos selecionados já foram processados ou não há arquivos pendentes." });
      return;
    }

    setIsProcessing(true);
    setConsolidatedReport(null); 
    toast({ title: "Iniciando Análise em Lote", description: `Processando ${filesToProcess.length} arquivo(s) de áudio para o caso "${caseName}".` });

    for (const audioFile of filesToProcess) {
      updateFileStatus(audioFile.id, { status: "reading", progress: 5, error: undefined, output: undefined });
      
      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioFile.file);

        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error("Erro ao ler o arquivo."));
        });
        
        updateFileStatus(audioFile.id, { dataUri, status: "reading", progress: 30 });

        updateFileStatus(audioFile.id, { status: "analyzing", progress: 50 });
        const input: TranscribeAudioInput = { audioDataUri: dataUri };
        const result = await transcribeAudio(input);
        updateFileStatus(audioFile.id, { output: result, status: "completed", progress: 100 });
        
        await saveAnalysisToCase(
          "Áudio",
          audioFile.file.name,
          `Análise de áudio: ${audioFile.file.name} - Resumo: ${result.report.substring(0,50)}...`,
          result
        );


      } catch (error: any) {
        console.error(`Erro na transcrição de ${audioFile.file.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
        updateFileStatus(audioFile.id, { error: errorMessage, status: "failed", progress: 0 });
        toast({ variant: "destructive", title: `Falha na Análise (${audioFile.file.name})`, description: errorMessage });
      }
    }
    setIsProcessing(false);
    toast({ title: "Processamento em Lote Concluído", description: "Todos os arquivos pendentes foram processados." });
  };

  const handleConsolidateReports = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso." });
      return;
    }
    const successfulAnalyses = audioFileResults.filter(
      (f) => f.status === "completed" && f.output
    );

    if (successfulAnalyses.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma Análise Bem-Sucedida",
        description: "Não há relatórios de áudio para consolidar.",
      });
      return;
    }

    setIsConsolidating(true);
    setConsolidatedReport(null);
    toast({
      title: "Iniciando Consolidação de Relatórios",
      description: `Consolidando ${successfulAnalyses.length} análise(s) de áudio para o caso "${caseName}". Pode levar alguns instantes.`,
    });

    try {
      const input: ConsolidateAudioAnalysesInput = {
        analyses: successfulAnalyses.map((f) => ({
          fileName: f.file.name,
          transcript: f.output!.transcript,
          report: f.output!.report,
        })),
        caseContext: caseContext || `Relatório consolidado para o caso: ${caseName}`,
      };

      const result = await consolidateAudioAnalyses(input);
      setConsolidatedReport(result.consolidatedReport);
      
      await saveAnalysisToCase(
        "Áudio Consolidado",
        `Relatório Consolidado - ${new Date().toLocaleDateString('pt-BR')}`,
        `Relatório consolidado de ${successfulAnalyses.length} áudios. Contexto: ${caseContext.substring(0,50)}...`,
        result
      );

    } catch (error: any) {
      console.error("Erro na consolidação dos relatórios:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Ocorreu um erro desconhecido durante a consolidação.";
      toast({
        variant: "destructive",
        title: "Falha na Consolidação",
        description: errorMessage,
      });
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleReset = () => {
    setAudioFileResults([]);
    setIsProcessing(false);
    setIsConsolidating(false);
    setConsolidatedReport(null);
    setCaseContext("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Lista de arquivos e resultados limpos." });
  };

  const removeFile = (idToRemove: string) => {
    setAudioFileResults(prev => prev.filter(f => f.id !== idToRemove));
    toast({ title: "Arquivo Removido", description: "O arquivo foi removido da lista." });
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Transcrição e Análise de Áudios Investigativa</h1>
        <p className="text-muted-foreground">Envie múltiplos arquivos de áudio para transcrição, identificação de interlocutores e geração de relatórios de investigação criminal, incluindo um relatório consolidado.</p>
      </header>

      {!isCaseSelected && (
        <ShadAlert variant="destructive" className="mb-4">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>Nenhum Caso Selecionado!</AlertTitle>
          <AlertDescription>
            Por favor, vá para a página de <Link href="/case-management?newCase=true" className="font-semibold underline">Gestão de Casos</Link> para selecionar ou criar um caso antes de prosseguir com a análise.
          </AlertDescription>
        </ShadAlert>
      )}

      {isCaseSelected && (
         <ShadAlert variant="default" className="mb-4 bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Analisando para o Caso: {caseName}</AlertTitle>
            <AlertDescription>
              Todas as análises realizadas aqui serão vinculadas a este caso.
            </AlertDescription>
          </ShadAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivos de Áudio</CardTitle>
          <CardDescription>Selecione um ou mais arquivos de áudio (ex: MP3, WAV, OGG). Cada arquivo será analisado individualmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="audio-upload">Arquivos de Áudio</Label>
            <Input id="audio-upload" type="file" accept="audio/*" multiple onChange={handleFileChange} ref={fileInputRef} disabled={isProcessing || isConsolidating || !isCaseSelected} />
          </div>
          
          {audioFileResults.length > 0 && (
            <div className="space-y-2">
              <Label>Arquivos Selecionados ({audioFileResults.length}):</Label>
              <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                <ul className="space-y-1">
                  {audioFileResults.map((af) => (
                    <li key={af.id} className="text-sm text-muted-foreground flex justify-between items-center p-1 hover:bg-muted/50 rounded">
                      <div className="flex items-center gap-2 truncate">
                        <FileAudio className="h-4 w-4 shrink-0" />
                        <span className="truncate" title={af.file.name}>{af.file.name} ({(af.file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        {af.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                        {af.status === "reading" && <Badge variant="secondary" className="animate-pulse">Lendo...</Badge>}
                        {af.status === "analyzing" && <Badge variant="secondary" className="animate-pulse">Analisando...</Badge>}
                        {af.status === "completed" && <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-3 w-3"/>Concluído</Badge>}
                        {af.status === "failed" && <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/>Falha</Badge>}
                      </div>
                       <Button variant="ghost" size="sm" onClick={() => removeFile(af.id)} disabled={(isProcessing && af.status === 'analyzing') || isConsolidating} className="shrink-0">
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {isProcessing && audioFileResults.some(f => f.status === 'analyzing' || f.status === 'reading') && (
            <div className="space-y-2">
              <Label>Progresso da Análise em Lote:</Label>
              {audioFileResults.filter(f => f.status === 'analyzing' || f.status === 'reading').map(f => (
                <div key={`progress-${f.id}`} className="mb-1">
                    <p className="text-xs text-muted-foreground">{f.file.name}: {f.progress}%</p>
                    <Progress value={f.progress} className="w-full h-1.5" />
                </div>
              ))}
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={handleAnalyzeAll} disabled={audioFileResults.filter(f=> f.status === 'pending' || f.status === 'failed').length === 0 || isProcessing || isConsolidating || !isCaseSelected}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
            {isProcessing ? "Analisando Áudios..." : `Analisar ${audioFileResults.filter(f=> f.status === 'pending' || f.status === 'failed').length} Áudio(s)`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isProcessing || isConsolidating}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Tudo
          </Button>
        </CardFooter>
      </Card>

      {audioFileResults.filter(ar => ar.status === "completed" || ar.status === "failed").length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><List className="h-6 w-6 text-primary"/>Resultados das Análises Individuais</CardTitle>
                <CardDescription>Resultados para cada arquivo de áudio processado.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="multiple" className="w-full space-y-3">
                    {audioFileResults.filter(ar => ar.status === "completed" || ar.status === "failed").map((audioFile) => (
                        <AccordionItem value={audioFile.id} key={audioFile.id} className="border rounded-lg bg-card shadow-sm">
                            <AccordionTrigger className="p-4 text-md font-semibold hover:no-underline">
                                <div className="flex items-center gap-2 w-full">
                                    {audioFile.status === "completed" && <CheckCircle className="h-5 w-5 text-green-500 shrink-0"/>}
                                    {audioFile.status === "failed" && <AlertCircle className="h-5 w-5 text-destructive shrink-0"/>}
                                    <span className="truncate" title={audioFile.file.name}>{audioFile.file.name}</span>
                                    <Badge variant={audioFile.status === "completed" ? "default" : "destructive"} className={`ml-auto ${audioFile.status === "completed" ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                                      {audioFile.status === "completed" ? "Sucesso" : "Falha"}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0 space-y-4">
                                {audioFile.output && (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <Label htmlFor={`transcript-${audioFile.id}`} className="font-medium">Transcrição:</Label>
                                            <ScrollArea className="h-[200px] mt-1">
                                                <Textarea id={`transcript-${audioFile.id}`} value={audioFile.output.transcript} readOnly rows={8} className="bg-muted/50 text-xs" />
                                            </ScrollArea>
                                        </div>
                                        <div>
                                            <Label htmlFor={`report-${audioFile.id}`} className="font-medium">Relatório de Investigação Criminal:</Label>
                                            <ScrollArea className="h-[200px] mt-1">
                                                <Textarea id={`report-${audioFile.id}`} value={audioFile.output.report} readOnly rows={8} className="bg-muted/50 text-xs" />
                                            </ScrollArea>
                                        </div>
                                    </div>
                                )}
                                {audioFile.error && (
                                    <div>
                                        <Label htmlFor={`error-${audioFile.id}`} className="font-medium text-destructive">Detalhes do Erro:</Label>
                                        <Textarea id={`error-${audioFile.id}`} value={audioFile.error} readOnly rows={3} className="bg-destructive/10 text-destructive text-xs mt-1" />
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                 </Accordion>
            </CardContent>
        </Card>
      )}

      {allFilesAnalyzed && atLeastOneSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Combine className="h-6 w-6 text-primary"/>Consolidação de Relatórios</CardTitle>
            <CardDescription>Gere um relatório unificado a partir de todas as análises de áudio bem-sucedidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="case-context">Contexto do Caso (Opcional)</Label>
              <Textarea
                id="case-context"
                value={caseContext}
                onChange={(e) => setCaseContext(e.target.value)}
                placeholder="Forneça um breve contexto sobre o caso para ajudar na consolidação..."
                rows={3}
                disabled={isConsolidating || isProcessing || !isCaseSelected}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleConsolidateReports} disabled={isConsolidating || isProcessing || !atLeastOneSuccess || !isCaseSelected}>
              {isConsolidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookText className="mr-2 h-4 w-4"/>}
              {isConsolidating ? "Consolidando Relatórios..." : "Gerar Relatório Consolidado"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {consolidatedReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookText className="h-6 w-6 text-primary"/>Relatório Consolidado Final</CardTitle>
            {caseName && <CardDescription>Referente ao caso: {caseName}</CardDescription>}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/50">
              <pre className="text-sm whitespace-pre-wrap">{consolidatedReport}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AudioAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <AudioAnalysisContent />
    </Suspense>
  )
}
