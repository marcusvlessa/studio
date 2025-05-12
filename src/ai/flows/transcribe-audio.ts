'use server';

/**
 * @fileOverview Este arquivo define um fluxo Genkit para transcrever arquivos de áudio e gerar um relatório investigativo.
 *
 * - transcribeAudio - Uma função que lida com o processo de transcrição de áudio e geração de relatório.
 * - TranscribeAudioInput - O tipo de entrada para a função transcribeAudio.
 * - TranscribeAudioOutput - O tipo de retorno para a função transcribeAudio.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "O arquivo de áudio a ser transcrito, como uma URI de dados que deve incluir um tipo MIME e usar codificação Base64. Formato esperado: 'data:<mimetype>;base64,<dados_codificados>'."
    ),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcript: z.string().describe('A transcrição detalhada do arquivo de áudio, com identificação dos interlocutores, se possível (ex: Interlocutor A, Interlocutor B).'),
  report: z.string().describe('Um Relatório de Investigação Criminal Consolidado com base no conteúdo do áudio, incluindo resumo, pontos chave, possíveis crimes, envolvidos, urgência e sugestões de diligências.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  output: {schema: TranscribeAudioOutputSchema},
  prompt: `Você é um especialista em IA em transcrição e análise de áudio, com foco em investigações criminais.

Você receberá um arquivo de áudio como entrada. Suas tarefas são:
1.  **Transcrição Detalhada com Identificação de Interlocutores**:
    *   Gere uma transcrição precisa do áudio.
    *   Na transcrição, identifique e rotule claramente os diferentes interlocutores (ex: Interlocutor A, Interlocutor B, Desconhecido 1). Se houver apenas um interlocutor, indique isso (ex: Interlocutor Único). Se as vozes não puderem ser distinguidas, transcreva o áudio da melhor forma possível sem atribuição de interlocutor.
2.  **Relatório de Investigação Criminal Consolidado**:
    *   Com base na transcrição e no áudio, gere um **Relatório de Investigação Criminal Consolidado**.
    *   Este relatório deve:
        *   Resumir o conteúdo principal do áudio, focando nos aspectos relevantes para uma investigação.
        *   Identificar os principais pontos de interesse (ex: menção a crimes, planos, nomes, locais, datas, informações financeiras, ameaças, confissões).
        *   Listar possíveis crimes mencionados ou implícitos no áudio, com breve justificativa.
        *   Identificar os envolvidos (pessoas, organizações mencionadas) e seus possíveis papéis (ex: suspeito, vítima, testemunha, cúmplice), se inferível.
        *   Avaliar a urgência ou criticidade das informações para uma investigação policial (ex: Baixa, Média, Alta, Crítica).
        *   Sugerir possíveis próximas diligências investigativas com base no conteúdo (ex: "Verificar identidade de 'Fulano'", "Aprofundar investigação sobre transação X").
    *   Se o áudio não contiver informações clara ou diretamente relevantes para uma investigação criminal, o relatório deve indicar "Nenhuma informação criminalmente relevante detectada neste áudio." de forma explícita e concisa.

Preencha os campos 'transcript' e 'report' da saída.

Áudio: {{media url=audioDataUri}}`,
});

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async input => {
    const {output} = await transcribeAudioPrompt(input);
    if (!output) {
        throw new Error("A IA não retornou um resultado válido para a transcrição e análise do áudio.");
    }
    return output;
  }
);

