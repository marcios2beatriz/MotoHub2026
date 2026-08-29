"use client";

import React from 'react';
import { Delivery } from '../utils/db';
import { getAdminFeeForDelivery, getRiderNetForDelivery } from '../pages/AdminDashboard';
import { Check } from 'lucide-react';

interface RiderFinancialMetricsCardProps {
  riderName: string;
  riderPhone?: string;
  deliveries: Delivery[];
  isPaid?: boolean;
  onSettle?: () => void;
  onUnsettle?: () => void;
  showSettleButton?: boolean;
  periodLabel?: string;
}

export default function RiderFinancialMetricsCard({
  riderName,
  riderPhone,
  deliveries,
  isPaid = false,
  onSettle,
  onUnsettle,
  showSettleButton = false,
  periodLabel
}: RiderFinancialMetricsCardProps) {
  const count = deliveries.length;
  const grossVal = deliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalAdditionals = deliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
  
  // Corridas de mesmo endereço (R$ 4 ou deliveryType same_address)
  const sameAddressCount = deliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00).length;
  const sameAddressTotal = deliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00).reduce((sum, d) => sum + Number(d.value || 0), 0);

  // Taxa adm R$ 1,00 apenas sobre as corridas padrão
  const adminCut = deliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const riderNet = Math.max(0, grossVal - adminCut);
  const allPaid = count > 0 && (isPaid || deliveries.every(d => d.paid));

  return (
    <div className={`p-5 rounded-3xl border-2 transition-all ${
      count > 0 
        ? allPaid 
          ? 'bg-slate-50 border-slate-200' 
          : 'bg-white border-indigo-200 shadow-md hover:border-indigo-400' 
        : 'bg-slate-50/50 border-slate-200 opacity-60'
    }`}>
      {/* Header do Card com Nome, Telefone e Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-indigo-600 text-white font-black text-base flex items-center justify-center flex-shrink-0 shadow-sm">
            {riderName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-slate-900 text-base truncate">{riderName}</h4>
            <p className="text-xs text-slate-500 font-mono">{riderPhone || 'Sem telefone'}</p>
          </div>
        </div>

        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
          count === 0 
            ? 'bg-slate-100 text-slate-500' 
            : allPaid 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-amber-100 text-amber-900 border border-amber-300'
        }`}>
          {count === 0 ? 'Sem Corridas' : allPaid ? 'PAGO' : 'A REPASSAR'}
        </span>
      </div>

      {/* Grid com as 5 Métricas Obrigatórias */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3.5 pb-2 text-center mt-2">
        
        {/* Métrica 1: Corridas */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-center">
          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">CORRIDAS</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{count}</p>
        </div>

        {/* Métrica 2: Mesmo Endereço (R$ 4) */}
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-2.5 flex flex-col justify-center">
          <p className="text-[9px] font-extrabold text-purple-900 uppercase tracking-wider">MESMO END. (R$4)</p>
          <p className="text-sm font-black text-purple-800 mt-0.5">
            {sameAddressCount} ({`R$ ${sameAddressTotal.toFixed(2)}`})
          </p>
        </div>

        {/* Métrica 3: + Adicionais */}
        <div className="bg-fuchsia-50/60 border border-fuchsia-200 rounded-2xl p-2.5 flex flex-col justify-center">
          <p className="text-[9px] font-extrabold text-fuchsia-800 uppercase tracking-wider">+ ADICIONAIS</p>
          <p className="text-sm font-black text-fuchsia-700 mt-0.5">R$ {totalAdditionals.toFixed(2)}</p>
        </div>

        {/* Métrica 4: Taxa Adm (R$ 1) */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-2.5 flex flex-col justify-center">
          <p className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider">TAXA ADM (R$1)</p>
          <p className="text-sm font-black text-amber-700 mt-0.5">R$ {adminCut.toFixed(2)}</p>
        </div>

        {/* Métrica 5: Líquido Motoboy */}
        <div className="col-span-2 sm:col-span-1 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-2.5 flex flex-col justify-center shadow-xs">
          <p className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider">LÍQUIDO MOTOBOY</p>
          <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">R$ {riderNet.toFixed(2)}</p>
        </div>

      </div>

      {/* Linha Inferior com Bruto Total e Ação de Baixa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 text-xs mt-1">
        <div className="text-slate-600 font-bold">
          <span>Bruto Total: </span>
          <strong className="text-slate-900 font-black text-sm">R$ {grossVal.toFixed(2)}</strong>
          {periodLabel && (
            <span className="text-[11px] text-slate-400 font-normal ml-1">({periodLabel})</span>
          )}
        </div>

        {showSettleButton && count > 0 && (
          <div className="flex items-center space-x-1.5 self-end sm:self-center">
            {allPaid ? (
              onUnsettle && (
                <button
                  type="button"
                  onClick={onUnsettle}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                  title="Desmarcar como pago"
                >
                  Reverter
                </button>
              )
            ) : (
              onSettle && (
                <button
                  type="button"
                  onClick={onSettle}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  <span>Dar Baixa (Pagar)</span>
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}