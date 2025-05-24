
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
import { 
  classifyTextForCrimes, 
  type ClassifyTextForCrimesOutput, 
  type ClassifyTextForCrimesInput,
  CrimeTagSchema // Import CrimeTagSchema
} from './classify-text-for-crimes-flow';

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
export type KeyEntity = z.infer<typeof KeyEntitySchema>;

const InvestigatorAnalysisSchema = z.object({
  observations: z.string().describe("Observações detalhadas do investigador. Pode conter uma mensagem de erro se a análise falhar (ex: 'Falha na análise do investigador: ...')."),
  potentialLeads: z.array(z.string()).optional().describe("Lista de pistas potenciais. Pode ser uma lista vazia ou ausente se a análise falhar."),
});
export type InvestigatorAnalysis = z.infer<typeof InvestigatorAnalysisSchema>;

const ClerkReportSchema = z.object({
  formalizedSummary: z.string().describe("Sumário formalizado dos fatos. Pode conter uma mensagem de erro se a análise falhar."),
  keyInformationStructured: z.array(z.object({ 
    category: z.string().describe("Categoria da informação chave."), 
    details: z.string().describe("Detalhes da informação chave.") 
  })).optional().describe("Lista estruturada de informações chave. Pode ser vazia ou ausente se a análise falhar."),
});
export type ClerkReport = z.infer<typeof ClerkReportSchema>;

const DelegateAssessmentSchema = z.object({
  overallAssessment: z.string().describe("Avaliação geral do delegado. Pode conter uma mensagem de erro se a análise falhar."),
  suggestedActions: z.array(z.string()).optional().describe("Lista de ações sugeridas. Pode ser vazia ou ausente se a análise falhar."),
  legalConsiderations: z.string().optional().describe("Considerações legais preliminares. Pode ser N/A ou conter mensagem de erro."),
});

// Schema para a saída do Escrivão, combinando extrações e relatório
const ClerkOutputSchema = z.object({
  extractedText: z.string().optional().describe('O texto extraído ou uma mensagem de erro indicando falha na extração (ex: "Falha na análise do escrivão: Erro ao extrair texto.").'),
  summary: z.string().describe('Resumo do documento ou uma mensagem de erro (ex: "Falha na análise do escrivão: Não foi possível gerar sumário.").'),
  keyEntities: z.array(KeyEntitySchema).optional().describe('Lista de entidades chave. Pode ser vazia se a extração falhar.'),
  language: z.string().optional().describe('Idioma detectado ou "N/A" em caso de falha.'),
  clerkReport: ClerkReportSchema.optional().describe("Relatório do Escrivão. Seus campos podem conter mensagens de erro."),
});
export type ClerkOutput = z.infer<typeof ClerkOutputSchema>;

// Schema para a saída do Assessor de Imprensa
const PressReleaseOutputSchema = z.object({
  pressRelease: z.string().describe("Press release para a imprensa. Pode refletir falhas nas etapas anteriores ou conter uma mensagem de erro específica se a geração do press release falhar (ex: 'Falha ao gerar press release: ...')."),
});
export type PressReleaseOutput = z.infer<typeof PressReleaseOutputSchema>;

// #################################################################################
// START: Role-Specific Prompts and Functions
// #################################################################################

// --- 1. Investigator ---
const investigatorPrompt = ai.definePrompt({
  name: 'investigatorPrompt',
  input: { schema: AnalyzeDocumentInputSchema },
  output: { schema: InvestigatorAnalysisSchema },
  prompt: `Você é um Investigador de Polícia / Agente de Inteligência.
Seu foco é a análise profunda e minuciosa do material disponível em busca de elementos relevantes para uma investigação.

{{#if isMediaInput}}
**Análise de Arquivo (Imagem ou PDF Processável Diretamente):**
Documento para análise ({{#if fileName}}Nome: {{fileName}}{{else}}Sem nome{{/if}}):
{{media url=fileDataUri}}
Instruções: O documento acima é um arquivo (imagem ou PDF) cujo conteúdo a IA pode processar diretamente. Analise-o.
{{else if textContent}}
**Análise de Conteúdo Textual ou Metadados de Arquivo:**
Nome do Arquivo: {{#if fileName}}{{fileName}}{{else}}Nome não fornecido{{/if}}
Conteúdo para Análise:
{{{textContent}}}
Instruções: O 'Conteúdo para Análise' acima pode ser texto extraído ou uma mensagem do sistema sobre um arquivo não processável.
Se for uma mensagem de sistema (AVISO DO SISTEMA): foque no que a existência desse arquivo, seu nome e tipo podem significar.
{{else}}
**Erro: Nenhum conteúdo ou arquivo válido fornecido para análise.**
Instruções: Indique que não foi fornecido conteúdo válido, preenchendo 'observations' com "Nenhum conteúdo válido fornecido para análise investigativa." e 'potentialLeads' como uma lista vazia.
{{/if}}

**Tarefa Principal - Análise Investigativa:**
-   **Observações do Investigador**: Descreva suas observações detalhadas. Identifique pistas (mesmo sutis), inconsistências, informações suspeitas, modus operandi, possíveis motivações, conexões não óbvias entre fatos ou pessoas, e qualquer outro elemento que possa ser crucial para elucidar um fato criminoso ou de interesse para a inteligência. Seja perspicaz e detalhista. Se não houver observações significativas, preencha com 'Nenhuma observação investigativa relevante.'.
-   **Pistas Potenciais**: Com base em suas observações, liste objetivamente as pistas concretas ou linhas de investigação potenciais que surgem da análise. Se nenhuma pista for identificada, pode ser uma lista vazia.
`,
});

