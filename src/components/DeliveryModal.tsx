"use client";

import React, { useState } from 'react';
import { X, Link2, Plus, DollarSign, Sparkles, AlertCircle, HelpCircle, Loader2, CreditCard, Banknote, QrCode, CheckCircle2 } from 'lucide-react';
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
    paymentMethod?: 'already_paid' | 'money' | 'card_debit' | 'card_credit' | 'pix_delivery';
    orderCollectionAmount?: string;
    changeFor?: string;
  };
  setDeliveryForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
}

export default function DeliveryModal({
  isOpen,
  onClose,
  editingDelivery,
  riders,
  establishments,
  deliveryForm,
  setDeliveryForm,
  onSave,
  isSubmitting = false
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
  const paymentMethod = deliveryForm.paymentMethod || 'already_paid';
  const isPaymentOnDelivery = paymentMethod !== 'already_paid';

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

  const collectionAmountNum = parseFloat(deliveryForm.orderCollectionAmount || '0') || 0;
  const changeForNum = parseFloat(deliveryForm.changeFor || '0') || 0;
  const changeToReturn = changeForNum > collectionAmountNum ? (changeForNum - collectionAmountNum).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto border border-slate-200">
        
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
              <p className="text-xs text-slate-500">Defina valor base, tipo de entrega e cobrança ao cliente</p>
            </div>
          </div>
          <button 
            type="button"
            disabled={isSubmitting}
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          
          {/* TIPO DE CORRIDA: PADRÃO VS MESMO ENDEREÇO */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Tipo de Entrega
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    value={deliveryForm.linkedOrderNumber || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, linkedOrderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
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
                    disabled={isSubmitting}
                    placeholder="Digite o Nº do Pedido Principal (Ex: 1042)"
                    value={deliveryForm.linkedOrderNumber || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, linkedOrderNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs bg-white font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          )}

          {/* NOVO BLOCO: PAGAMENTO DO PEDIDO NO ATO DA ENTREGA */}
          <div className="bg-amber-50/50 border border-amber-300/80 p-3.5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-amber-600" />
                <span>Forma de Pagamento do Pedido</span>
              </label>
              {isPaymentOnDelivery && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500 text-slate-950 rounded-full animate-pulse">
                  Cobrar na Entrega
                </span>
              )}
            </div>

            {/* Grid de Seleção da Forma de Pagamento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setDeliveryForm({ ...deliveryForm, paymentMethod: 'already_paid', orderCollectionAmount: '', changeFor: '' })}
                className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                  paymentMethod === 'already_paid'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="h-4 w-4 mb-0.5 text-emerald-400" />
                <span className="text-[11px]">Já Pago</span>
                <span className="text-[9px] opacity-70">(Online)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryForm({ ...deliveryForm, paymentMethod: 'money' })}
                className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                  paymentMethod === 'money'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Banknote className="h-4 w-4 mb-0.5" />
                <span className="text-[11px]">Dinheiro</span>
                <span className="text-[9px] opacity-80">(Com Troco)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryForm({ ...deliveryForm, paymentMethod: 'card_debit', changeFor: '' })}
                className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                  paymentMethod === 'card_debit'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="h-4 w-4 mb-0.5" />
                <span className="text-[11px]">Débito</span>
                <span className="text-[9px] opacity-80">(Maquininha)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryForm({ ...deliveryForm, paymentMethod: 'card_credit', changeFor: '' })}
                className={`p-2 rounded-xl border font-bold flex flex-col items-center justify-center transition-all ${
                  paymentMethod === 'card_credit'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="h-4 w-4 mb-0.5" />
                <span className="text-[11px]">Crédito</span>
                <span className="text-[9px] opacity-80">(Maquininha)</span>
              </button>
            </div>

            {/* Campos quando for pagamento na entrega */}
            {isPaymentOnDelivery && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-amber-950 uppercase mb-1">
                      Valor do Pedido a Cobrar do Cliente (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required={isPaymentOnDelivery}
                      placeholder="Ex: 45.90"
                      value={deliveryForm.orderCollectionAmount || ''}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, orderCollectionAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-black text-amber-950 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {paymentMethod === 'money' ? (
                    <div>
                      <label className="block text-[10px] font-black text-emerald-950 uppercase mb-1">
                        Troco para quanto? (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 50.00 ou 100.00"
                        value={deliveryForm.changeFor || ''}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, changeFor: e.target.value })}
                        className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-blue-900 font-bold">
                      <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>Motoboy deve levar a maquininha de cartão</span>
                    </div>
                  )}
                </div>

                {paymentMethod === 'money' && changeForNum > 0 && (
                  <div className="bg-emerald-100/80 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-900 font-bold">
                    <span>Troco a devolver ao cliente:</span>
                    <span className="text-sm font-black text-emerald-800">R$ {changeToReturn}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MOTOBOY E ESTABELECIMENTO */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Motoboy</label>
              <select
                required
                disabled={isSubmitting}
                value={deliveryForm.riderId}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
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
                disabled={isSubmitting}
                value={deliveryForm.establishmentId}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
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
                disabled={isSubmitting}
                value={deliveryForm.date}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Horário</label>
              <input
                type="time"
                required
                disabled={isSubmitting}
                value={deliveryForm.time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Nº DO PEDIDO */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nº do Pedido</label>
            <input
              type="text"
              disabled={isSubmitting}
              placeholder="Ex: 1042"
              value={deliveryForm.orderNumber}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* VALOR DA CORRIDA E VALOR ADICIONAL COM MOTIVO */}
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                  Taxa do Motoboy Base (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  disabled={isSubmitting}
                  placeholder="8.00"
                  value={deliveryForm.value}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
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
                  disabled={isSubmitting}
                  placeholder="0.00"
                  value={deliveryForm.additionalValue || ''}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, additionalValue: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-black text-amber-900 bg-amber-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* JUSTIFICATIVA DO ADICIONAL */}
            <div>
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-amber-600" />
                <span>Justificativa do Adicional</span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="Ex: Distância / Bairro dos Cuités, Chuva, Taxa extra..."
                value={deliveryForm.additionalReason || ''}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, additionalReason: e.target.value })}
                className="w-full px-3 py-2 border border-amber-300/80 rounded-xl text-xs font-semibold text-amber-950 bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-amber-900/40 disabled:opacity-50"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">Total Final da Corrida do Motoboy:</span>
              <span className="text-base font-black text-emerald-600">R$ {totalDisplay}</span>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Observações Gerais (Opcional)</label>
            <textarea
              disabled={isSubmitting}
              placeholder="Ex: Apartamento 302, bloco C, troco para 50..."
              value={deliveryForm.notes}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none resize-none disabled:opacity-50"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Corrida</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}