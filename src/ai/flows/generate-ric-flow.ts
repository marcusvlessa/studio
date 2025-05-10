'use server';
/**
 * @fileOverview Fluxo de IA para gerar um Relatório de Investigação Criminal (RIC) consolidado.
 *
 * - generateRic - Gera um RIC com base nas informações de um caso.
 * - GenerateRicInput - O tipo de entrada para a função generateRic.
 * - GenerateRicOutput - O tipo de retorno para a função generateRic.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalysisItemSchema = z.object({
    type: z.string().describe("Tipo da análise (ex: Documento, Áudio, Imagem, Vínculo)."),
    summary: z.string().describe("Resumo da análise ou conteúdo principal."),
    sourceFileName: z.string().optional().describe("Nome do arquivo original, se aplicável."),
});

const GenerateRicInputSchema = z.object({
  caseName: z.string().describe("Nome do caso para o qual o RIC está sendo gerado."),
  caseDescription: z.string().optional().describe("Breve descrição do caso."),
  analyses: z.array(AnalysisItemSchema).describe("Uma lista de análises e evidências coletadas para o caso."),
});
export type GenerateRicInput = z.infer<typeof GenerateRicInputSchema>;

const GenerateRicOutputSchema = z.object({
  reportContent: z.string().describe('O conteúdo completo do Relatório de Investigação Criminal gerado.'),
});
export type GenerateRicOutput = z.infer<typeof GenerateRicOutputSchema>;

export async function generateRic(input: GenerateRicInput): Promise<GenerateRicOutput> {
  return generateRicFlow(input);
}

const generateRicPrompt = ai.definePrompt({
  name: 'generateRicPrompt',
  input: {schema: GenerateRicInputSchema},
  output: {schema: GenerateRicOutputSchema},
  prompt: `
Você é um especialista em investigações criminais e redação de relatórios policiais. Sua tarefa é gerar um Relatório de Investigação Criminal (RIC) detalhado e bem estruturado com base nas informações fornecidas sobre um caso.

**Informações do Caso:**
Nome do Caso: {{{caseName}}}
{{#if caseDescription}}Descrição do Caso: {{{caseDescription}}}{{/if}}

**Análises e Evidências Coletadas:**
{{#if analyses.length}}
  {{#each analyses}}
    - Tipo: {{{this.type}}}
      {{#if this.sourceFileName}}Nome do Arquivo Original: {{{this.sourceFileName}}}{{/if}}
      Resumo/Conteúdo Principal: {{{this.summary}}}
  {{/each}}
{{else}}
  Nenhuma análise ou evidência detalhada foi fornecida para este caso.
{{/if}}

**Instruções para Geração do RIC:**

Estruture o relatório com as seguintes seções, adaptando e detalhando conforme necessário com base nas informações fornecidas:

1.  **CABEÇALHO:**
    *   Título: Relatório de Investigação Criminal
    *   Caso Nº / Nome: {{{caseName}}}
    *   Data de Emissão do Relatório: (Data Atual)
    *   Autoridade Policial Responsável: (Assumir um cargo genérico, ex: Delegado Titular)
    *   Equipe de Investigação: (Assumir uma equipe genérica, ex: Equipe Alfa)

2.  **INTRODUÇÃO / HISTÓRICO DO CASO:**
    *   Breve resumo do caso, incluindo a natureza da investigação. Utilize a "{{caseDescription}}" se fornecida.
    *   Origem da investigação (ex: denúncia, boletim de ocorrência, iniciativa policial).
    *   Objetivo principal da investigação.

3.  **DOS FATOS APURADOS / DESENVOLVIMENTO DA INVESTIGAÇÃO:**
    *   Esta é a seção principal. Detalhe cronologicamente ou tematicamente as diligências realizadas e os fatos descobertos.
    *   Para cada item em "Análises e Evidências Coletadas", integre as informações de forma coesa.
        *   Descreva o que cada análise (documento, áudio, imagem, vínculo) revelou e sua importância para o caso.
        *   Mencione os arquivos originais se os nomes forem fornecidos.
    *   Conecte os pontos entre as diferentes evidências.
    *   Identifique suspeitos, vítimas, testemunhas, modus operandi, se as evidências permitirem.
    *   Descreva observações relevantes, dificuldades encontradas, e progressos.

4.  **ANÁLISE TÉCNICA DAS EVIDÊNCIAS (se aplicável):**
    *   Se houver análises que exijam uma explanação mais técnica (ex: análise de malware, perícia em áudio/imagem), resuma os achados técnicos aqui.

5.  **CONCLUSÃO PRELIMINAR / CONSIDERAÇÕES FINAIS:**
    *   Com base nos fatos apurados, apresente uma conclusão preliminar sobre o caso.
    *   Indique se há indícios de autoria e materialidade de crimes.
    *   Mencione possíveis tipificações penais (crimes que podem ter sido cometidos).
    *   Aponte linhas de investigação futuras, se houver.

6.  **RECOMENDAÇÕES / PRÓXIMOS PASSOS (Opcional, se pertinente):**
    *   Sugestões de novas diligências, pedidos de prisão, busca e apreensão, etc.

**Estilo e Tom:**
*   Linguagem formal, objetiva e técnica, apropriada para um documento policial.
*   Evite jargões excessivos, mas utilize terminologia policial quando adequado.
*   Seja imparcial na apresentação dos fatos.

Gere o relatório completo no campo 'reportContent'. Se as informações forem escassas, construa o relatório da melhor forma possível, indicando as limitações.
Formate o relatório de maneira clara e legível, usando parágrafos e, se necessário, marcadores para listas.
Não inclua esta seção de instruções no relatório final.
`,
});

const generateRicFlow = ai.defineFlow(
  {
    name: 'generateRicFlow',
    inputSchema: GenerateRicInputSchema,
    outputSchema: GenerateRicOutputSchema,
  },
  async (input: GenerateRicInput) => {
    const {output} = await generateRicPrompt(input);
    if (!output) {
      throw new Error("A geração do RIC não retornou um resultado válido.");
    }
    return output;
  }
);
