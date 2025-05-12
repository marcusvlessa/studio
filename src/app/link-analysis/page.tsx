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
import { analyzeDocument, type AnalyzeDocumentInput } from "@/ai/flows/analyze-document-flow";
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
      const allowedExtensions = [".csv", ".txt", ".pdf", ".xls", ".xlsx", ".doc", ".docx", ".anb", ".anx"];
      const commonMimeTypes = ["application/pdf", "text/csv", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      
      let fileExtensionSupported = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || commonMimeTypes.includes(file.type.toLowerCase());
      // Browsers might report application/octet-stream for many binary files, allow if extension matches.
      if (file.type === "application/octet-stream" && allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        fileExtensionSupported = true;
      }


      if (fileExtensionSupported) {
        setSelectedFile(file);
        setRelationships(null);
        setProgress(0);
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: `Envie arquivos como: ${allowedExtensions.join(", ")}. Tipo detectado: ${file.type || "desconhecido"}.` });
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

    const phonePattern = /^(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4,5}-?\d{4}$/; 
    const imeiPattern = /^\d{15}$/; 
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/; 
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
    const plateOldPattern = /^[A-Z]{3}-?\d{4}$/i;
    const plateMercosulPattern = /^[A-Z]{3}\d[A-Z]\d{2}$/i;
    const cpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const cnpjPattern = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
    const moneyPattern = /(?:R\$|\$|€|£)\s*\d+(?:[,.]\d{1,2})*/;


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
        const cleanedCell = cell.replace(/^["']|["']$/g, ''); 

        let matchedSpecific = false;
        if (phonePattern.test(cleanedCell)) {
          entities.add(cleanedCell);
          matchedSpecific = true;
        } else if (imeiPattern.test(cleanedCell)) {
          entities.add(cleanedCell);
          matchedSpecific = true;
        } else if (ipPattern.test(cleanedCell)) {
          entities.add(cleanedCell);
          matchedSpecific = true;
        } else if (emailPattern.test(cleanedCell)) {
          entities.add(cleanedCell.toLowerCase());
          matchedSpecific = true;
        } else if (plateOldPattern.test(cleanedCell) || plateMercosulPattern.test(cleanedCell)) {
          entities.add(cleanedCell.toUpperCase()); 
          matchedSpecific = true;
        } else if (cpfPattern.test(cleanedCell)) {
            entities.add(cleanedCell);
            matchedSpecific = true;
        } else if (cnpjPattern.test(cleanedCell)) {
            entities.add(cleanedCell);
            matchedSpecific = true;
        } else if (moneyPattern.test(cleanedCell)) {
            entities.add(cleanedCell); 
            matchedSpecific = true;
        }
        
        if (!matchedSpecific) {
          if (cleanedCell.length >= 2 && cleanedCell.length < 100 && !/^\W+$/.test(cleanedCell) && (isNaN(Number(cleanedCell)) || cleanedCell.length > 4 || /^[a-zA-Z0-9\s-]+$/.test(cleanedCell) )) {
            entities.add(cleanedCell);
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
    let successfullyExtractedActualContent = false; 
    let entitiesFromAI: string[] = []; 

    try {
      if (selectedFile.type === "text/csv" || selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt") || selectedFile.name.toLowerCase().endsWith(".csv")) {
        setProgress(20);
        setProcessingMessage(`Lendo arquivo de texto: ${selectedFile.name}...`);
        try {
            extractedTextForParsing = await selectedFile.text();
            successfullyExtractedActualContent = true; 
            toast({ title: "Leitura de Texto Concluída", description: `Conteúdo de ${selectedFile.name} lido.` });
        } catch (textReadError) {
            console.error("Erro ao ler arquivo de texto:", textReadError);
            toast({ variant: "destructive", title: "Erro ao Ler Arquivo de Texto", description: `Não foi possível ler o conteúdo do arquivo ${selectedFile.name}.` });
            setIsLoading(false); 
            setProgress(0);
            return; 
        }
      } else { 
        setProgress(10);
        setProcessingMessage(`Preparando arquivo ${selectedFile.name} para análise pela IA...`);
        
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        
        await new Promise<void>((resolve, reject) => {
            reader.onloadend = async (e) => {
                const fileDataUri = e.target?.result as string;
                if (!fileDataUri) {
                    toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Não foi possível ler o conteúdo do arquivo."});
                    reject(new Error(`Erro ao ler arquivo ${selectedFile.name}: URI de dados vazia.`));
                    return;
                }
                setProgress(30);
                setProcessingMessage("Processando arquivo com IA (pode levar um momento)...");
                try {
                    const docInput: AnalyzeDocumentInput = { fileDataUri, fileName: selectedFile.name };
                    const docResult = await analyzeDocument(docInput); 
                    
                    extractedTextForParsing = docResult.extractedText || ""; 

                    if (docResult.extractedText && !docResult.extractedText.startsWith("AVISO DO SISTEMA:")) {
                        successfullyExtractedActualContent = true;
                        toast({ title: "Extração de Texto do Arquivo Concluída", description: `Texto extraído de ${selectedFile.name}.` });
                    } else {
                        successfullyExtractedActualContent = false; 
                        toast({ 
                            variant: "default", 
                            title: "Extração de Conteúdo do Arquivo Limitada", 
                            description: `O conteúdo de '${selectedFile.name}' (tipo: ${selectedFile.type || 'desconhecido'}) não pôde ser lido/extraído diretamente pela IA. A análise prosseguirá com base em metadados (como nome do arquivo).`,
                            duration: 8000
                        });
                    }
                    
                    if(docResult.keyEntities && docResult.keyEntities.length > 0){
                        entitiesFromAI = docResult.keyEntities.map(ke => ke.value);
                        if(!successfullyExtractedActualContent){
                             toast({title: "Entidades de Metadados", description: `IA identificou ${entitiesFromAI.length} entidades (provavelmente do nome do arquivo ou tipo).`});
                        }
                    }
                    resolve();
                } catch (extractionError: any) {
                    console.error(`Erro na análise do documento pela IA: ${extractionError.message}`, extractionError);
                    toast({ variant: "destructive", title: "Erro na Análise do Documento pela IA", description: (extractionError instanceof Error ? extractionError.message : `Falha ao processar o arquivo ${selectedFile.name} com IA.`) });
                    reject(extractionError);
                }
            };
            reader.onerror = (errorEvent) => { 
                 toast({ variant: "destructive", title: "Erro ao Ler Arquivo", description: "Ocorreu um erro ao tentar ler o arquivo."});
                 reject(new Error(`Erro no leitor de arquivo ao processar ${selectedFile.name}.`));
            }
        });
      }

      setProgress(50);
      setProcessingMessage("Identificando entidades do texto/metadados...");
      
      let entitiesFromTextParsing: string[] = [];
      if (successfullyExtractedActualContent && extractedTextForParsing) {
          entitiesFromTextParsing = parseEntitiesFromText(extractedTextForParsing);
      }

      const combinedEntities = new Set([...entitiesFromTextParsing, ...entitiesFromAI]);
      const finalEntities = Array.from(combinedEntities);
      
      if (finalEntities.length > 0) {
          let entitiesSourceMessage = `Total de ${finalEntities.length} entidades únicas identificadas `;
          if (entitiesFromTextParsing.length > 0 && entitiesFromAI.length > 0 && successfullyExtractedActualContent) {
              const uniqueFromAI = entitiesFromAI.filter(e => !entitiesFromTextParsing.includes(e)).length;
              entitiesSourceMessage += `(${entitiesFromTextParsing.length} do conteúdo, ${uniqueFromAI} de metadados).`;
          } else if (entitiesFromTextParsing.length > 0 && successfullyExtractedActualContent) {
              entitiesSourceMessage += `(extraídas do conteúdo do arquivo).`;
          } else if (entitiesFromAI.length > 0) {
              entitiesSourceMessage += `(extraídas de metadados do arquivo).`;
          }
          toast({ title: "Entidades Identificadas", description: entitiesSourceMessage });
      } else {
          toast({ variant: "default", title: "Nenhuma Entidade Identificada", description: `Não foram identificadas entidades em '${selectedFile.name}'. A análise de vínculos pode não encontrar resultados.` });
      }
      
      setProgress(70);
      setProcessingMessage(finalEntities.length > 0 ? `Analisando ${finalEntities.length} entidades com IA (Contexto: ${analysisContext})...` : `Tentando análise de vínculos (sem entidades primárias identificadas)...`);
      
      const relationshipInput: FindEntityRelationshipsInput = { entities: finalEntities, analysisContext };
      const result = await findEntityRelationships(relationshipInput);
      setRelationships(result.relationships);
      setProgress(100);

      if (result.relationships && result.relationships.length > 0) {
        let description = `Foram encontrados ${result.relationships.length} vínculos potenciais.`;
        if (!successfullyExtractedActualContent && finalEntities.length <= 3 && finalEntities.every(e => e === selectedFile.name || e === selectedFile.type || e === analysisContext)) {
             description += ` Nota: A extração de conteúdo do arquivo '${selectedFile.name}' foi limitada. Os vínculos foram baseados em metadados (nome/tipo do arquivo) e contexto.`;
             toast({
                variant: "default",
                title: "Análise de Vínculos Concluída (Baseada em Metadados)",
                description: description,
                duration: 10000,
             });
        } else {
            toast({ title: "Análise de Vínculos Concluída", description: description });
        }
      } else if (finalEntities.length > 0) {
         let detailMessage = "Nenhum vínculo direto foi encontrado para as entidades fornecidas.";
         if (!successfullyExtractedActualContent) {
            detailMessage += ` A extração de conteúdo do arquivo '${selectedFile.name}' foi limitada, e a análise se baseou principalmente em metadados. Para uma análise mais profunda do conteúdo, utilize arquivos TXT, CSV ou PDF textual.`;
         }
         toast({ title: "Análise de Vínculos Concluída", description: detailMessage, duration: 10000 });
      } else { 
        toast({ title: "Análise Concluída", description: `Não foram encontradas entidades em '${selectedFile.name}' e, consequentemente, nenhum vínculo. Verifique o conteúdo e formato do arquivo.` });
      }

    } catch (error: any) { 
      console.error("Erro na análise de vínculos:", error);
      if (!toast.toasts.some(t => t.title?.toString().includes("Erro"))) {
        toast({ variant: "destructive", title: "Falha na Análise de Vínculos", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
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
        <p className="text-muted-foreground">Envie arquivos com entidades (nomes, telefones, etc.) para identificar e visualizar seus relacionamentos. A IA tentará extrair texto de PDFs e outros formatos, mas a qualidade da extração pode variar.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo de Entidades</CardTitle>
          <CardDescription>
            Forneça um arquivo (TXT, CSV, PDF, XLS, XLSX, DOC, DOCX, ANB, ANX) contendo as entidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo</Label>
            <Input 
              id="entities-file-upload" 
              type="file" 
              accept=".csv,.txt,.pdf,.xls,.xlsx,.doc,.docx,.anb,.anx,text/csv,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream" 
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
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB) - Tipo: {selectedFile.type || 'Desconhecido'}
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
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>Para arquivos <strong>TXT/CSV</strong>: entidades devem ser separadas por linha ou delimitadores comuns (vírgula, ponto e vírgula, tabulação).</li>
            <li>Para <strong>PDF, DOCX, XLSX</strong>: a IA tentará extrair o texto. PDFs baseados em imagem (escaneados) ou arquivos Office muito complexos/antigos podem ter extração limitada. PDFs textuais e formatos OOXML (DOCX, XLSX modernos) tendem a funcionar melhor.</li>
            <li>Arquivos <strong>ANB/ANX, XLS (binário), DOC (binário)</strong> e outros formatos binários proprietários: a análise se baseará primariamente nos metadados (nome do arquivo, tipo) pois o conteúdo interno geralmente não pode ser lido diretamente pela IA.</li>
            <li>Selecionar um <strong>Contexto da Análise</strong> pode ajudar a IA a focar em tipos de entidades e relações relevantes.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {relationships && relationships.length > 0 && !isLoading && (
        <LinkAnalysisGraph relationshipsData={relationships} />
      )}

      {relationships && relationships.length === 0 && !isLoading && selectedFile && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Nenhum vínculo direto encontrado para as entidades identificadas no arquivo.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Verifique se o arquivo está formatado corretamente e contém dados válidos, ou se o tipo de arquivo permitiu extração de conteúdo textual. Para arquivos complexos, a análise pode ter se baseado apenas em metadados.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
