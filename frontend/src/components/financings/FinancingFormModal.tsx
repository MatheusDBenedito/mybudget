"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/auth";
import {
  type AmortizationSystem,
  type FinancingIndexer,
  type FinancingRecord,
  MAJOR_BANKS,
} from "@/lib/financings";

interface FinancingFormModalProps {
  open: boolean;
  editing: FinancingRecord | null;
  onClose: () => void;
  onSaved: (savedId: string) => void;
}

export function FinancingFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: FinancingFormModalProps) {
  if (!open) return null;

  return (
    <FinancingFormDialogInner
      key={editing?.id ?? "new"}
      editing={editing}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function FinancingFormDialogInner({
  editing,
  onClose,
  onSaved,
}: {
  editing: FinancingRecord | null;
  onClose: () => void;
  onSaved: (savedId: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [bankName, setBankName] = useState<string>(editing?.bankName ?? "Bradesco");
  const [contractNumber, setContractNumber] = useState(editing?.contractNumber ?? "");
  const [propertyAddress, setPropertyAddress] = useState(editing?.propertyAddress ?? "");
  const [system, setSystem] = useState<AmortizationSystem>(editing?.system ?? "SAC");
  const [indexer, setIndexer] = useState<FinancingIndexer>(editing?.indexer ?? "TR");
  const [propertyValue, setPropertyValue] = useState(
    editing ? String(editing.propertyValue) : ""
  );
  const [downPayment, setDownPayment] = useState(
    editing ? String(editing.downPayment) : "0"
  );
  const [financedAmount, setFinancedAmount] = useState(
    editing ? String(editing.financedAmount) : ""
  );
  const [currentBalance, setCurrentBalance] = useState(
    editing ? String(editing.currentBalance) : ""
  );
  const [nominalRateAnnual, setNominalRateAnnual] = useState(
    editing ? String(editing.nominalRateAnnual) : "10.02"
  );
  const [effectiveRateAnnual, setEffectiveRateAnnual] = useState(
    editing && editing.effectiveRateAnnual !== null
      ? String(editing.effectiveRateAnnual)
      : "10.49"
  );
  const [cetAnnual, setCetAnnual] = useState(
    editing && editing.cetAnnual !== null ? String(editing.cetAnnual) : "11.12"
  );
  const [totalMonths, setTotalMonths] = useState(
    editing ? String(editing.totalMonths) : "360"
  );
  const [dueDay, setDueDay] = useState(editing ? String(editing.dueDay) : "2");
  const [contractDate, setContractDate] = useState(
    editing ? editing.contractDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [monthlyAdminFee, setMonthlyAdminFee] = useState(
    editing ? String(editing.monthlyAdminFee) : "25"
  );
  const [monthlyInsurance, setMonthlyInsurance] = useState(
    editing ? String(editing.monthlyInsurance) : "0"
  );
  const [fgtsBalance, setFgtsBalance] = useState(
    editing ? String(editing.fgtsBalance) : "0"
  );
  const [lastFgtsUsageDate, setLastFgtsUsageDate] = useState(
    editing?.lastFgtsUsageDate ? editing.lastFgtsUsageDate.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !financedAmount || !currentBalance || !propertyValue) {
      toast.error("Preencha os campos obrigatórios do financiamento.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        bankName: bankName.trim(),
        contractNumber: contractNumber.trim() || undefined,
        propertyAddress: propertyAddress.trim() || undefined,
        system,
        indexer,
        propertyValue: Number(propertyValue),
        downPayment: Number(downPayment || 0),
        financedAmount: Number(financedAmount),
        currentBalance: Number(currentBalance),
        nominalRateAnnual: Number(nominalRateAnnual || effectiveRateAnnual || 10),
        effectiveRateAnnual: effectiveRateAnnual
          ? Number(effectiveRateAnnual)
          : undefined,
        cetAnnual: cetAnnual ? Number(cetAnnual) : undefined,
        totalMonths: Number(totalMonths),
        dueDay: Number(dueDay || 21),
        contractDate,
        monthlyAdminFee: Number(monthlyAdminFee || 0),
        monthlyInsurance: Number(monthlyInsurance || 0),
        fgtsBalance: Number(fgtsBalance || 0),
        lastFgtsUsageDate: lastFgtsUsageDate || null,
        notes: notes.trim() || undefined,
      };

      const url = editing
        ? `${API_BASE_URL}/financings/${editing.id}`
        : `${API_BASE_URL}/financings`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha ao salvar financiamento");
      }

      const saved = await res.json();
      toast.success(
        editing
          ? "Financiamento atualizado com sucesso."
          : "Financiamento cadastrado com sucesso."
      );
      onSaved(saved.id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? "Editar Financiamento" : "Novo Financiamento Imobiliário"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nome / Imóvel *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Apartamento Centro"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Banco *
              </label>
              <select
                value={
                  MAJOR_BANKS.includes(bankName as (typeof MAJOR_BANKS)[number])
                    ? bankName
                    : "Outro"
                }
                onChange={(e) => {
                  if (e.target.value !== "Outro") setBankName(e.target.value);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {MAJOR_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
                <option value="Outro">Outro banco</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nº do Contrato
              </label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Ex: 9147646"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Sistema *
                </label>
                <select
                  value={system}
                  onChange={(e) => setSystem(e.target.value as AmortizationSystem)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="SAC">SAC</option>
                  <option value="PRICE">PRICE</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Indexador *
                </label>
                <select
                  value={indexer}
                  onChange={(e) => setIndexer(e.target.value as FinancingIndexer)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="TR">TR</option>
                  <option value="IPCA">IPCA</option>
                  <option value="POUPANCA">Poupança</option>
                  <option value="FIXO">Fixo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Valor do Imóvel (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={propertyValue}
                onChange={(e) => setPropertyValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Valor Financiado (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={financedAmount}
                onChange={(e) => setFinancedAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Saldo Devedor Atual (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Taxa Nominal (% a.a.) *
              </label>
              <input
                type="number"
                step="0.01"
                value={nominalRateAnnual}
                onChange={(e) => setNominalRateAnnual(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Taxa Efetiva (% a.a.)
              </label>
              <input
                type="number"
                step="0.01"
                value={effectiveRateAnnual}
                onChange={(e) => setEffectiveRateAnnual(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                CET (% a.a.)
              </label>
              <input
                type="number"
                step="0.01"
                value={cetAnnual}
                onChange={(e) => setCetAnnual(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Prazo Total (meses) *
              </label>
              <input
                type="number"
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Data do Contrato *
              </label>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Dia Vencimento
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Saldo FGTS (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={fgtsBalance}
                onChange={(e) => setFgtsBalance(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Último Uso FGTS
              </label>
              <input
                type="date"
                value={lastFgtsUsageDate}
                onChange={(e) => setLastFgtsUsageDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Criar financiamento"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
