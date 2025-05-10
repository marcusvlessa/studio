
"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitFork, Search, RotateCcw, Loader2, FileText, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { analyzeDocument, type AnalyzeDocumentInput } from "@/ai/flows/analyze-document-flow"; // Import for PDF processing
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkAnalysisGraph } from "@/components/link-analysis/LinkAnalysisGraph";

type AnalysisContextType = "Geral" | "Telefonia" | "Financeira" | "Pessoas" | "Digital";

export default function LinkAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [relationships, setRelationships] = useState<FindEntityRelationshipsOutput['relationships'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("Analisando Vínculos...");
  const [analysisContext, setAnalysisContext] = useState<AnalysisContextType>("Geral");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedExtensions = [".csv", ".txt", ".pdf", ".xls", ".xlsx", ".anb", ".anx"];
      const fileExtensionSupported = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type === "application/pdf" || file.type === "text/csv" || file.type === "text/plain";

      if (fileExtensionSupported) {
        setSelectedFile(file);
        setRelationships(null);
        setProgress(0);
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: `Por favor, envie um arquivo com uma das seguintes extensões: ${allowedExtensions.join(", ")} ou um tipo comum (PDF, CSV, TXT).` });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  const parseEntitiesFromText = (text: string): string[] => {
    const entities = new Set<string>();
    if (!text || text.trim() === "" || text.startsWith("AVISO DO SISTEMA:")) {
      return [];
    }
    const lines = text.split(/\r?\n/);

    const phonePattern = /^(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}$/;
    const imeiPattern = /^\d{15}$/; 
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/; 
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const plateOldPattern = /^[A-Z]{3}-?\d{4}$/i;
    const plateMercosulPattern = /^[A-Z]{3}\d[A-Z]\d{2}$/i;

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const potentialDelimiters = [',', ';', '\t', '|'];
      let cells: string[] = [trimmedLine]; 

      for (const delimiter of potentialDelimiters) {
        if (trimmedLine.includes(delimiter)) {
          const parts = trimmedLine.split(delimiter);
          if (parts.length > 1 && parts.some(p => p.trim() !== "")) { 
            cells = parts.map(p => p.trim()).filter(p => p !== "");
            break;
          }
        }
      }

      cells.forEach(cell => {
        if (!cell) return;

        let matchedSpecific = false;
        if (phonePattern.test(cell)) {
          entities.add(cell);
          matchedSpecific = true;
        } else if (imeiPattern.test(cell)) {
          entities.add(cell);
          matchedSpecific = true;
        } else if (ipPattern.test(cell)) {
          entities.add(cell);
          matchedSpecific = true;
        } else if (emailPattern.test(cell)) {
          entities.add(cell);
          matchedSpecific = true;
        } else if (plateOldPattern.test(cell) || plateMercosulPattern.test(cell)) {
          entities.add(cell.toUpperCase()); 
          matchedSpecific = true;
        }
        
        if (!matchedSpecific) {
          if (cell.length >= 2 && cell.length < 100 && !/^\W+$/.test(cell) && (isNaN(Number(cell)) || cell.length > 4)) {
            entities.add(cell);
          }
        }
      });
    });
    
    return Array.from(entities);
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

    let extractedTextForParsing = "";
    let actualTextExtracted = false;

    try {
      if (selectedFile.type === "text/csv" || selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt") || selectedFile.name.toLowerCase().endsWith(".csv")) {
        setProgress(20);
        setProcessingMessage(`Lendo arquivo de texto: ${selectedFile.name}...`);
        try {
            extractedTextForParsing = await selectedFile.text();
            actualTextExtracted = true;
            toast({ title: "Leitura de Texto Concluída", description: `Conteúdo de ${selectedFile.name} lido.` });
        } catch (textReadError) {
            console.error("Erro ao ler arquivo de texto:", textReadError);
            toast({ variant: "destructive", title: "Erro ao Ler Arquivo de Texto", description: `Não foi possível ler o conteúdo do arquivo ${selectedFile.name}. Análise de vínculos não pode prosseguir.` });
            setIsLoading(false); 
            setProgress(0);
            return; 
        }
      } else { 
        setProgress(10);
        setProcessingMessage(`Preparando arquivo ${selectedFile.name} para extração de texto...`);
        
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        
        await new Promise<void>((resolve, reject) => {
            reader.onloadend = async (e) => {
                const fileDataUri = e.target?.result as string;
                if (!fileDataUri) {
                    toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Não foi possível ler o conteúdo do arquivo. Análise de vínculos não pode prosseguir."});
                    reject(new Error("Erro ao ler arquivo: URI de dados vazia."));
                    return;
                }
                setProgress(30);
                setProcessingMessage("Extraindo texto do arquivo com IA (pode levar um momento)...");
                try {
                    const docInput: AnalyzeDocumentInput = { fileDataUri, fileName: selectedFile.name };
                    const docResult = await analyzeDocument(docInput); 
                    
                    if (docResult.extractedText && docResult.extractedText.length > 0) {
                        if (docResult.extractedText.startsWith("AVISO DO SISTEMA:")) {
                           toast({ variant: "default", title: "Extração de Texto Limitada", description: `Conteúdo de ${selectedFile.name} não pôde ser lido diretamente pela IA. A análise de vínculos não será realizada para este arquivo.` });
                           actualTextExtracted = false; 
                        } else {
                           extractedTextForParsing = docResult.extractedText;
                           actualTextExtracted = true;
                           toast({ title: "Extração de Texto Concluída", description: `Texto extraído de ${selectedFile.name} para análise de entidades.` });
                        }
                    } else {
                        toast({ variant: "default", title: "Extração de Texto Falhou", description: `Não foi possível extrair texto de ${selectedFile.name} ou o arquivo está vazio. Análise de vínculos não pode prosseguir.` });
                        actualTextExtracted = false;
                    }
                    resolve();
                } catch (extractionError) {
                    console.error("Erro na extração de texto:", extractionError);
                    toast({ variant: "destructive", title: "Erro na Extração de Texto", description: (extractionError instanceof Error ? extractionError.message : "Falha ao extrair texto do arquivo com IA.") + " Análise de vínculos não pode prosseguir."});
                    reject(extractionError);
                }
            };
            reader.onerror = (errorEvent) => { 
                 toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Ocorreu um erro ao tentar ler o arquivo. Análise de vínculos não pode prosseguir."});
                 reject(new Error(`Erro no leitor de arquivo ao processar ${selectedFile.name}. Detalhes: ${errorEvent.type}`));
            }
        });
      }

      if (!actualTextExtracted || !extractedTextForParsing) {
        // Toasts for specific failures already shown above.
        // This is a fallback or if previous logic didn't set isLoading to false.
        if(actualTextExtracted && !extractedTextForParsing){ // If actualTextExtracted was true, but extractedText is empty
             toast({ variant: "default", title: "Texto Extraído Vazio", description: "O texto extraído do arquivo está vazio. Análise de vínculos não pode prosseguir." });
        }
        setIsLoading(false);
        setProgress(0);
        return;
      }

      setProgress(50);
      setProcessingMessage("Extraindo entidades do texto processado...");
      const entities = parseEntitiesFromText(extractedTextForParsing);
      
      if (entities.length === 0) {
        toast({ variant: "default", title: "Nenhuma Entidade Válida Encontrada", description: "Não foi possível extrair entidades válidas do texto do arquivo para análise de vínculos." });
        setIsLoading(false);
        setProgress(0);
        return;
      }
      
      setProgress(70);
      setProcessingMessage(`Analisando ${entities.length} entidades com IA (Contexto: ${analysisContext})...`);
      const input: FindEntityRelationshipsInput = { entities, analysisContext };
      const result = await findEntityRelationships(input);
      setRelationships(result.relationships);
      setProgress(100);

      if (result.relationships && result.relationships.length > 0) {
        toast({ title: "Análise de Vínculos Concluída", description: `Foram encontrados ${result.relationships.length} vínculos potenciais.` });
      } else {
        toast({ title: "Análise de Vínculos Concluída", description: "Nenhum vínculo direto foi encontrado para as entidades fornecidas." });
      }

    } catch (error) { 
      console.error("Erro na análise de vínculos:", error);
      // Avoid generic toast if a more specific one was already shown
      const errorMessagesToIgnore = ["Erro ao ler arquivo:", "Falha ao extrair texto", "URI de dados vazia"];
      if (!(error instanceof Error && errorMessagesToIgnore.some(msg => error.message.includes(msg)))) {
        toast({ variant: "destructive", title: "Falha Geral na Análise", description: (error instanceof Error ? error.message : "Ocorreu um erro desconhecido.") + " Análise de vínculos interrompida." });
      }
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
    setAnalysisContext("Geral");
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
            Para arquivos PDF e outros formatos complexos (XLS, XLSX, etc.), o texto será extraído pela IA. Para CSV/TXT, as entidades serão extraídas por linha ou delimitadores comuns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo</Label>
            <Input 
              id="entities-file-upload" 
              type="file" 
              accept=".csv,.txt,.pdf,.xls,.xlsx,.anb,.anx,text/csv,text/plain,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream" 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              disabled={isLoading}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="analysis-context">Contexto da Análise</Label>
            <Select 
                value={analysisContext} 
                onValueChange={(value: string) => setAnalysisContext(value as AnalysisContextType)}
                disabled={isLoading}
            >
                <SelectTrigger id="analysis-context" className="w-full">
                    <SelectValue placeholder="Selecione o contexto..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Geral">Geral</SelectItem>
                    <SelectItem value="Telefonia">Telefonia (foco em números, ERBs, etc.)</SelectItem>
                    <SelectItem value="Financeira">Financeira (foco em contas, valores, etc.)</SelectItem>
                    <SelectItem value="Pessoas">Pessoas e Organizações</SelectItem>
                    <SelectItem value="Digital">Digital (IPs, Emails, Sites, etc.)</SelectItem>
                </SelectContent>
            </Select>
             <p className="text-xs text-muted-foreground">Opcional: ajuda a IA a focar em tipos de entidades e relações relevantes.</p>
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
            <li>Arquivos <strong>PDF, XLS, XLSX, ANB, ANX</strong>: o texto será extraído automaticamente pela IA para identificar entidades. A qualidade da extração pode variar; arquivos não textuais ou muito complexos podem resultar em extração limitada.</li>
            <li>Selecionar um <strong>Contexto da Análise</strong> pode ajudar a IA a identificar tipos de entidades e relações mais relevantes.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {relationships && relationships.length > 0 && !isLoading && (
        <LinkAnalysisGraph relationshipsData={relationships} />
      )}

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
      
      {relationships && relationships.length === 0 && !isLoading && selectedFile && (
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

