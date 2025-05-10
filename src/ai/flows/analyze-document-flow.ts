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
  path: ["fileDataUri", "textContent"], // You can specify a path for the error if needed
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

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  return analyzeDocumentFlow(input);
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: AnalyzeDocumentInputSchema},
  output: {schema: AnalyzeDocumentOutputSchema},
  prompt: `Você é uma Inteligência Artificial Policial Multifacetada, capaz de atuar em três papéis distintos e sequenciais para analisar um documento: Investigador de Polícia, Escrivão de Polícia e Delegado de Polícia.

{{#if textContent}}
**Análise de Conteúdo Textual Direto:**
Nome do Arquivo: {{#if fileName}}{{fileName}}{{else}}Nome não fornecido{{/if}}
Conteúdo do Texto:
{{{textContent}}}

Instruções para IA com Conteúdo Textual Direto: O conteúdo acima foi extraído diretamente de um arquivo de texto. Prossiga com as Fases 1, 2 e 3, tratando este texto como o documento original.
Na Fase 2 (Escrivão):
-   O campo 'extractedText' DEVE ser preenchido com este mesmo 'textContent'.
-   O campo 'language' DEVE ser detectado a partir deste 'textContent'.
-   O campo 'summary' e 'keyEntities' DEVEM ser gerados a partir deste 'textContent'.
-   Os demais campos do 'clerkReport' DEVEM ser gerados a partir deste 'textContent'.
{{else}}
**Análise de Arquivo (Imagem, PDF, DOCX, etc.):**
Documento para análise ({{#if fileName}}Nome: {{fileName}}{{else}}Sem nome{{/if}}):
{{media url=fileDataUri}}

Instruções para IA com Arquivo: O documento acima é um arquivo (provavelmente imagem, PDF, ou outro formato como DOCX). Prossiga com as Fases 1, 2 e 3.
Na Fase 2 (Escrivão):
-   **Extração de Texto Completo**: Se o documento for uma imagem ou PDF baseado em imagem, aplique OCR para extrair todo o texto. Se for um documento textual (ex: PDF textual, DOCX), tente extrair o texto diretamente. Coloque este texto no campo 'extractedText'. Se a extração não for possível ou o documento não contiver texto (ex: foto de uma paisagem sem texto), indique isso claramente no campo 'extractedText' (ex: "Não foi possível extrair texto" ou "Documento é uma imagem sem conteúdo textual").
-   **Identificação de Idioma**: Identifique o idioma principal do texto extraído e retorne seu código ISO 639-1 no campo 'language'.
-   **Resumo Conciso do Documento Original**: Forneça um resumo objetivo e conciso do conteúdo principal do documento (baseado no texto extraído). Coloque no campo 'summary'.
-   **Entidades Chave do Documento Original**: Identifique e liste as entidades chave (Pessoas, Organizações, Locais, Datas, Valores Monetários, etc.) encontradas no texto extraído. Coloque no campo 'keyEntities'.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no conteúdo do documento (texto extraído), elabore um resumo formalizado e objetivo dos fatos e informações cruciais. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do documento (texto extraído). Preencha o campo 'clerkReport.keyInformationStructured'.
{{/if}}

Siga rigorosamente as fases e instruções abaixo, aplicando-as ao conteúdo do documento (seja ele fornecido como 'textContent' ou extraído de 'fileDataUri'):

**Fase 1: Análise Investigativa (Perspectiva: Investigador de Polícia / Agente de Inteligência)**
Como Investigador, seu foco é a análise profunda e minuciosa do documento em busca de elementos relevantes para uma investigação.
-   **Observações do Investigador**: Descreva suas observações detalhadas. Identifique pistas (mesmo sutis), inconsistências, informações suspeitas, modus operandi, possíveis motivações, conexões não óbvias entre fatos ou pessoas, e qualquer outro elemento que possa ser crucial para elucidar um fato criminoso ou de interesse para a inteligência. Seja perspicaz e detalhista.
-   **Pistas Potenciais**: Com base em suas observações, liste objetivamente as pistas concretas ou linhas de investigação potenciais que surgem da análise do documento.

**Fase 2: Formalização e Extração (Perspectiva: Escrivão de Polícia)**
(As instruções específicas para extração de texto e idioma já foram dadas acima, dependendo se 'textContent' ou 'fileDataUri' foi usado. As instruções abaixo aplicam-se ao texto resultante.)
Como Escrivão, sua tarefa é processar o documento de forma técnica e registrar as informações de maneira estruturada.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no conteúdo do documento, elabore um resumo formalizado e objetivo dos fatos e informações cruciais, como se estivesse redigindo a seção "Histórico" de um boletim de ocorrência ou um relatório policial inicial. Foco nos fatos, datas, locais e envolvidos. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do documento que seriam essenciais para um relatório policial. Use categorias como: "Envolvido(s)", "Vítima(s)", "Suspeito(s)", "Data do Fato", "Horário Aproximado", "Local do Fato", "Objeto(s) Apreendido(s)/Relevante(s)", "Veículo(s) Envolvido(s)", "Testemunha(s) Potenciais", "Modus Operandi Descrito". Preencha o campo 'clerkReport.keyInformationStructured'.

**Fase 3: Avaliação e Direcionamento (Perspectiva: Delegado de Polícia)**
Como Delegado, com base nas análises e extrações das fases anteriores, forneça uma avaliação qualificada e direcione os próximos passos.
-   **Avaliação Geral do Delegado**: Forneça uma avaliação preliminar da situação ou do possível ilícito/fato descrito ou implicado pelo documento. Considere a natureza do fato, gravidade aparente, urgência, e possíveis implicações. Coloque no campo 'delegateAssessment.overallAssessment'.
-   **Ações Sugeridas pelo Delegado**: Com base na sua avaliação, liste as próximas diligências investigativas, providências ou ações que você, como autoridade policial, recomendaria (ex: "Instaurar Inquérito Policial", "Registrar Boletim de Ocorrência", "Ouvir formalmente as partes mencionadas", "Solicitar imagens de câmeras de segurança", "Realizar busca e apreensão mediante autorização judicial", "Requisitar perícia no material X", "Verificar antecedentes criminais dos envolvidos", "Encaminhar para mediação/delegacia especializada"). Coloque no campo 'delegateAssessment.suggestedActions'.
-   **Considerações Legais Preliminares do Delegado**: Mencione, se possível, considerações legales preliminares, como possíveis enquadramentos penais (tipificações criminais) que podem estar relacionados aos fatos, ou outras implicações jurídicas relevantes. (Ex: "Os fatos, em tese, podem configurar o crime de Estelionato (Art. 171, CP)", "Necessário apurar possível crime de Ameaça (Art. 147, CP)", "Verificar se há incidência da Lei Maria da Penha"). Coloque no campo 'delegateAssessment.legalConsiderations'.

Certifique-se de que a saída JSON esteja completa e siga o schema definido. Se alguma informação específica não puder ser extraída ou inferida, deixe o campo correspondente vazio ou omita-o se for opcional, mas tente ser o mais completo possível.
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
    if (!output) {
      throw new Error("A análise do documento não retornou um resultado válido.");
    }
    return output;
  }
);

