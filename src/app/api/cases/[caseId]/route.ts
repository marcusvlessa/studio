
import { NextResponse, type NextRequest } from 'next/server';
import { casesDB, findCaseById, updateCaseInDB, deleteCaseFromDB } from '../db';
import type { Case } from '@/types/case';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  const caseDetails = findCaseById(params.caseId);
  if (caseDetails) {
    return NextResponse.json(caseDetails);
  }
  return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { name, description, status, relatedAnalyses } = await request.json();
    const existingCase = findCaseById(params.caseId);

    if (!existingCase) {
      return NextResponse.json({ error: 'Caso não encontrado para atualização.' }, { status: 404 });
    }

    const updatedCaseData: Case = {
      ...existingCase,
      name: name ?? existingCase.name,
      description: description ?? existingCase.description,
      status: status ?? existingCase.status,
      lastModified: new Date().toISOString(),
      relatedAnalyses: relatedAnalyses ?? existingCase.relatedAnalyses,
    };
    
    const result = updateCaseInDB(updatedCaseData);
    if (result) {
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Falha ao atualizar o caso.' }, { status: 500 });

  } catch (error) {
    console.error(`Erro ao atualizar caso ${params.caseId}:`, error);
    return NextResponse.json({ error: 'Erro interno do servidor ao atualizar caso.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  const deleted = deleteCaseFromDB(params.caseId);
  if (deleted) {
    return NextResponse.json({ message: 'Caso excluído com sucesso.' });
  }
  return NextResponse.json({ error: 'Caso não encontrado para exclusão.' }, { status: 404 });
}
