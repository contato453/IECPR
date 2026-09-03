import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { searchPeopleByName, createPerson } from "@/features/core/api";
import type { Person, UUID } from "@/types/domain";
import { toast } from "sonner";

interface PersonComboboxProps {
  value: UUID | null;
  onChange: (personId: UUID | null, person: Person | null) => void;
  organizationId: UUID;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Busca de pessoas com opção "Novo cadastro".
 *
 * Bug #3 corrigido: a busca dispara a partir de 3 caracteres, o filtro
 * interno do cmdk fica desligado (`shouldFilter={false}` é o padrão do
 * <Command> daqui, que só reage à lista vinda do servidor) e a opção "Novo
 * cadastro" é sempre adicionada DEPOIS dos resultados, nunca no lugar deles.
 */
export function PersonCombobox({ value, onChange, organizationId, placeholder = "Selecionar pessoa…", disabled }: PersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["people", "search", search],
    queryFn: () => searchPeopleByName(search),
    enabled: search.trim().length >= 3,
  });

  const selectedLabel = results.find((p) => p.id === value)?.full_name;

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;
    try {
      const person = await createPerson({ organization_id: organizationId, full_name: name });
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      onChange(person.id, person);
      toast.success(`"${name}" cadastrado.`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar pessoa.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite ao menos 3 letras…" value={search} onValueChange={setSearch} />
          <CommandList>
            {search.trim().length < 3 && (
              <CommandEmpty>Digite ao menos 3 letras para buscar.</CommandEmpty>
            )}
            {search.trim().length >= 3 && !isFetching && results.length === 0 && (
              <CommandEmpty>Nenhum cadastro encontrado.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Cadastrados">
                {results.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.id}
                    onSelect={() => {
                      onChange(person.id, person);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === person.id ? "opacity-100" : "opacity-0")} />
                    {person.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {search.trim().length >= 3 && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate} className="text-accent-foreground">
                  <UserPlus className="size-4" />
                  Novo cadastro: &ldquo;{search.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
