"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tags, CreditCard, Landmark, Link2, ExternalLink, Key } from "lucide-react";
import { CardManager } from "@/components/CardManager";
import { AccountManager } from "@/components/AccountManager";
import { CategoryManager } from "@/components/CategoryManager";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";

const TABS = [
    { value: "categorias", label: "Categorias", icon: Tags },
    { value: "cartoes", label: "Cartões", icon: CreditCard },
    { value: "contas", label: "Contas", icon: Landmark },
    { value: "integracoes", label: "Integrações", icon: Link2 },
];

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader title="Configurações" description="Gerencie suas categorias, cartões, contas e integrações." />

            <Tabs defaultValue="categorias" className="gap-6">
                <div className="overflow-x-auto border-b">
                    <TabsList variant="line" className="h-11 items-stretch gap-6 p-0">
                        {TABS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-0 after:hidden data-[state=active]:border-foreground"
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="categorias" className="focus-visible:outline-none">
                    <Panel title="Categorias" icon={Tags}>
                        <p className="mb-4 text-sm text-muted-foreground">Configure as tags para classificar suas receitas e despesas.</p>
                        <CategoryManager />
                    </Panel>
                </TabsContent>

                <TabsContent value="cartoes" className="focus-visible:outline-none">
                    <Panel title="Cartões de crédito" icon={CreditCard}>
                        <p className="mb-4 text-sm text-muted-foreground">Cadastre seus cartões, dias de fechamento e limites.</p>
                        <CardManager />
                    </Panel>
                </TabsContent>

                <TabsContent value="contas" className="focus-visible:outline-none">
                    <Panel title="Contas bancárias" icon={Landmark}>
                        <p className="mb-4 text-sm text-muted-foreground">Supervisione suas contas correntes e saldos individuais.</p>
                        <AccountManager />
                    </Panel>
                </TabsContent>

                <TabsContent value="integracoes" className="focus-visible:outline-none">
                    <Panel title="Integração com B3 (brapi)" icon={Link2}>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Configure a atualização automática de preços para seus ativos de renda variável.
                        </p>
                        <ol className="space-y-4">
                            <li className="flex items-start gap-4 rounded-lg border p-4">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="text-sm">
                                    <p className="mb-1 font-medium">Passo 1: Obter o token</p>
                                    <p className="text-muted-foreground">Para atualizar os preços automaticamente, você precisa de um token gratuito do brapi.dev.</p>
                                    <a
                                        href="https://brapi.dev/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-muted-foreground"
                                    >
                                        Criar conta no brapi.dev <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                    </a>
                                </div>
                            </li>
                            <li className="flex items-start gap-4 rounded-lg border p-4">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                    <Key className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="text-sm">
                                    <p className="mb-1 font-medium">Passo 2: Configurar no sistema</p>
                                    <p className="text-muted-foreground">
                                        No momento, a configuração do token é feita através do arquivo <code className="rounded bg-muted px-1">.env</code> na raiz do projeto.
                                    </p>
                                    <div className="mt-3 rounded-md bg-header p-3 font-mono text-xs text-header-foreground">
                                        BRAPI_TOKEN=&quot;seu_token_aqui&quot;
                                    </div>
                                    <p className="mt-3 text-muted-foreground">Após adicionar o token, reinicie o servidor do backend para aplicar as mudanças.</p>
                                </div>
                            </li>
                        </ol>
                    </Panel>
                </TabsContent>
            </Tabs>
        </div>
    );
}
