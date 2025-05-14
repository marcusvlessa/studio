'use server';
/**
 * @fileOverview Fluxo de IA para análise de dados financeiros provenientes de RIF (Relatório de Inteligência Financeira) do COAF.
 *
 * - analyzeFinancialData - Analisa o conteúdo textual de um arquivo RIF (gerado por extrator) para identificar movimentações atípicas, conexões e gerar um relatório de inteligência financeira, além de dados estruturados para um dashboard.
 * - AnalyzeFinancialDataInput - O tipo de entrada para a função analyzeFinancialData.
 * - AnalyzeFinancialDataOutput - O tipo de retorno para a função analyzeFinancialData.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeFinancialDataInputSchema = z.object({
  rifTextContent: z.string().describe("Conteúdo textual completo do arquivo RIF extraído (geralmente um .txt gerado por uma ferramenta como 'extratorif.exe'). Este texto contém informações das tabelas de Comunicação, Envolvidos e Ocorrências."),
  originalFileName: z.string().optional().describe("Nome do arquivo RIF original, se disponível, para referência no relatório."),
  caseContext: z.string().optional().describe("Contexto adicional sobre o caso investigativo para guiar e enriquecer a análise financeira."),
});
export type AnalyzeFinancialDataInput = z.infer<typeof AnalyzeFinancialDataInputSchema>;

const FinancialMetricSchema = z.object({
  label: z.string().describe("Nome da métrica. Ex: 'Valor Total Movimentado', 'Número de Transações Atípicas', 'Maior Transação Individual'."),
  value: z.string().describe("Valor da métrica. Ex: 'R$ 1.250.000,00', '15', 'R$ 250.000,00 (João Silva para Empresa X)'."),
  unit: z.string().optional().describe("Unidade da métrica, se aplicável. Ex: 'R$', '%', 'transações'."),
  category: z.enum(["Geral", "Risco", "Volume", "Frequência"]).optional().describe("Categoria da métrica para agrupamento no dashboard.")
});

const TopTransactionSchema = z.object({
  id: z.string().optional().describe("ID ou referência da transação, se disponível no RIF."),
  date: z.string().optional().describe("Data da transação (DD/MM/AAAA)."),
  description: z.string().describe("Breve descrição da transação, incluindo envolvidos se possível."),
  amount: z.string().describe("Valor da transação com moeda (ex: R$ 10.000,00)."),
  type: z.string().optional().describe("Tipo da transação (ex: TED, PIX, Depósito)."),
  riskIndicator: z.string().optional().describe("Breve indicador de risco ou atipicidade (ex: 'Valor elevado e incompatível', 'Fracionamento').")
});

const InvolvedPartyFinancialProfileSchema = z.object({
  name: z.string().describe("Nome do envolvido (pessoa ou organização)."),
  document: z.string().optional().describe("CPF/CNPJ do envolvido."),
  totalIn: z.string().optional().describe("Valor total de entrada para este envolvido (ex: R$ 50.000,00). Se não houver, indicar 'N/A' ou omitir."),
  totalOut: z.string().optional().describe("Valor total de saída deste envolvido (ex: R$ 30.000,00). Se não houver, indicar 'N/A' ou omitir."),
  transactionCount: z.number().int().optional().describe("Número de transações relacionadas a este envolvido."),
  primaryRole: z.string().optional().describe("Papel principal inferido nas transações (ex: Remetente Principal, Beneficiário Frequente).")
});

const FinancialDashboardDataSchema = z.object({
  keyMetrics: z.array(FinancialMetricSchema).max(10).describe("Lista de até 10 principais métricas financeiras chave extraídas do RIF."),
  topSuspiciousTransactions: z.array(TopTransactionSchema).max(10).describe("Lista de até 10 transações mais suspeitas ou de maior valor."),
  involvedPartiesProfiles: z.array(InvolvedPartyFinancialProfileSchema).max(5).describe("Resumo do perfil financeiro de até 5 envolvidos chave.")
});
export type FinancialDashboardData = z.infer<typeof FinancialDashboardDataSchema>;


const AnalyzeFinancialDataOutputSchema = z.object({
  financialIntelligenceReport: z.string().describe("Relatório de Inteligência Financeira (RIF) detalhado, gerado pela IA com base na análise dos dados fornecidos. Inclui seções como introdução, análise de comunicação, envolvidos, ocorrências, movimentações atípicas, conexões, indicadores de alerta, avaliação de risco e conclusões."),
  dashboardData: FinancialDashboardDataSchema.optional().describe("Dados estruturados para exibição em um dashboard BI. Estes dados devem ser um subconjunto focado das informações do relatório textual, priorizando métricas e resumos."),
});
export type AnalyzeFinancialDataOutput = z.infer<typeof AnalyzeFinancialDataOutputSchema>;

export async function analyzeFinancialData(input: AnalyzeFinancialDataInput): Promise<AnalyzeFinancialDataOutput> {
  if (!input.rifTextContent || input.rifTextContent.trim() === "") {
    return { 
        financialIntelligenceReport: "Conteúdo do arquivo RIF está vazio ou ausente. Não é possível realizar a análise.",
        dashboardData: {
            keyMetrics: [{label: "Erro", value: "Conteúdo do RIF ausente", category: "Geral"}],
            topSuspiciousTransactions: [],
            involvedPartiesProfiles: []
        }
    };
  }
  return analyzeFinancialDataFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataInputSchema},
  output: {schema: AnalyzeFinancialDataOutputSchema},
  prompt: `Você é uma Inteligência Artificial especializada em análise de dados financeiros e inteligência, com foco em Relatórios de Inteligência Financeira (RIF) do COAF. Sua tarefa é analisar o conteúdo textual de um arquivo RIF (previamente extraído para formato .txt) e gerar DUAS saídas:
1.  Um Relatório de Inteligência Financeira (RIF) textual detalhado e perspicaz ('financialIntelligenceReport').
2.  Dados estruturados para um dashboard de BI ('dashboardData'), contendo métricas chave, transações suspeitas e perfis financeiros de envolvidos.

**Contexto da Análise:**
{{#if originalFileName}}Arquivo de Origem (referência): {{{originalFileName}}}{{/if}}
{{#if caseContext}}Contexto do Caso (para guiar a análise): {{{caseContext}}}{{/if}}

**Conteúdo do Arquivo RIF para Análise:**
{{{rifTextContent}}}

**Instruções para Geração do Relatório de Inteligência Financeira (Campo: 'financialIntelligenceReport'):**

Com base no conteúdo textual fornecido, que representa dados extraídos de um RIF (incluindo informações das tabelas de Comunicação, Envolvidos e Ocorrências/Operações):

1.  **Interpretação dos Dados:**
    *   Identifique e extraia as informações relevantes de cada seção/tabela implícita no texto (Comunicação, Envolvidos, Ocorrências). Preste atenção a datas, valores, tipos de operação, nomes, CPFs/CNPJs, endereços, e descrições.

2.  **Análise Detalhada:**
    *   **Comunicação:** Data de envio, período coberto, instituição comunicante.
    *   **Envolvidos:** Identifique pessoas físicas e jurídicas, seus papéis (remetente, destinatário, beneficiário, etc.), e quaisquer informações cadastrais relevantes. Verifique por possíveis conexões entre envolvidos (ex: mesmo endereço, sobrenomes, etc.).
    *   **Ocorrências/Operações:** Analise cada operação financeira, incluindo tipo, data, valor, moeda, forma de pagamento, origem e destino dos recursos.

3.  **Estrutura do Relatório Textual ('financialIntelligenceReport'):**
    Siga rigorosamente as seções abaixo:

    *   **I. INTRODUÇÃO E ESCOPO DA ANÁLISE:**
        *   Breve descrição do objetivo da análise e o período coberto (baseado nos dados da "Comunicação", se inferível).
        *   Mencione o arquivo de origem se fornecido ({{{originalFileName}}}).
        *   Incorpore o {{{caseContext}}} se fornecido.

    *   **II. SUMÁRIO DOS DADOS DA COMUNICAÇÃO:**
        *   Principais informações extraídas sobre a comunicação RIF em si (ex: data de envio, período analisado, instituição reportante).

    *   **III. ANÁLISE DOS ENVOLVIDOS:**
        *   Liste os principais envolvidos identificados (pessoas e organizações).
        *   Detalhe as informações relevantes de cada um (CPF/CNPJ, papel na(s) operação(ões), etc.).
        *   Destaque quaisquer observações importantes sobre os envolvidos (ex: PEPs, participação em múltiplas operações suspeitas, informações cadastrais incompletas ou inconsistentes).

    *   **IV. ANÁLISE DAS OCORRÊNCIAS/OPERAÇÕES:**
        *   Descreva as operações financeiras mais significativas ou suspeitas.
        *   Agrupe operações por tipo, valor, ou outros critérios relevantes, se fizer sentido.
        *   Destaque volumes movimentados, frequência das operações, e formas de pagamento utilizadas.

    *   **V. IDENTIFICAÇÃO DE MOVIMENTAÇÕES ATÍPICAS E VALORES RELEVANTES:**
        *   Identifique e descreva quaisquer operações ou padrões que se desviem do esperado ou que sejam considerados atípicos.
        *   Liste os maiores valores transacionados e as operações mais frequentes.
        *   Analise a compatibilidade das movimentações com a atividade econômica declarada dos envolvidos (se essa informação estiver presente ou for inferível).

    *   **VI. CONEXÕES E VÍNCULOS IDENTIFICADOS:**
        *   Descreva as conexões financeiras e relacionais entre os envolvidos, com base nas operações e dados cadastrais. (Ex: "Envolvido A transferiu X para Envolvido B", "Envolvidos C e D compartilham o mesmo endereço").
        *   Se possível, crie uma representação textual de uma mini-rede de relacionamentos.

    *   **VII. INDICADORES DE ALERTA (RED FLAGS) E POSSÍVEIS TIPOLOGIAS CRIMINAIS:**
        *   Com base na análise, liste os indicadores de alerta (red flags) observados que podem sugerir atividades ilícitas (ex: fracionamento de depósitos, uso excessivo de dinheiro em espécie, operações incompatíveis com o perfil, triangulação de recursos, utilização de interpostas pessoas).
        *   Sugira possíveis tipologias criminais que podem estar associadas aos padrões observados (ex: lavagem de dinheiro, financiamento ao terrorismo, fraude, corrupção). Seja cauteloso e use termos como "indícios de", "sugere possível", "poderia configurar".

    *   **VIII. AVALIAÇÃO GERAL DE RISCO:**
        *   Forneça uma avaliação concisa do nível de risco financeiro e criminal associado às informações analisadas (ex: Baixo, Médio, Alto, Crítico). Justifique brevemente.

    *   **IX. CONCLUSÕES E RECOMENDAÇÕES:**
        *   Resuma as principais conclusões da análise.
        *   Sugira possíveis diligências investigativas ou ações de aprofundamento (ex: "Solicitar informações bancárias detalhadas", "Verificar antecedentes dos envolvidos", "Aprofundar investigação sobre a empresa X").

**Instruções para Geração dos Dados do Dashboard (Campo: 'dashboardData'):**

Com base na MESMA análise do conteúdo textual, extraia e estruture os seguintes dados para o dashboard:

1.  **Métricas Chave ('keyMetrics'):** Até 10 métricas.
    *   Exemplos:
        *   "Valor Total Movimentado no Período" (some todos os valores das ocorrências)
        *   "Número Total de Transações Analisadas"
        *   "Número de Envolvidos Identificados"
        *   "Maior Transação Individual" (valor e descrição breve)
        *   "Número de Transações Consideradas Atípicas" (com base na sua análise para o relatório textual)
        *   "Percentual de Transações em Espécie" (se identificável)
        *   "Número de Países de Destino/Origem Diferentes" (se aplicável e identificável)
    *   Para cada métrica: 'label', 'value' (formatado, ex: "R$ X.XXX,XX"), 'unit' (opcional), 'category' (opcional).

2.  **Principais Transações Suspeitas ('topSuspiciousTransactions'):** Até 10 transações.
    *   Selecione as transações que você considerou mais relevantes ou suspeitas durante a elaboração do relatório textual.
    *   Para cada transação: 'id' (opcional), 'date' (opcional), 'description' (breve, incluindo envolvidos se possível), 'amount' (formatado), 'type' (opcional), 'riskIndicator' (breve justificativa da suspeita).

3.  **Perfis Financeiros dos Envolvidos ('involvedPartiesProfiles'):** Até 5 envolvidos.
    *   Escolha os envolvidos mais significativos (ex: maior volume movimentado, maior número de transações suspeitas, PEPs).
    *   Para cada envolvido: 'name', 'document' (CPF/CNPJ), 'totalIn' (valor total de entrada, se aplicável), 'totalOut' (valor total de saída, se aplicável), 'transactionCount', 'primaryRole' (papel inferido). Se 'totalIn' ou 'totalOut' não for aplicável ou não puder ser calculado, pode omitir ou indicar 'N/A'.

**Formato e Tom (para o Relatório Textual):**
*   Linguagem formal, técnica, objetiva e imparcial, apropriada para um relatório de inteligência financeira.
*   Seja claro, conciso e direto ao ponto. Use marcadores e parágrafos para facilitar a leitura. Evite especulações não fundamentadas nos dados.

**Considerações Gerais:**
*   Se os dados fornecidos no 'rifTextContent' forem insuficientes, incompletos ou de difícil interpretação, indique claramente essas limitações no relatório textual e tente fornecer o máximo possível de dados estruturados para o dashboard, mesmo que parciais ou com observações.
*   Certifique-se de que o 'financialIntelligenceReport' seja abrangente e cubra todas as seções solicitadas.
*   Os dados para o 'dashboardData' devem ser consistentes com as conclusões do 'financialIntelligenceReport'.

Priorize a precisão e a utilidade das informações para uma investigação.
`,
});

const analyzeFinancialDataFlow = ai.defineFlow(
  {
    name: 'analyzeFinancialDataFlow',
    inputSchema: AnalyzeFinancialDataInputSchema,
    outputSchema: AnalyzeFinancialDataOutputSchema,
  },
  async (input: AnalyzeFinancialDataInput): Promise<AnalyzeFinancialDataOutput> => {
    const { output } = await analyzeFinancialDataPrompt(input);

    if (!output) {
      throw new Error("A análise dos dados financeiros não retornou um resultado válido da IA.");
    }
    if (!output.dashboardData) {
        // Provide a fallback if dashboardData is missing, though the prompt should ensure it.
        output.dashboardData = {
            keyMetrics: [{label: "Aviso", value: "Dados do dashboard não gerados pela IA.", category: "Geral"}],
            topSuspiciousTransactions: [],
            involvedPartiesProfiles: []
        };
    }
    return output;
  }
);

```
  </change>
  <change>
    <file>src/app/financial-analysis/page.tsx</file>
    <description>Integrate BI dashboard display and PDF export functionality. Added html2canvas for capturing the dashboard as an image to include in the PDF. Modified UI to display dashboard metrics and charts. Updated PDF generation logic.</description>
    <content><![CDATA[// src/app/financial-analysis/page.tsx
"use client";

import { useState, type ChangeEvent, useRef, useEffect, Suspense, createRef } from "react";
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

```
  </change>
  <change>
    <file>src/types/case.ts</file>
    <description>Update FinancialCaseAnalysis type to include FinancialDashboardData for BI dashboard integration.</description>
    <content><![CDATA[// src/types/case.ts


import type { AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import type { TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";
import type { ConsolidateAudioAnalysesOutput } from "@/ai/flows/consolidate-audio-analyses-flow";
import type { AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import type { FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import type { AnalyzeFinancialDataOutput, FinancialDashboardData } from "@/ai/flows/analyze-financial-data-flow"; // Import FinancialDashboardData
import type { ClassifyTextForCrimesOutput } from "@/ai/flows/classify-text-for-crimes-flow"; 

interface BaseAnalysis {
  id: string;
  analysisDate: string;
  originalFileName?: string;
  summary: string; 
}

export interface DocumentCaseAnalysis extends BaseAnalysis {
  type: "Documento";
  data: AnalyzeDocumentOutput; 
}

export interface AudioCaseAnalysis extends BaseAnalysis {
  type: "Áudio";
  data: TranscribeAudioOutput & { crimeAnalysisResults?: ClassifyTextForCrimesOutput }; 
}

export interface AudioConsolidatedCaseAnalysis extends BaseAnalysis {
  type: "Áudio Consolidado";
  data: ConsolidateAudioAnalysesOutput; 
}

export interface ImageCaseAnalysis extends BaseAnalysis {
  type: "Imagem";
  data: AnalyzeImageOutput;
}

export interface LinkCaseAnalysis extends BaseAnalysis {
  type: "Vínculo";
  data: FindEntityRelationshipsOutput;
}

export interface FinancialCaseAnalysis extends BaseAnalysis {
  type: "Financeiro";
  data: AnalyzeFinancialDataOutput; // This already includes dashboardData: FinancialDashboardData | undefined
}


export type CaseAnalysis =
  | DocumentCaseAnalysis
  | AudioCaseAnalysis
  | AudioConsolidatedCaseAnalysis
  | ImageCaseAnalysis
  | LinkCaseAnalysis
  | FinancialCaseAnalysis;

export interface Case {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  status: "Aberto" | "Em Investigação" | "Resolvido" | "Fechado";
  relatedAnalyses: CaseAnalysis[];
}

export interface AggregatedCrimeTag {
  name: string; // Keep 'name' for BarChart dataKey compatibility
  crimeType: string;
  count: number;
  fill: string; 
}

// Define an API key storage type
export interface ApiKeyStore {
  googleApiKey?: string;
}

```
  </change>
  <change>
    <file>package.json</file>
    <description>Add html2canvas and recharts as dependencies for BI dashboard image capture and display.</description>
    <content><![CDATA[{
  "name": "nextn",
  "version": "0.1.0",
  "private": true,
  "main": "electron.js",
  "scripts": {
    "dev": "next dev --turbopack -p 9002",
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts",
    "build": "next build && npm run build:flows",
    "build:flows": "node src/ai/build.mjs",
    "export": "next export",
    "start": "npm run build && node electron.js",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "electron:build": "npm run build && npm run export && electron-builder",
    "postinstall": "patch-package"
  },
  "dependencies": {
    "@genkit-ai/googleai": "^1.8.0",
    "@genkit-ai/next": "^1.8.0",
    "@hookform/resolvers": "^4.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@tanstack-query-firebase/react": "^1.0.5",
    "@tanstack/react-query": "^5.66.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dagre": "^0.8.5",
    "date-fns": "^3.6.0",
    "dotenv": "^16.5.0",
    "electron-store": "^10.0.0",
    "firebase": "^11.7.0",
    "genkit": "^1.8.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1",
    "lucide-react": "^0.475.0",
    "next": "15.2.3",
    "patch-package": "^8.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "reactflow": "11.11.4",
    "recharts": "^2.15.1",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52",
    "@types/jspdf": "^2.0.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "genkit-cli": "^1.8.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  },
  "build": {
    "appId": "com.example.cyberric",
    "productName": "CyberRIC",
    "copyright": "Copyright © 2024 ${author}",
    "files": [
      "dist/**/*",
      "electron.js",
      "preload.js",
      "package.json",
      "out/**/*",
      "public/**/*",
      "src/ai/dev.js",
      "dist_flows/**/*"
    ],
    "directories": {
      "buildResources": "assets",
      "output": "release"
    },
    "mac": {
      "category": "public.app-category.utilities"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": [
        "AppImage",
        "deb",
        "rpm"
      ]
    }
  }
}

