"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL, REMEMBERED_LOGIN_STORAGE_KEY } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REMEMBERED_LOGIN_STORAGE_KEY);
    if (!saved) return;
    Promise.resolve().then(() => {
      setEmail(saved);
      setRememberMe(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha.");
      return;
    }

    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Falha ao autenticar.");
        return;
      }

      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBERED_LOGIN_STORAGE_KEY, trimmedEmail);
        } else {
          window.localStorage.removeItem(REMEMBERED_LOGIN_STORAGE_KEY);
        }
      }

      setSession(data);
      toast.success(`Bem-vindo(a), ${data.user.name}!`);
      router.replace("/");
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar no MyFinance</CardTitle>
          <CardDescription>
            Acesse seus workspaces financeiros compartilhados com segurança.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Usuário ou e-mail</Label>
              <Input
                id="email"
                type="text"
                placeholder="seu@email.com ou usuário"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <Label htmlFor="rememberMe" className="cursor-pointer font-medium">
                Lembrar minha conta
              </Label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-5">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Entrar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Criar conta e workspace
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

