// src/app/admin/users/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold flex items-center">
        <Users className="mr-3 h-6 w-6 text-primary" />
        Gerenciamento de Usuários
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Esta seção permitirá visualizar, aprovar, e revogar acesso de usuários.
            A funcionalidade completa de gerenciamento de usuários, incluindo aprovação de solicitações e envio de credenciais, requer uma infraestrutura de backend e banco de dados que não está implementada nesta versão local.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            (Funcionalidade de listagem e gerenciamento de usuários a ser implementada)
          </p>
          <div className="mt-4 p-4 border-dashed border-2 border-muted-foreground rounded-md bg-muted/50">
            <h3 className="font-semibold">Próximos Passos (Desenvolvimento Futuro):</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Integração com um sistema de autenticação (ex: NextAuth.js com um provedor de OAuth ou banco de dados de usuários).</li>
              <li>Banco de dados para armazenar usuários, seus status (pendente, aprovado, revogado) e solicitações de acesso.</li>
              <li>Interface para o administrador visualizar solicitações pendentes.</li>
              <li>Lógica para aprovar/negar solicitações.</li>
              <li>Sistema de envio de email para notificar usuários sobre o status de suas solicitações e enviar credenciais provisórias.</li>
              <li>Funcionalidade para revogar acesso de usuários.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
