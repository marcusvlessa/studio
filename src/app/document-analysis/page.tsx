"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileUp, RotateCcw, Search, Loader2, FileTextIcon, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeDocument, type AnalyzeDocumentInput, type AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DocumentAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeDocumentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Updated to allow more document types, aligning with typical GenAI capabilities
      const allowedTypes = [
        "application/pdf", 
        "application/msword", // .doc
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "text/plain", // .txt
        "image/png", 
        "image/jpeg",
        "image/gif",
        "image/webp"
      ];

      if (allowedTypes.includes(file.type) || file.name.endsWith(".txt")) {
        setSelectedFile(file);
        setAnalysisResult(null);
        setProgress(0);

        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFilePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setFilePreview(null);
        }
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo PDF, Word, TXT ou imagem (PNG, JPG, GIF, WEBP)." });
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Selecionado", description: "Por favor, selecione um arquivo para analisar." });
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
        clearInterval(progressInterval);
      }
    }, 100);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async (e) => {
        const fileDataUri = e.target?.result as string;
        if (!fileDataUri) {
          toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Não foi possível ler o conteúdo do arquivo."});
          setIsLoading(false);
          clearInterval(progressInterval);
          setProgress(0);
          return;
        }
        
        setProgress(50); 

        const input: AnalyzeDocumentInput = { 
            fileDataUri,
            fileName: selectedFile.name
        };
        const result = await analyzeDocument(input);
        setAnalysisResult(result);
        setProgress(100);
        toast({ title: "Análise Concluída", description: "Documento processado com sucesso." });
      };
      reader.onerror = () => {
        throw new Error("Erro ao ler o arquivo.");
      }
    } catch (error) {
      console.error("Erro na análise do documento:", error);
      toast({ variant: "destructive", title: "Falha na Análise", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da análise foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Documentos</h1>
        <p className="text-muted-foreground">Envie e processe arquivos PDF, Word, TXT ou imagens para análise.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Documento</CardTitle>
          <CardDescription>Selecione um arquivo (PDF, DOCX, TXT, PNG, JPG) para iniciar a análise. OCR será aplicado a imagens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="document-upload">Arquivo do Documento</Label>
            <Input 
                id="document-upload" 
                type="file" 
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/gif,image/webp" 
                onChange={handleFileChange} 
            />
          </div>
          {selectedFile && (
            <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                <FileTextIcon className="h-5 w-5" />
                <div>
                    <p className="font-semibold">{selectedFile.name}</p>
                    <p>({ (selectedFile.size / 1024).toFixed(2) } KB) - Tipo: {selectedFile.type || "Desconhecido"}</p>
                </div>
            </div>
          )}
          {filePreview && selectedFile?.type.startsWith("image/") && (
            <div>
              <Label>Pré-visualização da Imagem:</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreview} alt="Preview" className="mt-2 max-h-60 w-auto rounded border" />
            </div>
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
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando..." : "Analisar Documento"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Info className="h-6 w-6 text-primary" /> Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p><strong>Nome do Arquivo:</strong> {selectedFile?.name || "N/A"}</p>
                    <p><strong>Idioma Detectado:</strong> {analysisResult.language ? analysisResult.language.toUpperCase() : "Não detectado"}</p>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileTextIcon className="h-6 w-6 text-primary" /> Resumo do Documento</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={analysisResult.summary} readOnly rows={8} className="bg-muted/50" />
                </CardContent>
            </Card>

            {analysisResult.keyEntities && analysisResult.keyEntities.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CheckCircle className="h-6 w-6 text-green-500" /> Entidades Chave Identificadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {analysisResult.keyEntities.map((entity, index) => (
                                <Badge key={index} variant="secondary" className="text-sm py-1 px-2">
                                    <strong>{entity.type}:</strong> {entity.value}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {analysisResult.extractedText && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileTextIcon className="h-6 w-6 text-primary" /> Texto Extraído Completo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/50">
                         <pre className="text-sm whitespace-pre-wrap">{analysisResult.extractedText}</pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {!analysisResult.extractedText && !isLoading && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="h-6 w-6 text-yellow-500" /> Texto Extraído</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Nenhum texto foi extraído ou o documento não continha texto legível.</p>
                    </CardContent>
                </Card>
            )}
        </div>
      )}
    </div>
  );
}
