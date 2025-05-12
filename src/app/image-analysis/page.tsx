"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileImage, Search, RotateCcw, Loader2, Sparkles, Smile } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { analyzeImage, type AnalyzeImageInput, type AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import Image from "next/image"; 
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ImageAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeImageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo de imagem (PNG, JPG, etc.)." });
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: "destructive",
          title: "Arquivo Muito Grande",
          description: `O tamanho máximo da imagem é ${MAX_FILE_SIZE_MB}MB. O arquivo selecionado tem ${(file.size / (1024*1024)).toFixed(2)}MB.`,
        });
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      
      setSelectedFile(file);
      setAnalysisResult(null); 
      setProgress(0);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast({ title: "Imagem Selecionada", description: file.name });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !imagePreview) {
      toast({ variant: "destructive", title: "Nenhuma Imagem Selecionada", description: "Por favor, selecione um arquivo de imagem para analisar." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setAnalysisResult(null);
    
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
      // Ensure imagePreview is not null, although previous check should cover it.
      if (!imagePreview) {
          throw new Error("Pré-visualização da imagem não está disponível.");
      }
      const photoDataUri = imagePreview;
      
      setProgress(50); // Image ready, AI call starting

      const input: AnalyzeImageInput = { photoDataUri };
      const result = await analyzeImage(input);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Análise de Imagem Concluída", description: "Imagem processada com sucesso." });
    } catch (error) {
      console.error("Erro na análise de imagem:", error);
      toast({ variant: "destructive", title: "Falha na Análise", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Imagem e resultados da análise foram limpos." });
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Imagens</h1>
        <p className="text-muted-foreground">Envie imagens para análise por IA, geração de descrição, leitura de placas, sugestões de melhoria e detecção facial.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Imagem</CardTitle>
          <CardDescription>Selecione um arquivo de imagem (PNG, JPG, GIF, etc.) com no máximo {MAX_FILE_SIZE_MB}MB para iniciar a análise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Arquivo de Imagem</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading}/>
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileImage className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB)
            </p>
          )}
          {imagePreview && (
            <div className="mt-4">
              <Label>Pré-visualização da Imagem:</Label>
              <div className="mt-2 w-full max-w-md aspect-video relative overflow-hidden rounded-md border shadow-sm bg-muted/30">
                <Image src={imagePreview} alt="Preview" layout="fill" objectFit="contain" />
              </div>
            </div>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress}%
                {progress < 35 && " (Iniciando...)"}
                {progress >= 35 && progress < 50 && " (Preparando imagem...)"}
                {progress >= 50 && progress < 100 && " (Analisando com IA...)"}
                {progress === 100 && " (Concluído!)"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Imagem..." : "Analisar Imagem"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Análise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="description-output">Descrição Gerada:</Label>
              <Textarea id="description-output" value={analysisResult.description} readOnly rows={6} className="bg-muted/50 mt-1" />
            </div>
            
            {analysisResult.possiblePlateRead && (
              <div>
                <Label htmlFor="plate-output">Possível Leitura de Placa:</Label>
                <Input id="plate-output" value={analysisResult.possiblePlateRead} readOnly className="bg-muted/50 font-mono text-lg mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Nota: Leituras de placa são sugestivas e podem não ser 100% precisas.</p>
              </div>
            )}
            {!analysisResult.possiblePlateRead && analysisResult.possiblePlateRead !== undefined && (
                 <p className="text-sm text-muted-foreground">Nenhuma placa de veículo detectada com confiança.</p>
            )}

            {analysisResult.enhancementSuggestions && analysisResult.enhancementSuggestions.length > 0 && (
                <div>
                    <h3 className="text-md font-semibold mb-2 flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary"/> Sugestões de Melhoramento de Imagem</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm pl-2 bg-muted/30 p-3 rounded-md">
                        {analysisResult.enhancementSuggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            )}

            {analysisResult.facialRecognition && (
                <div>
                     <h3 className="text-md font-semibold mb-2 flex items-center"><Smile className="mr-2 h-5 w-5 text-primary"/> Detecção Facial</h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                        <p className="text-sm"><strong>Faces Detectadas:</strong> {analysisResult.facialRecognition.facesDetected}</p>
                        {analysisResult.facialRecognition.facesDetected > 0 && analysisResult.facialRecognition.details && analysisResult.facialRecognition.details.length > 0 && (
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="face-details">
                                <AccordionTrigger className="text-sm py-2">Ver Detalhes das Faces</AccordionTrigger>
                                <AccordionContent>
                                    <ul className="list-disc list-inside space-y-1 text-sm pl-2">
                                    {analysisResult.facialRecognition.details.map((detail, index) => (
                                        <li key={index}>
                                            Face {index + 1}: 
                                            {detail.confidence && ` Confiança: ${(detail.confidence * 100).toFixed(0)}%.`}
                                            {detail.attributes && Object.keys(detail.attributes).length > 0 && ` Atributos: ${Object.entries(detail.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}.`}
                                            {detail.boundingBox && ` Posição: [${detail.boundingBox.join(', ')}].`}
                                            {(!detail.confidence && (!detail.attributes || Object.keys(detail.attributes).length === 0) && !detail.boundingBox) && " Sem detalhes adicionais."}
                                        </li>
                                    ))}
                                    </ul>
                                </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                         <p className="text-xs text-muted-foreground mt-1">Nota: A detecção facial indica a presença de faces e características gerais, não realiza identificação pessoal.</p>
                    </div>
                </div>
            )}

          </CardContent>
        </Card>
      )}
    </div>
  );
}

