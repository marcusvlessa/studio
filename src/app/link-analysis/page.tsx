// src/app/link-analysis/page.tsx
"use client";

import { useState, type ChangeEvent, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitFork, Search, RotateCcw, Loader2, FileText, AlertCircle, HelpCircle, FolderKanban, Info, BookOpenText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { analyzeDocument, type AnalyzeDocumentInput, type AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import { Progress } from "@/components/ui/progress";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LinkAnalysisGraph from "@/components/link-analysis/LinkAnalysisGraph";
import type { LinkCaseAnalysis } from "@/types/case";
import { ScrollArea } from "@/components/ui/scroll-area";

type AnalysisContextType = "Geral" | "Telefonia" | "Financeira" | "Pessoas e Organizações" | "Digital e Cibernética" | "Investigação Criminal Genérica";

function LinkAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisOutput, setAnalysisOutput] = useState<FindEntityRelationshipsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("Aguardando arquivo para análise...");
  const [analysisContext, setAnalysisContext] = useState<AnalysisContextType>("Geral");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";

  const saveAnalysisToCase = async (aiOutput: FindEntityRelationshipsOutput) => {
    if (!caseId || !selectedFile) return;

    const summary = aiOutput.analysisSummary || 
                    (aiOutput.relationships.length > 0 
      ? `Análise de vínculos de '${selectedFile.name}': ${aiOutput.relationships.length} relações e ${aiOutput.identifiedEntities.length} entidades.`
      : `Análise de vínculos de '${selectedFile.name}': Nenhuma relação ou entidade significativa encontrada.`);

    const analysisEntry: Omit<LinkCaseAnalysis, 'id' | 'analysisDate'> = {
      type: "Vínculo",
      summary: summary,
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
      toast({ title: "Análise Salva no Caso", description: `Resultados da análise de vínculos de "${selectedFile.name}" vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error("Erro ao salvar análise no caso:", error);
      toast({ variant: "destructive", title: "Falha ao Salvar Análise", description: error instanceof Error ? error.message : String(error) });
    }
  };


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisOutput(null);
      setProgress(0);
      setProcessingMessage("Arquivo selecionado. Pronto para analisar.");
      toast({ title: "Arquivo Selecionado", description: `${file.name} (${file.type || 'Tipo desconhecido'})` });
    }
  };

  const parseEntitiesFromText = (text: string): string[] => {
    const entities = new Set<string>();
    if (!text || text.trim() === "") {
      return [];
    }

    const firstFewLines = text.substring(0, Math.min(text.length, 2000)); // Increased sample size
    const commonDelimiters = [',', ';', '\t', '|'];
    let detectedDelimiter: string | null = null;

    // Try to detect delimiter based on consistency in first few lines
    for (const delimiter of commonDelimiters) {
        const linesSample = firstFewLines.split('\n').slice(0, 5); // Check first 5 lines
        if (linesSample.length > 1 && linesSample.every(line => line.includes(delimiter))) {
            const counts = linesSample.map(line => line.split(delimiter).length);
            // Check if counts are consistent and greater than 1
            if (counts.every(c => c === counts[0] && c > 1)) {
                detectedDelimiter = delimiter;
                break;
            }
        }
    }
    
    const lines = text.split(/\r?\n/);

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      let cells: string[] = [];
      if (detectedDelimiter) {
          cells = trimmedLine.split(detectedDelimiter)
            .map(p => p.replace(/^["']|["']$/g, '').trim()) 
            .filter(p => p && p.length > 0 && p.length < 250); 
      } else {
          // Fallback if no clear delimiter: try splitting by multiple spaces, then consider whole line
          if (trimmedLine.includes('  ')) { 
            cells = trimmedLine.split(/\s{2,}/) 
                .map(p => p.trim())
                .filter(p => p && p.length > 0 && p.length < 250);
          }
          if (cells.length === 0 && trimmedLine.length > 0 && trimmedLine.length < 500) { 
            // If no cells by delimiter or multiple spaces, add the whole trimmed line if it's not too long
            cells = [trimmedLine]; 
          }
      }
      cells.forEach(cell => { if(cell) entities.add(cell); });
    });
    
    // Also, extract specific patterns regardless of delimiters
    const textWithoutNewlines = text.replace(/\r?\n/g, ' ');
    const specificPatterns = {
        phone: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4,5}-?\d{4}/g,
        email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
        cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
        cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
        // placa: /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/gi, // Brazilian plate
        // money: /R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g,
        // date: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    };
    Object.values(specificPatterns).forEach(pattern => {
        const matches = textWithoutNewlines.matchAll(pattern);
        for (const match of matches) {
            if (match[0].trim().length > 1) entities.add(match[0].trim());
        }
    });

    return Array.from(entities).filter(e => e && e.trim().length > 1 && e.trim().length < 250);
  };

  const handleAnalyze = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso." });
      return;
    }
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Fornecido", description: "Por favor, envie um arquivo para análise." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setProcessingMessage("Iniciando análise...");
    setAnalysisOutput(null);

    let entitiesForRelationshipAnalysis: string[] = [];
    const fileName = selectedFile.name;
    const fileType = selectedFile.type.toLowerCase();
    const isTextBased = fileType === "text/csv" || fileType === "text/plain" || fileName.endsWith(".txt") || fileName.endsWith(".csv");

    try {
      if (isTextBased) {
        setProgress(20);
        setProcessingMessage(`Lendo e interpretando arquivo de texto/CSV: ${fileName}...`);
        const textContent = await selectedFile.text();
        entitiesForRelationshipAnalysis = parseEntitiesFromText(textContent);
        setProgress(40);
        if (entitiesForRelationshipAnalysis.length === 0) {
          setProcessingMessage(`Nenhuma entidade específica encontrada por interpretação local em '${fileName}'. Enviando conteúdo completo para IA...`);
          // Send a significant chunk, but not excessively large, to avoid overwhelming the AI or hitting limits.
          entitiesForRelationshipAnalysis = [textContent.substring(0, 50000)]; 
        } else {
          setProcessingMessage(`Entidades extraídas localmente: ${entitiesForRelationshipAnalysis.length}. Enviando para IA...`);
        }
      } else { 
        // For non-text files (PDF, DOCX, XLSX etc.), attempt extraction via analyzeDocument
        setProgress(10);
        setProcessingMessage(`Preparando arquivo '${fileName}' para extração de conteúdo pela IA (pode levar um momento)...`);
        
        const fileDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onloadend = (e) => resolve(e.target?.result as string);
            reader.onerror = (errEvent) => reject(new Error(`Erro ao ler o arquivo ${fileName}: ${errEvent.target?.error?.message || 'Erro desconhecido'}`));
        });
        if (!fileDataUri) throw new Error("Não foi possível ler o conteúdo do arquivo como Data URI.");

        setProgress(30);
        setProcessingMessage(`Tentando extrair texto de '${fileName}' com IA de documentos...`);
        const docInput: AnalyzeDocumentInput = { fileDataUri, fileName };
        
        const docResult: AnalyzeDocumentOutput = await analyzeDocument(docInput);
        
        if (docResult.extractedText && !docResult.extractedText.startsWith("AVISO DO SISTEMA:")) {
            entitiesForRelationshipAnalysis = parseEntitiesFromText(docResult.extractedText);
            if (docResult.keyEntities && docResult.keyEntities.length > 0) {
                entitiesForRelationshipAnalysis.push(...docResult.keyEntities.map(ke => `${ke.type}: ${ke.value}`));
            }
            // Remove duplicates and ensure entities are reasonable
            entitiesForRelationshipAnalysis = Array.from(new Set(entitiesForRelationshipAnalysis.filter(e => e && e.trim() !== "" && e.length < 250 && e.length > 1)));
            toast({ title: "Extração de Conteúdo Concluída", description: `Texto e entidades primárias extraídos de '${fileName}'. Analisando vínculos...` });
            setProcessingMessage(`Texto extraído. ${entitiesForRelationshipAnalysis.length} potenciais entidades/fragmentos de texto para análise de vínculos...`);
        } else {
            const limitedExtractionMessage = docResult.summary || `O conteúdo de '${fileName}' (${fileType || 'tipo desconhecido'}) não pôde ser lido/extraído diretamente pela IA de documentos. A análise de vínculos prosseguirá com base nos metadados e no tipo de arquivo. Para arquivos complexos como XLSX, DOCX, considere converter para TXT ou CSV para melhor extração de conteúdo.`;
            setProcessingMessage(limitedExtractionMessage.substring(0, 200) + "...");
             toast({ 
                variant: "default", 
                title: "Extração de Conteúdo Limitada", 
                description: limitedExtractionMessage,
                duration: 10000 
            });
            entitiesForRelationshipAnalysis.push(fileName);
            if (selectedFile.type) entitiesForRelationshipAnalysis.push(selectedFile.type);
            if (docResult.summary) entitiesForRelationshipAnalysis.push(docResult.summary); // Add the system summary for context
        }
      }

      setProgress(60);
      if (entitiesForRelationshipAnalysis.length === 0) {
         // This case should be rare now with the fallbacks
         entitiesForRelationshipAnalysis.push(selectedFile.name); 
         if(selectedFile.type) entitiesForRelationshipAnalysis.push(selectedFile.type);
         const fallbackMsg = `Nenhuma entidade específica extraída de '${selectedFile.name}'. A análise de vínculos prosseguirá com base no nome e tipo do arquivo.`;
         setProcessingMessage(fallbackMsg);
         toast({ variant: "default", title: "Nenhuma Entidade Específica Encontrada", description: fallbackMsg });
      } else {
         setProcessingMessage(`Analisando ${entitiesForRelationshipAnalysis.length} potenciais entidades/fragmentos de texto com IA (Contexto: ${analysisContext})...`);
      }
      
      const relationshipInput: FindEntityRelationshipsInput = { 
        entities: entitiesForRelationshipAnalysis, 
        analysisContext: analysisContext,
        fileOrigin: selectedFile.name
      };
      const result = await findEntityRelationships(relationshipInput);
      setAnalysisOutput(result);
      setProgress(100);

      if (result.relationships && result.relationships.length > 0) {
        toast({ title: "Análise de Vínculos Concluída", description: `Encontrados ${result.relationships.length} vínculos e ${result.identifiedEntities.length} entidades para o caso "${caseName}".` });
      } else {
         toast({ title: "Análise de Vínculos Concluída", description: result.analysisSummary || `Nenhum vínculo explícito encontrado. Verifique o resumo da IA.` });
      }
      await saveAnalysisToCase(result);

    } catch (error: any) { 
      console.error("Erro na análise de vínculos:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      setProcessingMessage(`Falha na análise: ${errorMessage.substring(0,100)}...`);
      toast({ variant: "destructive", title: "Falha na Análise de Vínculos", description: errorMessage, duration: 10000 });
      setProgress(0); // Reset progress on error
    } finally {
      setIsLoading(false); 
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisOutput(null);
    setIsLoading(false);
    setProgress(0);
    setProcessingMessage("Aguardando arquivo para análise...");
    setAnalysisContext("Geral");
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da análise de vínculos foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Vínculos (Estilo i2)</h1>
        <p className="text-muted-foreground">Envie arquivos com dados (TXT, CSV, PDF, DOCX, XLSX) para identificar entidades, classificá-las e visualizar seus relacionamentos em um grafo interativo.</p>
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
          <CardTitle>Enviar Arquivo para Análise de Vínculos</CardTitle>
          <CardDescription>
            Forneça um arquivo (TXT, CSV, PDF, DOCX, XLSX). A IA tentará extrair entidades e relações.
             Para arquivos como XLSX, DOCX e PDF complexos (especialmente os baseados em imagem), a extração de conteúdo pode ser limitada; converter para TXT ou CSV pode gerar melhores resultados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo</Label>
            <Input 
              id="entities-file-upload" 
              type="file" 
              accept=".csv,.txt,.pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/pdf,application/octet-stream" 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              disabled={isLoading || !isCaseSelected}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="analysis-context">Contexto da Análise Investigativa</Label>
            <Select 
                value={analysisContext} 
                onValueChange={(value: string) => setAnalysisContext(value as AnalysisContextType)}
                disabled={isLoading || !isCaseSelected}
            >
                <SelectTrigger id="analysis-context" className="w-full">
                    <SelectValue placeholder="Selecione o contexto..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Geral">Geral (amplo, menos focado)</SelectItem>
                    <SelectItem value="Telefonia">Telefonia (números, IMEI, ERBs)</SelectItem>
                    <SelectItem value="Financeira">Financeira (contas, transações, PIX)</SelectItem>
                    <SelectItem value="Pessoas e Organizações">Pessoas e Organizações (nomes, CPFs, CNPJs, empresas)</SelectItem>
                    <SelectItem value="Digital e Cibernética">Digital e Cibernética (IPs, emails, websites, malwares)</SelectItem>
                    <SelectItem value="Investigação Criminal Genérica">Investigação Criminal Genérica (fatos, locais, veículos)</SelectItem>
                </SelectContent>
            </Select>
             <p className="text-xs text-muted-foreground">Opcional: ajuda a IA a focar em tipos de entidades e relações relevantes para o seu cenário.</p>
          </div>
           {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileText className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB) - Tipo: {selectedFile.type || 'Desconhecido'}</p>
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
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !isCaseSelected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando..." : "Analisar Vínculos"}</Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      <ShadAlert variant="default" className="mt-4">
        <HelpCircle className="h-4 w-4" />
        <AlertTitle>Dicas para Melhor Análise de Vínculos</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>Para arquivos <strong>TXT/CSV</strong>: idealmente, cada linha ou célula deve conter uma entidade clara. A IA tentará interpretar e identificar entidades.</li>
            <li>Para <strong>PDF, DOCX, XLSX</strong>: a IA extrairá o texto e depois tentará identificar entidades e relações. Documentos complexos ou baseados em imagem podem ter limitações na extração de conteúdo. Considere converter para TXT ou CSV se a extração de conteúdo não for satisfatória.</li>
            <li>Selecionar um <strong>Contexto da Análise</strong> específico ajuda a IA a focar e aprimorar a identificação de entidades e relações.</li>
            <li>Se a extração de entidades do conteúdo falhar, a análise de vínculos usará o nome do arquivo e tipo MIME como entidades base.</li>
            <li>O grafo gerado é uma representação visual das inferências da IA. Verifique e cruze com outras fontes.</li>
            <li>Resultados muito grandes ou complexos podem demorar para renderizar no grafo.</li>
          </ul>
        </AlertDescription>
      </ShadAlert>

      {analysisOutput && analysisOutput.analysisSummary && !isLoading && (
        <Card className="mt-4">
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenText className="h-5 w-5 text-primary"/>Resumo da Análise de Inteligência (Vínculos)</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-muted/30">
                    <pre className="text-sm whitespace-pre-wrap font-sans">{analysisOutput.analysisSummary}</pre>
                </ScrollArea>
            </CardContent>
        </Card>
      )}

      {analysisOutput && analysisOutput.identifiedEntities && analysisOutput.identifiedEntities.length > 0 && !isLoading && (
        <LinkAnalysisGraph 
            relationshipsData={analysisOutput.relationships || []} 
            identifiedEntitiesData={analysisOutput.identifiedEntities} />
      )}
      
      {analysisOutput && (!analysisOutput.identifiedEntities || analysisOutput.identifiedEntities.length === 0) && !isLoading && selectedFile && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center font-semibold">Nenhuma entidade identificada para visualização.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Verifique o "Resumo da Análise de Inteligência" acima para mais detalhes.
                  O arquivo pode não conter dados textuais claros, as entidades podem não ter sido reconhecidas, ou a extração de conteúdo pode ter sido limitada.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LinkAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <LinkAnalysisContent />
    </Suspense>
  );
}
