// src/app/request-access/page.tsx
"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Send, BrainCircuit, ArrowLeft, Loader2, LogIn } from "lucide-react"; // Added LogIn
import { APP_NAME } from "@/config/site";

const requestAccessSchema = z.object({
  name: z.string().min(3, { message: "Nome completo é obrigatório (mínimo 3 caracteres)." }),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: "CPF inválido. Use o formato XXX.XXX.XXX-XX." }),
  workEmail: z.string().email({ message: "Email funcional inválido." }),
  phone: z.string().min(10, { message: "Telefone inválido. Inclua o DDD." }),
  whatsapp: z.string().min(10, { message: "WhatsApp inválido. Inclua o DDD." }).optional().or(z.literal('')),
  role: z.string().min(2, { message: "Função é obrigatória." }),
  department: z.string().min(2, { message: "Lotação é obrigatória." }),
});

type RequestAccessFormValues = z.infer<typeof requestAccessSchema>;

export default function RequestAccessPage() {
  const { toast } = useToast();
  const form = useForm<RequestAccessFormValues>({
    resolver: zodResolver(requestAccessSchema),
    defaultValues: {
      name: "",
      cpf: "",
      workEmail: "",
      phone: "",
      whatsapp: "",
      role: "",
      department: "",
    },
  });

  const onSubmit: SubmitHandler<RequestAccessFormValues> = (data) => {
    const mailtoSubject = `Solicitação de Acesso ao ${APP_NAME} - ${data.name}`;
    const mailtoBody = `
Nova Solicitação de Acesso ao ${APP_NAME}:

Nome Completo: ${data.name}
CPF: ${data.cpf}
Email Funcional: ${data.workEmail}
Telefone: ${data.phone}
WhatsApp: ${data.whatsapp || "Não informado"}
Função: ${data.role}
Lotação: ${data.department}

---
Solicitação gerada automaticamente pelo sistema ${APP_NAME}.
    `;
    const mailtoLink = `mailto:marcusvlessa@gmail.com?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody.trim())}`;

    window.location.href = mailtoLink;

    toast({
      title: "Solicitação Preparada",
      description: "Seu cliente de email deve abrir para enviar a solicitação. Por favor, envie o email gerado.",
      duration: 10000,
    });
    // form.reset(); 
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrainCircuit className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Solicitar Acesso ao {APP_NAME}</CardTitle>
          <CardDescription>
            Preencha o formulário abaixo para solicitar acesso à plataforma. Sua solicitação será enviada para análise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input placeholder="XXX.XXX.XXX-XX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="workEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Funcional</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu.email@instituicao.gov.br" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone (com DDD)</FormLabel>
                      <FormControl>
                        <Input placeholder="(XX) XXXXX-XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp (com DDD, opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(XX) XXXXX-XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função/Cargo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Agente de Polícia, Analista de Inteligência" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lotação/Unidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: DEIC, DHPP - 1ª Delegacia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full text-lg py-6" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-5 w-5" />
                )}
                Enviar Solicitação
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-center">
           <Link href="/login" className="mt-2">
             <Button variant="outline" className="text-sm ">
                <LogIn className="mr-2 h-4 w-4" /> Já tenho uma conta / Fazer Login
             </Button>
           </Link>
           <Link href="/" className="mt-4">
             <Button variant="link" className="text-sm text-muted-foreground">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para a página inicial
             </Button>
           </Link>
          <p className="text-xs text-muted-foreground mt-6">
            Ao enviar, sua solicitação será encaminhada para o administrador do sistema.
            Você será contatado por email caso seu acesso seja aprovado.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
