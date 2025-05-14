// src/types/case.ts


import type { AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import type { TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";
import type { ConsolidateAudioAnalysesOutput } from "@/ai/flows/consolidate-audio-analyses-flow";
import type { AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import type { FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import type { AnalyzeFinancialDataOutput, FinancialDashboardData } from "@/ai/flows/analyze-financial-data-flow"; // Import FinancialDashboardData
import type { ClassifyTextForCrimesOutput } from "@/ai/flows/classify-text-for-crimes-flow"; 

interface BaseAnalysis {
  id: string;
  analysisDate: string;
  originalFileName?: string;
  summary: string; 
}

export interface DocumentCaseAnalysis extends BaseAnalysis {
  type: "Documento";
  data: AnalyzeDocumentOutput; 
}

export interface AudioCaseAnalysis extends BaseAnalysis {
  type: "Áudio";
  data: TranscribeAudioOutput & { crimeAnalysisResults?: ClassifyTextForCrimesOutput }; 
}

export interface AudioConsolidatedCaseAnalysis extends BaseAnalysis {
  type: "Áudio Consolidado";
  data: ConsolidateAudioAnalysesOutput; 
}

export interface ImageCaseAnalysis extends BaseAnalysis {
  type: "Imagem";
  data: AnalyzeImageOutput;
}

export interface LinkCaseAnalysis extends BaseAnalysis {
  type: "Vínculo";
  data: FindEntityRelationshipsOutput;
}

export interface FinancialCaseAnalysis extends BaseAnalysis {
  type: "Financeiro";
  data: AnalyzeFinancialDataOutput; // This already includes dashboardData: FinancialDashboardData | undefined
}


export type CaseAnalysis =
  | DocumentCaseAnalysis
  | AudioCaseAnalysis
  | AudioConsolidatedCaseAnalysis
  | ImageCaseAnalysis
  | LinkCaseAnalysis
  | FinancialCaseAnalysis;

export interface Case {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  status: "Aberto" | "Em Investigação" | "Resolvido" | "Fechado";
  relatedAnalyses: CaseAnalysis[];
}

export interface AggregatedCrimeTag {
  name: string; // Keep 'name' for BarChart dataKey compatibility
  crimeType: string