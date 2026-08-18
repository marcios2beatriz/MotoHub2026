"use client";

import React, { useState, useEffect } from 'react';
import { X, Link2, Plus, DollarSign, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { User, Establishment, Delivery, db } from '../utils/db';

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDelivery: Delivery | null;
  riders: User[];
  establishments: Establishment[];
  deliveryForm: {
    riderId: string;
    establishmentId: string;
    date: string;
    time: string;
    value: string;
    orderNumber: string;
    notes: string;
    deliveryType?: 'standard' | 'same_address';
    additionalValue?: string;
    additionalReason?: string;
    linkedOrderNumber?: string;
  };
  setDeliveryForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: (e: React.FormEvent) => void;
}

export default function DeliveryModal({
  isOpen,
  onClose,
  editingDelivery,
  riders,
  establishments,
  deliveryForm,
  setDeliveryForm,
  onSave
}: DeliveryModalProps) {
  if (!isOpen) return null;

  const activeRiders = riders.filter(r => r.active);
  const activeEsts = establishments.filter(e => e.active);

  // Pedidos existentes no mesmo dia para facilitar a vinculação
  const availableDeliveries = db.getAvailableDeliveriesForLinking(
    deliveryForm.date,
    deliveryForm.time,
    deliveryForm.riderId
  ).filter(d => (!editingDelivery || d.id !== editingDelivery.id) && d.orderNumber);

  const isSameAddress = deliveryForm.deliveryType === 'same_address';

  const handleSelectDeliveryType = (type: 'standard' | 'same_address') => {
    const baseVal = type === 'same_address' ? '4.00' : '8.00';
    setDeliveryForm({
      ...deliveryForm,
      deliveryType: type,
      value: baseVal
    });
  };

  const calculatedBase = parseFloat(deliveryForm.value || '0') || 0;
  const calculatedAdd = parseFloat(deliveryForm.additionalValue || '0') || 0;
  const totalDisplay = (calculatedBase + calculatedAdd).toFixed(2);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                {editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}
              </h3>
              <p className="text-xs text-slate-500">Defina valor base, adicionais com motivo e vinculação</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-3.5">
          
          {/* TIPO DE CORRIDA: PADRÃO VS MESMO ENDEREÇO */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Tipo de Entrega
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDeliveryType('standard')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center transition-all ${
                  !isSameAddress
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Padrão</span>
                <span className="text-[10px] font-bold mt-0.5 opacity-90">R$ 8,00</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDeliveryType('same_address')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center transition-all ${
                  isSameAddress
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Mesmo Endereço</span>
                </div>
                <span className="text-[10px] font-bold mt-0.5 opacity-90">R$ 4,00</span>
              </button>
            </div>
          </div>

          {/* SELEÇÃO DO VÍNCULO AO PEDIDO PRINCIPAL (QUANDO MESMO ENDEREÇO) */}
          {isSameAddress && (
            <div className="bg-purple-50/80 border border-purple-200 p-3 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-purple-900 font-extrabold">
                <span className="flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5 text-purple-700" />
                  <span>Vincular ao Pedido Principal:</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded-full font-bold">
                  Mesmo Local
                </span>
              </div>

              {availableDeliveries.length > 0 ? (
                <div>
                  <select
                    value={deliveryForm.linkedOrderNumber || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, linkedOrderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Selecione o pedido do mesmo endereço...</option>
                    {availableDeliveries.map(d => (
                      <option key={d.id} value={d.orderNumber}>
                        Pedido #{d.orderNumber} ({d.time} - R$ {Number(d.value).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite o Nº do Pedido Principal (Ex: 1042)"
                    value={deliveryForm.linkedOrderNumber || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, linkedOrderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
              <p className="text-[10px] text-purple-700 font-medium">
                Esta entrega é compartilhada no mesmo prédio/rua de outro pedido já despachado.
              </p>
            </div>
          )}

          {/* MOTOBOY E ESTABELECIMENTO */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Motoboy</label>
              <select
                required
                value={deliveryForm.riderId}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {activeRiders.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Estabelecimento</label>
              <select
                required
                value={deliveryForm.establishmentId}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {activeEsts.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DATA E HORA */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                required
                value={deliveryForm.date}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horário</label>
              <input
                type="time"
                required
                value={deliveryForm.time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Nº DO PEDIDO */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nº do Pedido</label>
            <input
              type="text"
              placeholder="Ex: 1042"
              value={deliveryForm.orderNumber}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* VALOR DA CORRIDA E VALOR ADICIONAL COM MOTIVO */}
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                  Valor Base (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="8.00"
                  value={deliveryForm.value}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>+ Adicional (R$)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.00"
                  placeholder="0.00"
                  value={deliveryForm.additionalValue || ''}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, additionalValue: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-black text-amber-900 bg-amber-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* JUSTIFICATIVA DO ADICIONAL */}
            <div>
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-amber-600" />
                <span>Justificativa do Adicional (Por que está cobrando extra?)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Distância / Bairro dos Cuités, Chuva, Taxa extra..."
                value={deliveryForm.additionalReason || ''}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, additionalReason: e.target.value })}
                className="w-full px-3 py-2 border border-amber-300/80 rounded-xl text-xs font-semibold text-amber-950 bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-amber-900/40"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">Total Final da Corrida:</span>
              <span className="text-base font-black text-emerald-600">R$ {totalDisplay}</span>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Observações Gerais (Opcional)</label>
            <textarea
              placeholder="Ex: Apartamento 302, bloco C, troco para 50..."
              value={deliveryForm.notes}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none resize-none"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md"
            >
              Salvar Corrida
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}