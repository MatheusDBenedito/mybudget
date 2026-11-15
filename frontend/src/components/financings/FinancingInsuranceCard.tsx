"use client";

import { useState } from "react";
import { Building2, HeartPulse, Info, Receipt, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/Panel";
import { Money } from "@/components/Money";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeInsuranceSummary,
  type FinancingDashboardSummary,
} from "@/lib/financings";

interface FinancingInsuranceCardProps {
  financing: FinancingDashboardSummary["financing"];
}

interface InsuranceTooltipProps {
  label: string;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

function InsuranceTooltip({
  label,
  align = "start",
  children,
}: InsuranceTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-72 sm:w-80 rounded-xl border border-border bg-popover p-3.5 text-xs leading-relaxed text-popover-foreground shadow-xl"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function FinancingInsuranceCard({
  financing,
}: FinancingInsuranceCardProps) {
  const ins = computeInsuranceSummary(financing);

  return (
    <Panel
      title="Seguros Contratados & Encargos (MIP / DFI / TSA)"
      className="lg:col-span-2"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Detalhamento dos seguros habitacionais obrigatórios vinculados ao
          contrato {financing.bankName}
          {financing.contractNumber ? ` (${financing.contractNumber})` : ""}.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seguros no mês: <Money value={ins.currentInsuranceTotal} />
            {ins.insuranceShareOfInstallmentPct > 0 && (
              <span>({ins.insuranceShareOfInstallmentPct}% da parcela)</span>
            )}
          </span>
        </div>
      </div>

      {!ins.hasInstallments && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Nenhuma parcela importada ainda. Importe o extrato do financiamento
          para separar automaticamente MIP, DFI e TSA mês a mês.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* MIP */}
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold">MIP</h4>
                  <InsuranceTooltip
                    label="Informações sobre o seguro MIP"
                    align="start"
                  >
                    <p className="font-semibold text-foreground">
                      MIP — Morte ou Invalidez Permanente
                    </p>
                    <ul className="mt-2 space-y-1.5 text-muted-foreground">
                      <li>
                        <strong className="text-emerald-500">O que cobre:</strong>{" "}
                        Quitação integral (ou proporcional à sua cota) do saldo
                        devedor em caso de falecimento ou invalidez permanente
                        total.
                      </li>
                      <li>
                        <strong className="text-rose-500">Não cobre:</strong>{" "}
                        Desemprego, afastamento temporário (auxílio-doença) ou
                        parcelas vencidas antes do sinistro.
                      </li>
                      <li>
                        <strong className="text-foreground">Dica:</strong>{" "}
                        Calculado sobre o saldo devedor; cai conforme você
                        amortiza, mas a alíquota sobe por faixa etária.
                      </li>
                    </ul>
                  </InsuranceTooltip>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Morte ou Invalidez Permanente
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-foreground">
              <Money value={ins.currentMip} />
              <span className="text-[11px] font-normal text-muted-foreground">
                /mês
              </span>
            </span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cobertura (100% saldo)</span>
              <span className="font-medium">
                <Money value={ins.mipCoverageAmount} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Alíquota s/ saldo</span>
              <span className="font-medium">
                {ins.mipMonthlyRatePct > 0
                  ? `${ins.mipMonthlyRatePct.toFixed(4)}% a.m.`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já pago</span>
              <span className="font-medium text-emerald-500">
                <Money value={ins.mipPaid} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">A vencer (projetado)</span>
              <span className="font-medium">
                <Money value={ins.mipPending} />
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1">
              <span className="text-muted-foreground">Total no contrato</span>
              <span className="font-semibold">
                <Money value={ins.mipTotal} />
              </span>
            </div>
          </div>
        </div>

        {/* DFI */}
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold">DFI</h4>
                  <InsuranceTooltip
                    label="Informações sobre o seguro DFI"
                    align="center"
                  >
                    <p className="font-semibold text-foreground">
                      DFI — Danos Físicos ao Imóvel
                    </p>
                    <ul className="mt-2 space-y-1.5 text-muted-foreground">
                      <li>
                        <strong className="text-emerald-500">O que cobre:</strong>{" "}
                        Danos estruturais graves e súbitos até o valor do imóvel:
                        incêndio, explosão, raio, vendaval/destelhamento,
                        alagamento, inundação e desmoronamento.
                      </li>
                      <li>
                        <strong className="text-rose-500">Não cobre:</strong>{" "}
                        Manutenção do dia a dia, desgaste natural, pequenos
                        reparos hidráulicos ou elétricos e serviços de
                        assistência residencial 24h (salvo seguro residencial
                        contratado à parte).
                      </li>
                      <li>
                        <strong className="text-foreground">Como acionar:</strong>{" "}
                        Em sinistro estrutural coberto, abrir aviso diretamente
                        com o banco ou seguradora com fotos e orçamento.
                      </li>
                    </ul>
                  </InsuranceTooltip>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Danos Físicos ao Imóvel
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-foreground">
              <Money value={ins.currentDfi} />
              <span className="text-[11px] font-normal text-muted-foreground">
                /mês
              </span>
            </span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cobertura (valor imóvel)</span>
              <span className="font-medium">
                <Money value={ins.dfiCoverageAmount} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Alíquota s/ imóvel</span>
              <span className="font-medium">
                {ins.dfiMonthlyRatePct > 0
                  ? `${ins.dfiMonthlyRatePct.toFixed(4)}% a.m.`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já pago</span>
              <span className="font-medium text-emerald-500">
                <Money value={ins.dfiPaid} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">A vencer (projetado)</span>
              <span className="font-medium">
                <Money value={ins.dfiPending} />
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1">
              <span className="text-muted-foreground">Total no contrato</span>
              <span className="font-semibold">
                <Money value={ins.dfiTotal} />
              </span>
            </div>
          </div>
        </div>

        {/* Consolidado + TSA */}
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold">Consolidado & TSA</h4>
                  <InsuranceTooltip
                    label="Informações sobre TSA e encargos"
                    align="end"
                  >
                    <p className="font-semibold text-foreground">
                      TSA & Custo Efetivo dos Seguros
                    </p>
                    <ul className="mt-2 space-y-1.5 text-muted-foreground">
                      <li>
                        <strong className="text-foreground">TSA:</strong> Tarifa
                        mensal de administração do contrato cobrada pelo banco
                        (limitada a R$ 25,00/mês no SFH).
                      </li>
                      <li>
                        <strong className="text-foreground">Custo Anual:</strong>{" "}
                        Estimativa anual do peso de MIP + DFI sobre o saldo
                        devedor atual (já embutido no CET).
                      </li>
                    </ul>
                  </InsuranceTooltip>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Seguros Totais + Taxa Admin.
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-foreground">
              <Money value={ins.currentInsuranceTotal + ins.currentTsa} />
              <span className="text-[11px] font-normal text-muted-foreground">
                /mês
              </span>
            </span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seguros pagos (MIP+DFI)</span>
              <span className="font-medium text-emerald-500">
                <Money value={ins.insurancePaidTotal} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seguros a vencer</span>
              <span className="font-medium">
                <Money value={ins.insurancePendingTotal} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total seguros contrato</span>
              <span className="font-semibold">
                <Money value={ins.insuranceContractTotal} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                TSA (Taxa Admin.) mensal
              </span>
              <span className="font-medium">
                <Money value={ins.currentTsa} />
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1">
              <span className="text-muted-foreground">Custo anual est. s/ saldo</span>
              <span className="font-semibold">
                {ins.estimatedAnnualInsuranceRatePct > 0
                  ? `${ins.estimatedAnnualInsuranceRatePct.toFixed(2)}% a.a.`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
