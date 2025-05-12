
import { NextResponse, type NextRequest } from 'next/server';
import { casesDB, addCaseToDB } from './db';
import type { Case } from '@/types/case';

export async function GET() {
  // In a real application, you would fetch this from a database
  return NextResponse.json(casesDB);
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, status } = await request.json();

    if (!name || !description || !status) {
      return NextResponse.json({ error: 'Nome, descrição e status são obrigatórios.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newCase: Case = {
      id: crypto.randomUUID(),
      name,
      description,
      dateCreated: now,
      lastModified: now,
      status,
      relatedAnalyses: [],
    };

    addCaseToDB(newCase);
    // In a real application, you would save this to a database
    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar caso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor ao criar caso.' }, { status: 500 });
  }
}
