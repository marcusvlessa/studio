// src/app/ric-generation/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { NotebookText, Loader2, Download } from "lucide-react";
import { generateRic, type GenerateRicInput, type GenerateRicOutput } from "@/ai/flows/generate-ric-flow";

// Mock case data - in a real app, this would come from a service or state management
interface MockCase {
  id: string;
  name: string;
  description: string;
  analyses: Array<{ type: string, summary: string, sourceFileName?: string }>;
}
const mockCases: MockCase[] = [
  { id: "case1", name: "Operação Vizinhança Segura", description: "Investigação sobre furtos em série no bairro X.", analyses: [{type: "Documento", summary: "Boletim de ocorrência inicial.", sourceFileName: "BO_Furto_123.pdf"}, {type: "Imagem", summary: "Foto de suspeito capturada por câmera de segurança.", sourceFileName:"suspeito.jpg"}]},
  { id: "case2", name: "Caso Fraude Digital Alpha", description: "Apuração de esquema de phishing direcionado a clientes bancários.", analyses: [{type: "Áudio", summary: "Gravação de ligação com golpista.", sourceFileName: "ligacao_phishing.mp3"}, {type: "Documento", summary: "Relatório técnico de análise de malware.", sourceFileName: "malware_report.docx"}]},
];

export default function RicGenerationPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [generatedRic, setGeneratedRic] = useState<GenerateRicOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const selectedCaseDetails = mockCases.find(c => c.id === selectedCaseId);

  const handleGenerateRic = async () => {
    if (!selectedCaseId || !selectedCaseDetails) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, selecione um caso para gerar o RIC." });
      return;
    }

    setIsLoading(true);
    setGeneratedRic(null);

    try {
      const input: GenerateRicInput = {
        caseName: selectedCaseDetails.name,
        caseDescription: selectedCaseDetails.description,
        analyses: selectedCaseDetails.analyses,
      };
      
      const result = await generateRic(input);
      setGeneratedRic(result);
      toast({ title: "RIC Gerado", description: "O Relatório de Investigação Criminal foi gerado com sucesso." });

    } catch (error) {
      console.error("Erro ao gerar RIC:", error);
      toast({ variant: "destructive", title: "Falha na Geração do RIC", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Geração de Relatório de Investigação Criminal (RIC)</h1>
        <p className="text-muted-foreground">Selecione um caso para consolidar as informações e gerar um RIC automaticamente.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Caso</CardTitle>
          <CardDescription>Escolha um caso existente para iniciar a geração do relatório.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={setSelectedCaseId} value={selectedCaseId || undefined}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Selecione um caso..." />
            </SelectTrigger>
            <SelectContent>
              {mockCases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {mockCases.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhum caso disponível.</p>}
            </SelectContent>
          </Select>
          {selectedCaseDetails && (
            <div className="p-4 border rounded-md bg-muted/50">
                <h3 className="font-semibold">{selectedCaseDetails.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedCaseDetails.description}</p>
                <p className="text-xs mt-1">Análises no caso: {selectedCaseDetails.analyses.length}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateRic} disabled={!selectedCaseId || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookText className="mr-2 h-4 w-4" />}
            {isLoading ? "Gerando RIC..." : "Gerar RIC"}
          </Button>
        </CardFooter>
      </Card>

      {isLoading && !generatedRic && (
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Aguarde, o relatório está sendo gerado pela IA...</p>
          </CardContent>
        </Card>
      )}

      {generatedRic && (
        <Card>
          <CardHeader>
            <CardTitle>RIC Gerado</CardTitle>
            <CardDescription>Abaixo está o conteúdo do Relatório de Investigação Criminal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={generatedRic.reportContent} readOnly rows={20} className="bg-muted/50 text-sm font-mono" />
          </CardContent>
          <CardFooter>
            <Button onClick={() => alert("Funcionalidade de download ainda não implementada.")}>
                <Download className="mr-2 h-4 w-4" /> Baixar RIC (PDF)
            </Button>
          </CardFooter>
        </Card>
      )}
       <p className="text-xs text-muted-foreground text-center mt-4">Nota: A seleção de casos é baseada em dados de exemplo (mock). A integração real com a Gestão de Casos é necessária.</p>
    </div>
  );
}
