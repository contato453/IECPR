import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudTable } from "@/components/CrudTable";
import { PersonCombobox } from "@/components/PersonCombobox";
import { EmptyState } from "@/components/DataState";
import {
  accessProfileLabelsList,
  grantAccessProfile,
  listChurches,
  listUsers,
  revokeAccessProfile,
} from "@/features/core/api";
import { createUserAccount, updateUserPassword } from "@/lib/users.functions";
import { useSession } from "@/hooks/useSession";
import { accessProfileLabels } from "@/lib/labels";
import { formatShortDateWithWeekdayAndTime } from "@/lib/date";
import type { AccessProfile, UUID } from "@/types/domain";

export function UsuariosPage() {
  const { profile, isAdmin } = useSession();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<UUID | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [personId, setPersonId] = useState<UUID | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>("ministerial_viewer");
  const [churchId, setChurchId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const { data: users, isLoading, error } = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const { data: churches = [] } = useQuery({ queryKey: ["churches"], queryFn: listChurches });

  const churchNameById = new Map(churches.map((c) => [c.id, c.short_name]));

  async function handleCreateUser() {
    if (!profile) return;
    setSubmitting(true);
    try {
      const created = await createUserAccount({
        full_name: fullName,
        email,
        password,
        person_id: personId,
      });
      if (created.id) {
        await grantAccessProfile({
          user_id: created.id,
          organization_id: profile.organization_id,
          profile: accessProfile,
          church_id: churchId === "none" ? null : churchId,
          department_id: null,
        });
      }
      toast.success("Usuário criado.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setPersonId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  const passwordMutation = useMutation({
    mutationFn: () => updateUserPassword({ user_id: passwordUserId as string, password: newPassword }),
    onSuccess: () => {
      toast.success("Senha atualizada.");
      setPasswordUserId(null);
      setNewPassword("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha."),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: UUID) => revokeAccessProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (!isAdmin) {
    return (
      <ModulePage title="Usuários e acessos">
        <EmptyState title="Acesso restrito" description="Somente o pastor administrador vê esta tela." />
      </ModulePage>
    );
  }

  return (
    <ModulePage
      title="Usuários e acessos"
      description="Contas do sistema, perfil de acesso e escopo. Independente da qualificação ministerial."
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> Adicionar usuário
        </Button>
      }
    >
      <CrudTable
        rows={users}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        rowKey={(u) => u.id}
        emptyTitle="Nenhum usuário cadastrado"
        extraActions={(u) => (
          <Button variant="ghost" size="sm" onClick={() => setPasswordUserId(u.id)}>
            <KeyRound className="size-4" /> Senha
          </Button>
        )}
        columns={[
          { header: "Nome", cell: (u) => u.full_name },
          { header: "E-mail", cell: (u) => u.email },
          {
            header: "Perfil de acesso",
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.user_access_profiles.length === 0 && <span className="text-muted-foreground">—</span>}
                {u.user_access_profiles.map((ap) => (
                  <Badge key={ap.id} variant="secondary" className="cursor-pointer" onClick={() => revokeMutation.mutate(ap.id)} title="Clique para remover">
                    {accessProfileLabels[ap.profile]}
                    {ap.church_id && ` · ${churchNameById.get(ap.church_id) ?? ""}`}
                  </Badge>
                ))}
              </div>
            ),
          },
          { header: "Último acesso", cell: (u) => (u.last_login ? formatShortDateWithWeekdayAndTime(u.last_login) : "Nunca") },
          { header: "Status", cell: (u) => (u.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>) },
        ]}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
            <DialogDescription>O nome pode ser digitado livremente ou vinculado a uma pessoa já cadastrada.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Pessoa cadastrada (opcional)</Label>
              <div className="mt-1.5">
                <PersonCombobox
                  value={personId}
                  organizationId={profile?.organization_id ?? ""}
                  onChange={(id, person) => {
                    setPersonId(id);
                    if (person) setFullName(person.full_name);
                  }}
                />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Nome completo</Label>
              <Input className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>E-mail</Label>
              <Input className="mt-1.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Senha</Label>
              <Input className="mt-1.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <div>
              <Label>Perfil de acesso</Label>
              <Select value={accessProfile} onValueChange={(v) => setAccessProfile(v as AccessProfile)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accessProfileLabelsList().map((p) => (
                    <SelectItem key={p} value={p}>
                      {accessProfileLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escopo (igreja)</Label>
              <Select value={churchId} onValueChange={setChurchId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Toda a organização</SelectItem>
                  {churches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.short_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting || !fullName || !email || password.length < 8}>
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordUserId} onOpenChange={(open) => !open && setPasswordUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir nova senha</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nova senha</Label>
            <Input className="mt-1.5" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUserId(null)}>
              Cancelar
            </Button>
            <Button onClick={() => passwordMutation.mutate()} disabled={newPassword.length < 8 || passwordMutation.isPending}>
              Salvar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
