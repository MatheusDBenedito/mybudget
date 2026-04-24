"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, AlertTriangle, Link2, ExternalLink, Key } from "lucide-react";
import { CardManager } from "@/components/CardManager";
import { AccountManager } from "@/components/AccountManager";
import { CategoryManager } from "@/components/CategoryManager";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
    const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const executeSeed = async () => {
        setIsSeeding(true);
        try {
            const res = await fetch("http://localhost:3333/seed", {
                method: "POST"
            });
            if (res.ok) {
                toast.success("Banco populado com sucesso!");
                setTimeout(() => window.location.reload(), 2000);
            } else {
                toast.error("Erro ao popular o banco de dados.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Falha de conexão com a API.");
        } finally {
            setIsSeeding(false);
            setIsSeedModalOpen(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            {/* Header */}
            <div className="flex items-center space-x-3">
                <div className="rounded-full bg-slate-100 p-3">
                    <Settings className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Configurações do Sistema</h2>
                    <p className="mt-1 text-gray-500">Gerencie suas categorias, cartões e contas.</p>
                </div>
            </div>

            {/* Tabs Layout */}
            <Tabs defaultValue="categorias" className="w-full">
                {/* The TabsList holds the three buttons: Categorias, Cartões, Contas */}
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100/50">
                    <TabsTrigger value="categorias" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Categorias</TabsTrigger>
                    <TabsTrigger value="cartoes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Cartões</TabsTrigger>
                    <TabsTrigger value="contas" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Contas</TabsTrigger>
                    <TabsTrigger value="integracoes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-emerald-700 font-semibold">🔗 Integrações</TabsTrigger>
                </TabsList>

                <TabsContent value="categorias" className="focus-visible:outline-none focus-visible:ring-0 mt-4">
                    <Card className="border-slate-200 shadow-xs">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-lg text-slate-800">📋 Categorias</CardTitle>
                            <CardDescription>
                                Configure as tags para classificar suas receitas e despesas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <CategoryManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cartoes" className="focus-visible:outline-none focus-visible:ring-0 mt-4">
                    <Card className="border-slate-200 shadow-xs">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-lg text-slate-800">💳 Cartões de Crédito</CardTitle>
                            <CardDescription>
                                Cadastre seus cartões, dias de fechamento e limites.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <CardManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contas" className="focus-visible:outline-none focus-visible:ring-0 mt-4">
                    <Card className="border-slate-200 shadow-xs">
                        <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                            <CardTitle className="text-lg text-slate-800">🏦 Contas Bancárias</CardTitle>
                            <CardDescription>
                                Supervisione suas contas correntes e saldos individuais.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <AccountManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="integracoes" className="focus-visible:outline-none focus-visible:ring-0 mt-4">
                    <Card className="border-emerald-200 shadow-xs">
                        <CardHeader className="bg-emerald-50/50 rounded-t-xl border-b border-emerald-100">
                            <CardTitle className="text-lg text-emerald-800 flex items-center gap-2">
                                <Link2 className="h-5 w-5" />
                                Integração com B3 (Brapi)
                            </CardTitle>
                            <CardDescription>
                                Configure a atualização automática de preços para seus ativos de renda variável.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-800">
                                <ExternalLink className="h-5 w-5 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-bold mb-1">Passo 1: Obter o Token</p>
                                    <p>Para atualizar os preços automaticamente, você precisa de um token gratuito do brapi.dev.</p>
                                    <a
                                        href="https://brapi.dev/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center font-semibold underline hover:text-blue-600"
                                    >
                                        Criar conta no brapi.dev <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                                    <Key className="h-5 w-5 mt-0.5 shrink-0 text-slate-600" />
                                    <div className="text-sm">
                                        <p className="font-bold mb-1 text-slate-800">Passo 2: Configurar no Sistema</p>
                                        <p className="text-slate-600">No momento, a configuração do token é feita através do arquivo <code className="bg-slate-200 px-1 rounded">.env</code> na raiz do projeto.</p>
                                        <div className="mt-3 p-3 bg-slate-900 rounded-md text-slate-200 font-mono text-[11px]">
                                            BRAPI_TOKEN="seu_token_aqui"
                                        </div>
                                        <p className="mt-3 text-slate-500 italic">Após adicionar o token, reinicie o servidor do backend para aplicar as mudanças.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Danger Zone */}
            < div className="mt-12 pt-8 border-t border-red-200" >
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-red-900 flex items-center">
                                <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
                                Área de Risco (Desenvolvimento)
                            </h3>
                            <p className="mt-1 text-sm text-red-700 max-w-xl">
                                Ferramentas destrutivas para ambiente de desenvolvimento. Ações aqui não podem ser desfeitas e causarão perda permanente de dados.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            className="mt-2 sm:mt-0 bg-red-600 hover:bg-red-700"
                            onClick={() => setIsSeedModalOpen(true)}
                        >
                            Resetar & Popular Banco (Seed)
                        </Button>
                    </div>
                </div>
            </div >

            <AlertDialog open={isSeedModalOpen} onOpenChange={setIsSeedModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Confirmação de Reset (Destrutivo)
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-700 font-medium">
                            AVISO: Isso vai deletar TODOS os dados e repopular o banco do zero. Nenhuma informação anterior será recuperável. Você tem certeza absoluta?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSeeding}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={executeSeed} disabled={isSeeding} className="bg-red-600 hover:bg-red-700 text-white">
                            {isSeeding ? "Processando..." : "Sim, Deletar Tudo"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
