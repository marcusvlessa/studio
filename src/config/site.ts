import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FileText, Mic, GitFork, ImageIcon, ShieldAlert } from "lucide-react";

export const APP_NAME = "CyberRIC";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Document Analysis",
    href: "/document-analysis",
    icon: FileText,
  },
  {
    title: "Audio Analysis",
    href: "/audio-analysis",
    icon: Mic,
  },
  {
    title: "Link Analysis",
    href: "/link-analysis",
    icon: GitFork,
  },
  {
    title: "Image Analysis",
    href: "/image-analysis",
    icon: ImageIcon,
  },
];

export const SITE_TITLE = "CyberRIC";
export const SITE_DESCRIPTION = "Cybercrime Reporting and Intelligence Center";
