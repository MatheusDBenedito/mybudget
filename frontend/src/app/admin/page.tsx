"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Layers, Loader2, Plus, Save, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
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

interface AdminPermission {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
}

interface AdminRole {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  membersCount?: number;
  permissions: AdminPermission[];
}

interface AdminPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  allowedModules: string[];
  isDefault: boolean;
  _count?: { users: number };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  planId: string | null;
  plan?: { id: string; code: string; name: string } | null;
}

interface Overview {
  stats: {
    usersCount: number;
    workspacesCount: number;
    rolesCount: number;
    permissionsCount: number;
  };
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    createdBy?: { id: string; name: string; email: string };
    _count?: { members: number; accounts: number; transactions: number };
  }>;
}

export default function SuperAdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedPlanModules, setSelectedPlanModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [permModule, setPermModule] = useState("");
  const [permAction, setPermAction] = useState("");
  const [permDesc, setPermDesc] = useState("");

  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ovRes, permRes, roleRes, plansRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/overview`),
        fetch(`${API_BASE_URL}/admin/permissions`),
        fetch(`${API_BASE_URL}/admin/roles`),
        fetch(`${API_BASE_URL}/admin/plans`),
        fetch(`${API_BASE_URL}/admin/users`),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (permRes.ok) setPermissions(await permRes.json());
      if (roleRes.ok) {
        const loadedRoles: AdminRole[] = await roleRes.json();
        setRoles(loadedRoles);
        const targetId = selectedRoleId || loadedRoles[0]?.id || "";
        setSelectedRoleId(targetId);
        const found = loadedRoles.find((r) => r.id === targetId);
        if (found) {
          setSelectedPermissionIds(new Set(found.permissions.map((p) => p.id)));
        }
      }
      if (plansRes.ok) {
        const loadedPlans: AdminPlan[] = await plansRes.json();
        setPlans(loadedPlans);
        const targetPlanId = selectedPlanId || loadedPlans[0]?.id || "";
        setSelectedPlanId(targetPlanId);
        const foundPlan = loadedPlans.find((p) => p.id === targetPlanId);
        if (foundPlan) {
          setSelectedPlanModules(new Set(foundPlan.allowedModules));
        }
      }
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
    } catch {
      toast.error("Erro ao carregar catálogo RBAC.");
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, selectedRoleId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const allModules = useMemo(
    () => Array.from(new Set(permissions.map((p) => p.module))).sort(),
    [permissions],
  );

  const handleSelectRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roles.find((r) => r.id === roleId);
    setSelectedPermissionIds(new Set(role ? role.permissions.map((p) => p.id) : []));
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    setSelectedPlanModules(new Set(plan ? plan.allowedModules : []));
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const togglePlanModule = (mod: string) => {
    setSelectedPlanModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/roles/${selectedRole.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: Array.from(selectedPermissionIds) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Falha ao atualizar permissões do perfil.");
        return;
      }
      toast.success(`Permissões do perfil "${selectedRole.name}" salvas!`);
      await loadAll(true);
    } finally {
      setSavingRole(false);
    }
  };

  const handleSavePlanModules = async () => {
    if (!selectedPlan) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/plans/${selectedPlan.id}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedModules: Array.from(selectedPlanModules) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Falha ao atualizar módulos do plano.");
        return;
      }
      toast.success(`Módulos do plano "${selectedPlan.name}" salvos!`);
      await loadAll(true);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleChangeUserPlan = async (userId: string, planId: string) => {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Falha ao alterar plano do usuário.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, planId: data.planId, plan: data.plan } : u)));
    toast.success(`Plano de ${data.name} atualizado para "${data.plan?.name}".`);
  };

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permModule.trim() || !permAction.trim()) return;
    const code = `${permAction.trim().toLowerCase()}:${permModule.trim().toLowerCase()}`;
    const res = await fetch(`${API_BASE_URL}/admin/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        module: permModule.trim().toLowerCase(),
        action: permAction.trim().toLowerCase(),
        description: permDesc.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Erro ao criar permissão.");
      return;
    }
    setPermModule("");
    setPermAction("");
    setPermDesc("");
    toast.success(`Permissão "${data.code}" criada!`);
    await loadAll(true);
  };

  const handleDeletePermission = async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/admin/permissions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível remover a permissão.");
      return;
    }
    toast.success("Permissão removida.");
    await loadAll(true);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleCode.trim() || !roleName.trim()) return;
    const res = await fetch(`${API_BASE_URL}/admin/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: roleCode.trim().toUpperCase(),
        name: roleName.trim(),
        description: roleDesc.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Erro ao criar perfil.");
      return;
    }
    setRoleCode("");
    setRoleName("");
    setRoleDesc("");
    toast.success(`Perfil "${data.name}" criado!`);
    await loadAll(true);
  };

  const permissionsByModule = useMemo(() => {
    const map = new Map<string, AdminPermission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração Global (Super Admin)"
        description="Gerencie planos contratados, módulos liberados por usuário, permissões granulares (módulo:ação) e perfis RBAC."
      />

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Usuários na Plataforma</p>
            <p className="mt-1 text-2xl font-bold">{overview.stats.usersCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Workspaces Ativos</p>
            <p className="mt-1 text-2xl font-bold">{overview.stats.workspacesCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Perfis RBAC (Roles)</p>
            <p className="mt-1 text-2xl font-bold">{overview.stats.rolesCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Permissões Granulares</p>
            <p className="mt-1 text-2xl font-bold">{overview.stats.permissionsCount}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando configurações globais...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Plans & User Subscriptions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Planos & Módulos Liberados" icon={Layers}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={p.id === selectedPlanId ? "default" : "outline"}
                      onClick={() => handleSelectPlan(p.id)}
                    >
                      {p.name} ({p.code})
                    </Button>
                  ))}
                </div>
                {selectedPlan && (
                  <Button size="sm" onClick={handleSavePlanModules} disabled={savingPlan}>
                    {savingPlan ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Salvar módulos
                  </Button>
                )}
              </div>

              {selectedPlan && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {selectedPlan.description || `Módulos habilitados no plano ${selectedPlan.name}.`} Mesmo sendo OWNER, o usuário só acessa os módulos marcados no seu plano.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {allModules.map((mod) => (
                      <label
                        key={mod}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlanModules.has(mod)}
                          onChange={() => togglePlanModule(mod)}
                          className="rounded border-input"
                        />
                        <span>{mod}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Usuários & Planos Ativos" icon={Users}>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Usuário</th>
                      <th className="px-3 py-2">Plano</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium leading-tight">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          {u.isSuperAdmin ? (
                            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              Super Admin (Ilimitado)
                            </span>
                          ) : (
                            <Select
                              value={u.planId ?? ""}
                              onValueChange={(planId) => handleChangeUserPlan(u.id, planId)}
                            >
                              <SelectTrigger size="sm" className="h-8 w-[180px] text-xs">
                                <SelectValue placeholder="Selecione um plano" />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4}>
                                {plans.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Role selector + Permission Matrix */}
            <div className="lg:col-span-2 space-y-6">
              <Panel title="Matriz de Permissões por Perfil (RBAC)" icon={Shield}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r) => (
                      <Button
                        key={r.id}
                        size="sm"
                        variant={r.id === selectedRoleId ? "default" : "outline"}
                        onClick={() => handleSelectRole(r.id)}
                      >
                        {r.name} ({r.code})
                      </Button>
                    ))}
                  </div>

                  {selectedRole && (
                    <Button size="sm" onClick={handleSaveRolePermissions} disabled={savingRole}>
                      {savingRole ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Salvar permissões
                    </Button>
                  )}
                </div>

                {selectedRole && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      {selectedRole.description || `Configurando permissões do perfil ${selectedRole.code}`}
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {permissionsByModule.map(([mod, perms]) => (
                        <div key={mod} className="rounded-lg border p-3 space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Módulo: {mod}
                          </h4>
                          <div className="space-y-1.5">
                            {perms.map((p) => {
                              const checked = selectedPermissionIds.has(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50 cursor-pointer"
                                >
                                  <span className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePermission(p.id)}
                                      className="rounded border-input"
                                    />
                                    <span className="font-mono font-medium">{p.code}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      void handleDeletePermission(p.id);
                                    }}
                                    className="text-muted-foreground hover:text-destructive"
                                    title="Remover permissão"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            {/* Right: Create new Role & Permission */}
            <div className="space-y-6">
              <Panel title="Novo Perfil (Role)" icon={Plus}>
                <form onSubmit={handleCreateRole} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="role-code">Código</Label>
                    <Input
                      id="role-code"
                      placeholder="Ex: AUDITOR"
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-name">Nome de exibição</Label>
                    <Input
                      id="role-name"
                      placeholder="Ex: Auditor"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-desc">Descrição</Label>
                    <Input
                      id="role-desc"
                      placeholder="Opcional"
                      value={roleDesc}
                      onChange={(e) => setRoleDesc(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Criar Perfil
                  </Button>
                </form>
              </Panel>

              <Panel title="Nova Permissão Granular" icon={KeyRound}>
                <form onSubmit={handleCreatePermission} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="perm-action">Ação</Label>
                      <Input
                        id="perm-action"
                        placeholder="view / create / edit"
                        value={permAction}
                        onChange={(e) => setPermAction(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="perm-module">Módulo</Label>
                      <Input
                        id="perm-module"
                        placeholder="resumo / despesa"
                        value={permModule}
                        onChange={(e) => setPermModule(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-desc">Descrição</Label>
                    <Input
                      id="perm-desc"
                      placeholder="Opcional"
                      value={permDesc}
                      onChange={(e) => setPermDesc(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Adicionar Permissão
                  </Button>
                </form>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
