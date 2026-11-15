"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileUp, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/auth";
import { Money } from "@/components/Money";

interface PreviewResponse {
  detectedFormat: string;
  contract: {
    bankName?: string;
    contractNumber?: string;
    contractDate?: string;
    releaseDate?: string;
    propertyValue?: number;
    financedAmount?: number;
    currentBalance?: number;
    totalMonths?: number;
    paidMonths?: number;
    amortizationSystem?: string;
    indexer?: string;
    nominalAnnualRate?: number;
    effectiveAnnualRate?: number;
    cetAnnualRate?: number;
  };
  installments: Array<{
    installmentNumber: number | null;
    code: string;
    dueDate: string;
    totalAmount: number;
    principalAmount: number;
    interestAmount: number;
    endingBalance: number;
    status: string;
  }>;
  extraAmortizations: Array<{
    date: string;
    totalAmount: number;
    fgtsAmount: number;
    monthsReduced: number | null;
    source: string;
  }>;
  warnings: string[];
}

interface FinancingImportModalProps {
  open: boolean;
  targetFinancingId?: string;
  onClose: () => void;
  onImported: (financingId: string) => void;
}

export function FinancingImportModal({
  open,
  targetFinancingId,
  onClose,
  onImported,
}: FinancingImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  if (!open) return null;

  const handlePreview = async () => {
    if (!file) {
      toast.error("Selecione um arquivo PDF ou CSV do financiamento.");
      return;
    }
    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const query = password ? `?password=${encodeURIComponent(password)}` : "";
      const res = await fetch(`${API_BASE_URL}/financings/import/preview${query}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha ao processar extrato");
      }
      const data: PreviewResponse = await res.json();
      setPreview(data);
      if (!name && data.contract?.bankName) {
        setName(`Financiamento ${data.contract.bankName}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler arquivo");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || preview.installments.length === 0) {
      toast.error("Nenhuma parcela disponível para importar.");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch(`${API_BASE_URL}/financings/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financingId: targetFinancingId,
          name: name.trim() || undefined,
          contract: preview.contract,
          installments: preview.installments,
          extraAmortizations: preview.extraAmortizations,
          replaceExistingInstallments: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha ao confirmar importação");
      }
      const result = await res.json();
      toast.success(
        `${result.importedInstallments} parcela(s) importada(s) com sucesso!`
      );
      setPreview(null);
      setFile(null);
      onImported(result.financingId);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setConfirming(false);
    }
  };

  const paidCount =
    preview?.installments.filter((i) => i.status === "PAID").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Importar Extrato do Financiamento
            </h2>
            <p className="text-xs text-muted-foreground">
              Compatível com PDF do Bradesco (Extrato Financeiro), Caixa, Itaú,
              Santander, Banco do Brasil e CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Arquivo (PDF ou CSV)
              </label>
              <input
                type="file"
                accept=".pdf,.csv,.txt"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Senha do PDF (se houver)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Opcional (ex: primeiros dígitos do CPF)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {!targetFinancingId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nome do Financiamento (para novo cadastro)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Apartamento Bradesco"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!file || loadingPreview}
            className="gap-2"
          >
            <FileUp className="h-4 w-4" />
            {loadingPreview ? "Analisando documento..." : "Analisar Extrato"}
          </Button>

          {preview && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Formato detectado: {preview.detectedFormat}
                </div>
                <span className="text-xs text-muted-foreground">
                  {preview.installments.length} linhas ({paidCount} pagas) •{" "}
                  {preview.extraAmortizations.length} amortização(ões) extra(s)
                </span>
              </div>

              {preview.warnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{preview.warnings.join(" ")}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Banco:</span>{" "}
                  <strong>{preview.contract.bankName ?? "—"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Contrato:</span>{" "}
                  <strong>{preview.contract.contractNumber ?? "—"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Sistema:</span>{" "}
                  <strong>
                    {preview.contract.amortizationSystem ?? "SAC"} /{" "}
                    {preview.contract.indexer ?? "TR"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Saldo Devedor:</span>{" "}
                  <strong>
                    {preview.contract.currentBalance !== undefined ? (
                      <Money value={preview.contract.currentBalance} />
                    ) : (
                      "—"
                    )}
                  </strong>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">Nº</th>
                      <th className="px-2 py-1.5">Vencimento</th>
                      <th className="px-2 py-1.5">Amortização</th>
                      <th className="px-2 py-1.5">Juros</th>
                      <th className="px-2 py-1.5">Total</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.installments.slice(0, 12).map((inst, idx) => (
                      <tr key={`${inst.code}-${idx}`} className="border-t border-border/50">
                        <td className="px-2 py-1">{inst.code}</td>
                        <td className="px-2 py-1">{inst.dueDate}</td>
                        <td className="px-2 py-1">
                          <Money value={inst.principalAmount} />
                        </td>
                        <td className="px-2 py-1">
                          <Money value={inst.interestAmount} />
                        </td>
                        <td className="px-2 py-1">
                          <Money value={inst.totalAmount} />
                        </td>
                        <td className="px-2 py-1">{inst.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!preview || preview.installments.length === 0 || confirming}
            >
              {confirming ? "Importando..." : "Confirmar Importação"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
