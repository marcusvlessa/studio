'use server';
/**
 * @fileOverview Fluxo de IA para análise de dados financeiros provenientes de RIF (Relatório de Inteligência Financeira) do COAF.
 *
 * - analyzeFinancialData - Analisa o conteúdo textual de um arquivo RIF (gerado por extrator) para identificar movimentações atípicas, conexões e gerar um relatório de inteligência financeira.
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

const AnalyzeFinancialDataOutputSchema = z.object({
  financialIntelligenceReport: z.string().describe("Relatório de Inteligência Financeira (RIF) detalhado, gerado pela IA com base na análise dos dados fornecidos. Inclui seções como introdução, análise de comunicação, envolvidos, ocorrências, movimentações atípicas, conexões, indicadores de alerta, avaliação de risco e conclusões."),
});
export type AnalyzeFinancialDataOutput = z.infer<typeof AnalyzeFinancialDataOutputSchema>;

export async function analyzeFinancialData(input: AnalyzeFinancialDataInput): Promise<AnalyzeFinancialDataOutput> {
  if (!input.rifTextContent || input.rifTextContent.trim() === "") {
    return { financialIntelligenceReport: "Conteúdo do arquivo RIF está vazio ou ausente. Não é possível realizar a análise." };
  }
  return analyzeFinancialDataFlow(input);
}

const analyzeFinancialDataPrompt = ai.definePrompt({
  name: 'analyzeFinancialDataPrompt',
  input: {schema: AnalyzeFinancialDataInputSchema},
  output: {schema: AnalyzeFinancialDataOutputSchema},
  prompt: `Você é uma Inteligência Artificial especializada em análise de dados financeiros e inteligência, com foco em Relatórios de Inteligência Financeira (RIF) do COAF. Sua tarefa é analisar o conteúdo textual de um arquivo RIF (previamente extraído para formato .txt) e gerar um Relatório de Inteligência Financeira (RIF) detalhado e perspicaz.

**Contexto da Análise:**
{{#if originalFileName}}Arquivo de Origem (referência): {{{originalFileName}}}{{/if}}
{{#if caseContext}}Contexto do Caso (para guiar a análise): {{{caseContext}}}{{/if}}

**Conteúdo do Arquivo RIF para Análise:**
{{{rifTextContent}}}

**Instruções para Geração do Relatório de Inteligência Financeira:**

Com base no conteúdo textual fornecido, que representa dados extraídos de um RIF (incluindo informações das tabelas de Comunicação, Envolvidos e Ocorrências/Operações):

1.  **Interpretação dos Dados:**
    *   Identifique e extraia as informações relevantes de cada seção/tabela implícita no texto (Comunicação, Envolvidos, Ocorrências). Preste atenção a datas, valores, tipos de operação, nomes, CPFs/CNPJs, endereços, e descrições.

2.  **Análise Detalhada:**
    *   **Comunicação:** Data de envio, período coberto, instituição comunicante.
    *   **Envolvidos:** Identifique pessoas físicas e jurídicas, seus papéis (remetente, destinatário, beneficiário, etc.), e quaisquer informações cadastrais relevantes. Verifique por possíveis conexões entre envolvidos (ex: mesmo endereço, sobrenomes, etc.).
    *   **Ocorrências/Operações:** Analise cada operação financeira, incluindo tipo, data, valor, moeda, forma de pagamento, origem e destino dos recursos.

3.  **Geração do Relatório de Inteligência Financeira (RIF):**
    Estruture o relatório ('financialIntelligenceReport') com as seguintes seções obrigatórias:

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

**Formato e Tom:**
*   Linguagem formal, técnica, objetiva e imparcial, apropriada para um relatório de inteligência financeira.
*   Seja claro, conciso e direto ao ponto.
*   Use marcadores e parágrafos para facilitar a leitura.
*   Evite especulações não fundamentadas nos dados.

Se os dados fornecidos no 'rifTextContent' forem insuficientes, incompletos ou de difícil interpretação, indique claramente essas limitações no relatório, especialmente na seção de Introdução.
Certifique-se de que o 'financialIntelligenceReport' seja abrangente e cubra todas as seções solicitadas.
`,
});

const analyzeFinancialDataFlow = ai.defineFlow(
  {
    name: 'analyzeFinancialDataFlow',
    inputSchema: AnalyzeFinancialDataInputSchema,
    outputSchema: AnalyzeFinancialDataOutputSchema,
  },
  async (input: AnalyzeFinancialDataInput): Promise<AnalyzeFinancialDataOutput> => {
    // A IA agora processa diretamente o conteúdo textual.
    // Validações adicionais podem ser feitas aqui se necessário.
    const { output } = await analyzeFinancialDataPrompt(input);

    if (!output) {
      throw new Error("A análise dos dados financeiros não retornou um resultado válido da IA.");
    }
    return output;
  }
);
