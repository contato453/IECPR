import { useEffect } from "react";
import { useForm, Controller, type FieldValues, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FieldType = "text" | "textarea" | "select" | "checkbox" | "date" | "time" | "number" | "email" | "tel";

export interface RecordFieldOption {
  value: string;
  label: string;
}

export interface RecordField<TValues extends FieldValues> {
  name: keyof TValues & string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: RecordFieldOption[] | (() => RecordFieldOption[]);
  description?: string;
  colSpan?: 1 | 2;
}

interface RecordDialogProps<TValues extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: ZodType<TValues>;
  fields: RecordField<TValues>[];
  defaultValues: DefaultValues<TValues>;
  onSubmit: (values: TValues) => Promise<unknown> | void;
  submitLabel?: string;
}

/** Diálogo genérico de criar/editar registro, dirigido por um schema de campos. */
export function RecordDialog<TValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = "Salvar",
}: RecordDialogProps<TValues>) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  async function handleSubmit(values: TValues) {
    await onSubmit(values);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="grid grid-cols-2 gap-4">
          {fields.map((field) => {
            const error = form.formState.errors[field.name]?.message as string | undefined;
            const span = field.colSpan === 1 ? "col-span-1" : "col-span-2";
            const options = typeof field.options === "function" ? field.options() : field.options ?? [];

            return (
              <div key={field.name} className={span}>
                {field.type !== "checkbox" && <Label htmlFor={field.name}>{field.label}</Label>}
                <div className="mt-1.5">
                  <Controller
                    name={field.name as never}
                    control={form.control}
                    render={({ field: rhf }) => {
                      switch (field.type) {
                        case "textarea":
                          return (
                            <Textarea id={field.name} placeholder={field.placeholder} {...rhf} value={(rhf.value as string) ?? ""} />
                          );
                        case "checkbox":
                          return (
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox checked={!!rhf.value} onCheckedChange={rhf.onChange} />
                              {field.label}
                            </label>
                          );
                        case "select":
                          return (
                            <Select value={(rhf.value as string) ?? ""} onValueChange={rhf.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder ?? "Selecione"} />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        default:
                          return (
                            <Input
                              id={field.name}
                              type={field.type}
                              placeholder={field.placeholder}
                              {...rhf}
                              value={(rhf.value as string | number) ?? ""}
                            />
                          );
                      }
                    }}
                  />
                </div>
                {field.description && <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>}
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </div>
            );
          })}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