async function analyzeWithInvestigator(input: AnalyzeDocumentInput): Promise<InvestigatorAnalysisSchema> {
  try {
    if (!input.fileDataUri && !input.textContent) {
      console.warn('analyzeWithInvestigator: Nenhum fileDataUri ou textContent fornecido.');
      return { 
        observations: "Falha na análise do investigador: Nenhum conteúdo de entrada fornecido.", 
        potentialLeads: [] 
      };
    }
    const { output } = await investigatorPrompt(input);
    if (!output) {
      console.error('Investigator prompt returned no output structure.');
      return { 
        observations: "Falha na análise do investigador: resposta vazia da IA.", 
        potentialLeads: [] 
      };
    }
    return {
      observations: output.observations || "Nenhuma observação investigativa específica fornecida pela IA.",
      potentialLeads: output.potentialLeads || [],
    };
  } catch (error: any) {
    console.error(`Erro em analyzeWithInvestigator: ${error.message}`, error);
    return { 
      observations: `Falha na análise do investigador: ${error.message}`, 
      potentialLeads: [] 
    };
  }
}

// --- 2. Clerk ---
const clerkPrompt = ai.definePrompt({
  name: 'clerkPrompt',
  input: { schema: AnalyzeDocumentInputSchema },
  output: { schema: ClerkOutputSchema },
  prompt: `Você é um Escrivão de Polícia.
Sua tarefa é processar o material (documento, texto ou metadados) de forma técnica, extrair informações e registrá-las de maneira estruturada.

{{#if isMediaInput}}
**Análise de Arquivo (Imagem ou PDF Processável Diretamente):**
Documento para análise ({{#if fileName}}Nome: {{fileName}}{{else}}Sem nome{{/if}}):
{{media url=fileDataUri}}

Instruções para Arquivo Processável Diretamente:
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

Instruções para Conteúdo Textual/Metadados:
Se o 'Conteúdo para Análise' for uma mensagem do sistema (começando com "AVISO DO SISTEMA:"):
   -   O campo 'extractedText' DEVE ser preenchido com este mesmo 'Conteúdo para Análise' (a mensagem do sistema).
   -   O campo 'language' DEVE ser "N/A".
   -   O campo 'summary' DEVE ser um resumo da situação: "Impossibilidade de análise direta do conteúdo do arquivo. Análise baseada em metadados como nome do arquivo e tipo MIME."
   -   O campo 'keyEntities' DEVE conter entidades extraídas do nome do arquivo (ex: {{fileName}}) e do tipo MIME informado na mensagem do sistema. Tipos de entidade podem ser "Nome de Arquivo", "Tipo MIME".
   -   O 'clerkReport.formalizedSummary' deve descrever a natureza do arquivo e sua relevância hipotética com base nos metadados.
   -   'clerkReport.keyInformationStructured' deve refletir informações derivadas dos metadados.

Se for texto extraído diretamente (não "AVISO DO SISTEMA"):
-   O campo 'extractedText' DEVE ser o 'Conteúdo para Análise'.
-   Detecte 'language'.
-   Gere 'summary' e 'keyEntities' a partir do texto.
-   Elabore 'clerkReport.formalizedSummary' e 'clerkReport.keyInformationStructured' com base no texto.
{{else}}
**Erro: Nenhum conteúdo ou arquivo válido fornecido para análise.**
Instruções: Preencha os campos da seguinte forma:
- 'summary': "Nenhum dado de entrada válido para análise do escrivão."
- 'extractedText': "Nenhum dado de entrada válido para análise do escrivão."
- 'language': "N/A"
- 'keyEntities': []
- 'clerkReport.formalizedSummary': "Nenhuma informação para formalizar devido à ausência de dados de entrada."
- 'clerkReport.keyInformationStructured': []
{{/if}}

**Tarefas de Formalização e Extração:**
(As instruções específicas para 'extractedText', 'language', 'summary', 'keyEntities' já foram dadas acima.)
-   **Sumário Formalizado dos Fatos (Estilo Boletim de Ocorrência)**: Elabore um resumo formalizado e objetivo dos fatos e informações cruciais. Se for baseado em metadados, descreva a natureza do arquivo e sua relevância hipotética.
-   **Informações Chave Estruturadas para Relatório Policial**: Categorize e detalhe as informações chave extraídas.
`,
});

