import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FileText, Mic, GitFork, ImageIcon, ShieldAlert, FileSearch } from "lucide-react";

export const APP_NAME = "CyberRIC"; // Mantido como nome próprio, mas poderia ser "Central CyberRIC"

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
    icon: FileSearch, // Alterado para um ícone mais específico para análise de documentos
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
];

export const SITE_TITLE = "CyberRIC"; // Mantido
export const SITE_DESCRIPTION = "Centro de Inteligência e Denúncia de Cybercrimes";
