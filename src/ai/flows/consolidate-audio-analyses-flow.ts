'use server';
/**
 * @fileOverview Fluxo de IA para consolidar múltiplos relatórios de análise de áudio em um único relatório investigativo.
 *
 * - consolidateAudioAnalyses - Consolida informações de várias análises de áudio.
 * - ConsolidateAudioAnalysesInput - O tipo de entrada para a função consolidateAudioAnalyses.
 * - ConsolidateAudioAnalysesOutput - O tipo de retorno para a função consolidateAudioAnalyses.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IndividualAudioAnalysisSchema = z.object({
  fileName: z.string().optional().describe("Nome do arquivo de áudio original, se disponível."),
  transcript: z.string().describe('A transcrição detalhada do arquivo de áudio individual.'),
  report: z.string().describe('O relatório de investigação criminal individual gerado para o arquivo de áudio.'),
});

const ConsolidateAudioAnalysesInputSchema = z.object({
  analyses: z.array(IndividualAudioAnalysisSchema).min(1,"É necessária pelo menos uma análise de áudio para consolidação.").describe("Uma lista das transcrições e relatórios individuais de cada arquivo de áudio processado."),
  caseContext: z.string().optional().describe("Contexto geral do caso ou investigação, se houver, para ajudar a IA a focar nos aspectos mais relevantes durante a consolidação."),
});
export type ConsolidateAudioAnalysesInput = z.infer<typeof ConsolidateAudioAnalysesInputSchema>;

const ConsolidateAudioAnalysesOutputSchema = z.object({
  consolidatedReport: z.string().describe('Um Relatório de Investigação Criminal Consolidado, abrangendo todas as informações relevantes dos áudios fornecidos, com uma visão geral, principais achados interconectados, possíveis crimes, envolvidos, e sugestões de diligências conjuntas ou sequenciais.'),
});
export type ConsolidateAudioAnalysesOutput = z.infer<typeof ConsolidateAudioAnalysesOutputSchema>;

export async function consolidateAudioAnalyses(input: ConsolidateAudioAnalysesInput): Promise<ConsolidateAudioAnalysesOutput> {
  return consolidateAudioAnalysesFlow(input);
}

const consolidateAudioAnalysesPrompt = ai.definePrompt({
  name: 'consolidateAudioAnalysesPrompt',
  input: { schema: ConsolidateAudioAnalysesInputSchema },
  output: { schema: ConsolidateAudioAnalysesOutputSchema },
  prompt: `Você é um especialista em IA em análise de inteligência e consolidação de informações investigativas provenientes de múltiplas fontes de áudio.

Sua tarefa é gerar um **Relatório de Investigação Criminal Consolidado e Abrangente** com base em um conjunto de transcrições e relatórios individuais de diferentes arquivos de áudio.

{{#if caseContext}}
**Contexto do Caso:** {{{caseContext}}}
Utilize este contexto para guiar sua análise e priorizar informações.
{{/if}}

**Análises Individuais de Áudio Fornecidas:**
{{#if analyses.length}}
  {{#each analyses}}
    --- INÍCIO DA ANÁLISE INDIVIDUAL {{#if this.fileName}} (Arquivo: {{{this.fileName}}}) {{/if}} ---
    **Transcrição Individual:**
    {{{this.transcript}}}

    **Relatório Individual:**
    {{{this.report}}}
    --- FIM DA ANÁLISE INDIVIDUAL {{#if this.fileName}} (Arquivo: {{{this.fileName}}}) {{/if}} ---

  {{/each}}
{{else}}
  Nenhuma análise de áudio individual foi fornecida. O relatório consolidado deve refletir isso.
{{/if}}

**Instruções para o Relatório Consolidado:**

Com base em TODAS as análises individuais fornecidas (ou na ausência delas, se for o caso):
1.  **Visão Geral Consolidada**: Inicie com um parágrafo introdutório que resuma a natureza geral das conversas e a possível conexão entre elas, se houver. Se nenhuma análise foi fornecida, indique que não há dados para consolidar.
2.  **Principais Achados Interconectados**: Identifique e descreva os principais temas, eventos, pessoas, locais, e informações cruciais que emergem do conjunto dos áudios. Destaque conexões, padrões, contradições ou informações corroborantes entre os diferentes áudios. Não repita integralmente os relatórios individuais, mas sintetize e cruze as informações.
3.  **Linha do Tempo dos Eventos (se aplicável)**: Se for possível inferir uma sequência temporal de eventos a partir dos áudios, apresente-a de forma clara.
4.  **Identificação Consolidada de Envolvidos**: Liste todas as pessoas e organizações mencionadas no conjunto dos áudios, seus papéis inferidos (ex: suspeito principal, cúmplice, vítima, testemunha, contato) e, se possível, como se relacionam entre si com base nas conversas. Agrupe informações sobre a mesma pessoa mesmo que mencionada em áudios diferentes.
5.  **Possíveis Crimes e Modus Operandi**: Com base na totalidade das informações, liste os possíveis crimes que podem ter sido cometidos ou planejados. Descreva o modus operandi geral, se identificável.
6.  **Avaliação de Urgência e Criticidade Geral**: Forneça uma avaliação da urgência e criticidade das informações consolidadas para a investigação policial.
7.  **Sugestões de Diligências Estratégicas**: Sugira próximas diligências investigativas que considerem o panorama completo oferecido pelos áudios. Pense em ações que possam verificar as informações cruzadas, identificar outros envolvidos ou aprofundar a investigação nos pontos mais críticos.
8.  **Conclusão Concisa**: Finalize com uma breve conclusão sobre o que o conjunto dos áudios revela para a investigação.

Seja objetivo, analítico e foque em fornecer uma visão integrada e útil para o progresso da investigação. Evite redundâncias excessivas, mas garanta que nenhuma informação crucial de qualquer áudio seja perdida na consolidação.
Se as informações fornecidas forem insuficientes ou não conectadas, indique isso claramente no relatório. Se não houver áudios para analisar, o relatório deve indicar "Nenhuma análise de áudio fornecida para consolidação."

Preencha o campo 'consolidatedReport' da saída.
`,
});

const consolidateAudioAnalysesFlow = ai.defineFlow(
  {
    name: 'consolidateAudioAnalysesFlow',
    inputSchema: ConsolidateAudioAnalysesInputSchema,
    outputSchema: ConsolidateAudioAnalysesOutputSchema,
  },
  async (input) => {
    if (!input.analyses || input.analyses.length === 0) {
      return { consolidatedReport: "Nenhuma análise de áudio fornecida para consolidação. Não é possível gerar um relatório consolidado." };
    }
    const { output } = await consolidateAudioAnalysesPrompt(input);
    if (!output) {
      throw new Error("A IA não retornou um resultado válido para a consolidação dos relatórios de áudio.");
    }
    return output;
  }
);