async function analyzeWithClerk(input: AnalyzeDocumentInput): Promise<ClerkOutput> {
  const defaultErrorOutput: (errMsg: string, fileName?: string) => ClerkOutput = (errMsg, fileName) => ({
    extractedText: `Falha na análise do escrivão: ${errMsg}. (Arquivo: ${fileName || 'Desconhecido'})`,
    summary: `Falha na análise do escrivão: ${errMsg}. Não foi possível gerar o sumário. (Arquivo: ${fileName || 'Desconhecido'})`,
    keyEntities: [],
    language: "N/A",
    clerkReport: {
      formalizedSummary: `Falha na análise do escrivão: ${errMsg}. Não foi possível formalizar os fatos. (Arquivo: ${fileName || 'Desconhecido'})`,
      keyInformationStructured: [],
    },
  });

  try {
    if (!input.fileDataUri && !input.textContent) {
      console.warn('analyzeWithClerk: Nenhum fileDataUri ou textContent fornecido.');
      return defaultErrorOutput("Nenhum conteúdo de entrada fornecido", input.fileName);
    }
    const { output } = await clerkPrompt(input);
    if (!output) {
      console.error('Clerk prompt returned no output structure.');
      return defaultErrorOutput("Resposta vazia da IA", input.fileName);
    }
    return {
      extractedText: output.extractedText || `Texto não extraído ou ausente pela IA. (Arquivo: ${input.fileName || 'Desconhecido'})`,
      summary: output.summary || `Sumário não gerado pela IA. (Arquivo: ${input.fileName || 'Desconhecido'})`,
      keyEntities: output.keyEntities || [],
      language: output.language || "N/A",
      clerkReport: output.clerkReport || {
        formalizedSummary: "Relatório do escrivão não gerado ou incompleto pela IA.",
        keyInformationStructured: [],
      },
    };
  } catch (error: any) {
    console.error(`Erro em analyzeWithClerk: ${error.message}`, error);
    return defaultErrorOutput(error.message, input.fileName);
  }
}

// --- 3. Delegate ---
// Para o Delegate, o input idealmente incluiria o sumário/relatório do escrivão.
// Vamos criar um schema de input específico para o delegate.
const DelegateInputSchema = AnalyzeDocumentInputSchema.extend({
  clerkAnalysis: ClerkOutputSchema.optional().describe("Análise e extrações prévias do escrivão (pode conter mensagens de erro)."),
  investigatorObservations: InvestigatorAnalysisSchema.optional().describe("Observações prévias do investigador (pode conter mensagens de erro).")
});
export type DelegateInput = z.infer<typeof DelegateInputSchema>;

