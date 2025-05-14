// src/app/financial-analysis/page.tsx
"use client";

import React, { useState, type ChangeEvent, useRef, useEffect, Suspense, createRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Landmark, Upload, RotateCcw, Search, Loader2, FileText, Info, AlertCircle, FolderKanban, Download, FileDown, BarChart3, TrendingUp, Users, AlertTriangleIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeFinancialData, type AnalyzeFinancialDataInput, type AnalyzeFinancialDataOutput, type FinancialDashboardData } from "@/ai/flows/analyze-financial-data-flow";
import { Alert as ShadAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FinancialCaseAnalysis } from "@/types/case";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { PdfHeaderConfig } from '@/types/settings';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, PieChart, Pie, Cell } from 'recharts';


declare global {
  interface Window {
    electronAPI?: {
      getPdfHeaderConfig: () => Promise<PdfHeaderConfig | null>;
    };
  }
}

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];

interface FinancialDashboardDisplayProps {
  dashboardData: FinancialDashboardData;
}

const FinancialDashboardDisplay = React.forwardRef<HTMLDivElement, FinancialDashboardDisplayProps>(({ dashboardData }, ref) => {
  const { keyMetrics, topSuspiciousTransactions, involvedPartiesProfiles } = dashboardData;

  const transactionsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    topSuspiciousTransactions.forEach(t => {
      const type = t.type || 'Desconhecido';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [topSuspiciousTransactions]);

  const involvedPartyFlowData = useMemo(() => {
    return involvedPartiesProfiles.map(p => ({
      name: p.name,
      Entrada: parseFloat(p.totalIn?.replace(/[R$.]/g, '').replace(',', '.') || '0'),
      Saída: parseFloat(p.totalOut?.replace(/[R$.]/g, '').replace(',', '.') || '0')
    }));
  }, [involvedPartiesProfiles]);

  return (
    <div ref={ref} className="p-4 bg-background rounded-lg border">
      <h2 className="text-xl font-semibold mb-4 text-center text-primary">Dashboard de Inteligência Financeira</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {keyMetrics.slice(0, 6).map((metric, index) => (
          <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{metric.value} <span className="text-xs text-muted-foreground">{metric.unit}</span></p>
              {metric.category && <p className="text-xs text-muted-foreground mt-1">Categoria: {metric.category}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {transactionsByType.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-md font-semibold flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Distribuição de Tipos de Transações Suspeitas</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={transactionsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {transactionsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `${value} transações`} />
                  <RechartsLegend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {involvedPartyFlowData.length > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-md font-semibold flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Fluxo Financeiro por Envolvido Principal</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={involvedPartyFlowData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={120} interval={0} tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(value, name) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, name === 'Entrada' ? 'Total Entradas' : 'Total Saídas']} />
                  <RechartsLegend />
                  <Bar dataKey="Entrada" fill="hsl(var(--chart-2))" name="Total Entradas" radius={[0, 4, 4, 0]}/>
                  <Bar dataKey="Saída" fill="hsl(var(--chart-4))" name="Total Saídas" radius={[0, 4, 4, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
      
      {topSuspiciousTransactions.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-md font-semibold flex items-center"><AlertTriangleIcon className="mr-2 h-5 w-5 text-destructive"/>Principais Transações Suspeitas (Top {topSuspiciousTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <ul className="space-y-3">
                {topSuspiciousTransactions.map((tx, index) => (
                  <li key={tx.id || index} className="p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                    <p className="font-semibold text-sm">{tx.description} - <span className="font-bold text-primary">{tx.amount}</span></p>
                    {tx.date && <p className="text-xs text-muted-foreground">Data: {tx.date}</p>}
                    {tx.type && <p className="text-xs text-muted-foreground">Tipo: {tx.type}</p>}
                    {tx.riskIndicator && <p className="text-xs text-red-600">Risco: {tx.riskIndicator}</p>}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
FinancialDashboardDisplay.displayName = "FinancialDashboardDisplay";


function FinancialAnalysisContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const caseNameParam = searchParams.get("caseName");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeFinancialDataOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caseContext, setCaseContext] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardRef = createRef<HTMLDivElement>();

  const isCaseSelected = !!caseId;
  const caseName = caseNameParam ? decodeURIComponent(caseNameParam) : "Não especificado";

  const saveAnalysisToCase = async (aiOutput: AnalyzeFinancialDataOutput) => {
    if (!caseId || !selectedFile) return;

    const summary = `Análise Financeira (RIF): ${selectedFile.name}. ${aiOutput.dashboardData?.keyMetrics.find(m => m.label.includes("Total Movimentado"))?.value || 'Relatório gerado.'}`;

    const analysisEntry: Omit<FinancialCaseAnalysis, 'id' | 'analysisDate'> = {
      type: "Financeiro",
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
        throw new Error(errorData.error || 'Falha ao salvar análise financeira no caso.');
      }
      toast({ title: "Análise Financeira Salva", description: `Resultados de "${selectedFile.name}" vinculados ao caso "${caseName}".` });
    } catch (error) {
      console.error("Erro ao salvar análise financeira:", error);
      toast({ variant: "destructive", title: "Falha ao Salvar Análise", description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        setSelectedFile(file);
        setAnalysisResult(null);
        setProgress(0);
        toast({ title: "Arquivo .txt Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie apenas arquivos .txt gerados pelo ExtratorIF." });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!isCaseSelected) {
      toast({ variant: "destructive", title: "Nenhum Caso Selecionado", description: "Vá para Gestão de Casos e selecione um caso antes de prosseguir." });
      return;
    }
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Selecionado", description: "Por favor, selecione um arquivo .txt para analisar." });
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
    }, 500); 

    try {
      const rifTextContent = await selectedFile.text();
      setProgress(30); 

      const input: AnalyzeFinancialDataInput = { 
        rifTextContent, 
        originalFileName: selectedFile.name,
        caseContext: caseContext || `Análise RIF para o caso: ${caseName}`,
       };
      const result = await analyzeFinancialData(input);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Análise Financeira Concluída", description: `Arquivo RIF "${selectedFile.name}" processado para o caso "${caseName}".` });
      await saveAnalysisToCase(result);

    } catch (error) {
      console.error("Erro na análise financeira:", error);
      toast({ variant: "destructive", title: "Falha na Análise Financeira", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    setCaseContext("");
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivos e resultados da análise financeira foram limpos." });
  };

  const handleDownloadPdf = async () => {
    if (!analysisResult?.financialIntelligenceReport || !selectedFile) {
      toast({ variant: "destructive", title: "Erro", description: "Nenhum relatório para baixar." });
      return;
    }
  
    let pdfHeaderConfig: PdfHeaderConfig | null = null;
    if (typeof window !== 'undefined' && window.electronAPI?.getPdfHeaderConfig) {
      try {
        pdfHeaderConfig = await window.electronAPI.getPdfHeaderConfig();
      } catch (error) {
        console.error("Failed to load PDF header config from Electron store:", error);
        toast({ variant: "destructive", title: "Erro de Configuração", description: "Não foi possível carregar a configuração do cabeçalho do PDF." });
      }
    }
  
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });
  
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;
  
    const addHeader = () => {
      if (pdfHeaderConfig?.logoBase64) {
        try {
          const imgProps = doc.getImageProperties(pdfHeaderConfig.logoBase64);
          const aspectRatio = imgProps.width / imgProps.height;
          let logoHeight = 15;
          let logoWidth = logoHeight * aspectRatio;
          if (logoWidth > 40) {
            logoWidth = 40;
            logoHeight = logoWidth / aspectRatio;
          }
          doc.addImage(pdfHeaderConfig.logoBase64, 'PNG', margin, margin - 10, logoWidth, logoHeight);
        } catch (e) {
          console.error("Error adding logo to PDF:", e);
          doc.setFontSize(10);
          doc.text("Logo Indisponível", margin, margin - 5);
        }
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfHeaderConfig?.headerText || `Relatório - ${selectedFile.name}`, pageWidth / 2, margin, { align: 'center' });
      yPosition = margin + 15;
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
      yPosition += 5;
    };
  
    addHeader(); // Add header to the first page
  
    // Add Dashboard Image if data exists
    if (analysisResult.dashboardData && dashboardRef.current) {
        // Temporarily make dashboard visible for capture if it's normally hidden or styled for off-screen
        const originalStyle = dashboardRef.current.style.cssText;
        dashboardRef.current.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 800px; background: white; padding: 10px;'; // Ensure it has a background for capture
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow time for render

        try {
            const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = contentWidth; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (yPosition + imgHeight + 10 > pageHeight - margin) {
              doc.addPage();
              addHeader();
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text("Dashboard de Inteligência Financeira (Resumo Visual)", margin, yPosition);
            yPosition += 10;
            doc.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10; // Add some space after the image

        } catch(e) {
            console.error("Error capturing dashboard image:", e);
            toast({variant: "destructive", title: "Erro ao Gerar Imagem do Dashboard", description: "Não foi possível incluir o dashboard no PDF."});
        } finally {
            dashboardRef.current.style.cssText = originalStyle; // Restore original style
        }
    }
  
    // Add Textual Report
    if (yPosition + 20 > pageHeight - margin) { // Check if new page is needed before text report
        doc.addPage();
        addHeader();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("Relatório de Inteligência Financeira Detalhado", margin, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const reportText = analysisResult.financialIntelligenceReport;
    const lines = doc.splitTextToSize(reportText, contentWidth);
  
    lines.forEach((line: string) => {
      if (yPosition + 7 > pageHeight - margin) { 
        doc.addPage();
        addHeader();
      }
      doc.text(line, margin, yPosition);
      yPosition += 7; 
    });
  
    doc.save(`RIF_${selectedFile.name.replace(/\.[^/.]+$/, "")}.pdf`);
    toast({ title: "Download do PDF Iniciado", description: `RIF_${selectedFile.name}.pdf` });
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center"><Landmark className="mr-3 h-8 w-8 text-primary"/>Módulo de Análise Financeira (RIF/COAF)</h1>
        <p className="text-muted-foreground mt-1">
          Use a ferramenta <a href="https://admin.eforenses.kmdf.com.br/public/download/extratorif.exe" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">ExtratorIF.exe</a> para gerar um arquivo .txt a partir dos documentos RIF do COAF. Em seguida, envie o arquivo .txt gerado para análise.
        </p>
      </header>

      {!isCaseSelected && (
        <ShadAlert variant="destructive" className="mb-4">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>Nenhum Caso Selecionado!</AlertTitle>
          <AlertDescription>
            Por favor, vá para a página de <Link href="/case-management?newCase=true" className="font-semibold underline">Gestão de Casos</Link> para selecionar ou criar um caso antes de prosseguir.
          </AlertDescription>
        </ShadAlert>
      )}

      {isCaseSelected && (
         <ShadAlert variant="default" className="mb-4 bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Analisando para o Caso: {caseName}</AlertTitle>
            <AlertDescription>
              Qualquer análise financeira realizada aqui será vinculada a este caso.
            </AlertDescription>
          </ShadAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo .txt do RIF</CardTitle>
          <CardDescription>Selecione o arquivo .txt gerado pelo ExtratorIF para iniciar a análise financeira.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-md items-center gap-1.5">
            <Label htmlFor="rif-upload">Arquivo .txt (ExtratorIF)</Label>
            <Input id="rif-upload" type="file" accept=".txt,text/plain" onChange={handleFileChange} ref={fileInputRef} disabled={isLoading || !isCaseSelected}/>
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileText className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="case-context">Contexto Adicional do Caso (Opcional)</Label>
            <Textarea 
              id="case-context" 
              value={caseContext} 
              onChange={(e) => setCaseContext(e.target.value)} 
              placeholder="Forneça informações contextuais sobre a investigação que podem ajudar a IA a focar a análise financeira (ex: suspeitos principais, tipo de crime investigado, período de maior interesse)..." 
              rows={3}
              disabled={isLoading || !isCaseSelected}
              className="max-w-xl"
            />
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Label>Progresso da Análise Financeira:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress <= 30 && "Lendo arquivo..."}
                {progress > 30 && progress < 100 && "Analisando dados financeiros com IA (pode levar alguns minutos)..."}
                {progress === 100 && "Concluído!"}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading || !isCaseSelected}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando Dados..." : "Analisar Dados Financeiros"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
            {analysisResult && (
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isLoading}>
                <FileDown className="mr-2 h-4 w-4" /> Baixar PDF com Dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
      
      {/* Hidden div for dashboard capture - will be populated on demand */}
      <div id="dashboard-capture-area" ref={dashboardRef} className="fixed -left-[9999px] -top-[9999px] w-[800px] bg-white p-4">
        {analysisResult?.dashboardData && <FinancialDashboardDisplay dashboardData={analysisResult.dashboardData} />}
      </div>


      {analysisResult && (
        <>
          {analysisResult.dashboardData && (
            <Card className="mt-6">
              <CardHeader>
                 <CardTitle>Dashboard de Inteligência Financeira</CardTitle>
                 {selectedFile && <CardDescription>Visualização dos dados do arquivo: {selectedFile.name}</CardDescription>}
              </CardHeader>
              <CardContent>
                  <FinancialDashboardDisplay dashboardData={analysisResult.dashboardData} />
              </CardContent>
            </Card>
          )}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Relatório de Inteligência Financeira (RIF)</CardTitle>
              {selectedFile && <CardDescription>Resultado da análise textual do arquivo: {selectedFile.name}</CardDescription>}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/50">
                <pre className="text-sm whitespace-pre-wrap font-sans">{analysisResult.financialIntelligenceReport}</pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
      
       {analysisResult && !analysisResult.financialIntelligenceReport && !isLoading && (
         <Card className="mt-6">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center font-semibold">Nenhum relatório textual gerado.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  A IA pode não ter conseguido processar o arquivo ou gerar o relatório textual. Verifique o console para possíveis erros.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FinancialAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <FinancialAnalysisContent />
    </Suspense>
  )
}

