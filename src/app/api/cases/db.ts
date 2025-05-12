
import type { Case } from '@/types/case';

// In-memory store for cases
// IMPORTANT: This is for demonstration purposes only and will reset when the server restarts.
// A real application would use a persistent database.
export let casesDB: Case[] = [
  {
    id: "mock-case-1",
    name: "Operação Pégaso",
    description: "Investigação sobre fraudes financeiras online.",
    dateCreated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    status: "Em Investigação",
    relatedAnalyses: [],
  },
  {
    id: "mock-case-2",
    name: "Caso Testemunha Silenciosa",
    description: "Análise de documentos e áudios para identificar conexões.",
    dateCreated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    lastModified: new Date().toISOString(),
    status: "Aberto",
    relatedAnalyses: [],
  }
];

// Helper function to find a case by ID
export const findCaseById = (caseId: string): Case | undefined => {
  return casesDB.find(c => c.id === caseId);
};

// Helper function to update a case
export const updateCaseInDB = (updatedCase: Case): Case | null => {
  const caseIndex = casesDB.findIndex(c => c.id === updatedCase.id);
  if (caseIndex !== -1) {
    casesDB[caseIndex] = updatedCase;
    return casesDB[caseIndex];
  }
  return null;
};

// Helper function to delete a case
export const deleteCaseFromDB = (caseId: string): boolean => {
  const initialLength = casesDB.length;
  casesDB = casesDB.filter(c => c.id !== caseId);
  return casesDB.length < initialLength;
};

// Helper function to add a case
export const addCaseToDB = (newCase: Case): Case => {
  casesDB.unshift(newCase); // Add to the beginning of the array
  return newCase;
};
