// src/app/admin/layout.tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold">Painel Administrativo - CyberRIC</h1>
          <Link href="/dashboard">
            <Button variant="outline" className="text-primary bg-primary-foreground hover:bg-primary-foreground/90">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao App
            </Button>
          </Link>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-6">
        {children}
      </main>
      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
        Painel Administrativo CyberRIC &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
