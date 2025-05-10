"use client";
import { BarChart, LineChart, TrendingUp, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Bar, CartesianGrid, XAxis, YAxis, Line, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend } from "recharts";
import Image from "next/image";

const barChartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

const chartConfigBar = {
  desktop: { label: "Desktop", color: "hsl(var(--chart-1))" },
  mobile: { label: "Mobile", color: "hsl(var(--chart-2))" },
};

const lineChartData = [
  { date: "2024-01-01", incidents: 5 },
  { date: "2024-01-08", incidents: 8 },
  { date: "2024-01-15", incidents: 6 },
  { date: "2024-01-22", incidents: 10 },
  { date: "2024-01-29", incidents: 7 },
  { date: "2024-02-05", incidents: 12 },
];

const chartConfigLine = {
  incidents: { label: "Incidents", color: "hsl(var(--chart-1))" },
};

const pieChartData = [
    { name: 'Phishing', value: 400, fill: 'hsl(var(--chart-1))' },
    { name: 'Malware', value: 300, fill: 'hsl(var(--chart-2))' },
    { name: 'Ransomware', value: 300, fill: 'hsl(var(--chart-3))' },
    { name: 'DDoS', value: 200, fill: 'hsl(var(--chart-4))' },
];


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Interactive Crime Dashboard</h1>
        <p className="text-muted-foreground">Visualize cybercrime statistics and trends.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">+15% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">56</div>
            <p className="text-xs text-muted-foreground">3 new cases today</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">12</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crime Incidents by Type</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigBar} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={barChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
                <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incident Trends</CardTitle>
            <CardDescription>Weekly incident reports</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigLine} className="h-[300px] w-full">
              <LineChart
                accessibilityLayer
                data={lineChartData}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                 <ChartLegend content={<ChartLegendContent />} />
                <Line
                  dataKey="incidents"
                  type="monotone"
                  stroke="var(--color-incidents)"
                  strokeWidth={2}
                  dot={true}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Crime Distribution</CardTitle>
                <CardDescription>Breakdown of cybercrime types.</CardDescription>
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
                        <RechartsLegend />
                        <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label />
                    </RechartsPieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Geospatial Hotspots</CardTitle>
            <CardDescription>Concentration of reported incidents.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              <Image
                src="https://picsum.photos/seed/map/800/450"
                alt="Crime Hotspot Map"
                width={800}
                height={450}
                className="h-full w-full object-cover"
                data-ai-hint="world map"
              />
            </div>
             <p className="mt-2 text-sm text-muted-foreground flex items-center">
                <MapPin className="mr-1 h-4 w-4" /> Placeholder map showing incident clusters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
