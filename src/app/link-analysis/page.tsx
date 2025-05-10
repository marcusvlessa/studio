
"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GitFork, Search, RotateCcw, Loader2, FileText, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { analyzeDocument, type AnalyzeDocumentInput } from "@/ai/flows/analyze-document-flow"; // Import for PDF processing
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkAnalysisGraph } from "@/components/link-analysis/LinkAnalysisGraph";

export default function LinkAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [relationships, setRelationships] = useState<FindEntityRelationshipsOutput['relationships'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("Analisando Vínculos...");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedExtensions = [".csv", ".txt", ".pdf", ".xls", ".xlsx", ".anb", ".anx"];
      const fileExtensionSupported = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (fileExtensionSupported) {
        setSelectedFile(file);
        setRelationships(null);
        setProgress(0);
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: `Por favor, envie um arquivo com uma das seguintes extensões: ${allowedExtensions.join(", ")}.` });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  const parseEntitiesFromText = (text: string): string[] => {
    const entities = new Set<string>();
    let potentialEntities = text.split(/\r?\n/); // New lines

    if (potentialEntities.length < 10 && text.includes(',')) { // If few lines, also try commas
        potentialEntities = [...potentialEntities, ...text.split(',')];
    }
    if (potentialEntities.length < 10 && text.includes(';')) { // And semicolons
        potentialEntities = [...potentialEntities, ...text.split(';')];
    }
     if (potentialEntities.length < 10 && text.includes('\t')) { // And tabs
        potentialEntities = [...potentialEntities, ...text.split('\t')];
    }

    potentialEntities.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine.length > 1 && trimmedLine.length < 200) { 
            entities.add(trimmedLine);
        }
    });
    
    return Array.from(entities).filter(e => e.length > 0);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Fornecido", description: "Por favor, envie um arquivo para análise." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setProcessingMessage("Iniciando análise...");
    setRelationships(null);

    let entities: string[] = [];

    try {
      if (selectedFile.type === "application/pdf") {
        setProgress(10);
        setProcessingMessage("Lendo arquivo PDF...");
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        
        await new Promise<void>((resolve, reject) => {
            reader.onloadend = async (e) => {
                const fileDataUri = e.target?.result as string;
                if (!fileDataUri) {
                    toast({ variant: "destructive", title: "Erro ao Ler PDF", description: "Não foi possível ler o conteúdo do arquivo PDF."});
                    reject(new Error("Erro ao ler PDF"));
                    return;
                }
                setProgress(30);
                setProcessingMessage("Extraindo texto do PDF com IA...");
                try {
                    const docInput: AnalyzeDocumentInput = { fileDataUri, fileName: selectedFile.name };
                    const docResult = await analyzeDocument(docInput);
                    setProgress(60);
                    setProcessingMessage("Processando texto extraído...");
                    if (docResult.extractedText) {
                        entities = parseEntitiesFromText(docResult.extractedText);
                    } else {
                        toast({ variant: "destructive", title: "Extração de Texto Falhou", description: "Não foi possível extrair texto do PDF." });
                    }
                    resolve();
                } catch (pdfError) {
                    reject(pdfError);
                }
            };
            reader.onerror = () => {
                 toast({ variant: "destructive", title: "Erro ao Ler PDF", description: "Ocorreu um erro ao tentar ler o arquivo PDF."});
                 reject(new Error("Erro no reader do PDF."));
            }
        });

      } else if (selectedFile.type === "text/csv" || selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt") || selectedFile.name.toLowerCase().endsWith(".csv")) {
        setProgress(20);
        setProcessingMessage("Lendo arquivo de texto...");
        const fileText = await selectedFile.text();
        setProgress(50);
        setProcessingMessage("Extraindo entidades do texto...");
        entities = parseEntitiesFromText(fileText);
      } else {
        // For XLS, XLSX, ANB, ANX - show warning, attempt text extraction (might fail or be garbage)
        toast({ 
            variant: "default", 
            title: "Formato de Arquivo Complexo", 
            description: "Para arquivos como XLS, XLSX, ANB, ANX, a extração automática de entidades é limitada. Tentaremos uma extração de texto básica. Para melhores resultados, converta para CSV/TXT ou cole o conteúdo relevante.",
            duration: 8000,
        });
        setProgress(20);
        setProcessingMessage("Tentando ler arquivo complexo...");
        try {
            const fileText = await selectedFile.text(); // This will likely be garbled for binary files
            setProgress(50);
            setProcessingMessage("Extraindo entidades (pode ser limitado)...");
            entities = parseEntitiesFromText(fileText);
        } catch (readError) {
            toast({ variant: "destructive", title: "Erro ao Ler Arquivo Complexo", description: "Não foi possível ler o conteúdo. Considere converter para TXT/CSV." });
            setIsLoading(false);
            setProgress(0);
            return;
        }
      }

      if (entities.length === 0) {
        toast({ variant: "destructive", title: "Nenhuma Entidade Encontrada", description: "O arquivo não contém entidades válidas ou está mal formatado para extração automática." });
        setIsLoading(false);
        setProgress(0);
        return;
      }
      
      setProgress(70);
      setProcessingMessage("Analisando vínculos com IA...");
      const input: FindEntityRelationshipsInput = { entities };
      const result = await findEntityRelationships(input);
      setRelationships(result.relationships);
      setProgress(100);

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
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRelationships(null);
    setIsLoading(false);
    setProgress(0);
    setProcessingMessage("Analisando Vínculos...");
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da análise de vínculos foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Vínculos</h1>
        <p className="text-muted-foreground">Envie arquivos (TXT, CSV, PDF, XLS, XLSX, ANB, ANX) com entidades para identificar e visualizar seus relacionamentos.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo de Entidades</CardTitle>
          <CardDescription>
            Forneça um arquivo contendo as entidades (ex: nomes, telefones, empresas, locais) para analisar suas conexões.
            Para arquivos PDF, o texto será extraído. Para CSV/TXT, as entidades serão extraídas por linha ou delimitadores comuns.
            Formatos como XLS, XLSX, ANB, ANX têm suporte limitado para extração automática.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo</Label>
            <Input 
              id="entities-file-upload" 
              type="file" 
              accept=".csv,.txt,.pdf,.xls,.xlsx,.anb,.anx,text/csv,text/plain,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              disabled={isLoading}
            />
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
                {progress}% ({processingMessage})
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando..." : "Encontrar Vínculos"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      <Alert variant="default" className="mt-4">
        <HelpCircle className="h-4 w-4" />
        <AlertTitle>Dicas para Melhor Análise</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside text-xs">
            <li>Para arquivos <strong>CSV/TXT</strong>: certifique-se que as entidades estão separadas por linha, vírgula, ponto e vírgula ou tabulação.</li>
            <li>Arquivos <strong>PDF</strong>: o texto será extraído automaticamente para identificar entidades. PDFs baseados em imagem podem não ter bons resultados.</li>
            <li>Arquivos <strong>XLS/XLSX/ANB/ANX</strong>: A extração automática é complexa. Para melhores resultados, converta os dados relevantes para CSV ou TXT, ou cole o texto diretamente.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Visual Graph Section */}
      {relationships && relationships.length > 0 && !isLoading && (
        <LinkAnalysisGraph relationshipsData={relationships} />
      )}


      {/* Tabular/List View of Relationships - Kept for detailed textual view */}
      {relationships && relationships.length > 0 && !isLoading && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lista de Vínculos Identificados</CardTitle>
            <CardDescription>Abaixo estão as conexões potenciais encontradas entre as entidades do arquivo em formato de lista.</CardDescription>
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
      
      {/* Message for no relationships found */}
      {relationships && relationships.length === 0 && !isLoading && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Nenhum vínculo direto encontrado para as entidades fornecidas no arquivo.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Verifique se o arquivo está formatado corretamente e contém dados válidos, ou se o conteúdo textual extraído foi suficiente.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

