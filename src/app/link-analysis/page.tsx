
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
import { GitFork, Search, RotateCcw, Loader2, FileText, AlertCircle, HelpCircle, FolderKanban, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { analyzeDocument, type AnalyzeDocumentInput, type AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import { Progress } from "@/components/ui/progress";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkAnalysisGraph } from "@/components/link-analysis/LinkAnalysisGraph";
import type { LinkCaseAnalysis } from "@/types/case";

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
      ? `Análise de vínculos de '${selectedFile.name}': ${aiOutput.relationships.length} relações e ${aiOutput.identifiedEntities.length} entidades encontradas.`
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
      const allowedExtensions = [".csv", ".txt", ".pdf", ".xls", ".xlsx", ".doc", ".docx"]; // ANB/ANX removed due to binary nature
      const commonMimeTypes = [
          "application/pdf", "text/csv", "text/plain", 
          "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ];
      
      let fileExtensionSupported = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || commonMimeTypes.includes(file.type.toLowerCase());
      
      // Allow octet-stream if extension is known (e.g., .csv might be octet-stream sometimes)
      if (file.type === "application/octet-stream" && allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        fileExtensionSupported = true;
      }

      if (fileExtensionSupported) {
        setSelectedFile(file);
        setAnalysisOutput(null);
        setProgress(0);
        setProcessingMessage("Arquivo selecionado. Pronto para analisar.");
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Potencialmente Não Suportado", description: `Tente TXT, CSV, PDF, DOCX, XLSX. Outros tipos podem ter processamento limitado pela IA. Tipo detectado: ${file.type || "desconhecido"}.` });
        setSelectedFile(file); // Allow selection, backend handles it
        setAnalysisOutput(null);
        setProgress(0);
        setProcessingMessage(`Arquivo ${file.name} selecionado (aviso: tipo pode ter processamento limitado).`);
        toast({ title: "Arquivo Selecionado (Aviso)", description: `${file.name} - o tipo pode ter processamento limitado.` });
      }
    }
  };

  // Improved client-side entity parsing for TXT/CSV
  const parseEntitiesFromText = (text: string): string[] => {
    const entities = new Set<string>();
    if (!text || text.trim() === "") {
      return [];
    }
    // Regex for various entity types
    const patterns = {
        phone: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4,5}-?\d{4}/g, // Brazilian phone
        imei: /\b\d{15}\b/g,
        ip: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
        plateOld: /\b[A-Z]{3}-?\d{4}\b/gi,
        plateMercosul: /\b[A-Z]{3}\d[A-Z]\d{2}\b/gi,
        cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
        cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
        money: /(?:R\$|\$|€|£)\s*\d+(?:[.,]\d{2})?/g, // Simplified money
        // General words/phrases (potential names, places, orgs) - less specific
        words: /\b[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9\s'-]{2,99}\b/g 
    };

    // Extract specific patterns first
    Object.values(patterns).forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[0].trim().length > 1) entities.add(match[0].trim());
        }
    });
    
    // Fallback for lines/cells if no specific patterns are found within them (for CSV-like data)
    const lines = text.split(/\r?\n/);
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const potentialDelimiters = [',', ';', '\t', '|'];
        let cells: string[] = [trimmedLine];

        for (const delimiter of potentialDelimiters) {
            if (trimmedLine.includes(delimiter)) {
                const parts = trimmedLine.split(delimiter);
                if (parts.length > 1 && parts.some(p => p.trim() !== "")) {
                    cells = parts.map(p => p.trim()).filter(p => p !== "" && p.length > 1 && p.length < 100 && !/^\W+$/.test(p));
                    break;
                }
            }
        }
        cells.forEach(cell => {
          const cleanedCell = cell.replace(/^["']|["']$/g, '').trim();
          if(cleanedCell.length > 1 && cleanedCell.length < 100 && !/^\W+$/.test(cleanedCell)) {
            entities.add(cleanedCell);
          }
        });
    });

    return Array.from(entities).filter(e => e.length > 1); // Filter out very short/empty entities
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

    let extractedEntities: string[] = [];

    try {
      const fileName = selectedFile.name;
      const fileType = selectedFile.type;

      if (fileType === "text/csv" || fileType === "text/plain" || fileName.toLowerCase().endsWith(".txt") || fileName.toLowerCase().endsWith(".csv")) {
        setProgress(20);
        setProcessingMessage(`Lendo arquivo de texto/CSV: ${fileName}...`);
        const textContent = await selectedFile.text();
        extractedEntities = parseEntitiesFromText(textContent);
        setProgress(40);
        setProcessingMessage(`Entidades extraídas do texto: ${extractedEntities.length}. Enviando para IA...`);
        if (extractedEntities.length === 0) {
          toast({ variant: "default", title: "Extração de Texto Local", description: `Nenhuma entidade específica reconhecida em '${fileName}' por padrões locais. A IA tentará analisar o conteúdo completo.` });
          extractedEntities = [textContent]; // Send full content if no specific entities found
        } else {
           toast({ title: "Extração de Texto Local Concluída", description: `${extractedEntities.length} potenciais entidades encontradas em '${fileName}'.` });
        }
      } else { 
        setProgress(10);
        setProcessingMessage(`Preparando arquivo '${fileName}' para extração de texto pela IA...`);
        const fileDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onloadend = (e) => resolve(e.target?.result as string);
            reader.onerror = (errorEvent) => reject(new Error(`Erro no leitor de arquivo ao processar ${fileName}.`));
        });
        if (!fileDataUri) throw new Error("Não foi possível ler o conteúdo do arquivo.");

        setProgress(30);
        setProcessingMessage(`Extraindo texto e entidades iniciais de '${fileName}' com IA (pode levar um momento)...`);
        const docInput: AnalyzeDocumentInput = { fileDataUri, fileName };
        const docResult: AnalyzeDocumentOutput = await analyzeDocument(docInput); 
        
        let baseEntitiesForAI: string[] = [];
        if (docResult.extractedText && !docResult.extractedText.startsWith("AVISO DO SISTEMA:")) {
            baseEntitiesForAI.push(docResult.extractedText); // Add full text for AI to process further
            if (docResult.keyEntities && docResult.keyEntities.length > 0) {
                baseEntitiesForAI.push(...docResult.keyEntities.map(ke => `${ke.type}: ${ke.value}`));
            }
            toast({ title: "Extração de Conteúdo do Arquivo Concluída", description: `Texto e entidades iniciais extraídos de '${fileName}' pela IA.` });
        } else {
            baseEntitiesForAI.push(fileName); // Fallback to filename
            if (fileType) baseEntitiesForAI.push(fileType);
            toast({ 
                variant: "default", 
                title: "Extração de Conteúdo do Arquivo Limitada", 
                description: docResult.summary || `O conteúdo de '${fileName}' não pôde ser lido/extraído diretamente. A análise prosseguirá com base em metadados.`,
                duration: 8000
            });
        }
        extractedEntities = Array.from(new Set(baseEntitiesForAI.filter(e => e && e.trim() !== "")));
      }

      setProgress(60);
      if (extractedEntities.length === 0) {
         extractedEntities.push(selectedFile.name); // Ensure there's at least one entity (filename)
         if(selectedFile.type) extractedEntities.push(selectedFile.type);
         toast({ variant: "default", title: "Nenhuma Entidade Específica Encontrada", description: `Analisando vínculos com base no nome/tipo do arquivo: '${selectedFile.name}'.` });
      }
      setProcessingMessage(`Analisando ${extractedEntities.length} grupo(s) de informação/entidades com IA (Contexto: ${analysisContext})...`);
      
      const relationshipInput: FindEntityRelationshipsInput = { 
        entities: extractedEntities, 
        analysisContext: analysisContext,
        fileOrigin: selectedFile.name
      };
      const result = await findEntityRelationships(relationshipInput);
      setAnalysisOutput(result);
      setProgress(100);

      if (result.relationships && result.relationships.length > 0) {
        toast({ title: "Análise de Vínculos Concluída", description: `Encontrados ${result.relationships.length} vínculos e ${result.identifiedEntities.length} entidades para o caso "${caseName}".` });
      } else {
         toast({ title: "Análise de Vínculos Concluída", description: `Nenhum vínculo explícito encontrado. ${result.analysisSummary || ""}` });
      }
      await saveAnalysisToCase(result);

    } catch (error: any) { 
      console.error("Erro na análise de vínculos:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      setProcessingMessage(`Falha na análise: ${errorMessage.substring(0,100)}...`);
      toast({ variant: "destructive", title: "Falha na Análise de Vínculos", description: errorMessage });
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
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo</Label>
            <Input 
              id="entities-file-upload" 
              type="file" 
              accept=".csv,.txt,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/pdf" 
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
            <li>Para arquivos <strong>TXT/CSV</strong>: idealmente, cada linha ou célula deve conter uma entidade clara. A IA tentará parsear.</li>
            <li>Para <strong>PDF, DOCX, XLSX</strong>: a IA extrairá o texto e depois tentará identificar entidades e relações. Documentos complexos ou baseados em imagem podem ter limitações.</li>
            <li>Selecionar um <strong>Contexto da Análise</strong> específico ajuda a IA a focar e aprimorar a identificação de entidades e relações.</li>
            <li>Se a extração de entidades do conteúdo falhar, a análise de vínculos usará o nome do arquivo e tipo MIME como entidades base.</li>
            <li>O grafo gerado é uma representação visual das inferências da IA. Verifique e cruze com outras fontes.</li>
          </ul>
        </AlertDescription>
      </ShadAlert>

      {analysisOutput && analysisOutput.relationships && analysisOutput.relationships.length > 0 && !isLoading && (
        <LinkAnalysisGraph relationshipsData={analysisOutput.relationships} identifiedEntitiesData={analysisOutput.identifiedEntities} />
      )}
      {analysisOutput && analysisOutput.analysisSummary && !isLoading && (
        <Card className="mt-4">
            <CardHeader><CardTitle>Resumo da Análise da IA</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{analysisOutput.analysisSummary}</p></CardContent>
        </Card>
      )}

      {analysisOutput && analysisOutput.relationships && analysisOutput.relationships.length === 0 && !isLoading && selectedFile && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Nenhum vínculo explícito encontrado pela IA para as entidades identificadas no arquivo.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Verifique se o arquivo está formatado corretamente, se contém dados relacionáveis ou se o contexto da análise foi apropriado. Arquivos muito complexos ou com formatação incomum podem dificultar a extração.</p>
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
  )
}

