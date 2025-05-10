'use server';

/**
 * @fileOverview Este arquivo define um fluxo Genkit para transcrever arquivos de áudio e gerar um relatório.
 *
 * - transcribeAudio - Uma função que lida com o processo de transcrição de áudio.
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
  transcript: z.string().describe('A transcrição do arquivo de áudio.'),
  report: z.string().describe('Um relatório resumindo o conteúdo do arquivo de áudio.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribeAudioPrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  output: {schema: TranscribeAudioOutputSchema},
  prompt: `Você é um especialista em IA em transcrição e análise de áudio.

Você receberá um arquivo de áudio como entrada e gerará uma transcrição do áudio. Em seguida, gere um relatório resumindo o conteúdo do arquivo de áudio.

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
    return output!;
  }
);
