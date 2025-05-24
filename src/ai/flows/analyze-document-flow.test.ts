// @vitest-environment node
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import { ZodError } from 'zod';

// Mock Genkit AI and specific flow dependencies
vi.mock('@/ai/genkit', async () => {
  const actualGenkit = await vi.importActual('@/ai/genkit') as any;
  // This is a simplified mock. It returns a mock function for each prompt,
  // which we can then specifically mock the resolution for in tests.
  // A more sophisticated version could use the 'name' property of the prompt config.
  const definePromptMock = vi.fn((config) => {
    // This function (the actual prompt) needs to be callable and return a promise
    // that resolves to an object with an 'output' property.
    const promptMock = vi.fn().mockName(config.name || 'unnamedPrompt');
    return promptMock;
  });

  return {
    ...actualGenkit,
    ai: {
      ...actualGenkit.ai,
      definePrompt: definePromptMock,
      defineFlow: vi.fn().mockImplementation((config, func) => func), // Mock defineFlow to just return the function
    },
  };
});

// Mock classifyTextForCrimes flow
vi.mock('./classify-text-for-crimes-flow', async () => {
  const actual = await vi.importActual('./classify-text-for-crimes-flow') as any;
  return {
    ...actual,
    classifyTextForCrimes: vi.fn().mockName('classifyTextForCrimes'),
  };
});


import { analyzeDocument, AnalyzeDocumentOutputSchema, AnalyzeDocumentInput } from './analyze-document-flow';
import { classifyTextForCrimes } from './classify-text-for-crimes-flow';
import { ai } from '@/ai/genkit';
import { CrimeAnalysisResultsSchema, InvestigatorAnalysisSchema, ClerkOutputSchema, DelegateAssessmentSchema, PressReleaseOutputSchema, KeyEntitySchema, ClerkReportSchema } from './analyze-document-flow'; // Import internal schemas for mocking


