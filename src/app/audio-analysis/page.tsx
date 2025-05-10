"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Mic, FileAudio, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { transcribeAudio, type TranscribeAudioInput, type TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";

export default function AudioAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscribeAudioOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("audio/")) {
        setSelectedFile(file);
        setTranscriptionResult(null); 
        setProgress(0);
        toast({ title: "Arquivo de Áudio Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo de áudio." });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Selecionado", description: "Por favor, selecione um arquivo de áudio para transcrever." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setTranscriptionResult(null);
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress <= 30) { 
        setProgress(currentProgress);
      } else {
        // Hold progress
      }
    }, 200);


    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async (e) => {
        clearInterval(progressInterval);
        const audioDataUri = e.target?.result as string;
        if (!audioDataUri) {
          setIsLoading(false);
          setProgress(0);
          toast({variant: "destructive", title: "Erro ao Ler Arquivo", description: "Não foi possível ler o conteúdo do arquivo de áudio."});
          return;
        }
        
        setProgress(50); // File read, AI call starting

        try {
            const input: TranscribeAudioInput = { audioDataUri };
            const result = await transcribeAudio(input);
            setTranscriptionResult(result);
            setProgress(100);
            toast({ title: "Transcrição Concluída", description: "Áudio processado com sucesso." });
        } catch (aiError) {
            console.error("Erro na chamada da IA:", aiError);
            toast({ variant: "destructive", title: "Falha na Análise por IA", description: aiError instanceof Error ? aiError.message : "Ocorreu um erro durante a análise pela IA." });
            setProgress(0); // Reset progress on AI error
        } finally {
            setIsLoading(false); // Set loading to false after AI call (success or failure)
        }
      };
      reader.onerror = () => {
        clearInterval(progressInterval);
        setIsLoading(false);
        setProgress(0);
        toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Ocorreu um erro ao tentar ler o arquivo de áudio."});
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Erro na transcrição:", error);
      toast({ variant: "destructive", title: "Falha na Transcrição", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
      setIsLoading(false); // Ensure loading is false on catch
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTranscriptionResult(null);
    setIsLoading(false);
    setProgress(0);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da transcrição foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Transcrição e Análise de Áudio</h1>
        <p className="text-muted-foreground">Envie arquivos de áudio para gerar transcrições e relatórios de análise.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo de Áudio</CardTitle>
          <CardDescription>Selecione um arquivo de áudio (ex: MP3, WAV, OGG) para iniciar a análise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="audio-upload">Arquivo de Áudio</Label>
            <Input id="audio-upload" type="file" accept="audio/*" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading}/>
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileAudio className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB)
            </p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress}%
                {progress < 35 && " (Iniciando...)"}
                {progress >= 35 && progress < 50 && " (Preparando áudio...)"}
                {progress >= 50 && progress < 100 && " (Transcrevendo com IA...)"}
                {progress === 100 && " (Concluído!)"}
                </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
            {isLoading ? "Transcrevendo Áudio..." : "Transcrever Áudio"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {transcriptionResult && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Transcrição</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={transcriptionResult.transcript} readOnly rows={15} className="bg-muted/50" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Relatório de Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={transcriptionResult.report} readOnly rows={15} className="bg-muted/50" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
