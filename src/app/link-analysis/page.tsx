"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GitFork, Search, RotateCcw, Loader2, FileText, AlertCircle } from "lucide-react"; // Users icon removed as it wasn't used. FileUp removed.
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress"; // Added Progress component

export default function LinkAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [relationships, setRelationships] = useState<FindEntityRelationshipsOutput['relationships'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Added progress state
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // For now, primary focus is CSV, TXT.
      // Complex parsing for XLS, ANX, ANB is out of scope for simple client-side or LLM processing.
      const allowedTypes = ["text/csv", "text/plain"];
      const allowedExtensions = [".csv", ".txt"];
      
      const fileTypeSupported = allowedTypes.includes(file.type);
      const fileExtensionSupported = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (fileTypeSupported || fileExtensionSupported) {
        setSelectedFile(file);
        setRelationships(null);
        setProgress(0);
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo CSV ou TXT. Formatos como XLS, ANX, ANB não são suportados para extração direta de entidades no momento." });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  // Basic text parsing: assumes entities are line-separated or comma-separated.
  // This can be made more robust based on expected structures.
  const parseEntitiesFromText = (text: string): string[] => {
    const entities = new Set<string>();
    // Try splitting by new lines first
    let potentialEntities = text.split(/\r?\n/);

    // If mostly one line, or few lines, try splitting by comma as well
    if (potentialEntities.length < 5) {
        const commaEntities = text.split(',');
        potentialEntities = [...potentialEntities, ...commaEntities];
    }
    
    potentialEntities.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.length > 1 && trimmedLine.length < 200) { // Basic sanity check for entity length
            entities.add(trimmedLine);
        }
    });
    
    return Array.from(entities).filter(e => e.length > 0);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Fornecido", description: "Por favor, envie um arquivo CSV ou TXT com as entidades." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setRelationships(null);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 10; // Faster progress for this shorter operation
      if (currentProgress <= 40) { 
        setProgress(currentProgress);
      } else {
        // Hold progress
      }
    }, 150);

    try {
      const fileText = await selectedFile.text();
      setProgress(60); // File read

      const entities = parseEntitiesFromText(fileText);

      if (entities.length === 0) {
        toast({ variant: "destructive", title: "Nenhuma Entidade Encontrada", description: "O arquivo não contém entidades válidas ou está mal formatado para extração automática." });
        setIsLoading(false);
        clearInterval(progressInterval);
        setProgress(0);
        return;
      }
      
      setProgress(80); // Entities parsed, AI call starting
      const input: FindEntityRelationshipsInput = { entities };
      const result = await findEntityRelationships(input);
      setRelationships(result.relationships);
      setProgress(100); // Analysis complete

      if (result.relationships && result.relationships.length > 0) {
        toast({ title: "Análise de Vínculos Concluída", description: "Foram encontrados vínculos potenciais entre as entidades." });
      } else {
        toast({ title: "Análise de Vínculos Concluída", description: "Nenhum vínculo direto foi encontrado para as entidades fornecidas." });
      }
    } catch (error) {
      console.error("Erro na análise de vínculos:", error);
      toast({ variant: "destructive", title: "Falha na Análise", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao processar o arquivo ou analisar os vínculos." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRelationships(null);
    setIsLoading(false);
    setProgress(0);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da análise de vínculos foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Vínculos</h1>
        <p className="text-muted-foreground">Envie um arquivo CSV ou TXT com entidades para identificar e visualizar seus relacionamentos.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo de Entidades (CSV, TXT)</CardTitle>
          <CardDescription>
            Forneça um arquivo de texto (CSV ou TXT) contendo as entidades (ex: nomes, telefones, empresas, locais) para analisar suas conexões.
            O sistema tentará extrair entidades separadas por linha ou vírgula.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo (CSV, TXT)</Label>
            <Input id="entities-file-upload" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading}/>
          </div>
           {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileText className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB)
            </p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full h-2.5" />
              <p className="text-sm text-muted-foreground text-center">
                {progress}%
                {progress < 50 && " (Lendo arquivo...)"}
                {progress >= 50 && progress < 80 && " (Extraindo entidades...)"}
                {progress >= 80 && progress < 100 && " (Analisando vínculos com IA...)"}
                {progress === 100 && " (Concluído!)"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Vínculos..." : "Encontrar Vínculos"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {/* Removed the separate loading card as progress is now shown in the upload card */}

      {relationships && relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vínculos Identificados</CardTitle>
            <CardDescription>Abaixo estão as conexões potenciais encontradas entre as entidades do arquivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
              <div className="space-y-4">
                {relationships.map((rel, index) => (
                  <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 pt-4">
                        <div className="flex items-center justify-around gap-2 flex-wrap">
                            <div className="text-center">
                                <Badge variant="secondary" className="py-1 px-2 text-sm mb-1">{rel.entity1}</Badge>
                                {rel.entity1Type && <p className="text-xs text-muted-foreground">({rel.entity1Type})</p>}
                            </div>
                            <GitFork className="h-6 w-6 text-primary shrink-0 mx-2" />
                             <div className="text-center">
                                <Badge variant="secondary" className="py-1 px-2 text-sm mb-1">{rel.entity2}</Badge>
                                {rel.entity2Type && <p className="text-xs text-muted-foreground">({rel.entity2Type})</p>}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="mt-1 text-sm text-muted-foreground text-center italic">
                        "{rel.relationship}"
                      </p>
                      {rel.strength !== undefined && (
                        <div className="mt-2 text-center">
                            <Label htmlFor={`strength-${index}`} className="text-xs text-muted-foreground mr-2">Força:</Label>
                            <Progress id={`strength-${index}`} value={rel.strength * 100} className="h-2 w-24 inline-block" />
                            <span className="text-xs text-muted-foreground ml-1">({(rel.strength*100).toFixed(0)}%)</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      {relationships && relationships.length === 0 && !isLoading && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Nenhum vínculo direto encontrado para as entidades fornecidas no arquivo.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Verifique se o arquivo está formatado corretamente (entidades por linha ou separadas por vírgula) e contém dados válidos.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
