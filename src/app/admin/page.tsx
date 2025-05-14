// src/app/admin/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ScrollText } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Painel de Administração</h1>
        <p className="text-muted-foreground">
          Bem-vindo à área administrativa do CyberRIC.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Gerenciamento de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Visualize e gerencie as solicitações de acesso e os usuários da plataforma.
            </p>
            <Link href="/admin/users">
              <Button variant="outline">Acessar Gerenciamento de Usuários</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ScrollText className="mr-2 h-5 w-5" />
              Logs de Acesso e Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Monitore os logs de acesso e as principais atividades realizadas no sistema.
            </p>
            <Link href="/admin/logs">
              <Button variant="outline">Visualizar Logs</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8 p-4 border-dashed border-2 border-destructive/50 rounded-md bg-destructive/5">
        <h3 className="font-semibold text-destructive">Aviso Importante:</h3>
        <p className="text-sm text-destructive/90 mt-1">
          As funcionalidades de gerenciamento de usuários e logging são conceituais nesta versão local e não possuem persistência de dados ou envio real de emails. Uma infraestrutura de backend completa seria necessária para habilitar essas funcionalidades em um ambiente de produção.
        </p>
      </div>
    </div>
  );
}
