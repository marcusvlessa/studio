// src/app/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, FileSearch, FolderKanban, AlertTriangle, MapPin, ShieldCheck, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, LineChart, Bar, CartesianGrid, XAxis, YAxis, Line, Cell, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import type { Case, CaseAnalysis, AggregatedCrimeTag } from "@/types/case";
import type { ClassifyTextForCrimesOutput } from "@/ai/flows/classify-text-for-crimes-flow";

// Dynamically import the GoogleCaseMap component
const GoogleCaseMap = dynamic(() => import("@/components/dashboard/GoogleCaseMap"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-muted rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando mapa...</p></div>,
});

export interface GoogleMapMarkerData {
  position: { lat: number; lng: number };
  popupContent: string;
  id: string;
}

type ChartConfig = Record<string, { label: string; color: string }>;

const statusColors: Record<Case["status"], string> = {
  "Aberto": "hsl(var(--chart-1))",
  "Em Investigação": "hsl(var(--chart-2))",
  "Resolvido": "hsl(var(--chart-3))",
  "Fechado": "hsl(var(--chart-4))",
};

const crimeColors: string[] = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--accent))",
];


export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const fetchCases = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/cases');
        if (!response.ok) throw new Error('Falha ao buscar casos para o painel.');
        const data: Case[] = await response.json();
        setCases(data);
      } catch (error) {
        console.error("Erro ao carregar dados do painel:", error);
        toast({ variant: "destructive", title: "Erro ao Carregar Painel", description: error instanceof Error ? error.message : String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCases();
  }, [toast]);

  const totalCases = cases.length;
  const casesEmInvestigacao = cases.filter(c => c.status === "Em Investigação").length;
  const casesAbertos = cases.filter(c => c.status === "Aberto").length;

  const casesByStatusChartData = useMemo(() => {
    const statusCounts: Record<Case["status"], number> = {
      "Aberto": 0,
      "Em Investigação": 0,
      "Resolvido": 0,
      "Fechado": 0,
    };
    cases.forEach(c => {
      statusCounts[c.status]++;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status as Case["status"],
      count,
      fill: statusColors[status as Case["status"]],
    }));
  }, [cases]);

  const chartConfigBarStatus: ChartConfig = useMemo(() => 
    Object.keys(statusColors).reduce((acc, statusKey) => {
      acc[statusKey] = { label: statusKey, color: statusColors[statusKey as Case["status"]] };
      return acc;
    }, {} as ChartConfig)
  , []);


  const casesOverTimeChartData = useMemo(() => {
    const countsByMonth: { [key: string]: number } = {};
    cases.forEach(c => {
      const date = new Date(c.dateCreated);
      const monthYear = `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear().toString().slice(-2)}`;
      countsByMonth[monthYear] = (countsByMonth[monthYear] || 0) + 1;
    });
    
    const sortedMonths = Object.keys(countsByMonth).sort((a, b) => {
        const [monthA, yearA] = a.split('/');
        const [monthB, yearB] = b.split('/');
        const dateA = new Date(parseInt(`20${yearA}`), new Date(Date.parse(monthA +" 1, 2012")).getMonth());
        const dateB = new Date(parseInt(`20${yearB}`), new Date(Date.parse(monthB +" 1, 2012")).getMonth());
        return dateA.getTime() - dateB.getTime();
    });

    return sortedMonths.map(monthYear => ({
      month: monthYear,
      novosCasos: countsByMonth[monthYear],
    }));
  }, [cases]);

  const chartConfigLine: ChartConfig = {
    novosCasos: { label: "Novos Casos", color: "hsl(var(--chart-1))" },
  };
  
  const aggregatedCrimeData: AggregatedCrimeTag[] = useMemo(() => {
    const crimeCounts: Record<string, number> = {};
    cases.forEach(c => {
      c.relatedAnalyses.forEach(analysis => {
        if (analysis.type === "Documento" && analysis.data && 'crimeAnalysisResults' in analysis.data) {
            const docAnalysisData = analysis.data as { crimeAnalysisResults?: ClassifyTextForCrimesOutput };
            if (docAnalysisData.crimeAnalysisResults?.crimeTags && docAnalysisData.crimeAnalysisResults.crimeTags.length > 0) {
            docAnalysisData.crimeAnalysisResults.crimeTags.forEach(tag => {
                if (tag.crimeType && tag.crimeType !== 'Atividade Suspeita Não Especificada' && tag.crimeType !== 'Atividade Suspeita Relevante') {
                crimeCounts[tag.crimeType] = (crimeCounts[tag.crimeType] || 0) + 1;
                }
            });
            }
        }
      });
    });

    const sortedCrimeData = Object.entries(crimeCounts)
      .sort(([, countA], [, countB]) => countB - countA) 
      .slice(0, 10); 

    return sortedCrimeData.map(([name, value], index) => ({
      name, 
      crimeType: name, 
      count: value,
      fill: crimeColors[index % crimeColors.length],
    }));
  }, [cases]);

   const chartConfigCrimeTypes: ChartConfig = useMemo(() => 
    aggregatedCrimeData.reduce((acc, crime) => {
      acc[crime.name] = { label: crime.crimeType, color: crime.fill };
      return acc;
    }, {} as ChartConfig)
  , [aggregatedCrimeData]);

  const mapMarkers: GoogleMapMarkerData[] = useMemo(() => {
    if (!cases || cases.length === 0) return [];
    
    const parseHexSafe = (str: string): number => {
      const parsed = parseInt(str, 16);
      return isNaN(parsed) ? Math.floor(Math.random() * 256) : parsed; // Use random if not hex
    };

    return cases.map((caseItem, index) => {
      // Generate pseudo-random but deterministic coordinates
      // Use a combination of index and parts of the ID for more variation
      // Ensure substrings are valid or provide defaults
      const idPart1Str = caseItem.id.length >= 2 ? caseItem.id.substring(0, 2) : "00";
      const idPart2Str = caseItem.id.length >= 4 ? caseItem.id.substring(2, 4) : "00";

      const idNum1 = parseHexSafe(idPart1Str);
      const idNum2 = parseHexSafe(idPart2Str);

      // Base coordinates (Brasilia, adjust as needed for desired region)
      const baseLat = -15.7801;
      const baseLng = -47.9292;

      // Create offsets - ensure these are not NaN
      // Maximize spread within a reasonable area (e.g., +/- 5 degrees)
      const latOffset = ((index * 13) % 100 / 100 - 0.5) * 10 + (idNum1 / 255 - 0.5) * 2; 
      const lngOffset = ((index * 29) % 100 / 100 - 0.5) * 10 + (idNum2 / 255 - 0.5) * 2;
      
      let lat = baseLat + latOffset;
      let lng = baseLng + lngOffset;

      // Clamp coordinates to valid ranges
      lat = Math.max(-90, Math.min(90, lat));
      lng = Math.max(-180, Math.min(180, lng));
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn(`Generated invalid coordinates for case ${caseItem.id}: lat=${lat}, lng=${lng}. Defaulting to base.`);
        lat = baseLat + (Math.random() - 0.5) * 0.1; // Small random offset from base
        lng = baseLng + (Math.random() - 0.5) * 0.1;
      }

      return {
        id: caseItem.id,
        position: { lat, lng },
        popupContent: `<b>Caso:</b> ${caseItem.name}<br/><b>Status:</b> ${caseItem.status}<br/><b>Descrição:</b> ${caseItem.description.substring(0,50)}...`,
      };
    });
  }, [cases]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground text-lg">Carregando estatísticas do painel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Painel Interativo de Casos</h1>
        <p className="text-muted-foreground">Visualize estatísticas e tendências dos casos investigativos.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Casos Registrados</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases}</div>
            <p className="text-xs text-muted-foreground">Número total de casos no sistema.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos em Investigação</CardTitle>
            <FileSearch className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{casesEmInvestigacao}</div>
            <p className="text-xs text-muted-foreground">Casos atualmente sob investigação ativa.</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Abertos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{casesAbertos}</div>
            <p className="text-xs text-muted-foreground">Casos aguardando início da investigação.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Casos por Status</CardTitle>
            <CardDescription>Visão geral dos status dos casos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigBarStatus} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart accessibilityLayer data={casesByStatusChartData} layout="vertical" margin={{ right: 20}}>
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="status"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    width={120}
                  />
                  <XAxis dataKey="count" type="number" hide/>
                  <ChartTooltip 
                      cursor={false} 
                      content={<ChartTooltipContent 
                          formatter={(value) => `${value} casos`}
                          labelFormatter={(label) => `Status: ${label}`} 
                      />} 
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="count" radius={5} barSize={25}>
                      {casesByStatusChartData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} name={entry.status} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendência de Criação de Casos</CardTitle>
            <CardDescription>Novos casos registrados por mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigLine} className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  accessibilityLayer
                  data={casesOverTimeChartData}
                  margin={{ left: 12, right: 12, top: 5, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis dataKey="novosCasos" allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    dataKey="novosCasos"
                    type="monotone"
                    stroke="var(--color-novosCasos)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--color-novosCasos)" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/> Tipos de Crimes Identificados (Top 10)</CardTitle>
                <CardDescription>Distribuição dos principais tipos de crimes identificados nas análises de documentos.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              {aggregatedCrimeData.length > 0 ? (
                <ChartContainer config={chartConfigCrimeTypes} className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedCrimeData} layout="vertical" margin={{ right: 20}}>
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="crimeType" type="category" tickLine={false} axisLine={false} tickMargin={10} width={150} interval={0}/>
                      <XAxis dataKey="count" type="number" hide />
                      <ChartTooltip 
                        cursor={false} 
                        content={<ChartTooltipContent formatter={(value) => `${value} ocorrências`} />} 
                      />
                       <ChartLegend content={<ChartLegendContent />} />
                       <Bar dataKey="count" radius={5} barSize={20}>
                        {aggregatedCrimeData.map((entry) => (
                          <Cell key={`cell-${entry.crimeType}`} fill={entry.fill} name={entry.crimeType}/>
                        ))}
                      </Bar>
                    </BarChart>
                   </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum dado de crime classificado para exibir.</p>
                  <p className="text-xs text-muted-foreground">Realize análises de documentos para popular este gráfico.</p>
                </div>
              )}
            </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Pontos Críticos Geoespaciais (Casos)</CardTitle>
            <CardDescription>Distribuição geográfica dos casos (localizações simuladas).</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] p-0">
             {cases.length > 0 && googleMapsApiKey ? (
                <GoogleCaseMap markers={mapMarkers} apiKey={googleMapsApiKey} />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-center bg-muted rounded-lg">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">{!googleMapsApiKey ? "Chave API do Google Maps não configurada." : "Nenhum caso para exibir no mapa."}</p>
                    <p className="text-xs text-muted-foreground">{!googleMapsApiKey ? "Adicione a chave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY em .env.local para ver o mapa." : "Cadastre casos para visualizá-los aqui."}</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
       <p className="text-xs text-muted-foreground text-center mt-4">Nota: Os dados são simulados e armazenados em memória. Funcionalidades de IA dependem da chave API configurada.</p>
    </div>
  );
}

