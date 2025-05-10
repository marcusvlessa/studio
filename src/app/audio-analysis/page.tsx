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
        clearInterval(progressInterval);
      }
    }, 100);


    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async (e) => {
        const audioDataUri = e.target?.result as string;
        if (!audioDataUri) {
          throw new Error("Não foi possível ler o arquivo.");
        }
        
        setProgress(50);

        const input: TranscribeAudioInput = { audioDataUri };
        const result = await transcribeAudio(input);
        setTranscriptionResult(result);
        setProgress(100);
        toast({ title: "Transcrição Concluída", description: "Áudio processado com sucesso." });
      };
      reader.onerror = () => {
        throw new Error("Erro ao ler o arquivo.");
      }
    } catch (error) {
      console.error("Erro na transcrição:", error);
      toast({ variant: "destructive", title: "Falha na Transcrição", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval); 
      setIsLoading(false);
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
            <Input id="audio-upload" type="file" accept="audio/*" onChange={handleFileChange} ref={fileInputRef} />
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileAudio className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{progress}% {progress < 100 && progress > 30 ? "(Processando...)" : ""}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
            {isLoading ? "Transcrevendo..." : "Transcrever Áudio"}
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
