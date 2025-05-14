// src/app/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, ShieldCheck, BarChart3, GitFork, Mic, FileSearch, ImageIcon, Landmark } from "lucide-react";
import Image from "next/image";
import { APP_NAME, SITE_DESCRIPTION } from "@/config/site";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/request-access">
              <Button variant="default">Solicitar Acesso</Button>
            </Link>
             {/* Placeholder for future login button
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            */}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-16 md:py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl md:text-6xl">
              {APP_NAME}: Sua Plataforma de Inteligência Policial Avançada
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {SITE_DESCRIPTION}
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/request-access">
                <Button size="lg" className="text-lg px-8 py-6">
                  Solicitar Acesso Agora
                </Button>
              </Link>
              {/* <Button variant="link" size="lg" className="text-lg">Saiba Mais &rarr;</Button> */}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-background/50">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Recursos Poderosos para sua Investigação</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O {APP_NAME} oferece um conjunto completo de ferramentas para otimizar suas análises e investigações criminais.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-2xl auto-rows-fr grid-cols-1 gap-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
              {[
                { icon: FileSearch, title: "Análise de Documentos", description: "Extraia informações cruciais, identifique entidades e classifique crimes em PDFs, DOCs e TXTs." },
                { icon: Mic, title: "Análise de Áudio", description: "Transcreva áudios, identifique interlocutores e gere relatórios investigativos detalhados." },
                { icon: ImageIcon, title: "Análise de Imagens", description: "Descreva conteúdos, detecte placas, faces (com estimativa de idade) e aprimore imagens." },
                { icon: GitFork, title: "Análise de Vínculos", description: "Visualize e explore conexões complexas entre pessoas, organizações e eventos." },
                { icon: Landmark, title: "Análise Financeira (RIF)", description: "Processe dados do COAF, identifique movimentações atípicas e gere relatórios de inteligência." },
                { icon: ShieldCheck, title: "Segurança e Privacidade", description: "Desenvolvido com foco na segurança dos seus dados e operação local." },
              ].map((feature, index) => (
                <Card key={index} className="flex flex-col justify-between rounded-2xl shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-primary mb-4" />
                    <CardTitle className="text-xl text-primary">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-16 md:py-24 text-center">
           <div className="mx-auto max-w-3xl">
            <Image src="https://picsum.photos/seed/cyberric-dashboard/1200/600" alt="CyberRIC Dashboard Preview" width={1200} height={600} className="rounded-xl shadow-2xl mb-12" data-ai-hint="dashboard interface" />
            <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Inteligência ao seu Alcance</h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              O {APP_NAME} foi projetado para ser uma ferramenta intuitiva e poderosa, capacitando agentes e analistas a desvendar informações complexas de forma eficiente e segura.
            </p>
            <div className="mt-10">
              <Link href="/request-access">
                <Button size="lg" className="text-lg px-8 py-6 bg-accent hover:bg-accent/90 text-accent-foreground">
                  Quero Começar
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-muted-foreground border-t border-border/40 bg-background/95">
         <p>
            Desenvolvido por <a href="https://www.linkedin.com/in/marcus-vinicius-lessa-34a5b126" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Marcus Vinicius Lessa</a>.
          </p>
          <p className="mt-1">
            Dúvidas e sugestões: <a href="mailto:marcusvlessa@gmail.com" className="font-medium text-primary hover:underline">marcusvlessa@gmail.com</a>
          </p>
        <p className="mt-2 text-xs">&copy; {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