const delegatePrompt = ai.definePrompt({
  name: 'delegatePrompt',
  input: { schema: DelegateInputSchema },
  output: { schema: DelegateAssessmentSchema },
  prompt: `Você é um Delegado de Polícia.
Com base nas análises e extrações fornecidas (do Investigador e do Escrivão), forneça uma avaliação qualificada e direcione os próximos passos.
Note que as análises anteriores podem conter mensagens de erro (ex: "Falha na análise..."). Se for o caso, sua avaliação deve refletir isso.

**Material para Análise:**
{{#if investigatorObservations}}
**Observações do Investigador:**
Observações: {{investigatorObservations.observations}}
{{#if investigatorObservations.potentialLeads}}
Pistas Potenciais:
{{#each investigatorObservations.potentialLeads}}
- {{this}}
{{/each}}
{{/if}}
{{/if}}

{{#if clerkAnalysis}}
**Relatório e Extrações do Escrivão:**
{{#if clerkAnalysis.extractedText}}Texto Extraído: "{{clerkAnalysis.extractedText}}"{{/if}}
Resumo: "{{clerkAnalysis.summary}}"
{{#if clerkAnalysis.clerkReport.formalizedSummary}}Sumário Formalizado: "{{clerkAnalysis.clerkReport.formalizedSummary}}"{{/if}}
{{#if clerkAnalysis.keyEntities.length}}
Entidades Chave:
{{#each clerkAnalysis.keyEntities}}
- Tipo: {{this.type}}, Valor: {{this.value}}
{{/each}}
{{else}}
Nenhuma entidade chave extraída.
{{/if}}
{{#if clerkAnalysis.clerkReport.keyInformationStructured.length}}
Informações Estruturadas:
{{#each clerkAnalysis.clerkReport.keyInformationStructured}}
- Categoria: {{this.category}}, Detalhes: {{this.details}}
{{/each}}
{{else}}
Nenhuma informação estruturada extraída.
{{/if}}
{{else}}
Nenhuma análise do escrivão disponível.
{{/if}}

{{#if textContent}}
Conteúdo Original (se aplicável): {{{textContent}}}
{{else if isMediaInput}}
Um arquivo de mídia foi fornecido. Baseie-se nas extrações e observações acima.
{{else if (!clerkAnalysis && !investigatorObservations)}}
Nenhum dado de entrada parece ter sido processado com sucesso pelas fases anteriores.
Nome do Arquivo: {{#if fileName}}{{fileName}}{{else}}Nome não fornecido{{/if}}
{{/if}}


**Tarefa Principal - Avaliação e Direcionamento:**
-   **Avaliação Geral do Delegado**: Forneça uma avaliação preliminar da situação. Se as análises anteriores (Investigador/Escrivão) indicarem falhas (ex: "Falha na análise...", "Texto não extraído"), sua avaliação DEVE levar isso em conta (ex: "Impossível prosseguir com avaliação detalhada devido à falha na extração de conteúdo do documento pelo escrivão." ou "Análise investigativa comprometida, resultando em avaliação limitada."). Caso contrário, avalie o possível ilícito/fato, considerando natureza, gravidade, urgência e implicações.
-   **Ações Sugeridas pelo Delegado**: Com base na sua avaliação, liste as próximas diligências. Se a análise estiver comprometida por falhas anteriores, sugira ações como "Tentar reprocessar o documento com erro", "Analisar manualmente o arquivo original", ou "Solicitar esclarecimentos sobre a falha na fase X". Se as análises foram bem-sucedidas, sugira ações investigativas apropriadas.
-   **Considerações Legais Preliminares do Delegado**: Mencione considerações legais. Se a análise estiver comprometida, indique que considerações legais são prematuras ou condicionadas à resolução dos problemas anteriores.
`,
});

async function analyzeWithDelegate(input: DelegateInput): Promise<DelegateAssessmentSchema> {
  const defaultErrorOutput: (errMsg: string) => DelegateAssessmentSchema = (errMsg) => ({
    overallAssessment: `Falha na análise do delegado: ${errMsg}`,
    suggestedActions: [],
    legalConsiderations: `Considerações legais não puderam ser formuladas devido à falha: ${errMsg}`
  });

  try {
    // O prompt do delegado é instruído a verificar os inputs de clerkAnalysis e investigatorObservations,
    // que podem conter mensagens de erro.
    const { output } = await delegatePrompt(input);
    if (!output) {
      console.error('Delegate prompt returned no output structure.');
      return defaultErrorOutput("Resposta vazia da IA");
    }
    return {
      overallAssessment: output.overallAssessment || "Nenhuma avaliação geral fornecida pelo delegado.",
      suggestedActions: output.suggestedActions || [],
      legalConsiderations: output.legalConsiderations || "Nenhuma consideração legal específica fornecida."
    };
  } catch (error: any) {
    console.error(`Erro em analyzeWithDelegate: ${error.message}`, error);
    return defaultErrorOutput(error.message);
  }
}

// --- 4. Press Release ---
// O input para o Press Release idealmente incluiria sumário do escrivão e avaliação do delegado.
const PressReleaseInputSchema = AnalyzeDocumentInputSchema.extend({
  clerkAnalysis: ClerkOutputSchema.optional().describe("Análise e extrações do escrivão (pode conter mensagens de erro)."),
  delegateAssessment: DelegateAssessmentSchema.optional().describe("Avaliação e direcionamento do delegado (pode conter mensagens de erro).")
});
export type PressReleaseInput = z.infer<typeof PressReleaseInputSchema>;

