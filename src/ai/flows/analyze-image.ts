// This file is machine-generated - changes may be lost.

'use server';

/**
 * @fileOverview Fluxo de IA para analisar imagens, extrair dados, gerar descrições, sugerir melhorias, detectar faces e gerar uma versão melhorada da imagem.
 *
 * - analyzeImage - Analisa uma imagem para extrair dados relevantes, gerar uma descrição, sugerir melhorias, detectar faces e gerar uma imagem aprimorada.
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
  attributesDescription: z.string().optional().describe('Descrição textual dos atributos gerais da face (ex: "possui óculos, aparenta estar sorrindo"), se detectados.'),
  estimatedAge: z.string().optional().describe('Estimativa da faixa etária da face detectada (ex: "25-35 anos", "criança", "idoso"). Se não puder estimar, indicar "Não estimável".')
});

const VehicleDetailSchema = z.object({
  make: z.string().optional().describe('Marca do veículo detectado (ex: Ford, Chevrolet).'),
  model: z.string().optional().describe('Modelo do veículo detectado (ex: Fiesta, Onix).'),
  confidence: z.number().optional().describe('Confiança da detecção do veículo (0 a 1).')
});

const AnalyzeImageOutputSchema = z.object({
  description: z.string().describe('Uma descrição detalhada do conteúdo da imagem, incluindo menção explícita à marca e modelo de quaisquer veículos reconhecidos.'),
  possiblePlateRead: z.string().optional().describe('Uma leitura plausível de placa de veículo, se detectada.'),
  enhancementSuggestions: z.array(z.string()).optional().describe('Sugestões de técnicas de melhoramento de imagem que poderiam ser aplicadas e porquê, incluindo as que foram implicitamente usadas pela IA para a análise (se aplicável).'),
  facialRecognition: z.object({
    facesDetected: z.number().int().nonnegative().describe('Número de faces humanas detectadas na imagem.'),
    details: z.array(FacialRecognitionDetailSchema).optional().describe('Detalhes sobre cada face detectada, se a IA puder fornecer (sem identificação pessoal).')
  }).optional().describe('Resultados da detecção facial. Não realiza identificação pessoal.'),
  vehicleDetails: z.array(VehicleDetailSchema).optional().describe('Lista de veículos detectados com suas possíveis marcas e modelos.'),
  enhancedPhotoDataUri: z.string().optional().describe("A URI de dados da imagem melhorada pela IA, se o melhoramento foi aplicado e bem-sucedido."),
});

export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

// Helper function to extract MIME type from data URI
function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  return match ? match[1] : null;
}

const SUPPORTED_IMAGE_MIME_TYPES_FOR_GEMINI = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
];

export async function analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
  const mimeType = getMimeTypeFromDataUri(input.photoDataUri);
  if (!mimeType || !SUPPORTED_IMAGE_MIME_TYPES_FOR_GEMINI.includes(mimeType.toLowerCase())) {
    const supportedTypes = SUPPORTED_IMAGE_MIME_TYPES_FOR_GEMINI.map(t => t.split('/')[1].toUpperCase()).join(', ');
    throw new Error(`Tipo de imagem não suportado: ${mimeType || 'desconhecido'}. Por favor, use ${supportedTypes}.`);
  }
  return analyzeImageFlow(input);
}

const analyzeImageTextPrompt = ai.definePrompt({
  name: 'analyzeImageTextPrompt',
  input: {schema: AnalyzeImageInputSchema},
  output: {
    schema: AnalyzeImageOutputSchema.omit({ enhancedPhotoDataUri: true }) // Textual analysis doesn't produce enhanced image URI
  },
  prompt: `Você é um especialista em análise forense de imagens. Seu trabalho é analisar uma imagem e extrair dados relevantes, gerar uma descrição detalhada, sugerir melhorias (e listar as aplicadas por você, se houver), detectar faces e identificar veículos.

  Analise a seguinte imagem:
  {{media url=photoDataUri}}

  Siga estas instruções:
  1.  **Descrição Detalhada**: Descreva a imagem em detalhes, incluindo objetos, pessoas, ambiente, ações e qualquer outra informação relevante. **Crucialmente, se veículos forem identificados (item 5), inclua a marca e modelo de cada veículo reconhecido diretamente nesta descrição textual.**
  2.  **Leitura de Placa (se aplicável)**: Preste muita atenção à identificação de qualquer texto na imagem, como placas de veículos. Se uma placa for detectada, forneça uma leitura plausível, mas apenas se tiver pelo menos 75% de certeza da leitura. Se nenhuma placa for claramente legível, indique isso.
  3.  **Sugestões e Aplicações de Melhoramento**:
      *   Se a qualidade da imagem puder ser melhorada para análise (ex: baixa luminosidade, borrada, ruído), sugira técnicas de processamento de imagem que poderiam ser aplicadas (ex: ajuste de contraste, nitidez, redução de ruído, deinterlacing). Explique brevemente por que cada técnica seria útil.
      *   Se, para realizar sua análise, você implicitamente aplicou alguma técnica de melhoramento (ex: aumento de nitidez para ler um texto), mencione quais foram.
  4.  **Detecção Facial**:
      *   Indique o número de faces humanas claramente visíveis na imagem. Se nenhuma face for detectada, retorne 0.
      *   Se faces forem detectadas, e se a IA puder fornecer, descreva características gerais para cada uma (sem fazer identificação pessoal), como a presença de óculos, barba, chapéu, ou a direção do olhar, se discernível, no campo 'attributesDescription'.
      *   **Estimativa de Idade**: Para cada face detectada, forneça uma estimativa da faixa etária (ex: "25-35 anos", "criança", "idoso", "adulto jovem", "meia-idade"). Se não for possível estimar com razoável confiança, preencha o campo 'estimatedAge' com "Não estimável".
      *   Forneça a caixa delimitadora (bounding box) e confiança se possível.
      *   Se a IA não puder fornecer detalhes faciais mesmo detectando faces, indique isso.
  5.  **Identificação de Veículos**:
      *   Se veículos forem visíveis na imagem, tente identificar a marca (ex: Ford, Volkswagen, Fiat) e o modelo (ex: Fiesta, Gol, Palio) de cada um.
      *   Para cada veículo identificado, preencha os campos 'make', 'model' e 'confidence' (0 a 1) no array 'vehicleDetails'. Se não for possível determinar a marca ou modelo, deixe os campos correspondentes vazios ou indique "Desconhecido(a)". Se nenhum veículo for detectado, o array 'vehicleDetails' deve ser vazio.
      *   Lembre-se de incorporar a marca e modelo dos veículos identificados aqui na Descrição Detalhada (item 1).

  Seja objetivo e forneça informações factuais baseadas na imagem. Certifique-se de preencher todos os campos do schema de saída (exceto 'enhancedPhotoDataUri'), mesmo que com valores indicando ausência de informação (ex: "Nenhuma placa detectada", lista vazia para sugestões, 0 para faces).
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

const analyzeImageFlow = ai.defineFlow(
  {
    name: 'analyzeImageFlow',
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async (input: AnalyzeImageInput): Promise<AnalyzeImageOutput> => {
    // 1. Get textual analysis and suggestions
    const { output: textualAnalysis } = await analyzeImageTextPrompt(input);
    if (!textualAnalysis) {
        throw new Error("A análise textual da imagem não retornou um resultado válido da IA.");
    }

    let enhancedPhotoDataUri: string | undefined = undefined;

    // 2. Attempt to generate an enhanced image
    try {
      const enhancementPrompt = [
        { media: { url: input.photoDataUri } },
        { text: "Aprimore esta imagem para análise forense. Aumente a nitidez, melhore o contraste, reduza o ruído e realce detalhes ocultos. Preserve a integridade factual da imagem original e evite adicionar elementos que não existem." }
      ];
      
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', 
        prompt: enhancementPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'], 
          safetySettings: [ 
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        },
      });

      if (media && media.url) {
        enhancedPhotoDataUri = media.url;
      }
    } catch (enhancementError) {
      console.warn("Falha ao gerar imagem aprimorada:", enhancementError);
      // Proceed without enhanced image if generation fails
    }
    
    // 3. Combine results
    return {
      ...textualAnalysis,
      enhancedPhotoDataUri: enhancedPhotoDataUri,
    };
  }
);

    
