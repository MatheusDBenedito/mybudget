"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

export function GoogleSignInButton() {
  const router = useRouter();
  const { setSession } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    const handleCredential = async (response: { credential?: string }) => {
      if (!response.credential) {
        toast.error("Não foi possível obter a credencial do Google.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message || "Falha ao autenticar com Google.");
          return;
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

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 360,
        locale: "pt-BR",
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton);
      return () => existingScript.removeEventListener("load", renderGoogleButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);
  }, [router, setSession]);

  return (
    <div className="w-full space-y-3">
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t" />
        <span className="mx-3 shrink-0 text-xs uppercase text-muted-foreground">ou</span>
        <div className="flex-grow border-t" />
      </div>

      {GOOGLE_CLIENT_ID ? (
        <div
          ref={containerRef}
          className={`flex min-h-10 w-full items-center justify-center ${submitting ? "pointer-events-none opacity-60" : ""}`}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() =>
            toast.info(
              "Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_ID no .env para ativar o login com Google.",
            )
          }
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          Continuar com Google
        </Button>
      )}
    </div>
  );
}