const pressReleasePrompt = ai.definePrompt({
  name: 'pressReleasePrompt',
  input: { schema: PressReleaseInputSchema },
  output: { schema: PressReleaseOutputSchema },
  prompt: `Você é um Assessor de Imprensa da Polícia Civil da Bahia (PCBA).
Sua tarefa é redigir um press release com base nas informações disponíveis.
Note que as análises do Escrivão ou do Delegado podem conter mensagens de erro (ex: "Falha na análise..."). Seu press release deve refletir isso de forma profissional.

**Informações Disponíveis para o Press Release:**
{{#if clerkAnalysis}}
**Do Relatório do Escrivão:**
Resumo Geral: "{{clerkAnalysis.summary}}" {{!-- Pode ser uma mensagem de erro --}}
Sumário Formalizado dos Fatos: "{{clerkAnalysis.clerkReport.formalizedSummary}}" {{!-- Pode ser uma mensagem de erro --}}
{{#if clerkAnalysis.extractedText}}
{{#if clerkAnalysis.extractedText.startsWith "AVISO DO SISTEMA:"}}
Informação sobre Arquivo: {{clerkAnalysis.extractedText}}
Nome do Arquivo Original: {{#if fileName}}{{fileName}}{{else}}Não informado{{/if}}
{{else if clerkAnalysis.extractedText.startsWith "Falha na análise do escrivão:"}}
Problema na Análise do Escrivão: "{{clerkAnalysis.extractedText}}"
{{/if}}
{{/if}}
{{else if textContent}}
{{#if textContent.startsWith "AVISO DO SISTEMA:"}}
Informação sobre Arquivo: {{textContent}}
Nome do Arquivo Original: {{#if fileName}}{{fileName}}{{else}}Não informado{{/if}}
{{else}}
Conteúdo Textual Direto (sem análise prévia do escrivão): "{{textContent}}"
{{/if}}
{{else if fileName}}
Informação Limitada: Análise referente ao arquivo '{{fileName}}'.
{{else}}
Informação Limitada: Solicitação de análise recebida sem conteúdo detalhado ou nome de arquivo.
{{/if}}

{{#if delegateAssessment}}
**Da Avaliação do Delegado:**
Avaliação Geral: "{{delegateAssessment.overallAssessment}}" {{!-- Pode ser uma mensagem de erro --}}
{{#if delegateAssessment.suggestedActions.length}}
Ações Sugeridas: {{#join delegateAssessment.suggestedActions ", "}}{{/join}}
{{/if}}
{{/if}}

**Tarefa Principal - Gerar Press Release OBRIGATÓRIO:**
-   **Conteúdo**: Redija um resumo informativo e objetivo.
    *   Se as análises anteriores indicarem falhas (ex: "Falha na análise...", "Impossível prosseguir..."), o press release deve comunicar a situação de forma transparente mas profissional (ex: "A Polícia Civil da Bahia está apurando um incidente/documento. Devido a desafios técnicos no processamento inicial, detalhes específicos não podem ser divulgados no momento. As equipes estão trabalhando para solucionar a questão e garantir a integridade da análise.").
    *   Se o 'clerkAnalysis.extractedText' for uma mensagem "AVISO DO SISTEMA:", informe sobre a existência do arquivo '{{fileName}}' e a impossibilidade de detalhar seu conteúdo.
    *   Caso contrário, baseie-se no 'clerkAnalysis.clerkReport.formalizedSummary' ou 'clerkAnalysis.summary', adaptando para o público.
-   **Estrutura do Release**: Título, data/local (Salvador, BA), resumo divulgável, ações da PCBA (se houver), importância (mesmo que "recebido para análise"), citação simulada (opcional), contato (simulado).
-   **Tom e Estilo**: Claro, conciso, imparcial, profissional. Mantenha a confiança do público mesmo ao reportar dificuldades.
-   **Garantia de Geração**: Um press release DEVE ser gerado. Se as informações forem muito escassas ou indicarem múltiplas falhas, o release deve refletir isso (ex: "A Polícia Civil da Bahia confirma o recebimento de um documento para análise. O processamento encontra-se em estágio inicial e mais detalhes serão divulgados oportunamente.").
`,
});

