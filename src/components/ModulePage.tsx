import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

/** Casca padrão de página de módulo: título, descrição, ações e conteúdo. */
export function ModulePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}
