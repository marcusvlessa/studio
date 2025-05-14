// src/components/layout/app-layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME, NAV_ITEMS } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BrainCircuit, LogOut } from "lucide-react"; // Changed icon here

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2.5"> {/* Increased gap slightly */}
            <BrainCircuit className="h-9 w-9 text-primary" /> {/* Changed icon here */}
            <h1 className="text-2xl font-semibold text-primary group-data-[collapsible=icon]:hidden"> {/* Made text larger */}
              {APP_NAME}
            </h1>
          </Link>
        </SidebarHeader>
        <SidebarContent className="flex-1 p-2">
          <ScrollArea className="h-full">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={{ children: item.title, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                        pathname === item.href && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-2">
            <SidebarMenu>
                <SidebarMenuItem>
                     <SidebarMenuButton 
                        asChild 
                        tooltip={{ children: "Sair", className: "bg-card text-card-foreground border-border" }}
                    >
                        <Link href="#"> 
                            <LogOut />
                            <span>Sair</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 md:justify-end">
          <SidebarTrigger className="md:hidden" />
          <Button variant="outline" size="sm">Perfil do Usuário</Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
        <footer className="border-t bg-background/80 p-4 text-center text-xs text-muted-foreground">
          <p>
            Desenvolvido por <a href="https://www.linkedin.com/in/marcus-vinicius-lessa-34a5b126" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Marcus Vinicius Lessa</a>.
          </p>
          <p className="mt-1">
            Dúvidas e sugestões: <a href="mailto:marcusvlessa@gmail.com" className="font-medium text-primary hover:underline">marcusvlessa@gmail.com</a>
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