async function generatePressRelease(input: PressReleaseInput): Promise<PressReleaseOutput> {
  const defaultFallbackMessage = (errMsg?: string): string => {
    let msg = "A Polícia Civil da Bahia informa que está analisando um documento ";
    if (input.fileName) {
      msg += `denominado '${input.fileName}' `;
    }
    msg += "recebido recentemente. ";
    
    if (input.clerkAnalysis?.summary && 
        !input.clerkAnalysis.summary.toLowerCase().includes("falha na análise") && 
        !input.clerkAnalysis.summary.includes("Impossibilidade de análise direta")) {
      msg += `Resumo preliminar: ${input.clerkAnalysis.summary}. `;
    } else if (input.clerkAnalysis?.extractedText?.toLowerCase().includes("falha na análise")) {
      msg += "Ocorreu uma dificuldade técnica no processamento inicial do documento. ";
    } else if (errMsg) {
      msg += `Ocorreu um erro ao gerar o comunicado: ${errMsg}. `;
    }
    
    msg += "As investigações estão em andamento. Detalhes adicionais serão fornecidos à medida que se tornarem disponíveis e apropriados para divulgação pública. Contato: Assessoria de Comunicação da PCBA - ascom@pc.ba.gov.br.";
    return msg;
  }

  try {
    const { output } = await pressReleasePrompt(input);
    if (!output || !output.pressRelease || output.pressRelease.trim() === "") {
      console.warn('Press release prompt returned empty or null. Using fallback.');
      return { pressRelease: defaultFallbackMessage("Resposta vazia da IA") };
    }
    return output;
  } catch (error: any) {
    console.error(`Erro em generatePressRelease: ${error.message}`, error);
    return { pressRelease: defaultFallbackMessage(error.message) };
  }
}


// #################################################################################
// END: Role-Specific Prompts and Functions
// #################################################################################


// REMOVE OLD MONOLITHIC PROMPT - It's replaced by role-specific prompts.
// const analyzeDocumentPrompt = ai.definePrompt({ ... });

// CrimeTagFromFlowSchema is removed as it's redundant. We'll use CrimeTagSchema imported from classify-text-for-crimes-flow.ts

const CrimeAnalysisResultsSchema = z.object({
  crimeTags: z.array(CrimeTagSchema).describe("Lista de tags de crimes identificados. Pode estar vazia se nenhum crime for detectado ou se a análise falhar."), // Using imported CrimeTagSchema
  overallCriminalAssessment: z.string().describe("Avaliação geral sobre crimes. Pode conter mensagem de erro se a classificação falhar."),
});
// It's useful to also export the type for CrimeAnalysisResults if it's used elsewhere,
// or if direct type hinting is preferred in some parts of the code.
export type CrimeAnalysisResults = z.infer<typeof CrimeAnalysisResultsSchema>;


