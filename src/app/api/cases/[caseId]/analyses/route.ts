
import { NextResponse, type NextRequest } from 'next/server';
import { findCaseById, updateCaseInDB } from '../../db'; // Adjust path to db
import type { CaseAnalysis, Case } from '@/types/case';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const caseId = params.caseId;
    const analysisData: Omit<CaseAnalysis, 'id' | 'analysisDate'> = await request.json();

    const targetCase = findCaseById(caseId);

    if (!targetCase) {
      return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
    }

    const newAnalysis: CaseAnalysis = {
      ...analysisData,
      id: crypto.randomUUID(),
      analysisDate: new Date().toISOString(),
    } as CaseAnalysis; // Cast because data structure varies

    targetCase.relatedAnalyses.push(newAnalysis);
    targetCase.lastModified = new Date().toISOString();
    
    const updatedCase = updateCaseInDB(targetCase);

    if (updatedCase) {
      return NextResponse.json(newAnalysis, { status: 201 });
    } else {
      return NextResponse.json({ error: 'Falha ao adicionar análise ao caso.' }, { status: 500 });
    }

  } catch (error) {
    console.error(`Erro ao adicionar análise ao caso ${params.caseId}:`, error);
    return NextResponse.json({ error: 'Erro interno do servidor ao adicionar análise.' }, { status: 500 });
  }
}
