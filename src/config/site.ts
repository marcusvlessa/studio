
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FileSearch, Mic, GitFork, ImageIcon, FolderKanban, NotebookText, Landmark, Settings, UserCog, History } from "lucide-react";

export const APP_NAME = "CyberRIC"; 

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Painel de Controle",
    href: "/dashboard", // Updated from "/"
    icon: LayoutDashboard,
  },
  {
    title: "Gestão de Casos",
    href: "/case-management",
    icon: FolderKanban,
  },
  {
    title: "Análise de Documentos",
    href: "/document-analysis",
    icon: FileSearch, 
  },
  {
    title: "Análise de Áudio",
    href: "/audio-analysis",
    icon: Mic,
  },
  {
    title: "Análise de Imagens",
    href: "/image-analysis",
    icon: ImageIcon,
  },
  {
    title: "Análise de Vínculos",
    href: "/link-analysis",
    icon: GitFork,
  },
  {
    title: "Análise Financeira (RIF)",
    href: "/financial-analysis",
    icon: Landmark, 
  },
  {
    title: "Geração de RIC",
    href: "/ric-generation",
    icon: NotebookText,
  },
   {
    title: "Configurações",
    href: "/settings",
    icon: Settings,
  },
  // Admin routes (optional to include in main nav, could be separate)
  // {
  //   title: "Admin: Usuários",
  //   href: "/admin/users",
  //   icon: UserCog,
  // },
  // {
  //   title: "Admin: Logs",
  //   href: "/admin/logs",
  //   icon: History,
  // },
];

export const SITE_TITLE = "CyberRIC - Sistema de Inteligência Policial"; 
export const SITE_DESCRIPTION = "Plataforma integrada para análise de documentos, áudios, imagens, vínculos, dados financeiros e geração de Relatórios de Investigação Criminal (RIC).";
