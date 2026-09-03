import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataState";

export interface CrudColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface CrudTableProps<T> {
  rows: T[] | undefined;
  columns: CrudColumn<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  extraActions?: (row: T) => ReactNode;
}

/** Tabela genérica com colunas configuráveis e ações — usada por todos os CRUDs. */
export function CrudTable<T>({
  rows,
  columns,
  rowKey,
  isLoading,
  error,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  onEdit,
  onDelete,
  extraActions,
}: CrudTableProps<T>) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const hasActions = !!onEdit || !!onDelete || !!extraActions;

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.header} className={col.className}>
                {col.header}
              </TableHead>
            ))}
            {hasActions && <TableHead className="text-right iecpr-no-print">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.header} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell className="iecpr-no-print">
                  <div className="flex justify-end gap-1">
                    {extraActions?.(row)}
                    {onEdit && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(row)} title="Editar">
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(row)} title="Excluir">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
