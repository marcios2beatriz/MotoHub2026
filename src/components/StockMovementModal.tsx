"use client";

import React, { useState, useEffect } from 'react';
import { Product, StockMovement } from '../utils/db';
import { ArrowDownRight, ArrowUpRight, RotateCcw, X, Save, Package, DollarSign } from 'lucide-react';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  products: Product[];
  initialProductId?: string;
  initialType?: 'in' | 'out' | 'adjustment';
  userName?: string;
  onSaveMovement: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => Promise<StockMovement>;
}

const COMMON_IN_REASONS = [
  'Compra de Fornecedor / Reposição',
  'Devolução de Cliente',
  'Produção Interna',
  'Entrada por Ajuste de Inventário',
  'Outro Motivo de Entrada'
];

const COMMON_OUT_REASONS = [
  'Venda no Caixa / Salão / Delivery',
  'Consumo Interno / Cozinha',
  'Produto Vencido / Descarte',
  'Avaria / Quebra / Estragado',
  'Saída por Ajuste de Inventário',
  'Outro Motivo de Saída'
];

export default function StockMovementModal({
  isOpen,
  onClose,
  establishmentId,
  products,
  initialProductId,
  initialType = 'in',
  userName = 'Gerente',
  onSaveMovement
}: StockMovementModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialProductId && products.some(p => p.id === initialProductId)) {
      setSelectedProductId(initialProductId);
    } else if (products.length > 0) {
      setSelectedProductId(products[0].id);
    }
    setType(initialType);
    setQuantity('1');
    setReason(initialType === 'in' ? COMMON_IN_REASONS[0] : COMMON_OUT_REASONS[0]);
    setCustomReason('');
    
    const prod = products.find(p => p.id === (initialProductId || (products[0]?.id)));
    setCostPrice(prod?.costPrice ? String(prod.costPrice) : '');
  }, [initialProductId, initialType, isOpen, products]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  if (!isOpen) return null;

  const currentStock = selectedProduct ? Number(selectedProduct.currentStock || 0) : 0;
  const numQty = parseFloat(quantity) || 0;
  
  let previewStock = currentStock;
  if (type === 'in') {
    previewStock = currentStock + numQty;
  } else if (type === 'out') {
    previewStock = Math.max(0, currentStock - numQty);
  } else {
    previewStock = numQty;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Selecione um produto.');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }

    if (type === 'out' && numQty > currentStock) {
      const confirmNegative = confirm(
        `A quantidade informada (${numQty} ${selectedProduct?.unit || 'UN'}) é maior que o estoque atual (${currentStock} ${selectedProduct?.unit || 'UN'}).\n\nO estoque ficará zerado. Deseja continuar?`
      );
      if (!confirmNegative) return;
    }

    const finalReason = reason.includes('Outro') 
      ? (customReason.trim() || reason) 
      : reason;

    const parsedCost = costPrice ? parseFloat(costPrice.replace(',', '.')) : undefined;

    setIsSaving(true);
    try {
      await onSaveMovement({
        establishmentId,
        productId: selectedProductId,
        productName: selectedProduct?.name,
        type,
        quantity: numQty,
        previousStock: currentStock,
        newStock: previewStock,
        reason: finalReason,
        costPrice: parsedCost,
        createdBy: userName
      });
      onClose();
    } catch (err) {
      alert('Erro ao registrar movimentação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl text-white ${
              type === 'in' ? 'bg-emerald-600' : type === 'out' ? 'bg-red-600' : 'bg-blue-600'
            }`}>
              {type === 'in' ? <ArrowDownRight className="h-5 w-5" /> : type === 'out' ? <ArrowUpRight className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                {type === 'in' ? 'Entrada de Mercadoria' : type === 'out' ? 'Saída de Mercadoria' : 'Ajuste de Estoque'}
              </h3>
              <p className="text-xs text-slate-500">Atualização em tempo real do estoque</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* SELETOR DE TIPO DE MOVIMENTAÇÃO */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('in');
                setReason(COMMON_IN_REASONS[0]);
              }}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                type === 'in' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              <span>Entrada (+)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('out');
                setReason(COMMON_OUT_REASONS[0]);
              }}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                type === 'out' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Saída (-)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('adjustment');
                setReason('Ajuste de Inventário / Conferência');
              }}
              className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                type === 'adjustment' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Ajuste</span>
            </button>
          </div>

          {/* SELEÇÃO DO PRODUTO */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
              <Package className="h-3.5 w-3.5 text-slate-400" />
              <span>Selecione o Produto *</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find(prod => prod.id === e.target.value);
                if (p?.costPrice) setCostPrice(String(p.costPrice));
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Atual: {p.currentStock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* QUANTIDADE E PRÉVIA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                {type === 'adjustment' ? 'Novo Estoque Total' : 'Quantidade *'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-xl text-xs font-black text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs uppercase">
                  {selectedProduct?.unit || 'UN'}
                </span>
              </div>
            </div>

            {/* CARD DE PRÉVIA DO ESTOQUE */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Resultado</span>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {currentStock} → <strong className={`font-black ${
                  previewStock <= (selectedProduct?.minStock || 0) ? 'text-amber-600' : 'text-emerald-600'
                }`}>{previewStock} {selectedProduct?.unit || 'UN'}</strong>
              </p>
            </div>
          </div>

          {/* PREÇO DE CUSTO SE FOR ENTRADA */}
          {type === 'in' && (
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>Preço de Custo Unitário Desta Compra (Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="R$ 0,00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-xl text-xs font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* MOTIVO / JUSTIFICATIVA */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Motivo da Movimentação *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(type === 'in' ? COMMON_IN_REASONS : COMMON_OUT_REASONS).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {reason.includes('Outro') && (
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">
                Especifique o Motivo
              </label>
              <input
                type="text"
                required
                placeholder="Descreva o motivo da movimentação..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 border border-indigo-300 bg-indigo-50/30 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2 text-white rounded-xl font-black shadow-md flex items-center gap-1.5 ${
                type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'out' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Registrando...' : 'Confirmar Movimentação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
