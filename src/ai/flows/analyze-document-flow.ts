
'use server';
/**
 * @fileOverview Fluxo de IA para análise de documentos, atuando como Investigador, Escrivão e Delegado, e gerando um press release.
 *
 * - analyzeDocument - Analisa um documento para extrair conteúdo, resumir, identificar entidades, classificar crimes, fornecer análises investigativas e gerar um press release.
 * - AnalyzeDocumentInput - O tipo de entrada para a função analyzeDocument.
 * - AnalyzeDocumentOutput - O tipo de retorno para a função analyzeDocument.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { classifyTextForCrimes, type ClassifyTextForCrimesOutput, type ClassifyTextForCrimesInput } from './classify-text-for-crimes-flow';

const AnalyzeDocumentInputSchema = z.object({
  fileDataUri: z
    .string()
    .optional()
    .describe(
      "O documento (imagem, PDF, etc.) a ser analisado, como uma URI de dados que deve incluir um tipo MIME e usar codificação Base64. Formato esperado: 'data:<mimetype>;base64,<dados_codificados>'. Usado se textContent não for fornecido."
    ),
  textContent: z.string().optional().describe('O conteúdo textual direto de um arquivo (ex: .txt). Usado se fileDataUri não for fornecido.'),
  fileName: z.string().optional().describe('O nome do arquivo original, se disponível.'),
  isMediaInput: z.boolean().optional().describe("Flag interna para indicar se fileDataUri contém mídia processável para o prompt."),
}).refine(data => data.fileDataUri || data.textContent, {
  message: "Either fileDataUri or textContent must be provided for analysis.",
  path: ["fileDataUri", "textContent"],
});

export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentInputSchema>;

const KeyEntitySchema = z.object({
    type: z.string().describe('O tipo da entidade (ex: Pessoa, Organização, Local, Data, Valor Monetário, Nome de Arquivo, Tipo MIME).'),
    value: z.string().describe('O valor da entidade extraída.'),
});

const InvestigatorAnalysisSchema = z.object({
  observations: z.string().describe("Observações detalhadas do investigador sobre o documento, incluindo pistas, inconsistências, elementos suspeitos e conexões relevantes para uma investigação criminal. Se nenhuma observação específica for encontrada, deve ser 'Nenhuma observação investigativa relevante.'."),
  potentialLeads: z.array(z.string()).optional().describe("Lista de pistas potenciais ou linhas de investigação identificadas pelo investigador com base no documento. Pode ser uma lista vazia se nenhuma pista for encontrada."),
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

const CrimeTagFromFlowSchema = z.object({
  crimeType: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  involvedParties: z.array(z.string()).optional(),
  relevantExcerpts: z.array(z.string()).optional()
});
const CrimeAnalysisResultsSchema = z.object({
  crimeTags: z.array(CrimeTagFromFlowSchema),
  overallCriminalAssessment: z.string()
});


const AnalyzeDocumentOutputSchema = z.object({
  extractedText: z.string().optional().describe('O texto completo extraído do documento (ou o texto fornecido diretamente se textContent foi usado, ou uma mensagem do sistema se o processamento direto falhou). Pode estar ausente se a extração falhar ou não for aplicável.'),
  summary: z.string().describe('Um resumo conciso do conteúdo original do documento ou, se o conteúdo não pôde ser lido, um resumo da situação (ex: impossibilidade de leitura de arquivo X).'),
  keyEntities: z.array(KeyEntitySchema).optional().describe('Uma lista de entidades chave (pessoas, organizações, locais, etc., e também Nome de Arquivo, Tipo MIME se relevante) identificadas no texto original do documento ou nos metadados/mensagem do sistema.'),
  language: z.string().optional().describe('O idioma principal detectado no documento (código ISO 639-1, ex: "pt", "en"). Pode ser "N/A" se não aplicável.'),
  
  investigatorAnalysis: InvestigatorAnalysisSchema.describe("Análise detalhada sob a perspectiva de um Investigador de Polícia/Agente de Inteligência. Este campo é obrigatório."),
  clerkReport: ClerkReportSchema.optional().describe("Relatório estruturado e formalizado sob a perspectiva de um Escrivão de Polícia."),
  delegateAssessment: DelegateAssessmentSchema.optional().describe("Avaliação, direcionamento e sugestões de próximos passos sob a perspectiva de um Delegado de Polícia."),
  crimeAnalysisResults: CrimeAnalysisResultsSchema.optional().describe("Resultados da classificação de crimes identificados no texto do documento."),
  pressRelease: z.string().describe("Press release OBRIGATÓRIO para envio à imprensa, formatado como um assessor de imprensa da Polícia Civil da Bahia (PCBA). Deve resumir as informações disponíveis (mesmo que sejam apenas metadados de um arquivo) de forma objetiva e adequada para divulgação pública."),
});
export type AnalyzeDocumentOutput = z.infer<typeof AnalyzeDocumentOutputSchema>;

function getMimeTypeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  return match ? match[1] : null;
}

const DIRECTLY_PROCESSABLE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
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

    // Corrigir MIME type para application/octet-stream se for PDF por extensão
    if (isPdfByExtension && (effectiveMimeTypeForCheck === 'application/octet-stream' || !effectiveMimeTypeForCheck)) {
      effectiveMimeTypeForCheck = 'application/pdf';
      // Reconstruir Data URI se necessário para garantir 'application/pdf'
      if (input.fileDataUri.includes(',')) {
        const base64Content = input.fileDataUri.substring(input.fileDataUri.indexOf(',') + 1);
        processedFileDataUri = `data:application/pdf;base64,${base64Content}`;
      }
    }
    
    const isDirectlyProcessable = effectiveMimeTypeForCheck && DIRECTLY_PROCESSABLE_MIME_TYPES.includes(effectiveMimeTypeForCheck);

    if (isDirectlyProcessable) {
      const internalFlowInput: AnalyzeDocumentInput = {
        fileDataUri: processedFileDataUri, 
        fileName: fileName,
      };
      return analyzeDocumentFlowInternal(internalFlowInput);
    } else {
      const systemMessage = `AVISO DO SISTEMA: O arquivo '${fileName}' (tipo MIME: ${effectiveMimeTypeForCheck || 'desconhecido'}) foi fornecido. Seu conteúdo binário não pode ser processado/extraído diretamente pela IA neste fluxo. A análise subsequente deve se concentrar no nome do arquivo, tipo MIME informado e na natureza deste aviso. Tente extrair entidades do nome do arquivo e do tipo MIME.`;
      const internalFlowInput: AnalyzeDocumentInput = { 
        textContent: systemMessage, 
        fileName: fileName 
      };
      return analyzeDocumentFlowInternal(internalFlowInput);
    }
  } else if (input.textContent) {
    const internalFlowInput: AnalyzeDocumentInput = {
      textContent: input.textContent,
      fileName: input.fileName
    };
    return analyzeDocumentFlowInternal(internalFlowInput);
  } else {
    throw new Error("Input inválido: é necessário fornecer fileDataUri ou textContent para a função analyzeDocument.");
  }
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {schema: AnalyzeDocumentInputSchema},
  output: {schema: AnalyzeDocumentOutputSchema.omit({ crimeAnalysisResults: true })}, 
  prompt: `Você é uma Inteligência Artificial Policial Multifacetada, capaz de atuar em quatro papéis distintos e sequenciais para analisar um documento: Investigador de Polícia, Escrivão de Polícia, Delegado de Polícia e Assessor de Imprensa da Polícia Civil da Bahia (PCBA).

{{#if isMediaInput}}
**Análise de Arquivo (Imagem ou PDF Processável Diretamente):**
Documento para análise ({{#if fileName}}Nome: {{fileName}}{{else}}Sem nome{{/if}}):
{{media url=fileDataUri}}

Instruções para IA com Arquivo Processável Diretamente: O documento acima é um arquivo (imagem ou PDF) cujo conteúdo a IA pode processar diretamente. Prossiga com as Fases 1, 2, 3 e 4.
Na Fase 2 (Escrivão):
-   **Extração de Texto Completo**: Se o documento for uma imagem ou PDF baseado em imagem, aplique OCR para extrair todo o texto. Se for um PDF textual, extraia o texto diretamente. Coloque este texto no campo 'extractedText'. Se a extração não for possível ou o documento não contiver texto (ex: foto de uma paisagem sem texto), indique isso claramente no campo 'extractedText' (ex: "Não foi possível extrair texto" ou "Documento é uma imagem sem conteúdo textual").
-   **Identificação de Idioma**: Identifique o idioma principal do texto extraído e retorne seu código ISO 639-1 no campo 'language'.
-   **Resumo Conciso do Documento Original**: Forneça um resumo objetivo e conciso do conteúdo principal do documento (baseado no texto extraído). Coloque no campo 'summary'.
-   **Entidades Chave do Documento Original**: Identifique e liste as entidades chave (Pessoas, Organizações, Locais, Datas, Valores Monetários, etc.) encontradas no texto extraído. Coloque no campo 'keyEntities'.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no conteúdo do documento (texto extraído), elabore um resumo formalizado e objetivo dos fatos e informações cruciais. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do documento (texto extraído). Preencha o campo 'clerkReport.keyInformationStructured'.
{{else if textContent}}
**Análise de Conteúdo Textual ou Metadados de Arquivo:**
Nome do Arquivo: {{#if fileName}}{{fileName}}{{else}}Nome não fornecido{{/if}}
Conteúdo para Análise:
{{{textContent}}}

Instruções para IA com Conteúdo Textual/Metadados:
O 'Conteúdo para Análise' acima pode ser:
1.  Texto extraído diretamente de um arquivo de texto.
2.  Uma mensagem do sistema (começando com "AVISO DO SISTEMA:") indicando que um arquivo (ex: DOCX, XLS, ou tipo desconhecido) foi fornecido, mas seu conteúdo não pôde ser lido/processado diretamente pela IA.
   Neste caso (AVISO DO SISTEMA):
   -   O campo 'extractedText' DEVE ser preenchido com este mesmo 'Conteúdo para Análise' (a mensagem do sistema).
   -   O campo 'language' DEVE ser "N/A".
   -   O campo 'summary' DEVE ser um resumo da situação: "Impossibilidade de análise direta do conteúdo do arquivo. Análise baseada em metadados como nome do arquivo e tipo MIME."
   -   O campo 'keyEntities' DEVE conter entidades extraídas do nome do arquivo (ex: {{fileName}}) e do tipo MIME informado na mensagem do sistema. Tipos de entidade podem ser "Nome de Arquivo", "Tipo MIME".
   -   As Fases 1, 2, 3 e 4 devem focar na interpretação do nome do arquivo, tipo MIME e na implicação de tal arquivo existir no contexto de uma investigação. O 'pressRelease' (Fase 4) DEVE informar sobre a existência do arquivo '{{fileName}}' (tipo MIME informado na mensagem do sistema) e a impossibilidade de detalhar seu conteúdo no momento, mantendo um tom profissional e informativo adequado para a imprensa.

Para texto extraído diretamente (não "AVISO DO SISTEMA"):
-   O campo 'extractedText' DEVE ser o 'Conteúdo para Análise'.
-   Detecte 'language'.
-   Gere 'summary' e 'keyEntities' a partir do texto.
-   Prossiga com as Fases 1, 2, 3 e 4 aplicadas ao texto.
{{else}}
**Erro: Nenhum conteúdo ou arquivo válido fornecido para análise.**
Instruções para a IA: Preencha a resposta indicando que não foi fornecido conteúdo válido. Por exemplo, no campo 'summary', coloque "Nenhum dado de entrada válido para análise.". Deixe outros campos como 'extractedText', 'keyEntities' e as análises das Fases 1, 2, 3 e 4 com indicações de ausência de dados ou observações. O 'pressRelease' deve ser um breve comunicado informando que foi recebida uma solicitação de análise, mas nenhum dado válido foi fornecido para processamento, mantendo um tom profissional.
{{/if}}

Siga rigorosamente as fases e instruções abaixo, aplicando-as ao conteúdo disponível (seja ele texto extraído de 'fileDataUri', 'Conteúdo para Análise', ou metadados de um arquivo não processável):

**Fase 1: Análise Investigativa (Perspectiva: Investigador de Polícia / Agente de Inteligência)**
Como Investigador, seu foco é a análise profunda e minuciosa do material disponível em busca de elementos relevantes para uma investigação. Esta fase é OBRIGATÓRIA.
-   **Observações do Investigador**: Descreva suas observações detalhadas. Identifique pistas (mesmo sutis), inconsistências, informações suspeitas, modus operandi, possíveis motivações, conexões não óbvias entre fatos ou pessoas, e qualquer outro elemento que possa ser crucial para elucidar um fato criminoso ou de interesse para a inteligência. Seja perspicaz e detalhista. Se estiver analisando apenas metadados de um arquivo não processável, foque no que a existência desse arquivo, seu nome e tipo podem significar. Se não houver observações significativas, preencha com 'Nenhuma observação investigativa relevante.'.
-   **Pistas Potenciais**: Com base em suas observações, liste objetivamente as pistas concretas ou linhas de investigação potenciais que surgem da análise. Se nenhuma pista for identificada, pode ser uma lista vazia ou omitido (se o schema permitir).

**Fase 2: Formalização e Extração (Perspectiva: Escrivão de Polícia)**
(As instruções específicas para 'extractedText', 'language', 'summary', 'keyEntities' já foram dadas acima, dependendo se 'isMediaInput' ou 'textContent' foi usado. As instruções abaixo aplicam-se ao texto/material resultante/disponível.)
Como Escrivão, sua tarefa é processar o material de forma técnica e registrar as informações de maneira estruturada.
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Com base no material (texto extraído ou metadados do arquivo), elabore um resumo formalizado e objetivo dos fatos e informações cruciais, como se estivesse redigindo a seção "Histórico" de um boletim de ocorrência ou um relatório policial inicial. Foco nos fatos, datas, locais e envolvidos. Se for baseado em metadados, descreva a natureza do arquivo e sua relevância hipotética. Coloque no campo 'clerkReport.formalizedSummary'.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas do material que seriam essenciais para um relatório policial. Use categorias como: "Envolvido(s)", "Vítima(s)", "Suspeito(s)", "Data do Fato", "Horário Aproximado", "Local do Fato", "Objeto(s) Apreendido(s)/Relevante(s)", "Veículo(s) Envolvido(s)", "Testemunha(s) Potenciais", "Modus Operandi Descrito", "Nome do Arquivo", "Tipo de Arquivo". Preencha o campo 'clerkReport.keyInformationStructured'.

**Fase 3: Avaliação e Direcionamento (Perspectiva: Delegado de Polícia)**
Como Delegado, com base nas análises e extrações das fases anteriores, forneça uma avaliação qualificada e direcione os próximos passos.
-   **Avaliação Geral do Delegado**: Forneça uma avaliação preliminar da situação ou do possível ilícito/fato descrito ou implicado pelo material. Considere a natureza do fato, gravidade aparente, urgência, e possíveis implicações. Coloque no campo 'delegateAssessment.overallAssessment'.
-   **Ações Sugeridas pelo Delegado**: Com base na sua avaliação, liste as próximas diligências investigativas, providências ou ações que você, como autoridade policial, recomendaria (ex: "Instaurar Inquérito Policial", "Registrar Boletim de Ocorrência", "Ouvir formalmente as partes mencionadas", "Solicitar imagens de câmeras de segurança", "Realizar busca e apreensão mediante autorização judicial", "Requisitar perícia no material X", "Verificar antecedentes criminais dos envolvidos", "Encaminhar para mediação/delegacia especializada"). Coloque no campo 'delegateAssessment.suggestedActions'.
-   **Considerações Legais Preliminares do Delegado**: Mencione, if possível, considerações legales preliminares, como possíveis enquadramentos penais (tipificações criminais) que podem estar relacionados aos fatos, ou outras implicações jurídicas relevantes. (Ex: "Os fatos, em tese, podem configurar o crime de Estelionato (Art. 171, CP)", "Necessário apurar possível crime de Ameaça (Art. 147, CP)", "Verificar se há incidência da Lei Maria da Penha"). Coloque no campo 'delegateAssessment.legalConsiderations'.

**Fase 4: Comunicação à Imprensa (Perspectiva: Assessor de Imprensa da PCBA)**
Com base nas análises anteriores, especialmente no 'clerkReport.formalizedSummary' (ou no 'textContent' se este for uma mensagem de sistema sobre arquivo não processável) e na avaliação do Delegado (se disponível), redija um 'pressRelease'.
-   **Conteúdo OBRIGATÓRIO do Press Release**: O release DEVE SEMPRE ser gerado. Ele deve ser um resumo informativo e objetivo do 'clerkReport.formalizedSummary' (ou do 'textContent' se este for uma mensagem de sistema), adaptado para divulgação pública. Se o conteúdo for uma mensagem de sistema sobre um arquivo não processável, o release deve informar sobre a existência do arquivo e a impossibilidade de detalhar seu conteúdo no momento, mantendo um tom apropriado para a imprensa.
    *   O release deve incluir um título informativo.
    *   Data e local (Salvador, BA - fictício se não houver dados).
    *   Resumo do que pode ser divulgado publicamente, derivado do 'clerkReport.formalizedSummary' ou da mensagem de sistema.
    *   Principais ações realizadas pela Polícia Civil da Bahia (PCBA) relacionadas ao documento/arquivo, se inferível.
    *   Importância da informação/documento para a investigação (mesmo que seja "arquivo recebido para análise").
    *   Pode incluir uma citação simulada de uma autoridade policial, se pertinente ao contexto.
    *   Informações de contato para a imprensa (simuladas, ex: "Assessoria de Comunicação da PCBA - ascom@pc.ba.gov.br").
-   **Tom e Estilo**: Linguagem clara, concisa, e imparcial. Evitar jargões excessivos. Foco nos fatos e na atuação da PCBA.
-   **Garantia de Geração**: Independentemente da sensibilidade ou escassez das informações, um press release DEVE ser gerado, mesmo que seja um breve comunicado sobre o recebimento e processamento de um documento/arquivo. NÃO utilize frases como "Informações não apropriadas ou insuficientes".

Certifique-se de que a saída JSON esteja completa e siga o schema definido, especialmente para a Fase 1 (Análise Investigativa) que é obrigatória e para a Fase 4 (Press Release) que também é obrigatória. Se alguma informação específica não puder ser extraída ou inferida para campos opcionais, deixe o campo correspondente vazio ou omita-o, mas tente ser o mais completo possível.
O campo 'crimeAnalysisResults' será preenchido em uma etapa separada pelo sistema, não precisa se preocupar com ele neste prompt.
`,
});

const analyzeDocumentFlowInternal = ai.defineFlow(
  {
    name: 'analyzeDocumentFlowInternal',
    inputSchema: AnalyzeDocumentInputSchema, 
    outputSchema: AnalyzeDocumentOutputSchema, 
  },
  async (rawInput: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> => { 
    const promptInput = {...rawInput};

    if (promptInput.fileDataUri && !promptInput.textContent) { 
        promptInput.isMediaInput = true;
    } else { 
        promptInput.isMediaInput = false;
        if (promptInput.textContent) {
          delete promptInput.fileDataUri;
        }
    }
    
    const {output: mainAnalysisOutput} = await analyzeDocumentPrompt(promptInput); 
    if (!mainAnalysisOutput) {
      throw new Error("A análise do documento não retornou um resultado válido.");
    }
    
    if (!mainAnalysisOutput.investigatorAnalysis) {
        mainAnalysisOutput.investigatorAnalysis = {
            observations: "Nenhuma observação investigativa retornada pela IA.",
            potentialLeads: []
        };
    } else {
        if (mainAnalysisOutput.investigatorAnalysis.observations === undefined || mainAnalysisOutput.investigatorAnalysis.observations === null || mainAnalysisOutput.investigatorAnalysis.observations.trim() === "") {
            mainAnalysisOutput.investigatorAnalysis.observations = "Nenhuma observação investigativa específica fornecida.";
        }
        if (mainAnalysisOutput.investigatorAnalysis.potentialLeads === undefined || mainAnalysisOutput.investigatorAnalysis.potentialLeads === null) {
             mainAnalysisOutput.investigatorAnalysis.potentialLeads = [];
        }
    }

    if (mainAnalysisOutput.pressRelease === undefined || mainAnalysisOutput.pressRelease === null || mainAnalysisOutput.pressRelease.trim() === "") {
      // This case should be less frequent now due to stronger prompting, but as a last resort.
      mainAnalysisOutput.pressRelease = "Falha ao gerar o press release pela IA. Informações do documento podem ser limitadas ou de difícil interpretação para divulgação pública neste momento.";
    }

    let crimeAnalysisResults: ClassifyTextForCrimesOutput | undefined = undefined;
    if (mainAnalysisOutput.extractedText && !mainAnalysisOutput.extractedText.startsWith("AVISO DO SISTEMA:") && mainAnalysisOutput.extractedText.trim() !== "Não foi possível extrair texto" && mainAnalysisOutput.extractedText.trim() !== "Documento é uma imagem sem conteúdo textual") {
      try {
        const crimeInput: ClassifyTextForCrimesInput = {
          textContent: mainAnalysisOutput.extractedText,
          context: `Documento analisado: ${rawInput.fileName || 'Nome de arquivo desconhecido'}`
        };
        crimeAnalysisResults = await classifyTextForCrimes(crimeInput);
      } catch (crimeError) {
        console.error("Erro na classificação de crimes:", crimeError);
        crimeAnalysisResults = {
          crimeTags: [],
          overallCriminalAssessment: "Falha ao realizar a classificação de crimes no texto do documento."
        };
      }
    } else {
       crimeAnalysisResults = {
          crimeTags: [],
          overallCriminalAssessment: "Nenhum texto útil extraído para análise de crimes."
       };
    }
    
    return {
      ...mainAnalysisOutput,
      crimeAnalysisResults: crimeAnalysisResults
    };
  }
);

    


