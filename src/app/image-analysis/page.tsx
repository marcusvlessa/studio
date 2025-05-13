// src/app/image-analysis/page.tsx
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
import { FileImage, Search, RotateCcw, Loader2, Sparkles, Smile, FolderKanban, Info, Car, GalleryHorizontalEnd, Download } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { analyzeImage, type AnalyzeImageInput, type AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import Image from "next/image"; 
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ImageCaseAnalysis } from "@/types/case";
import { Badge } from "@/components/ui/badge";

const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function ImageAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeImageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";

  const saveAnalysisToCase = async (aiOutput: AnalyzeImageOutput) => {
    if (!caseId || !selectedFile) return;

    const analysisEntry: Omit<ImageCaseAnalysis, 'id' | 'analysisDate'> = {
      type: "Imagem",
      summary: `Análise de imagem: ${selectedFile.name} - ${aiOutput.description.substring(0, 50)}...`,
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
        throw new Error(errorData.error || 'Falha ao salvar análise no caso.');
      }
      toast({ title: "Análise Salva no Caso", description: `Resultados da imagem "${selectedFile.name}" vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error("Erro ao salvar análise no caso:", error);
      toast({ variant: "destructive", title: "Falha ao Salvar Análise", description: error instanceof Error ? error.message : String(error) });
    }
  };

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
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso." });
      return;
    }
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
      if (currentProgress <= 90) { 
        setProgress(currentProgress);
      }
    }, 300);

    try {
      if (!imagePreview) {
          throw new Error("Pré-visualização da imagem não está disponível.");
      }
      const photoDataUri = imagePreview;
      
      setProgress(30); 

      const input: AnalyzeImageInput = { photoDataUri };
      const result = await analyzeImage(input);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Análise de Imagem Concluída", description: `Imagem "${selectedFile.name}" processada para o caso "${caseName}".` });
      await saveAnalysisToCase(result);

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

  const handleDownloadEnhancedImage = () => {
    if (analysisResult?.enhancedPhotoDataUri && selectedFile) {
      const link = document.createElement('a');
      link.href = analysisResult.enhancedPhotoDataUri;
      
      const originalFileName = selectedFile.name;
      const extensionIndex = originalFileName.lastIndexOf('.');
      const baseName = extensionIndex > 0 ? originalFileName.substring(0, extensionIndex) : originalFileName;
      const extension = extensionIndex > 0 ? originalFileName.substring(extensionIndex) : '.png'; // Default to png if no ext
      
      link.download = `${baseName}_aprimorada${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({title: "Download Iniciado", description: "A imagem aprimorada está sendo baixada."});
    } else {
      toast({variant: "destructive", title: "Download Falhou", description: "Nenhuma imagem aprimorada disponível para download."});
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Imagens</h1>
        <p className="text-muted-foreground">Envie imagens para análise por IA, geração de descrição, leitura de placas, sugestões de melhoria, detecção facial e melhoramento de imagem.</p>
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
              Qualquer análise realizada aqui será vinculada a este caso.
            </AlertDescription>
          </ShadAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enviar Imagem</CardTitle>
          <CardDescription>Selecione um arquivo de imagem (PNG, JPG, GIF, etc.) com no máximo {MAX_FILE_SIZE_MB}MB para iniciar a análise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Arquivo de Imagem</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading || !isCaseSelected}/>
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileImage className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB)
            </p>
          )}
          {imagePreview && (
            <div className="mt-4">
              <Label>Pré-visualização da Imagem Original:</Label>
              <div className="mt-2 w-full max-w-md aspect-video relative overflow-hidden rounded-md border shadow-sm bg-muted/30">
                <Image src={imagePreview} alt="Preview da Imagem Original" layout="fill" objectFit="contain" data-ai-hint="foto imagem" />
              </div>
            </div>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress <= 30 && "Preparando imagem..."}
                {progress > 30 && progress < 70 && "Analisando texto e objetos na imagem..."}
                {progress >= 70 && progress < 100 && "Gerando imagem aprimorada e finalizando..."}
                {progress === 100 && "Concluído!"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !isCaseSelected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Imagem..." : "Analisar Imagem"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resultados da Análise Textual e Detecção</CardTitle>
              {caseName && <CardDescription>Referente ao caso: {caseName}</CardDescription>}
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

              {analysisResult.vehicleDetails && analysisResult.vehicleDetails.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold mb-2 flex items-center"><Car className="mr-2 h-5 w-5 text-primary"/> Detalhes de Veículos Detectados</h3>
                  <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="vehicle-details">
                      <AccordionTrigger className="text-sm py-2">Ver Detalhes dos Veículos ({analysisResult.vehicleDetails.length})</AccordionTrigger>
                      <AccordionContent>
                          <ul className="list-disc list-inside space-y-2 text-sm pl-2">
                              {analysisResult.vehicleDetails.map((vehicle, index) => (
                                  <li key={index} className="p-2 border rounded-md bg-muted/20">
                                      <strong>Veículo {index + 1}:</strong>
                                      {vehicle.make && ` Marca: ${vehicle.make}.`}
                                      {vehicle.model && ` Modelo: ${vehicle.model}.`}
                                      {vehicle.confidence !== undefined && ` Confiança: ${(vehicle.confidence * 100).toFixed(0)}%.`}
                                      {(!vehicle.make && !vehicle.model && vehicle.confidence === undefined) && " Sem detalhes adicionais."}
                                  </li>
                              ))}
                          </ul>
                      </AccordionContent>
                      </AccordionItem>
                  </Accordion>
                </div>
              )}

              {analysisResult.enhancementSuggestions && analysisResult.enhancementSuggestions.length > 0 && (
                  <div>
                      <h3 className="text-md font-semibold mb-2 flex items-center"><Sparkles className="mr-2 h-5 w-5 text-primary"/> Sugestões de Melhoramento de Imagem (Técnicas)</h3>
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
                                      <ul className="list-disc list-inside space-y-2 text-sm pl-2">
                                      {analysisResult.facialRecognition.details.map((detail, index) => (
                                          <li key={index} className="p-2 border rounded-md bg-muted/20">
                                              <strong>Face {index + 1}:</strong> 
                                              {detail.estimatedAge && ` Idade Estimada: ${detail.estimatedAge}.`}
                                              {detail.attributesDescription && ` Atributos: ${detail.attributesDescription}.`}
                                              {detail.confidence !== undefined && ` Confiança: ${(detail.confidence * 100).toFixed(0)}%.`}
                                              {detail.boundingBox && ` Posição: [${detail.boundingBox.join(', ')}].`}
                                              {(!detail.estimatedAge && !detail.attributesDescription && detail.confidence === undefined && !detail.boundingBox) && " Sem detalhes adicionais."}
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
          
          {analysisResult.enhancedPhotoDataUri && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><GalleryHorizontalEnd className="h-6 w-6 text-primary"/> Imagem Melhorada pela IA</div>
                   <Button variant="outline" size="sm" onClick={handleDownloadEnhancedImage}>
                     <Download className="mr-2 h-4 w-4" /> Baixar Imagem Aprimorada
                   </Button>
                </CardTitle>
                <CardDescription>Esta é a versão da imagem aprimorada pela IA para melhor visualização de detalhes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mt-2 w-full max-w-xl mx-auto aspect-video relative overflow-hidden rounded-md border shadow-lg bg-muted/30">
                  <Image src={analysisResult.enhancedPhotoDataUri} alt="Imagem Melhorada pela IA" layout="fill" objectFit="contain" data-ai-hint="foto melhorada" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ImageAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <ImageAnalysisContent />
    </Suspense>
  )
}

    
