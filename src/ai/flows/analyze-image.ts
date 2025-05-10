// This file is machine-generated - changes may be lost.

'use server';

/**
 * @fileOverview Fluxo de IA para analisar imagens, extrair dados, gerar descrições, sugerir melhorias e detectar faces.
 *
 * - analyzeImage - Analisa uma imagem para extrair dados relevantes, gerar uma descrição, sugerir melhorias e detectar faces.
 * - AnalyzeImageInput - O tipo de entrada para a função analyzeImage.
 * - AnalyzeImageOutput - O tipo de retorno para a função analyzeImage.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "Uma foto para analisar, como uma URI de dados que deve incluir um tipo MIME e usar codificação Base64. Formato esperado: 'data:<mimetype>;base64,<dados_codificados>'."
    ),
});

export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>;

const FacialRecognitionDetailSchema = z.object({
  boundingBox: z.array(z.number()).optional().describe('Caixa delimitadora da face detectada (ex: [x, y, largura, altura]).'),
  confidence: z.number().optional().describe('Confiança da detecção da face (0 a 1).'),
  attributes: z.record(z.string(), z.any()).optional().describe('Atributos gerais da face (ex: óculos, sorriso), se detectados.')
});

const AnalyzeImageOutputSchema = z.object({
  description: z.string().describe('Uma descrição detalhada do conteúdo da imagem.'),
  possiblePlateRead: z.string().optional().describe('Uma leitura plausível de placa de veículo, se detectada.'),
  enhancementSuggestions: z.array(z.string()).optional().describe('Sugestões de técnicas de melhoramento de imagem que poderiam ser aplicadas e porquê.'),
  facialRecognition: z.object({
    facesDetected: z.number().int().nonnegative().describe('Número de faces humanas detectadas na imagem.'),
    details: z.array(FacialRecognitionDetailSchema).optional().describe('Detalhes sobre cada face detectada, se a IA puder fornecer (sem identificação pessoal).')
  }).optional().describe('Resultados da detecção facial. Não realiza identificação pessoal.')
});

export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

export async function analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
  return analyzeImageFlow(input);
}

const analyzeImagePrompt = ai.definePrompt({
  name: 'analyzeImagePrompt',
  input: {schema: AnalyzeImageInputSchema},
  output: {schema: AnalyzeImageOutputSchema},
  prompt: `Você é um especialista em análise forense de imagens. Seu trabalho é analisar uma imagem e extrair dados relevantes, gerar uma descrição detalhada, sugerir melhorias e detectar faces.

  Analise a seguinte imagem:
  {{media url=photoDataUri}}

  Siga estas instruções:
  1.  **Descrição Detalhada**: Descreva a imagem em detalhes, incluindo objetos, pessoas, ambiente, ações e qualquer outra informação relevante.
  2.  **Leitura de Placa (se aplicável)**: Preste muita atenção à identificação de qualquer texto na imagem, como placas de veículos. Se uma placa for detectada, forneça uma leitura plausível, mas apenas se tiver pelo menos 75% de certeza da leitura.
  3.  **Sugestões de Melhoramento**: Se a qualidade da imagem puder ser melhorada para análise (ex: baixa luminosidade, borrada, ruído), sugira técnicas de processamento de imagem que poderiam ser aplicadas (ex: ajuste de contraste, nitidez, redução de ruído, deinterlacing). Explique brevemente por que cada técnica seria útil.
  4.  **Detecção Facial**:
      *   Indique o número de faces humanas claramente visíveis na imagem.
      *   Se faces forem detectadas, e se a IA puder fornecer, descreva características gerais (sem fazer identificação pessoal), como a presença de óculos, barba, chapéu, ou a direção do olhar, se discernível. Não tente adivinhar identidade, idade exata ou etnia. Apenas características observáveis.

  Seja objetivo e forneça informações factuais baseadas na imagem.
`,
});

const analyzeImageFlow = ai.defineFlow(
  {
    name: 'analyzeImageFlow',
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async input => {
    const {output} = await analyzeImagePrompt(input);
    return output!;
  }
);