describe('analyzeDocument Flow', () => {
  // Helper to get the mock for a specific prompt based on its definition order or name
  // This relies on the order of calls to definePrompt within analyze-document-flow.ts
  // 1. investigatorPrompt, 2. clerkPrompt, 3. delegatePrompt, 4. pressReleasePrompt
  const getPromptMock = (name: 'investigatorPrompt' | 'clerkPrompt' | 'delegatePrompt' | 'pressReleasePrompt') => {
    const definePromptCalls = (ai.definePrompt as vi.Mock).mock.calls;
    let callIndex = -1;
    if (name === 'investigatorPrompt') callIndex = 0;
    else if (name === 'clerkPrompt') callIndex = 1;
    else if (name === 'delegatePrompt') callIndex = 2;
    else if (name === 'pressReleasePrompt') callIndex = 3;
    
    if (callIndex === -1 || !definePromptCalls[callIndex]) {
        throw new Error(`Mock for prompt definition ${name} not found or not called in expected order.`);
    }
    // The definePrompt mock returns the prompt function itself
    return (ai.definePrompt as vi.Mock).mock.results[callIndex].value as vi.Mock;
  };


  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error-filled output if no input is provided', async () => {
    // This case is handled by the Zod refine at the schema level or by the initial checks in analyzeDocument.
    // The refine in AnalyzeDocumentInputSchema should catch this.
    // However, the implementation in analyzeDocument also provides a fallback.
    const result = await analyzeDocument({} as any); // Force invalid input

    expect(result.summary).toContain('Entrada inválida: Nenhum documento ou conteúdo textual fornecido para análise.');
    expect(result.extractedText).toContain('Falha crítica na entrada: Entrada inválida: Nenhum documento ou conteúdo textual fornecido para análise.');
    expect(result.investigatorAnalysis.observations).toContain('Falha na análise: Entrada inválida');
    expect(result.clerkReport?.formalizedSummary).toContain('Falha na análise: Entrada inválida');
    expect(result.delegateAssessment?.overallAssessment).toContain('Falha na análise: Entrada inválida');
    expect(result.pressRelease).toContain('Falha na análise do documento: Entrada inválida');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toContain('Falha na análise: Entrada inválida');
  });

  it('should handle non-processable file types (System Message)', async () => {
    const input: AnalyzeDocumentInput = {
      fileDataUri: 'data:application/zip;base64,UEsDBBQAAAAA...', // Non-processable
      fileName: 'archive.zip',
    };
    const systemMessage = `AVISO DO SISTEMA: O arquivo '${input.fileName}' (tipo MIME: application/zip) foi fornecido. Seu conteúdo binário não pode ser processado/extraído diretamente pela IA neste fluxo. A análise subsequente deve se concentrar no nome do arquivo, tipo MIME informado e na natureza deste aviso. Tente extrair entidades do nome do arquivo e do tipo MIME.`;

    // Mock AI responses
    getPromptMock('investigatorPrompt').mockResolvedValue({ output: { observations: 'Investigator observed system message for archive.zip.', potentialLeads: ['Check file metadata'] } });
    getPromptMock('clerkPrompt').mockResolvedValue({ 
      output: { 
        extractedText: systemMessage,
        summary: 'Impossibilidade de análise direta do conteúdo do arquivo. Análise baseada em metadados como nome do arquivo e tipo MIME.',
        keyEntities: [{type: 'Nome de Arquivo', value: 'archive.zip'}, {type: 'Tipo MIME', value: 'application/zip'}],
        language: 'N/A',
        clerkReport: { formalizedSummary: 'Clerk report for system message: archive.zip', keyInformationStructured: []}
      } 
    });
    getPromptMock('delegatePrompt').mockResolvedValue({ output: { overallAssessment: 'Delegate assessment for system message: archive.zip', suggestedActions: ['Log file receipt'], legalConsiderations: 'None directly from content.' } });
    getPromptMock('pressReleasePrompt').mockResolvedValue({ output: { pressRelease: 'Press release regarding archive.zip: content not processed.' } });
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ crimeTags: [], overallCriminalAssessment: 'Nenhum texto útil extraído ou disponível para análise de crimes.' });

    const result = await analyzeDocument(input);

    expect(result.extractedText).toBe(systemMessage);
    expect(result.summary).toBe('Impossibilidade de análise direta do conteúdo do arquivo. Análise baseada em metadados como nome do arquivo e tipo MIME.');
    expect(result.keyEntities).toEqual([{type: 'Nome de Arquivo', value: 'archive.zip'}, {type: 'Tipo MIME', value: 'application/zip'}]);
    expect(result.investigatorAnalysis.observations).toBe('Investigator observed system message for archive.zip.');
    expect(result.clerkReport?.formalizedSummary).toBe('Clerk report for system message: archive.zip');
    expect(result.delegateAssessment?.overallAssessment).toBe('Delegate assessment for system message: archive.zip');
    expect(result.pressRelease).toBe('Press release regarding archive.zip: content not processed.');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toBe('Classificação de crimes não realizada devido à falha na extração de texto pelo escrivão. Detalhe da falha do escrivão: "AVISO DO SISTEMA: O arquivo \'archive.zip\' (tipo MIME: application/zip) foi fornecido. Seu conteúdo binário não pode ser processado/extraído diretamente pela IA neste fluxo. A análise subsequente deve se concentrar no nome do arquivo, tipo MIME informado e na natureza deste aviso. Tente extrair entidades do nome do arquivo e do tipo MIME."');
  });

  it('should successfully analyze textContent', async () => {
    const input: AnalyzeDocumentInput = {
      textContent: 'This is a test document about a fictional event.',
      fileName: 'test.txt',
    };

    // Mock AI responses for successful path
    getPromptMock('investigatorPrompt').mockResolvedValue({ output: { observations: 'Investigator: Looks interesting.', potentialLeads: ['Follow up on event'] } });
    getPromptMock('clerkPrompt').mockResolvedValue({ 
      output: { 
        extractedText: input.textContent,
        summary: 'Summary of test document.',
        keyEntities: [{type: 'Event', value: 'fictional event'}],
        language: 'en',
        clerkReport: { formalizedSummary: 'Formalized summary of test.txt', keyInformationStructured: [{category: 'Content', details: 'fictional event'}]}
      } 
    });
    getPromptMock('delegatePrompt').mockResolvedValue({ output: { overallAssessment: 'Delegate: Seems straightforward.', suggestedActions: ['Archive it'], legalConsiderations: 'N/A' } });
    getPromptMock('pressReleasePrompt').mockResolvedValue({ output: { pressRelease: 'Press release: test.txt analyzed.' } });
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ crimeTags: [{crimeType: 'Fictional Activity', description: 'Activity in a test document', confidence: 0.3, involvedParties:[], relevantExcerpts:[]}], overallCriminalAssessment: 'Low relevance.' });

    const result = await analyzeDocument(input);

    expect(result.extractedText).toBe(input.textContent);
    expect(result.summary).toBe('Summary of test document.');
    expect(result.investigatorAnalysis.observations).toBe('Investigator: Looks interesting.');
    expect(result.clerkReport?.formalizedSummary).toBe('Formalized summary of test.txt');
    expect(result.delegateAssessment?.overallAssessment).toBe('Delegate: Seems straightforward.');
    expect(result.pressRelease).toBe('Press release: test.txt analyzed.');
    expect(result.crimeAnalysisResults?.crimeTags[0].crimeType).toBe('Fictional Activity');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toBe('Low relevance.');
  });

  it('should successfully analyze fileDataUri (directly processable)', async () => {
    const input: AnalyzeDocumentInput = {
      fileDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // 1x1 pixel PNG
      fileName: 'pixel.png',
    };
     const expectedExtractedText = "Extracted text from pixel.png by AI."; // Example, actual OCR would differ

    getPromptMock('investigatorPrompt').mockResolvedValue({ output: { observations: 'Investigator: PNG processed.', potentialLeads: [] } });
    getPromptMock('clerkPrompt').mockResolvedValue({ 
      output: { 
        extractedText: expectedExtractedText,
        summary: 'Summary of pixel.png.',
        keyEntities: [{type: 'File', value: 'pixel.png'}],
        language: 'en', // Assuming OCR gives English for this example
        clerkReport: { formalizedSummary: 'Formalized summary of pixel.png', keyInformationStructured: []}
      } 
    });
    getPromptMock('delegatePrompt').mockResolvedValue({ output: { overallAssessment: 'Delegate: PNG assessed.', suggestedActions: [], legalConsiderations: 'N/A' } });
    getPromptMock('pressReleasePrompt').mockResolvedValue({ output: { pressRelease: 'Press release: pixel.png analyzed.' } });
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ crimeTags: [], overallCriminalAssessment: 'No criminal content in pixel.png.' });

    const result = await analyzeDocument(input);

    expect(result.extractedText).toBe(expectedExtractedText);
    expect(result.summary).toBe('Summary of pixel.png.');
    expect(result.investigatorAnalysis.observations).toBe('Investigator: PNG processed.');
    expect(result.pressRelease).toBe('Press release: pixel.png analyzed.');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toBe('No criminal content in pixel.png.');
  });

  it('should handle failure in a role-specific flow (e.g., clerk)', async () => {
    const input: AnalyzeDocumentInput = {
      textContent: 'Some content that will cause clerk to fail.',
      fileName: 'clerk_fail_test.txt',
    };
    const clerkErrorMessage = `Falha na análise do escrivão: AI error during clerk processing. (Arquivo: ${input.fileName})`;

    getPromptMock('investigatorPrompt').mockResolvedValue({ output: { observations: 'Investigator: Analysis proceeding.', potentialLeads: [] } });
    // Mock clerk to return its structured error
    getPromptMock('clerkPrompt').mockResolvedValue({ 
      output: { 
        extractedText: clerkErrorMessage,
        summary: `Falha na análise do escrivão: AI error during clerk processing. Não foi possível gerar o sumário. (Arquivo: ${input.fileName})`,
        keyEntities: [],
        language: 'N/A',
        clerkReport: { 
          formalizedSummary: `Falha na análise do escrivão: AI error during clerk processing. Não foi possível formalizar os fatos. (Arquivo: ${input.fileName})`, 
          keyInformationStructured: []
        }
      } 
    });
    // Delegate and Press Release should reflect the clerk's failure
    getPromptMock('delegatePrompt').mockResolvedValue({ 
      output: { 
        overallAssessment: 'Delegate: Assessment impossible due to clerk failure.', 
        suggestedActions: ['Retry clerk analysis'], 
        legalConsiderations: 'Cannot determine due to clerk failure.' 
      } 
    });
    getPromptMock('pressReleasePrompt').mockResolvedValue({ 
      output: { 
        pressRelease: 'Press release: Analysis of clerk_fail_test.txt encountered issues due to clerk phase error.' 
      } 
    });
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ 
      crimeTags: [], 
      overallCriminalAssessment: `Classificação de crimes não realizada devido à falha na extração de texto pelo escrivão. Detalhe da falha do escrivão: "${clerkErrorMessage}"`
    });

    const result = await analyzeDocument(input);

    expect(result.investigatorAnalysis.observations).toBe('Investigator: Analysis proceeding.');
    expect(result.extractedText).toBe(clerkErrorMessage);
    expect(result.summary).toContain('Falha na análise do escrivão');
    expect(result.clerkReport?.formalizedSummary).toContain('Falha na análise do escrivão');
    expect(result.delegateAssessment?.overallAssessment).toBe('Delegate: Assessment impossible due to clerk failure.');
    expect(result.pressRelease).toBe('Press release: Analysis of clerk_fail_test.txt encountered issues due to clerk phase error.');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toContain('Classificação de crimes não realizada devido à falha na extração de texto pelo escrivão');
  });

  it('should handle failure in classifyTextForCrimes', async () => {
    const input: AnalyzeDocumentInput = {
      textContent: 'Valid content for analysis.',
      fileName: 'crime_fail_test.txt',
    };
    const crimeAnalysisErrorMessage = 'Falha ao realizar a classificação de crimes no texto do documento: Simulated AI error in crime classification.';

    getPromptMock('investigatorPrompt').mockResolvedValue({ output: { observations: 'Investigator: OK.', potentialLeads: [] } });
    getPromptMock('clerkPrompt').mockResolvedValue({ 
      output: { 
        extractedText: input.textContent,
        summary: 'Summary of crime_fail_test.txt.',
        keyEntities: [], language: 'en',
        clerkReport: { formalizedSummary: 'Clerk report for crime_fail_test.txt', keyInformationStructured: []}
      } 
    });
    getPromptMock('delegatePrompt').mockResolvedValue({ output: { overallAssessment: 'Delegate: OK.', suggestedActions: [], legalConsiderations: 'N/A' } });
    getPromptMock('pressReleasePrompt').mockResolvedValue({ output: { pressRelease: 'Press release: crime_fail_test.txt analyzed.' } });
    
    // Mock classifyTextForCrimes to return its error structure
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ 
      crimeTags: [], 
      overallCriminalAssessment: crimeAnalysisErrorMessage 
    });

    const result = await analyzeDocument(input);

    expect(result.extractedText).toBe(input.textContent);
    expect(result.investigatorAnalysis.observations).toBe('Investigator: OK.');
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toBe(crimeAnalysisErrorMessage);
    expect(result.crimeAnalysisResults?.crimeTags).toEqual([]);
  });

  it('should handle unexpected error during a prompt call', async () => {
    const input: AnalyzeDocumentInput = {
      textContent: 'Content that causes unexpected error.',
      fileName: 'unexpected_error.txt',
    };
    const unexpectedErrorMessage = "Simulated unexpected network error";

    // Mock investigator to throw an actual error
    getPromptMock('investigatorPrompt').mockRejectedValue(new Error(unexpectedErrorMessage));
    
    // Other mocks can be simple, as they might not be reached or their input will be error data
    getPromptMock('clerkPrompt').mockResolvedValue({ 
        output: { 
            extractedText: `Falha na análise do escrivão: Nenhum conteúdo de entrada fornecido. (Arquivo: ${input.fileName})`, // Default error from clerk if investigator fails badly
            summary: "...", keyEntities: [], language: 'N/A', clerkReport: { formalizedSummary: "...", keyInformationStructured: []}
        }
    });
     getPromptMock('delegatePrompt').mockResolvedValue({ output: { overallAssessment: "...", suggestedActions: [], legalConsiderations: "..." } });
     getPromptMock('pressReleasePrompt').mockResolvedValue({ output: { pressRelease: "..." } });
    (classifyTextForCrimes as vi.Mock).mockResolvedValue({ crimeTags: [], overallCriminalAssessment: "..." });


    const result = await analyzeDocument(input);
    
    // Check if the investigator's error is reflected
    expect(result.investigatorAnalysis.observations).toBe(`Falha na análise do investigador: ${unexpectedErrorMessage}`);
    // Subsequent steps will use the error output from the failed step or default error messages
    expect(result.clerkReport?.formalizedSummary).toContain("Falha na análise do escrivão"); // Clerk will receive investigator's error
    expect(result.delegateAssessment?.overallAssessment).toContain("Falha na análise do delegado"); // Delegate will receive error inputs
    expect(result.pressRelease).not.toBe("..."); // The press release should reflect the error.
    expect(result.crimeAnalysisResults?.overallCriminalAssessment).toContain("Classificação de crimes não realizada");
  });

});

// Helper to validate against Zod schema - useful for complex objects
// Not strictly necessary for each test if using toMatchObject and checking key fields,
// but good for ensuring full compliance if needed.
// e.g. expect(() => AnalyzeDocumentOutputSchema.parse(result)).not.toThrow();
