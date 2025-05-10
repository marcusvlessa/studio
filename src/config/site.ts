import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FileSearch, Mic, GitFork, ImageIcon, FolderKanban, NotebookText } from "lucide-react";

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
    href: "/",
    icon: LayoutDashboard,
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
    title: "Análise de Vínculos",
    href: "/link-analysis",
    icon: GitFork,
  },
  {
    title: "Análise de Imagens",
    href: "/image-analysis",
    icon: ImageIcon,
  },
  {
    title: "Gestão de Casos",
    href: "/case-management",
    icon: FolderKanban,
  },
  {
    title: "Geração de RIC",
    href: "/ric-generation",
    icon: NotebookText,
  },
];

export const SITE_TITLE = "CyberRIC"; 
export const SITE_DESCRIPTION = "Centro de Inteligência e Denúncia de Cybercrimes";
