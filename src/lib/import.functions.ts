import * as XLSX from "xlsx";
import { db, unwrap } from "@/services/supabase";
import type { UUID } from "@/types/domain";

export interface ImportedMemberRow {
  full_name: string;
  phone?: string;
  email?: string;
  birth_date?: string; // "YYYY-MM-DD"
  church_short_name?: string;
  notes?: string;
}

const COLUMN_ALIASES: Record<keyof ImportedMemberRow, string[]> = {
  full_name: ["nome", "nome completo", "membro", "full_name"],
  phone: ["telefone", "celular", "phone", "whatsapp"],
  email: ["e-mail", "email"],
  birth_date: ["data de nascimento", "nascimento", "birth_date", "aniversário"],
  church_short_name: ["igreja", "congregação", "church"],
  notes: ["observações", "observacoes", "notes"],
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function excelDateToISO(value: unknown): string | undefined {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

/** Lê um arquivo .xlsx e mapeia as colunas conhecidas (ver COLUMN_ALIASES). */
export async function parseMembersSpreadsheet(file: File): Promise<ImportedMemberRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] as string];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw
    .map((row) => {
      const normalizedRow: Record<string, unknown> = {};
      for (const [header, value] of Object.entries(row)) {
        normalizedRow[normalizeHeader(header)] = value;
      }

      const result: ImportedMemberRow = { full_name: "" };
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof ImportedMemberRow, string[]][]) {
        const alias = aliases.find((a) => normalizedRow[a] !== undefined && normalizedRow[a] !== "");
        if (!alias) continue;
        const value = normalizedRow[alias];
        if (field === "birth_date") {
          const iso = excelDateToISO(value);
          if (iso) result.birth_date = iso;
        } else {
          (result as unknown as Record<string, unknown>)[field] = String(value).trim();
        }
      }
      return result;
    })
    .filter((row) => row.full_name.length > 0);
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/** Cria membros em lote a partir das linhas já mapeadas. */
export async function importMembers(organizationId: UUID, rows: ImportedMemberRow[]): Promise<ImportResult> {
  const churches = unwrap(await db.from("churches").select("id, short_name")) as { id: UUID; short_name: string }[];
  const churchByShortName = new Map(churches.map((c) => [c.short_name.toLowerCase(), c.id]));

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const churchId = row.church_short_name ? churchByShortName.get(row.church_short_name.toLowerCase()) ?? null : null;
      const { error } = await db.from("people").insert({
        organization_id: organizationId,
        church_id: churchId,
        full_name: row.full_name,
        phone: row.phone || null,
        email: row.email || null,
        birth_date: row.birth_date || null,
        notes: row.notes || null,
        situation: "ativo",
        active: true,
      });
      if (error) throw new Error(error.message);
      result.created += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push(`${row.full_name}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  return result;
}
