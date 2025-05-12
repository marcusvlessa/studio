
// src/app/document-analysis/page.tsx
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
import { FileUp, RotateCcw, Search, Loader2, FileTextIcon, CheckCircle, AlertCircle, Info, UserCheck, FileSignature, Gavel, ListChecks, AlertTriangle, BookOpen, Scale, FolderKanban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeDocument, type AnalyzeDocumentInput, type AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DocumentCaseAnalysis } from "@/types/case";

function DocumentAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeDocumentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";

  const saveAnalysisToCase = async (aiOutput: AnalyzeDocumentOutput) => {
    if (!caseId || !selectedFile) return;

    const analysisEntry: Omit<DocumentCaseAnalysis, 'id' | 'analysisDate'> = {
      type: "Documento",
      summary: `Análise de '${selectedFile.name}': ${aiOutput.summary.substring(0, 100)}${aiOutput.summary.length > 100 ? '...' : ''}`,
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
      toast({ title: "Análise Salva no Caso", description: `Resultados de "${selectedFile.name}" foram vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error("Erro ao salvar análise no caso:", error);
      toast({ variant: "destructive", title: "Falha ao Salvar Análise", description: error instanceof Error ? error.message : String(error) });
    }
  };


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const commonImageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/jpg"];
      const documentTypes = [
        "application/pdf", 
        "application/msword", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
       const isAllowedFile = commonImageTypes.includes(file.type.toLowerCase()) || 
                             documentTypes.includes(file.type.toLowerCase()) ||
                             file.name.toLowerCase().endsWith(".txt") ||
                             file.name.toLowerCase().endsWith(".doc") || 
                             file.name.toLowerCase().endsWith(".docx");

      if (isAllowedFile) {
        setSelectedFile(file);
        setAnalysisResult(null);
        setProgress(0);

        if (commonImageTypes.includes(file.type.toLowerCase())) {
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
        toast({ variant: "destructive", title: "Tipo de Arquivo Potencialmente Não Suportado", description: "Por favor, envie um arquivo PDF, Word, TXT ou imagem. Outros tipos podem não ser processados corretamente." });
        setSelectedFile(file); // Allow selection, backend handles it
        setAnalysisResult(null);
        setProgress(0);
        setFilePreview(null);
        toast({ title: "Arquivo Selecionado (aviso)", description: `${file.name} - o tipo pode ter processamento limitado.` });
      }
    }
  };

  const handleAnalyze = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso." });
      return;
    }
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
      if (currentProgress <= 90) { 
        setProgress(currentProgress);
      }
    }, 300);

    const fileName = selectedFile.name;
    const fileType = selectedFile.type;

    try {
      let inputData: AnalyzeDocumentInput;

      if (fileType === "text/plain" || fileName.toLowerCase().endsWith(".txt")) {
        const textContent = await selectedFile.text();
        setProgress(50);
        inputData = { textContent, fileName: selectedFile.name };
      } else {
        const fileDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onloadend = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error("Erro ao ler o arquivo."));
        });
        setProgress(50);
        inputData = { fileDataUri, fileName: selectedFile.name };
      }
          
      const result = await analyzeDocument(inputData);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Análise Concluída", description: `Documento "${fileName}" processado para o caso "${caseName}".` });
      await saveAnalysisToCase(result);

    } catch (error: any) {
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
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Documentos Investigativa</h1>
        <p className="text-muted-foreground">Envie documentos (PDF, Word, TXT, Imagens) para uma análise multifacetada por IA.</p>
      </header>

      {!isCaseSelected && (
        <ShadAlert variant="destructive" className="mb-4">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>Nenhum Caso Selecionado!</AlertTitle>
          <AlertDescription>
            Por favor, vá para a página de <Link href="/case-management" className="font-semibold underline">Gestão de Casos</Link> para selecionar ou criar um caso antes de prosseguir com a análise.
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
          <CardTitle>Enviar Documento para Análise Profunda</CardTitle>
          <CardDescription>Selecione um arquivo para extração de texto, resumo, identificação de entidades e análise investigativa completa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="document-upload">Arquivo do Documento</Label>
            <Input 
                id="document-upload" 
                type="file" 
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.txt,image/*" 
                onChange={handleFileChange} 
                disabled={isLoading || !isCaseSelected}
            />
          </div>
          {selectedFile && (
            <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                <FileTextIcon className="h-5 w-5" />
                <div>
                    <p className="font-semibold">{selectedFile.name}</p>
                    <p>({ (selectedFile.size / (1024*1024)).toFixed(2) } MB) - Tipo: {selectedFile.type || "Desconhecido"}</p>
                </div>
            </div>
          )}
          {filePreview && selectedFile?.type.startsWith("image/") && (
            <div>
              <Label>Pré-visualização da Imagem:</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreview} alt="Preview" className="mt-2 max-h-60 w-auto rounded border object-contain" data-ai-hint="documento foto" />
            </div>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress <= 50 && "Preparando e lendo arquivo..."}
                {progress > 50 && progress < 100 && "Analisando com IA (pode levar alguns instantes)..."}
                {progress === 100 && "Concluído!"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !isCaseSelected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Documento..." : "Analisar Documento"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <div className="grid gap-6 mt-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Info className="h-6 w-6 text-primary" /> Informações Gerais do Documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p><strong>Nome do Arquivo:</strong> {selectedFile?.name || "N/A"}</p>
                    <p><strong>Idioma Detectado:</strong> {analysisResult.language ? analysisResult.language.toUpperCase() : "Não detectado/N/A"}</p>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Resumo do Conteúdo Analisado</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea value={analysisResult.summary} readOnly rows={6} className="bg-muted/50" />
                </CardContent>
            </Card>

            {analysisResult.keyEntities && analysisResult.keyEntities.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CheckCircle className="h-6 w-6 text-green-500" /> Entidades Chave (do Conteúdo Analisado)</CardTitle>
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
            
            <Accordion type="multiple" className="w-full space-y-4" defaultValue={["investigator-analysis", "clerk-report", "delegate-assessment"]}>
                {analysisResult.investigatorAnalysis && (
                    <AccordionItem value="investigator-analysis" className="border rounded-lg bg-card shadow-sm">
                        <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                            <div className="flex items-center gap-2"><UserCheck className="h-6 w-6 text-blue-600" /> Análise do Investigador</div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0 space-y-4">
                            <div>
                                <Label className="font-semibold text-md">Observações Detalhadas:</Label>
                                <Textarea value={analysisResult.investigatorAnalysis.observations} readOnly rows={8} className="bg-muted/50 mt-1" />
                            </div>
                            {analysisResult.investigatorAnalysis.potentialLeads && analysisResult.investigatorAnalysis.potentialLeads.length > 0 ? (
                                <div>
                                    <Label className="font-semibold text-md">Pistas Potenciais Identificadas:</Label>
                                    <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md mt-1">
                                        {analysisResult.investigatorAnalysis.potentialLeads.map((lead, index) => (
                                            <li key={index}>{lead}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                 <div>
                                    <Label className="font-semibold text-md">Pistas Potenciais Identificadas:</Label>
                                    <p className="text-sm text-muted-foreground italic mt-1 bg-muted/30 p-3 rounded-md">Nenhuma pista potencial específica identificada.</p>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                )}

                {analysisResult.clerkReport && (
                     <AccordionItem value="clerk-report" className="border rounded-lg bg-card shadow-sm">
                        <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                             <div className="flex items-center gap-2"><FileSignature className="h-6 w-6 text-orange-600" /> Relatório do Escrivão</div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0 space-y-4">
                            <div>
                                <Label className="font-semibold text-md">Sumário Formalizado dos Fatos (Estilo B.O.):</Label>
                                <Textarea value={analysisResult.clerkReport.formalizedSummary} readOnly rows={8} className="bg-muted/50 mt-1" />
                            </div>
                            {analysisResult.clerkReport.keyInformationStructured && analysisResult.clerkReport.keyInformationStructured.length > 0 && (
                                <div>
                                    <Label className="font-semibold text-md">Informações Chave Estruturadas:</Label>
                                     <div className="space-y-2 mt-1">
                                        {analysisResult.clerkReport.keyInformationStructured.map((info, index) => (
                                            <div key={index} className="p-2 border rounded-md bg-muted/30">
                                                <p><strong>{info.category}:</strong> {info.details}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                )}

                {analysisResult.delegateAssessment && (
                    <AccordionItem value="delegate-assessment" className="border rounded-lg bg-card shadow-sm">
                        <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                             <div className="flex items-center gap-2"><Gavel className="h-6 w-6 text-red-600" /> Avaliação do Delegado</div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0 space-y-4">
                             <div>
                                <Label className="font-semibold text-md flex items-center gap-1"><ListChecks/> Avaliação Geral do Caso:</Label>
                                <Textarea value={analysisResult.delegateAssessment.overallAssessment} readOnly rows={6} className="bg-muted/50 mt-1" />
                            </div>
                            {analysisResult.delegateAssessment.suggestedActions && analysisResult.delegateAssessment.suggestedActions.length > 0 && (
                                <div>
                                    <Label className="font-semibold text-md flex items-center gap-1"><AlertTriangle/> Ações Sugeridas / Próximos Passos:</Label>
                                    <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md mt-1">
                                        {analysisResult.delegateAssessment.suggestedActions.map((action, index) => (
                                            <li key={index}>{action}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {analysisResult.delegateAssessment.legalConsiderations && (
                                 <div>
                                    <Label className="font-semibold text-md flex items-center gap-1"><Scale /> Considerações Legais Preliminares:</Label>
                                    <Textarea value={analysisResult.delegateAssessment.legalConsiderations} readOnly rows={4} className="bg-muted/50 mt-1" />
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>

            {analysisResult.extractedText && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileTextIcon className="h-6 w-6 text-primary" /> Texto Processado pela IA</CardTitle>
                        <CardDescription>Este é o texto que a IA utilizou para a análise (pode ser o conteúdo original, texto extraído de imagem/PDF, ou uma mensagem do sistema para arquivos não processáveis).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/50">
                         <pre className="text-sm whitespace-pre-wrap">{analysisResult.extractedText}</pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {!analysisResult.extractedText && !isLoading && selectedFile && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="h-6 w-6 text-yellow-500" /> Conteúdo Processado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Nenhum texto foi explicitamente retornado no campo 'extractedText'. Isto pode ocorrer se o arquivo original não era textual e a extração não foi bem-sucedida, ou se a IA não retornou este campo.</p>
                    </CardContent>
                </Card>
            )}
        </div>
      )}
    </div>
  );
}

export default function DocumentAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <DocumentAnalysisContent />
    </Suspense>
  );
}
