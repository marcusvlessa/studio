"use client";

import { useState, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GitFork, Search, Users, RotateCcw, Loader2, FileUp, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function LinkAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [relationships, setRelationships] = useState<FindEntityRelationshipsOutput['relationships'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Allowing CSV, and potentially other text-based or simple structured files in future.
      // For now, primary focus is CSV. ANX/ANB parsing is complex and out of scope for this update.
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSelectedFile(file);
        setRelationships(null);
        toast({ title: "Arquivo Selecionado", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, envie um arquivo CSV. Outros formatos como XLS, ANX, ANB não são suportados atualmente." });
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  // Basic CSV parsing: assumes entities are in the first column, or all columns if only one row.
  // This can be made more robust based on expected CSV structures.
  const parseCsvEntities = (csvText: string): string[] => {
    const entities = new Set<string>();
    const rows = csvText.split(/\r?\n/).map(row => row.split(',').map(cell => cell.trim())).filter(row => row.join('').trim() !== "");

    if (rows.length === 0) return [];

    // Heuristic: if multiple rows, assume first column. If one row, assume all cells.
    if (rows.length > 1) {
        rows.forEach(row => {
            if (row[0]) entities.add(row[0]);
        });
    } else if (rows.length === 1) {
        rows[0].forEach(cell => {
            if (cell) entities.add(cell);
        });
    }
    
    return Array.from(entities).filter(e => e.length > 0);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Nenhum Arquivo Fornecido", description: "Por favor, envie um arquivo CSV com as entidades." });
      return;
    }

    setIsLoading(true);
    setRelationships(null);

    try {
      const fileText = await selectedFile.text();
      const entities = parseCsvEntities(fileText);

      if (entities.length === 0) {
        toast({ variant: "destructive", title: "Nenhuma Entidade Encontrada", description: "O arquivo CSV não contém entidades válidas ou está mal formatado." });
        setIsLoading(false);
        return;
      }
      
      const input: FindEntityRelationshipsInput = { entities };
      const result = await findEntityRelationships(input);
      setRelationships(result.relationships);
      if (result.relationships && result.relationships.length > 0) {
        toast({ title: "Análise de Vínculos Concluída", description: "Foram encontrados vínculos potenciais entre as entidades." });
      } else {
        toast({ title: "Análise de Vínculos Concluída", description: "Nenhum vínculo direto foi encontrado para as entidades fornecidas." });
      }
    } catch (error) {
      console.error("Erro na análise de vínculos:", error);
      toast({ variant: "destructive", title: "Falha na Análise", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao processar o arquivo ou analisar os vínculos." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRelationships(null);
    setIsLoading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    toast({ title: "Reiniciado", description: "Arquivo e resultados da análise de vínculos foram limpos." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Análise de Vínculos</h1>
        <p className="text-muted-foreground">Envie um arquivo CSV com entidades para identificar e visualizar seus relacionamentos.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Arquivo de Entidades (CSV)</CardTitle>
          <CardDescription>
            Forneça um arquivo CSV contendo as entidades (ex: pessoas, organizações, locais) para analisar suas conexões.
            O sistema tentará extrair entidades da primeira coluna ou de todas as colunas se houver apenas uma linha.
            Formatos como XLS, ANX, ANB não são suportados no momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="entities-file-upload">Arquivo CSV</Label>
            <Input id="entities-file-upload" type="file" accept=".csv,text/csv" onChange={handleFileChange} ref={fileInputRef} />
          </div>
           {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileText className="mr-2 h-4 w-4" /> 
                Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analisando..." : "Encontrar Vínculos"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardFooter>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Procurando por conexões...</p>
          </CardContent>
        </Card>
      )}

      {relationships && relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vínculos Identificados</CardTitle>
            <CardDescription>Abaixo estão as conexões potenciais encontradas entre as entidades do arquivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
              <div className="space-y-4">
                {relationships.map((rel, index) => (
                  <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 pt-4">
                        <div className="flex items-center justify-around gap-2 flex-wrap">
                            <div className="text-center">
                                <Badge variant="secondary" className="py-1 px-2 text-sm mb-1">{rel.entity1}</Badge>
                                {rel.entity1Type && <p className="text-xs text-muted-foreground">({rel.entity1Type})</p>}
                            </div>
                            <GitFork className="h-6 w-6 text-primary shrink-0 mx-2" />
                             <div className="text-center">
                                <Badge variant="secondary" className="py-1 px-2 text-sm mb-1">{rel.entity2}</Badge>
                                {rel.entity2Type && <p className="text-xs text-muted-foreground">({rel.entity2Type})</p>}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="mt-1 text-sm text-muted-foreground text-center italic">
                        "{rel.relationship}"
                      </p>
                      {rel.strength !== undefined && (
                        <div className="mt-2 text-center">
                            <Label htmlFor={`strength-${index}`} className="text-xs text-muted-foreground mr-2">Força:</Label>
                            <Progress id={`strength-${index}`} value={rel.strength * 100} className="h-2 w-24 inline-block" />
                            <span className="text-xs text-muted-foreground ml-1">({(rel.strength*100).toFixed(0)}%)</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      {relationships && relationships.length === 0 && !isLoading && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Nenhum vínculo direto encontrado para as entidades fornecidas no arquivo CSV.</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Verifique se o arquivo está formatado corretamente e contém dados válidos.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
