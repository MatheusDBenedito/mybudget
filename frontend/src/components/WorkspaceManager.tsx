"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Copy, Loader2, MailPlus, Plus, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleOption {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  status: string;
  joinedAt: string;
  user: { id: string; name: string; email: string };
  role: { id: string; code: string; name: string };
}

interface WorkspaceInvite {
  id: string;
  email: string;
  token: string;
  status: string;
  expiresAt: string;
  role: { id: string; code: string; name: string };
  workspace?: { id: string; name: string };
  invitedBy?: { name: string; email: string };
}

export function WorkspaceManager() {
  const {
    user,
    workspaces,
    activeWorkspace,
    hasPermission,
    refreshSession,
    switchWorkspace,
  } = useAuth();

  const canViewMembers = hasPermission("view:membros");
  const canManageMembers = hasPermission("manage:membros");

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInvite[]>([]);
  const [pendingForMe, setPendingForMe] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rolesRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/workspaces/roles`),
        fetch(`${API_BASE_URL}/workspaces/invites/pending`),
      ]);

      if (rolesRes.ok) {
        const rolesData: RoleOption[] = await rolesRes.json();
        setRoles(rolesData);
        const editorDefault = rolesData.find((r) => r.code === "EDITOR") ?? rolesData[0];
        if (editorDefault && !inviteRoleId) {
          setInviteRoleId(editorDefault.id);
        }
      }
      if (pendingRes.ok) {
        setPendingForMe(await pendingRes.json());
      }

      if (canViewMembers && activeWorkspace) {
        const membersRes = await fetch(`${API_BASE_URL}/workspaces/current/members`);
        if (membersRes.ok) {
          setMembers(await membersRes.json());
        }
      } else {
        setMembers([]);
      }

      if (canManageMembers && activeWorkspace) {
        const invitesRes = await fetch(`${API_BASE_URL}/workspaces/current/invites`);
        if (invitesRes.ok) {
          setWorkspaceInvites(await invitesRes.json());
        }
      } else {
        setWorkspaceInvites([]);
      }
    } catch {
      toast.error("Erro ao carregar dados de workspaces.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, canManageMembers, canViewMembers, inviteRoleId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreatingWs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Não foi possível criar o workspace.");
        return;
      }
      setNewWorkspaceName("");
      toast.success(`Workspace "${data.name}" criado!`);
      await refreshSession();
      switchWorkspace(data.id);
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setCreatingWs(false);
    }
  };

  const handleSetDefault = async (workspaceId: string) => {
    const res = await fetch(`${API_BASE_URL}/workspaces/default`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (!res.ok) {
      toast.error("Falha ao definir workspace padrão.");
      return;
    }
    toast.success("Workspace padrão atualizado.");
    await refreshSession();
  };

  const handleAcceptInvite = async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/workspaces/invites/${token}/accept`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Falha ao aceitar convite.");
      return;
    }
    toast.success("Convite aceito!");
    await refreshSession();
    await loadData(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteRoleId) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`${API_BASE_URL}/workspaces/current/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), roleId: inviteRoleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Falha ao enviar convite.");
        return;
      }
      setInviteEmail("");
      toast.success(`Convite criado para ${data.email}`);
      await loadData(true);
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const res = await fetch(`${API_BASE_URL}/workspaces/current/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Não foi possível revogar o convite.");
      return;
    }
    toast.success("Convite revogado.");
    await loadData(true);
  };

  const handleChangeMemberRole = async (memberId: string, roleId: string) => {
    const res = await fetch(`${API_BASE_URL}/workspaces/current/members/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Falha ao atualizar perfil.");
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === memberId ? data : m)));
    toast.success("Perfil do membro atualizado.");
  };

  const handleRemoveMember = async (memberId: string) => {
    const res = await fetch(`${API_BASE_URL}/workspaces/current/members/${memberId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Falha ao remover membro.");
      return;
    }
    toast.success("Membro removido do workspace.");
    await loadData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando workspaces e membros...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending invites received by this user */}
      {pendingForMe.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            Convites pendentes para você ({pendingForMe.length})
          </h3>
          <div className="space-y-2">
            {pendingForMe.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {inv.workspace?.name ?? "Workspace"} — Perfil: <span className="font-semibold">{inv.role.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Convidado por {inv.invitedBy?.name ?? inv.invitedBy?.email}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleAcceptInvite(inv.token)}>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Aceitar convite
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User workspaces + create new */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" />
            Meus Workspaces
          </h3>
          <div className="space-y-2">
            {workspaces.map((ws) => {
              const isCurrent = ws.id === activeWorkspace?.id;
              const isDefault = ws.id === user?.defaultWorkspaceId;
              return (
                <div
                  key={ws.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
                    isCurrent ? "border-primary bg-primary/5" : "bg-card"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ws.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                        {ws.roleName} ({ws.roleCode})
                      </span>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3" /> Padrão
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isDefault && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetDefault(ws.id)}>
                        Definir padrão
                      </Button>
                    )}
                    {!isCurrent && (
                      <Button size="sm" variant="outline" onClick={() => switchWorkspace(ws.id)}>
                        Usar este
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleCreateWorkspace} className="space-y-3 rounded-lg border p-4 h-fit">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Criar Novo Workspace / Família
          </h3>
          <p className="text-xs text-muted-foreground">
            Workspaces isolam contas, cartões, investimentos e fluxo de caixa para que você compartilhe apenas com os membros convidados.
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-ws-name">Nome do Workspace</Label>
            <div className="flex gap-2">
              <Input
                id="new-ws-name"
                placeholder="Ex: Família, Empresa, Viagem..."
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                required
              />
              <Button type="submit" disabled={creatingWs}>
                {creatingWs ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Active workspace members & invites */}
      {activeWorkspace && canViewMembers && (
        <div className="space-y-4 border-t pt-6">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4" />
              Membros de &ldquo;{activeWorkspace.name}&rdquo;
            </h3>
            <p className="text-xs text-muted-foreground">
              Gerencie quem tem acesso aos dados deste workspace e qual perfil RBAC cada membro possui.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Membro</th>
                  <th className="px-4 py-2.5">E-mail</th>
                  <th className="px-4 py-2.5">Perfil (Role)</th>
                  {canManageMembers && <th className="px-4 py-2.5 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => {
                  const isSelf = m.userId === user?.id;
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 font-medium">
                        {m.user.name} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.user.email}</td>
                      <td className="px-4 py-2.5">
                        {canManageMembers && !isSelf ? (
                          <Select
                            value={m.role.id}
                            onValueChange={(value) => handleChangeMemberRole(m.id, value)}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`Perfil de ${m.user.name}`}
                              className="h-8 text-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4}>
                              {roles
                                .filter((r) => r.code !== "OWNER" || r.id === m.role.id)
                                .map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name} ({r.code})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                            {m.role.name} ({m.role.code})
                          </span>
                        )}
                      </td>
                      {canManageMembers && (
                        <td className="px-4 py-2.5 text-right">
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveMember(m.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManageMembers && (
            <div className="grid gap-6 lg:grid-cols-2 pt-2">
              <form onSubmit={handleSendInvite} className="space-y-3 rounded-lg border p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <MailPlus className="h-4 w-4" />
                  Convidar Pessoa para &ldquo;{activeWorkspace.name}&rdquo;
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">E-mail do convidado</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="familiar@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Perfil de acesso</Label>
                    <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                      <SelectTrigger id="invite-role" className="w-full">
                        <SelectValue placeholder="Selecione um perfil" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {roles
                          .filter((r) => r.code !== "OWNER")
                          .map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name} ({r.code})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={sendingInvite}>
                  {sendingInvite ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Gerar convite
                </Button>
              </form>

              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Convites Pendentes Enviados</h4>
                {workspaceInvites.filter((i) => i.status === "PENDING").length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum convite pendente neste workspace.</p>
                ) : (
                  <div className="space-y-2">
                    {workspaceInvites
                      .filter((i) => i.status === "PENDING")
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-medium">{inv.email}</p>
                            <p className="text-muted-foreground">Perfil: {inv.role.name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Copiar token do convite"
                              onClick={() => {
                                navigator.clipboard.writeText(inv.token);
                                toast.success("Token copiado!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleRevokeInvite(inv.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

