// src/app/settings/page.tsx
"use client";

import { useState, useEffect, type ChangeEvent, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, UploadCloud, Save, Image as ImageIcon, KeyRound, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import type { PdfHeaderConfig, ApiKeyConfig } from "@/types/settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


declare global {
  interface Window {
    electronAPI?: {
      getPdfHeaderConfig: () => Promise<PdfHeaderConfig | null>;
      setPdfHeaderConfig: (config: PdfHeaderConfig) => Promise<{ success: boolean; error?: string }>;
      getApiKey: () => Promise<string | null>;
      setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

function SettingsContent() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [headerText, setHeaderText] = useState<string>("");
  const [googleApiKey, setGoogleApiKey] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  const [electronApiAvailable, setElectronApiAvailable] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      setElectronApiAvailable(true);
    } else {
      setElectronApiAvailable(false);
       setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (electronApiAvailable) {
      const loadConfigs = async () => {
        setIsLoading(true);
        try {
          const pdfConfig = await window.electronAPI!.getPdfHeaderConfig();
          if (pdfConfig) {
            setLogoPreview(pdfConfig.logoBase64);
            setHeaderText(pdfConfig.headerText || `Relatório - ${new Date().toLocaleDateString('pt-BR')}`);
          } else {
            setHeaderText(`Relatório - ${new Date().toLocaleDateString('pt-BR')}`);
          }

          const apiKey = await window.electronAPI!.getApiKey();
          setGoogleApiKey(apiKey || "");

        } catch (error) {
          console.error("Erro ao carregar configurações:", error);
          toast({ variant: "destructive", title: "Erro ao Carregar", description: "Não foi possível carregar as configurações." });
        } finally {
          setIsLoading(false);
        }
      };
      loadConfigs();
    }
  }, [electronApiAvailable, toast]);


  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: "Por favor, selecione um arquivo de imagem." });
    }
  };

  const handleSavePdfHeader = async () => {
    if (!electronApiAvailable) {
      toast({ variant: "destructive", title: "Erro de Configuração", description: "API do Electron não está disponível." });
      return;
    }
    setIsSavingHeader(true);
    let logoBase64: string | null = logoPreview; // Keep existing if no new file
    if (logoFile) {
      logoBase64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(logoFile);
      });
    }

    try {
      const result = await window.electronAPI!.setPdfHeaderConfig({ logoBase64, headerText });
      if (result.success) {
        toast({ title: "Configuração Salva", description: "Cabeçalho do PDF atualizado com sucesso." });
      } else {
        throw new Error(result.error || "Falha ao salvar configuração do cabeçalho.");
      }
    } catch (error) {
      console.error("Erro ao salvar cabeçalho do PDF:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleSaveApiKey = async () => {
     if (!electronApiAvailable) {
      toast({ variant: "destructive", title: "Erro de Configuração", description: "API do Electron não está disponível." });
      return;
    }
    setIsSavingApiKey(true);
    try {
      const result = await window.electronAPI!.setApiKey(googleApiKey);
       if (result.success) {
        toast({ title: "Chave API Salva", description: "Chave API do Google atualizada com sucesso." });
      } else {
        throw new Error(result.error || "Falha ao salvar chave API.");
      }
    } catch (error) {
      console.error("Erro ao salvar chave API:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  if (isLoading && electronApiAvailable) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center"><Settings className="mr-3 h-8 w-8 text-primary"/>Configurações da Aplicação</h1>
        <p className="text-muted-foreground mt-1">Personalize o cabeçalho dos relatórios PDF e gerencie sua chave API do Google.</p>
      </header>

      {!electronApiAvailable && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API do Electron Não Detectada!</AlertTitle>
          <AlertDescription>
            As funcionalidades de salvamento e carregamento de configurações estão desabilitadas. 
            Verifique se o aplicativo está sendo executado corretamente no ambiente Electron.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cabeçalho dos Relatórios PDF</CardTitle>
          <CardDescription>Configure o logo e o texto que aparecerão no cabeçalho dos PDFs gerados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="logo-upload">Logo (Opcional)</Label>
            <Input id="logo-upload" type="file" accept="image/png, image/jpeg" onChange={handleLogoChange} disabled={!electronApiAvailable || isSavingHeader}/>
            <p className="text-xs text-muted-foreground">Envie uma imagem (PNG ou JPG, máx 2MB). Idealmente com fundo transparente e proporção retangular.</p>
            {logoPreview && (
              <div className="mt-2 p-2 border rounded-md inline-block bg-muted/30">
                <Image src={logoPreview} alt="Preview do Logo" width={100} height={50} className="max-h-[50px] object-contain" data-ai-hint="logotipo empresa"/>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="header-text">Texto do Cabeçalho</Label>
            <Textarea 
              id="header-text" 
              value={headerText} 
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Ex: Relatório Confidencial - Unidade de Inteligência"
              rows={2}
              disabled={!electronApiAvailable || isSavingHeader}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSavePdfHeader} disabled={!electronApiAvailable || isSavingHeader}>
            {isSavingHeader ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Configurações do Cabeçalho
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chave API do Google</CardTitle>
          <CardDescription>Insira sua chave API do Google (Gemini) para habilitar as funcionalidades de Inteligência Artificial. A chave será armazenada localmente de forma segura.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="api-key">Chave API</Label>
          <Input 
            id="api-key" 
            type="password" 
            value={googleApiKey} 
            onChange={(e) => setGoogleApiKey(e.target.value)} 
            placeholder="Cole sua chave API aqui"
            disabled={!electronApiAvailable || isSavingApiKey}
          />
           <p className="text-xs text-muted-foreground">
            Sua chave API é usada para acessar os modelos de IA do Google. Ela não é compartilhada com terceiros.
            Obtenha sua chave no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-primary">Google AI Studio</a>.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveApiKey} disabled={!electronApiAvailable || isSavingApiKey}>
            {isSavingApiKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Salvar Chave API
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando...</p></div>}>
      <SettingsContent />
    </Suspense>
  )
}