const AnalyzeDocumentOutputSchema = z.object({
  extractedText: z.string().optional().describe('O texto extraído ou uma mensagem de erro indicando falha na extração (ex: "Falha na análise do escrivão: Erro ao extrair texto.").'),
  summary: z.string().describe('Resumo do documento ou uma mensagem de erro (ex: "Falha na análise do escrivão: Não foi possível gerar sumário.").'),
  keyEntities: z.array(KeyEntitySchema).optional().describe('Lista de entidades chave. Pode ser vazia se a extração falhar.'),
  language: z.string().optional().describe('Idioma detectado ou "N/A" em caso de falha.'),
  
  investigatorAnalysis: InvestigatorAnalysisSchema.describe("Análise do Investigador. O campo 'observations' pode conter mensagens de erro."),
  clerkReport: ClerkReportSchema.optional().describe("Relatório do Escrivão. Campos internos podem conter mensagens de erro."),
  delegateAssessment: DelegateAssessmentSchema.optional().describe("Avaliação do Delegado. Campos internos podem conter mensagens de erro."),
  crimeAnalysisResults: CrimeAnalysisResultsSchema.optional().describe("Resultados da classificação de crimes. Contém 'crimeTags' (usando o schema importado) e 'overallCriminalAssessment'. 'overallCriminalAssessment' pode conter mensagens de erro."),
  pressRelease: z.string().describe("Press release para a imprensa. Pode refletir falhas nas etapas anteriores ou conter uma mensagem de erro específica."),
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
  try {
    if (input.fileDataUri) {
      const originalMimeType = getMimeTypeFromDataUri(input.fileDataUri);
      const fileName = input.fileName || 'Desconhecido';
      let processedFileDataUri = input.fileDataUri;

      let effectiveMimeTypeForCheck = originalMimeType ? originalMimeType.toLowerCase() : null;
      const isPdfByExtension = fileName.toLowerCase().endsWith('.pdf');

      if (isPdfByExtension && (effectiveMimeTypeForCheck === 'application/octet-stream' || !effectiveMimeTypeForCheck)) {
        effectiveMimeTypeForCheck = 'application/pdf';
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
          isMediaInput: true,
        };
        return await analyzeDocumentFlowInternal(internalFlowInput);
      } else {
        const systemMessage = `AVISO DO SISTEMA: O arquivo '${fileName}' (tipo MIME: ${effectiveMimeTypeForCheck || 'desconhecido'}) foi fornecido. Seu conteúdo binário não pode ser processado/extraído diretamente pela IA neste fluxo. A análise subsequente deve se concentrar no nome do arquivo, tipo MIME informado e na natureza deste aviso. Tente extrair entidades do nome do arquivo e do tipo MIME.`;
        const internalFlowInput: AnalyzeDocumentInput = { 
          textContent: systemMessage, 
          fileName: fileName,
          isMediaInput: false,
        };
        return await analyzeDocumentFlowInternal(internalFlowInput);
      }
    } else if (input.textContent) {
      const internalFlowInput: AnalyzeDocumentInput = {
        textContent: input.textContent,
        fileName: input.fileName,
        isMediaInput: false,
      };
      return await analyzeDocumentFlowInternal(internalFlowInput);
    } else {
      // This case is caught by Zod refine on AnalyzeDocumentInputSchema, but as a defense-in-depth:
      console.error("analyzeDocument foi chamado sem fileDataUri ou textContent. Isso não deveria ocorrer se a validação de schema funcionou.");
      const errorMsg = "Entrada inválida: Nenhum documento ou conteúdo textual fornecido para análise. Verifique a requisição.";
      // Construct a full error output matching AnalyzeDocumentOutputSchema
      return {
        extractedText: `Falha crítica na entrada: ${errorMsg}`,
        summary: `Falha crítica na entrada: ${errorMsg}`,
        keyEntities: [],
        language: "N/A",
        investigatorAnalysis: { observations: `Falha na análise: ${errorMsg}`, potentialLeads: [] },
        clerkReport: { formalizedSummary: `Falha na análise: ${errorMsg}`, keyInformationStructured: [] },
        delegateAssessment: { overallAssessment: `Falha na análise: ${errorMsg}`, suggestedActions: [], legalConsiderations: `Falha na análise: ${errorMsg}` },
        pressRelease: `A Polícia Civil da Bahia informa um problema técnico: ${errorMsg}. Contato: Assessoria de Comunicação da PCBA - ascom@pc.ba.gov.br.`,
        crimeAnalysisResults: { crimeTags: [], overallCriminalAssessment: `Falha na análise: ${errorMsg}` },
      };
    }
  } catch (error: any) {
    // Catch any unexpected errors from analyzeDocumentFlowInternal or other logic within analyzeDocument itself
    console.error(`Erro crítico e inesperado em analyzeDocument: ${error.message}`, error);
    const criticalErrorMsg = `Erro crítico e inesperado durante a análise do documento: ${error.message}. A equipe técnica foi notificada.`;
    return {
      extractedText: criticalErrorMsg,
      summary: criticalErrorMsg,
      keyEntities: [],
      language: "N/A",
      investigatorAnalysis: { observations: criticalErrorMsg, potentialLeads: [] },
      clerkReport: { formalizedSummary: criticalErrorMsg, keyInformationStructured: [] },
      delegateAssessment: { overallAssessment: criticalErrorMsg, suggestedActions: [], legalConsiderations: criticalErrorMsg },
      pressRelease: `A Polícia Civil da Bahia informa que ocorreu um erro crítico e inesperado durante o processamento de um documento. Detalhes técnicos: ${error.message}. A equipe técnica foi notificada. Contato: Assessoria de Comunicação da PCBA - ascom@pc.ba.gov.br.`,
      crimeAnalysisResults: { crimeTags: [], overallCriminalAssessment: criticalErrorMsg },
    };
  }
}

