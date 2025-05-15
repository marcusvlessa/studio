// src/components/layout/app-layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { BrainCircuit, LogOut, UserCircle } from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2.5 group"> 
            <BrainCircuit className="h-9 w-9 text-primary transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_hsl(var(--accent))]" /> 
            <h1 className="text-2xl font-semibold text-primary group-data-[collapsible=icon]:hidden"> 
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
                    isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                    tooltip={{ children: item.title, className: "bg-card text-card-foreground border-border" }}
                    className={cn(
                        (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
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
                        onClick={handleLogout}
                        tooltip={{ children: "Sair", className: "bg-card text-card-foreground border-border" }}
                    >
                        <LogOut />
                        <span>Sair</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 md:justify-end">
          <SidebarTrigger className="md:hidden" />
          {isAuthenticated && user ? (
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://avatar.vercel.sh/${user.email}.png`} alt={user.name || user.email} />
                    <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.push('/login')}>Entrar</Button>
          )}
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
