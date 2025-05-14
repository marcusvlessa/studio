
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

    