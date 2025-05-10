'use server';
/**
 * @fileOverview Fluxo de IA para análise de documentos, extração de texto e geração de resumo.
 *
 * - analyzeDocument - Analisa um documento para extrair conteúdo, resumir e identificar entidades chave.
 * - AnalyzeDocumentInput - O tipo de entrada para a função analyzeDocument.
 * - AnalyzeDocumentOutput - O tipo de retorno para a função analyzeDocument.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDocumentInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "O documento a ser analisado, como uma URI de dados que deve incluir um tipo MIME e usar codificação Base64. Formato esperado: 'data:<mimetype>;base64,<dados_codificados>'."
    ),
  fileName: z.string().optional().describe('O nome do arquivo original, se disponível.'),
});
export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentInputSchema>;

const KeyEntitySchema = z.object({
    type: z.string().describe('O tipo da entidade (ex: Pessoa, Organização, Local, Data, Valor Monetário).'),
    value: z.string().describe('O valor da entidade extraída.'),
});

const AnalyzeDocumentOutputSchema = z.object({
  extractedText: z.string().optional().describe('O texto completo extraído do documento. Pode estar ausente se a extração falhar ou não for aplicável.'),
  summary: z.string().describe('Um resumo conciso do conteúdo do documento.'),
  keyEntities: z.array(KeyEntitySchema).optional().describe('Uma lista de entidades chave identificadas no documento.'),
  language: z.string().optional().describe('O idioma principal detectado no documento (código ISO 639-1, ex: "pt", "en").')
});
export type AnalyzeDocumentOutput = z.infer<typeof AnalyzeDocumentOutputSchema>;

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  return analyzeDocumentFlow(input);
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: AnalyzeDocumentInputSchema},
  output: {schema: AnalyzeDocumentOutputSchema},
  prompt: `Você é um especialista em análise de documentos e extração de informações.
Sua tarefa é processar o documento fornecido, extrair seu conteúdo textual, identificar o idioma principal, gerar um resumo conciso e listar as entidades chave.

Documento para análise ({{fileName}}):
{{media url=fileDataUri}}

Instruções:
1.  **Extração de Texto**: Se o documento for uma imagem ou PDF baseado em imagem, aplique OCR para extrair o texto. Se for um documento textual (ex: PDF textual, DOCX), extraia o texto diretamente. Se a extração de texto não for possível ou relevante (ex: arquivo de áudio passado por engano), o campo extractedText pode ser omitido.
2.  **Identificação de Idioma**: Identifique o idioma principal do texto extraído e retorne seu código ISO 639-1 (ex: "pt" para Português, "en" para Inglês).
3.  **Resumo**: Forneça um resumo conciso e informativo do conteúdo principal do documento.
4.  **Entidades Chave**: Identifique e liste as entidades chave encontradas no texto. Para cada entidade, especifique seu tipo (Pessoa, Organização, Local, Data, Valor Monetário, Email, Telefone, etc.) e o valor.

Priorize a precisão e a relevância das informações extraídas. Se o documento não contiver texto ou for ilegível, indique isso no resumo.
`,
});

const analyzeDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentFlow',
    inputSchema: AnalyzeDocumentInputSchema,
    outputSchema: AnalyzeDocumentOutputSchema,
  },
  async (input: AnalyzeDocumentInput) => {
    const {output} = await analyzeDocumentPrompt(input);
    return output!;
  }
);
