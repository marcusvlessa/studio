
import type { AnalyzeDocumentOutput } from "@/ai/flows/analyze-document-flow";
import type { TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";
import type { ConsolidateAudioAnalysesOutput } from "@/ai/flows/consolidate-audio-analyses-flow";
import type { AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import type { FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";

interface BaseAnalysis {
  id: string;
  analysisDate: string;
  originalFileName?: string;
  summary: string; // A concise summary/title for the analysis item
}

export interface DocumentCaseAnalysis extends BaseAnalysis {
  type: "Documento";
  data: AnalyzeDocumentOutput;
}

export interface AudioCaseAnalysis extends BaseAnalysis {
  type: "Áudio";
  data: TranscribeAudioOutput;
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

export type CaseAnalysis =
  | DocumentCaseAnalysis
  | AudioCaseAnalysis
  | AudioConsolidatedCaseAnalysis
  | ImageCaseAnalysis
  | LinkCaseAnalysis;

export interface Case {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  lastModified: string;
  status: "Aberto" | "Em Investigação" | "Resolvido" | "Fechado";
  relatedAnalyses: CaseAnalysis[];
}
