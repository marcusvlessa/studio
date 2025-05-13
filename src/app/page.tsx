// src/app/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, FileSearch, FolderKanban, AlertTriangle, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, LineChart, Bar, CartesianGrid, XAxis, YAxis, Line, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend, Cell } from "recharts";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import type { Case } from "@/types/case";
import { Loader2 } from "lucide-react";

type ChartConfig = Record<string, { label: string; color: string }>;

const statusColors: Record<Case["status"], string> = {
  "Aberto": "hsl(var(--chart-1))",
  "Em Investigação": "hsl(var(--chart-2))",
  "Resolvido": "hsl(var(--chart-3))",
  "Fechado": "hsl(var(--chart-4))",
};

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

  const chartConfigBar: ChartConfig = useMemo(() => 
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
        const dateA = new Date(`01 ${monthA} 20${yearA}`);
        const dateB = new Date(`01 ${monthB} 20${yearB}`);
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
  
  const pieChartData = casesByStatusChartData.map(item => ({
    name: item.status,
    value: item.count,
    fill: item.fill,
  }));


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
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases}</div>
            <p className="text-xs text-muted-foreground">Número total de casos no sistema.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos em Investigação</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{casesEmInvestigacao}</div>
            <p className="text-xs text-muted-foreground">Casos atualmente sob investigação ativa.</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Abertos</CardTitle>
            <FolderKanban className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{casesAbertos}</div>
            <p className="text-xs text-muted-foreground">Casos aguardando início da investigação.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Casos por Status</CardTitle>
            <CardDescription>Visão geral dos status dos casos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigBar} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={casesByStatusChartData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="status"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <XAxis dataKey="count" type="number" hide/>
                <ChartTooltip 
                    cursor={false} 
                    content={<ChartTooltipContent 
                        formatter={(value, name) => `${value} casos`}
                        labelFormatter={(label) => `Status: ${label}`} 
                    />} 
                />
                <ChartLegend content={<ChartLegendContent />} />
                {Object.keys(statusColors).map((statusKey) => (
                    <Bar key={statusKey} dataKey="count" name={statusKey} fill={`var(--color-${statusKey})`} radius={4} 
                        barSize={30}
                    >
                         {casesByStatusChartData.map((entry, index) => (
                            entry.status === statusKey && <Cell key={`cell-${index}`} fill={entry.fill} />
                         ))}
                    </Bar>
                ))}
              </BarChart>
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
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Proporção de Casos por Status</CardTitle>
                <CardDescription>Percentual de casos em cada status.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <RechartsTooltip 
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))', 
                                borderColor: 'hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                            }}
                        />
                        <RechartsLegend verticalAlign="bottom" height={36}/>
                        <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                return (
                                <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px">
                                    {`${(percent * 100).toFixed(0)}%`}
                                </text>
                                );
                            }}
                        >
                             {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                    </RechartsPieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Pontos Críticos Geoespaciais</CardTitle>
            <CardDescription>Concentração de incidentes (Exemplo).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              <Image
                src="https://picsum.photos/seed/mapa_pontos_criticos/800/450"
                alt="Mapa de Pontos Críticos de Crimes"
                width={800}
                height={450}
                className="h-full w-full object-cover"
                data-ai-hint="mapa cidade"
              />
            </div>
             <p className="mt-2 text-sm text-muted-foreground flex items-center">
                <MapPin className="mr-1 h-4 w-4" /> Mapa de exemplo mostrando agrupamentos de incidentes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
