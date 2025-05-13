
'use server';
/**
 * @fileOverview Fluxo de IA para classificar texto em busca de potenciais crimes.
 *
 * - classifyTextForCrimes - Analisa um texto para identificar e classificar crimes.
 * - ClassifyTextForCrimesInput - O tipo de entrada para a função classifyTextForCrimes.
 * - ClassifyTextForCrimesOutput - O tipo de retorno para a função classifyTextForCrimes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CrimeTagSchema = z.object({
  crimeType: z.string().describe("O tipo de crime identificado (ex: Homicídio, Roubo, Estelionato, Tráfico de Drogas, Ameaça, Lesão Corporal, Associação Criminosa, Lavagem de Dinheiro, Corrupção). Se nenhum crime específico for claro, mas houver atividade suspeita relevante para investigação, usar 'Atividade Suspeita Relevante'. Se nenhuma atividade criminal ou suspeita for detectada, este campo não deve ser preenchido."),
  description: z.string().describe("Breve descrição ou justificativa para a classificação do crime com base no texto fornecido, explicando por que o texto sugere essa classificação."),
  confidence: z.number().min(0).max(1).describe("Nível de confiança da classificação do crime (0.0 para incerteza total, 1.0 para certeza total)."),
  involvedParties: z.array(z.string()).optional().describe("Nomes ou descrições das partes explicitamente mencionadas como envolvidas no crime específico, se claramente indicado no texto."),
  relevantExcerpts: z.array(z.string()).optional().describe("Um ou dois trechos curtos e mais significativos do texto que levaram à identificação deste crime específico.")
});
export type CrimeTag = z.infer<typeof CrimeTagSchema>;

const ClassifyTextForCrimesInputSchema = z.object({
  textContent: z.string().describe('O conteúdo textual a ser analisado para classificação de crimes.'),
  context: z.string().optional().describe('Contexto adicional sobre a origem do texto ou o caso investigativo (ex: "Transcrição de interceptação telefônica", "Relatório de vigilância", "Depoimento de testemunha").'),
});
export type ClassifyTextForCrimesInput = z.infer<typeof ClassifyTextForCrimesInputSchema>;

const ClassifyTextForCrimesOutputSchema = z.object({
  crimeTags: z.array(CrimeTagSchema).describe("Lista de tags de crimes identificados no texto. Se nenhum crime ou atividade suspeita relevante for detectada, a lista deve ser vazia."),
  overallCriminalAssessment: z.string().describe("Uma avaliação geral concisa sobre a natureza criminal do texto. Se nenhum crime for detectado, indicar 'Nenhuma atividade criminal aparente ou suspeita relevante detectada no texto.'"),
});
export type ClassifyTextForCrimesOutput = z.infer<typeof ClassifyTextForCrimesOutputSchema>;

export async function classifyTextForCrimes(input: ClassifyTextForCrimesInput): Promise<ClassifyTextForCrimesOutput> {
  if (!input.textContent || input.textContent.trim().length < 10) { // Basic check for empty or too short content
    return {
      crimeTags: [],
      overallCriminalAssessment: "Conteúdo textual insuficiente para análise de crimes."
    };
  }
  return classifyTextForCrimesFlow(input);
}

const classifyTextForCrimesPrompt = ai.definePrompt({
  name: 'classifyTextForCrimesPrompt',
  input: {schema: ClassifyTextForCrimesInputSchema},
  output: {schema: ClassifyTextForCrimesOutputSchema},
  prompt: `Você é um analista de inteligência criminal especializado em identificar e classificar crimes a partir de textos.
Analise o seguinte texto para identificar quaisquer menções ou descrições de atividades criminosas ou suspeitas relevantes para uma investigação.

{{#if context}}
**Contexto Fornecido:** {{{context}}}
Use este contexto para refinar sua análise.
{{/if}}

**Texto para Análise:**
{{{textContent}}}

**Instruções:**
1.  **Identifique Tipos de Crime**: Para cada atividade criminosa ou suspeita relevante identificada, classifique-a usando um 'crimeType' específico (ex: Homicídio, Roubo, Estelionato, Tráfico de Drogas, Ameaça, Lesão Corporal, Associação Criminosa, Lavagem de Dinheiro, Corrupção Ativa/Passiva, Organização Criminosa).
    *   Se a atividade for suspeita mas não claramente um crime específico, use 'Atividade Suspeita Relevante'.
    *   Se o texto não contiver nenhuma menção a crimes ou atividades suspeitas relevantes, o array 'crimeTags' deve ser vazio.
2.  **Descrição/Justificativa**: Forneça uma 'description' concisa explicando por que o texto sugere essa classificação, citando elementos do texto.
3.  **Confiança**: Atribua um nível de 'confidence' (0.0 a 1.0) para cada classificação.
4.  **Envolvidos (Opcional)**: Se o texto mencionar claramente partes envolvidas NO CRIME específico, liste-as em 'involvedParties'.
5.  **Trechos Relevantes (Opcional)**: Inclua um ou dois 'relevantExcerpts' (trechos curtos) do texto que são mais indicativos do crime classificado.
6.  **Avaliação Geral**: Forneça um 'overallCriminalAssessment' conciso sobre a presença ou ausência de informações criminais no texto. Se nenhum crime for encontrado, deve ser "Nenhuma atividade criminal aparente ou suspeita relevante detectada no texto."

**Formato de Saída Esperado:**
Preencha os campos 'crimeTags' e 'overallCriminalAssessment' conforme o schema.
Se o texto for muito vago ou não contiver informações criminais, o array 'crimeTags' deverá ser vazio e o 'overallCriminalAssessment' deverá refletir isso.

Priorize a precisão e relevância para investigações criminais.
Seja específico nos tipos de crime. Evite generalizações se detalhes permitirem uma classificação mais precisa.
`,
});

const classifyTextForCrimesFlow = ai.defineFlow(
  {
    name: 'classifyTextForCrimesFlow',
    inputSchema: ClassifyTextForCrimesInputSchema,
    outputSchema: ClassifyTextForCrimesOutputSchema,
  },
  async (input) => {
    const {output} = await classifyTextForCrimesPrompt(input);
    if (!output) {
      throw new Error("A IA não retornou um resultado válido para a classificação de crimes.");
    }
    // Ensure overallCriminalAssessment is present
    if (!output.overallCriminalAssessment) {
        output.overallCriminalAssessment = output.crimeTags && output.crimeTags.length > 0 
            ? "Atividades criminais ou suspeitas foram detectadas." 
            : "Nenhuma atividade criminal aparente ou suspeita relevante detectada no texto.";
    }
    return output;
  }
);