const analyzeDocumentFlowInternal = ai.defineFlow(
  {
    name: 'analyzeDocumentFlowInternal',
    inputSchema: AnalyzeDocumentInputSchema, 
    outputSchema: AnalyzeDocumentOutputSchema, 
  },
  async (rawInput: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> => { 
    // This function orchestrates calls to role-specific functions.
    // These functions now internally handle errors and return schema-compliant outputs,
    // possibly embedding error messages within their fields.

    const baseAnalysisInput: AnalyzeDocumentInput = {
        ...rawInput,
        isMediaInput: rawInput.isMediaInput === true || (!!rawInput.fileDataUri && !rawInput.textContent), 
    };
    // Clear fileDataUri if textContent is the primary source (and not a system message for a file)
    if (!baseAnalysisInput.isMediaInput && baseAnalysisInput.textContent) {
        delete baseAnalysisInput.fileDataUri; 
    }

    // Fase 1: Análise Investigativa
    const investigatorAnalysis = await analyzeWithInvestigator(baseAnalysisInput);

    // Fase 2: Formalização e Extração (Escrivão)
    let clerkInput = {...baseAnalysisInput};
    // If it was a non-processable file, clerk should operate on the system message (textContent)
    if (clerkInput.isMediaInput && clerkInput.textContent && clerkInput.textContent.startsWith("AVISO DO SISTEMA:")) {
      clerkInput.fileDataUri = undefined; 
      clerkInput.isMediaInput = false; 
    }
    const clerkOutput = await analyzeWithClerk(clerkInput); // clerkOutput may contain error messages

    // Fase 3: Avaliação e Direcionamento (Delegado)
    let delegateInput: DelegateInput = {
      ...baseAnalysisInput, 
      clerkAnalysis: clerkOutput, // Pass potentially error-laden clerkOutput
      investigatorObservations: investigatorAnalysis, // Pass potentially error-laden investigatorAnalysis
      isMediaInput: baseAnalysisInput.isMediaInput, 
    };
    if (delegateInput.isMediaInput && delegateInput.textContent && delegateInput.textContent.startsWith("AVISO DO SISTEMA:")) {
        delegateInput.fileDataUri = undefined;
        delegateInput.isMediaInput = false;
    }
    const delegateAssessment = await analyzeWithDelegate(delegateInput); // delegateAssessment may contain error messages

    // Fase 4: Comunicação à Imprensa (Assessor de Imprensa)
    let pressReleaseInput: PressReleaseInput = {
      ...baseAnalysisInput, 
      clerkAnalysis: clerkOutput,
      delegateAssessment: delegateAssessment,
      isMediaInput: baseAnalysisInput.isMediaInput,
    };
    if (pressReleaseInput.isMediaInput && pressReleaseInput.textContent && pressReleaseInput.textContent.startsWith("AVISO DO SISTEMA:")) {
        pressReleaseInput.fileDataUri = undefined;
        pressReleaseInput.isMediaInput = false;
    }
    const pressReleaseOutput = await generatePressRelease(pressReleaseInput); // pressReleaseOutput may contain error messages

    // Montar a saída final
    // The individual components (clerkOutput, investigatorAnalysis, etc.)
    // now conform to their schemas even in error cases, containing error messages in string fields.
    const finalOutput: AnalyzeDocumentOutput = {
      extractedText: clerkOutput.extractedText,
      summary: clerkOutput.summary,
      keyEntities: clerkOutput.keyEntities,
      language: clerkOutput.language,
      investigatorAnalysis: investigatorAnalysis,
      clerkReport: clerkOutput.clerkReport,
      delegateAssessment: delegateAssessment,
      pressRelease: pressReleaseOutput.pressRelease,
      // crimeAnalysisResults will be added next
    };
    
    // Análise de Crimes
    let crimeAnalysisResults: ClassifyTextForCrimesOutput;
    const textForCrimeAnalysis = clerkOutput.extractedText;
    const clerkFailed = textForCrimeAnalysis && (
        textForCrimeAnalysis.startsWith("Falha na análise do escrivão:") || 
        textForCrimeAnalysis.startsWith("AVISO DO SISTEMA:") ||
        textForCrimeAnalysis.includes("Nenhum dado de entrada válido para análise do escrivão") ||
        textForCrimeAnalysis.includes("Texto não extraído ou ausente pela IA")
    );

    if (textForCrimeAnalysis && !clerkFailed) {
      try {
        const crimeInput: ClassifyTextForCrimesInput = {
          textContent: textForCrimeAnalysis,
          context: `Documento analisado: ${rawInput.fileName || 'Nome de arquivo desconhecido'}`
        };
        const result = await classifyTextForCrimes(crimeInput);
        if (!result) {
            console.error("classifyTextForCrimes returned undefined");
            crimeAnalysisResults = {
                crimeTags: [],
                overallCriminalAssessment: "Falha na classificação de crimes: resposta nula ou indefinida da função de classificação."
            };
        } else {
            crimeAnalysisResults = result;
        }
      } catch (crimeError: any) {
        console.error("Erro na classificação de crimes:", crimeError);
        crimeAnalysisResults = {
          crimeTags: [],
          overallCriminalAssessment: `Falha ao realizar a classificação de crimes no texto do documento: ${crimeError.message}`
        };
      }
    } else {
       crimeAnalysisResults = {
          crimeTags: [],
          overallCriminalAssessment: "Nenhum texto útil extraído ou disponível para análise de crimes."
       };
       if (clerkFailed) {
          crimeAnalysisResults.overallCriminalAssessment = `Classificação de crimes não realizada devido à falha na extração de texto pelo escrivão. Detalhe da falha do escrivão: "${textForCrimeAnalysis}"`;
       }
    }
    
    return {
      ...finalOutput,
      crimeAnalysisResults: crimeAnalysisResults
    };
  }
);

    


