'use server';
/**
 * @fileOverview Fluxo de IA para análise de documentos, atuando como Investigador, Escrivão e Delegado.
 *
 * - analyzeDocument - Analisa um documento para extrair conteúdo, resumir, identificar entidades e fornecer análises investigativas.
 * - AnalyzeDocumentInput - O tipo de entrada para a função analyzeDocument.
 * - AnalyzeDocumentOutput - O tipo de retorno para a função analyzeDocument.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDocumentInputSchema = z.object({
  fileDataUri: z
    .string()
    .optional()
    .describe(
      "O documento (imagem, PDF, etc.) a ser analisado, como uma URI de dados que deve incluir um tipo MIME e usar codificação Base64. Formato esperado: 'data:<mimetype>;base64,<dados_codificados>'. Usado se textContent não for fornecido."
    ),
  textContent: z.string().optional().describe('O conteúdo textual direto de um arquivo (ex: .txt). Usado se fileDataUri não for fornecido.'),
  fileName: z.string().optional().describe('O nome do arquivo original, se disponível.'),
}).refine(data => data.fileDataUri || data.textContent, {
  message: "Either fileDataUri or textContent must be provided for analysis.",
  path: ["fileDataUri", "textContent"],
});

export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentInputSchema>;

const KeyEntitySchema = z.object({
    type: z.string().describe('O tipo da entidade (ex: Pessoa, Organização, Local, Data, Valor Monetário).'),
    value: z.string().describe('O valor da entidade extraída.'),
});

const InvestigatorAnalysisSchema = z.object({
  observations: z.string().describe("Observações detalhadas do investigador sobre o documento, incluindo pistas, inconsistências, elementos suspeitos e conexões relevantes para uma investigação criminal."),
  potentialLeads: z.array(z.string()).optional().describe("Lista de pistas potenciais ou linhas de investigação identificadas pelo investigador com base no documento."),
});

const ClerkReportSchema = z.object({
  formalizedSummary: z.string().describe("Sumário formalizado dos fatos e informações cruciais extraídas do documento, redigido de forma objetiva, como se fosse para um registro oficial ou boletim de ocorrência."),
  keyInformationStructured: z.array(z.object({ 
    category: z.string().describe("Categoria da informação chave (ex: Envolvido(s), Vítima(s), Suspeito(s), Data do Fato, Local do Fato, Objeto(s) Relevante(s), Veículo(s) Envolvido(s), Testemunha(s))."), 
    details: z.string().describe("Detalhes da informação chave extraída do documento.") 
  })).optional().describe("Lista estruturada de informações chave categorizadas, extraídas do documento, relevantes para um relatório policial."),
});

const DelegateAssessmentSchema = z.object({
  overallAssessment: z.string().describe("Avaliação geral e preliminar da situação ou possível incidente/crime descrito ou implicado pelo documento, sob a perspectiva de um delegado de polícia. Considerar a gravidade, urgência e natureza do fato."),
  suggestedActions: z.array(z.string()).optional().describe("Lista de próximas diligências investigativas, procedimentos ou ações que o delegado recomendaria (ex: oitivas, perícias, buscas, representações judiciais)."),
  legalConsiderations: z.string().optional().describe("Considerações legales preliminares, possíveis enquadramentos típicos (tipificação penal), ou implicações jurídicas com base nas informações disponíveis no documento."),
});

const AnalyzeDocumentOutputSchema = z.object({
  extractedText: z.string().optional().describe('O texto completo extraído do documento (ou o texto fornecido diretamente se textContent foi usado). Pode estar ausente se a extração falhar ou não for aplicável.'),
  summary: z.string().describe('Um resumo conciso do conteúdo original do documento.'),
  keyEntities: z.array(KeyEntitySchema).optional().describe('Uma lista de entidades chave (pessoas, organizações, locais, etc.) identificadas no texto original do documento.'),
  language: z.string().optional().describe('O idioma principal detectado no documento (código ISO 639-1, ex: "pt", "en").'),
  
  investigatorAnalysis: InvestigatorAnalysisSchema.optional().describe("Análise detalhada sob a perspectiva de um Investigador de Polícia/Agente de Inteligência."),
  clerkReport: ClerkReportSchema.optional().describe("Relatório estruturado e formalizado sob a perspectiva de um Escrivão de Polícia."),
  delegateAssessment: DelegateAssessmentSchema.optional().describe("Avaliação, direcionamento e sugestões de próximos passos sob a perspectiva de um Delegado de Polícia.")
});
export type AnalyzeDocumentOutput = z.infer<typeof AnalyzeDocumentOutputSchema>;

// Helper function to extract MIME type from data URI
function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  return match ? match[1] : null;
}

// List of MIME types that Gemini can process directly with {{media}} tag for document analysis
const DIRECTLY_PROCESSABLE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  if (input.fileDataUri) {
    const originalMimeType = getMimeTypeFromDataUri(input.fileDataUri);
    const fileName = input.fileName || 'Desconhecido';
    let processedFileDataUri = input.fileDataUri;

    let effectiveMimeTypeForCheck = originalMimeType ? originalMimeType.toLowerCase() : null;
    const isPdfByExtension = fileName.toLowerCase().endsWith('.pdf');

    if (isPdfByExtension && (effectiveMimeTypeForCheck === 'application/octet-stream' || !effectiveMimeTypeForCheck)) {
      effectiveMimeTypeForCheck = 'application/pdf';
      // Reconstruct data URI if original MIME type was generic but it's a PDF by extension
      // This helps ensure Gemini receives 'application/pdf' as the MIME type for the media part.
      if (input.fileDataUri.includes(',')) {
        const base64Content = input.fileDataUri.substring(input.fileDataUri.indexOf(',') + 1);
        processedFileDataUri = `data:application/pdf;base64,${base64Content}`;
      }
    }

    if (effectiveMimeTypeForCheck && DIRECTLY_PROCESSABLE_MIME_TYPES.includes(effectiveMimeTypeForCheck)) {
      const fileProcessingInput: AnalyzeDocumentInput = {
        fileDataUri: processedFileDataUri, // Use the (potentially reconstructed) data URI
        fileName: fileName,
      };
      return analyzeDocumentFlowInternal(fileProcessingInput);
    } else {
      const detectedMimeTypeInfo = originalMimeType || (isPdfByExtension ? 'pdf (por extensão)' : 'não detectado');
      const systemMessage = `AVISO DO SISTEMA: O arquivo '${fileName}' (tipo MIME: ${detectedMimeTypeInfo}) foi fornecido. Seu conteúdo binário não pode ser processado/extraído diretamente pela IA neste fluxo. A análise deve se concentrar no nome do arquivo, tipo MIME informado e na natureza deste aviso. Prossiga com a análise baseada nessas metainformações.`;
      
      const textProcessingInput: AnalyzeDocumentInput = { 
        textContent: systemMessage, 
        fileName: fileName 
      };
      return analyzeDocumentFlowInternal(textProcessingInput);
    }
  } else if (input.textContent) {
    const textProcessingInput: AnalyzeDocumentInput = {
      textContent: input.textContent,
      fileName: input.fileName
    };
    return analyzeDocumentFlowInternal(textProcessingInput);
  } else {
    throw new Error("Input inválido: é necessário fornecer fileDataUri ou textContent para a função analyzeDocument.");
  }
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: AnalyzeDocumentInputSchema},
  output: {schema: AnalyzeDocumentOutputSchema},
  prompt: `Você é uma Inteligência Artificial Policial Multifacetada, capaz de atuar em três papéis distintos e sequenciais para analisar um documento: Investigador de Polícia, Escrivão de Polícia e Delegado de Polícia.

{{#if textContent}}
**Análise de Conteúdo Textual ou Metadados de Arquivo:**
Nome do Arquivo: {{#if fileName}}{{fileName}}{{else}}Nome não fornecido{{/if}}
Conteúdo para Análise:
{{{textContent}}}

Instruções para IA com Conteúdo Textual/Metadados:
O conteúdo acima pode ser:
1.  Texto extraído diretamente de um arquivo de texto.
2.  Uma mensagem do sistema (começando com "AVISO DO SISTEMA:") indicando que um arquivo (ex: DOCX, XLS, ou tipo desconhecido como application/octet-stream) foi fornecido, mas seu conteúdo não pôde ser lido/processado diretamente pela IA. Neste caso, a análise deve se basear no nome do arquivo, tipo MIME (se informado no texto) e na natureza do aviso.

Prossiga com as Fases 1, 2 e 3, aplicando-as ao 'Conteúdo para Análise'.
Na Fase 2 (Escrivão):
-   O campo 'extractedText' DEVE ser preenchido com este mesmo 'Conteúdo para Análise' (seja ele o texto original ou a mensagem do sistema).
-   O campo 'language' DEVE ser detectado a partir deste 'Conteúdo para Análise', se aplicável (pode não ser aplicável para mensagens do sistema, nesse caso pode retornar "N/A" ou omitir).
-   O campo 'summary' e 'keyEntities' DEVEM ser gerados a partir deste 'Conteúdo para Análise', interpretando-o da melhor forma possível. Se for uma mensagem do sistema, o resumo deve ser sobre a impossibilidade de análise do conteúdo do arquivo e focar nos metadados disponíveis. As entidades também devem ser extraídas do texto fornecido (que pode ser a mensagem do sistema).
-   Os demais campos do 'clerkReport' DEVEM ser gerados a partir deste 'Conteúdo para Análise'.
{{else}}
**Análise de Arquivo (Imagem ou PDF Processável Diretamente):**
Documento para análise ({{#if fileName}}Nome: {{fileName}}{{else}}Sem nome{{/if}}):
{{media url=fileDataUri}}

Instruções para IA com Arquivo Processável Diretamente: O documento acima é um arquivo (imagem ou PDF) cujo conteúdo a IA pode processar diretamente. Prossiga com as Fases 1, 2 e 3.
Na Fase 2 (Escrivão):
-   **Extração de Texto Completo**: Se o documento for uma imagem ou PDF baseado em imagem, aplique OCR para extrair todo o texto. Se for um PDF textual, extraia o texto diretamente. Coloque este texto no campo 'extractedText'. Se a extração não for possível ou o documento não contiver texto (ex: foto de uma paisagem sem texto), indique isso claramente no campo 'extractedText' (ex: "Não foi possível extrair texto" ou "Documento é uma imagem sem conteúdo textual").
-   **Identificação de Idioma**: Identifique o idioma principal do texto extraído e retorne seu código ISO 639-1 no campo 'language'.
-   **Resumo Conciso do Documento Original**: Forneça um resumo objetivo e conciso do conteúdo principal do documento (baseado no texto extraído). Coloque no campo 'summary'.
-   **Entidades Chave do Documento Original**: Identifique e liste as entidades chave (Pessoas, Organizações, Locais, Datas, Valores Monetários, etc.) encontradas no texto extraído. Coloque no campo 'keyEntities'.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no conteúdo do documento (texto extraído), elabore um resumo formalizado e objetivo dos fatos e informações cruciais. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do documento (texto extraído). Preencha o campo 'clerkReport.keyInformationStructured'.
{{/if}}

Siga rigorosamente as fases e instruções abaixo, aplicando-as ao conteúdo disponível (seja ele 'Conteúdo para Análise' ou o texto extraído de 'fileDataUri'):

**Fase 1: Análise Investigativa (Perspectiva: Investigador de Polícia / Agente de Inteligência)**
Como Investigador, seu foco é a análise profunda e minuciosa do material disponível em busca de elementos relevantes para uma investigação.
-   **Observações do Investigador**: Descreva suas observações detalhadas. Identifique pistas (mesmo sutis), inconsistências, informações suspeitas, modus operandi, possíveis motivações, conexões não óbvias entre fatos ou pessoas, e qualquer outro elemento que possa ser crucial para elucidar um fato criminoso ou de interesse para a inteligência. Seja perspicaz e detalhista.
-   **Pistas Potenciais**: Com base em suas observações, liste objetivamente as pistas concretas ou linhas de investigação potenciais que surgem da análise.

**Fase 2: Formalização e Extração (Perspectiva: Escrivão de Polícia)**
(As instruções específicas para extração de texto, idioma, resumo e entidades já foram dadas acima, dependendo se 'Conteúdo para Análise' ou 'fileDataUri' foi usado. As instruções abaixo aplicam-se ao texto resultante/disponível.)
Como Escrivão, sua tarefa é processar o material de forma técnica e registrar as informações de maneira estruturada.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no material, elabore um resumo formalizado e objetivo dos fatos e informações cruciais, como se estivesse redigindo a seção "Histórico" de um boletim de ocorrência ou um relatório policial inicial. Foco nos fatos, datas, locais e envolvidos. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do material que seriam essenciais para um relatório policial. Use categorias como: "Envolvido(s)", "Vítima(s)", "Suspeito(s)", "Data do Fato", "Horário Aproximado", "Local do Fato", "Objeto(s) Apreendido(s)/Relevante(s)", "Veículo(s) Envolvido(s)", "Testemunha(s) Potenciais", "Modus Operandi Descrito". Preencha o campo 'clerkReport.keyInformationStructured'.

**Fase 3: Avaliação e Direcionamento (Perspectiva: Delegado de Polícia)**
Como Delegado, com base nas análises e extrações das fases anteriores, forneça uma avaliação qualificada e direcione os próximos passos.
-   **Avaliação Geral do Delegado**: Forneça uma avaliação preliminar da situação ou do possível ilícito/fato descrito ou implicado pelo material. Considere a natureza do fato, gravidade aparente, urgência, e possíveis implicações. Coloque no campo 'delegateAssessment.overallAssessment'.
-   **Ações Sugeridas pelo Delegado**: Com base na sua avaliação, liste as próximas diligências investigativas, providências ou ações que você, como autoridade policial, recomendaria (ex: "Instaurar Inquérito Policial", "Registrar Boletim de Ocorrência", "Ouvir formalmente as partes mencionadas", "Solicitar imagens de câmeras de segurança", "Realizar busca e apreensão mediante autorização judicial", "Requisitar perícia no material X", "Verificar antecedentes criminais dos envolvidos", "Encaminhar para mediação/delegacia especializada"). Coloque no campo 'delegateAssessment.suggestedActions'.
-   **Considerações Legais Preliminares do Delegado**: Mencione, se possível, considerações legales preliminares, como possíveis enquadramentos penais (tipificações criminais) que podem estar relacionados aos fatos, ou outras implicações jurídicas relevantes. (Ex: "Os fatos, em tese, podem configurar o crime de Estelionato (Art. 171, CP)", "Necessário apurar possível crime de Ameaça (Art. 147, CP)", "Verificar se há incidência da Lei Maria da Penha"). Coloque no campo 'delegateAssessment.legalConsiderations'.

Certifique-se de que a saída JSON esteja completa e siga o schema definido. Se alguma informação específica não puder ser extraída ou inferida, deixe o campo correspondente vazio ou omita-o se for opcional, mas tente ser o mais completo possível.
`,
});

const analyzeDocumentFlowInternal = ai.defineFlow(
  {
    name: 'analyzeDocumentFlowInternal',
    inputSchema: AnalyzeDocumentInputSchema, // Accepts either fileDataUri or textContent (optional fields)
    outputSchema: AnalyzeDocumentOutputSchema,
  },
  async (input: AnalyzeDocumentInput) => { 
    const {output} = await analyzeDocumentPrompt(input); // Pass the structured input
    if (!output) {
      throw new Error("A análise do documento não retornou um resultado válido.");
    }
    return output;
  }
);
