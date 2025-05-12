"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Mic, FileAudio, RotateCcw, Loader2, List, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { transcribeAudio, type TranscribeAudioInput, type TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AudioFileResult {
  id: string;
  file: File;
  dataUri?: string;
  output?: TranscribeAudioOutput;
  error?: string;
  status: "pending" | "reading" | "analyzing" | "completed" | "failed";
  progress: number;
}

export default function AudioAnalysisPage() {
  const [audioFileResults, setAudioFileResults] = useState<AudioFileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      setAudioFileResults(prevResults => [...prevResults, ...newAudioFiles].filter((v,i,a)=>a.findIndex(t=>(t.file.name === v.file.name && t.file.size === v.file.size))===i)); // Add new files and remove duplicates
      
      if (newAudioFiles.length > 0) {
        toast({ title: `${newAudioFiles.length} Arquivo(s) de Áudio Selecionado(s)`, description: "Pronto para análise." });
      }
       // Clear the input value to allow selecting the same file(s) again after removal/reset
       if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const updateFileStatus = (id: string, updates: Partial<AudioFileResult>) => {
    setAudioFileResults(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleAnalyzeAll = async () => {
    if (audioFileResults.filter(f => f.status === 'pending' || f.status === 'failed').length === 0) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Novo para Analisar", description: "Todos os arquivos selecionados já foram processados ou não há arquivos pendentes." });
      return;
    }

    setIsProcessing(true);
    toast({ title: "Iniciando Análise", description: `Processando ${audioFileResults.filter(f => f.status === 'pending' || f.status === 'failed').length} arquivo(s) de áudio.` });

    for (const audioFile of audioFileResults) {
      if (audioFile.status !== "pending" && audioFile.status !== "failed") continue; // Skip already processed or in-process files

      updateFileStatus(audioFile.id, { status: "reading", progress: 5 });
      
      try {
        const reader = new FileReader();
        const dataUriPromise = new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error("Erro ao ler o arquivo."));
          reader.readAsDataURL(audioFile.file);
        });

        const audioDataUri = await dataUriPromise;
        updateFileStatus(audioFile.id, { dataUri: audioDataUri, status: "reading", progress: 30 });

        updateFileStatus(audioFile.id, { status: "analyzing", progress: 50 });
        const input: TranscribeAudioInput = { audioDataUri };
        const result = await transcribeAudio(input);
        updateFileStatus(audioFile.id, { output: result, status: "completed", progress: 100 });
        toast({ title: "Transcrição Concluída", description: `Áudio "${audioFile.file.name}" processado com sucesso.` });

      } catch (error: any) {
        console.error(`Erro na transcrição de ${audioFile.file.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
        updateFileStatus(audioFile.id, { error: errorMessage, status: "failed", progress: 0 });
        toast({ variant: "destructive", title: `Falha na Transcrição (${audioFile.file.name})`, description: errorMessage });
      }
    }
    setIsProcessing(false);
    toast({ title: "Processamento em Lote Concluído", description: "Todos os arquivos pendentes foram processados." });
  };

  const handleReset = () => {
    setAudioFileResults([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Lista de arquivos e resultados limpos." });
  };

  const removeFile = (id: string) => {
    setAudioFileResults(prev => prev.filter(f => f.id !== id));
    toast({ title: "Arquivo Removido", description: "O arquivo foi removido da lista." });
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Transcrição e Análise de Áudios</h1>
        <p className="text-muted-foreground">Envie múltiplos arquivos de áudio para gerar transcrições e relatórios de análise individuais.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivos de Áudio</CardTitle>
          <CardDescription>Selecione um ou mais arquivos de áudio (ex: MP3, WAV, OGG) para iniciar a análise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="audio-upload">Arquivos de Áudio</Label>
            <Input id="audio-upload" type="file" accept="audio/*" multiple onChange={handleFileChange} ref={fileInputRef} disabled={isProcessing} />
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
                        {af.status === "reading" && <Badge variant="secondary">Lendo...</Badge>}
                        {af.status === "analyzing" && <Badge variant="secondary">Analisando...</Badge>}
                        {af.status === "completed" && <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-3 w-3"/>Concluído</Badge>}
                        {af.status === "failed" && <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3"/>Falha</Badge>}
                      </div>
                       <Button variant="ghost" size="sm" onClick={() => removeFile(af.id)} disabled={isProcessing && af.status === 'analyzing'} className="shrink-0">
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
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyzeAll} disabled={audioFileResults.filter(f=> f.status === 'pending' || f.status === 'failed').length === 0 || isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
            {isProcessing ? "Analisando Áudios..." : `Analisar ${audioFileResults.filter(f=> f.status === 'pending' || f.status === 'failed').length} Áudio(s)`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Tudo
          </Button>
        </CardFooter>
      </Card>

      {audioFileResults.filter(ar => ar.status === "completed" || ar.status === "failed").length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><List className="h-6 w-6 text-primary"/>Resultados das Análises</CardTitle>
                <CardDescription>Resultados individuais para cada arquivo de áudio processado.</CardDescription>
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
                                    <Badge variant={audioFile.status === "completed" ? "default" : "destructive"} className={`ml-auto ${audioFile.status === "completed" ? 'bg-green-500' : ''}`}>
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
                                            <Label htmlFor={`report-${audioFile.id}`} className="font-medium">Relatório de Análise:</Label>
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
    </div>
  );
}

    