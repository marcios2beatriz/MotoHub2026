"use client";

import React, { useState, useEffect } from 'react';
import { Product } from '../utils/db';
import { Package, X, Save, DollarSign, Tag, Barcode, Layers, AlertCircle } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  editingProduct?: Product | null;
  onSave: (product: Product) => Promise<void>;
}

const DEFAULT_CATEGORIES = [
  'Bebidas & Refrigerantes',
  'Ingredientes & Insumos',
  'Carnes & Frios',
  'Hortifruti',
  'Laticínios',
  'Embalagens & Descartáveis',
  'Molhos & Condimentos',
  'Doces & Sobremesas',
  'Geral'
];

const COMMON_UNITS = [
  { value: 'UN', label: 'Unidade (UN)' },
  { value: 'KG', label: 'Quilograma (KG)' },
  { value: 'G', label: 'Grama (G)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ML', label: 'Mililitro (ML)' },
  { value: 'CX', label: 'Caixa (CX)' },
  { value: 'PCT', label: 'Pacote (PCT)' },
  { value: 'FD', label: 'Fardo (FD)' },
  { value: 'LT', label: 'Lata (LT)' },
  { value: 'GF', label: 'Garrafa (GF)' }
];

export default function ProductModal({
  isOpen,
  onClose,
  establishmentId,
  editingProduct,
  onSave
}: ProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Geral');
  const [customCategory, setCustomCategory] = useState('');
  const [unit, setUnit] = useState('UN');
  const [minStock, setMinStock] = useState('5');
  const [currentStock, setCurrentStock] = useState('0');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setSku(editingProduct.sku || '');
      if (DEFAULT_CATEGORIES.includes(editingProduct.category || '')) {
        setCategory(editingProduct.category || 'Geral');
        setCustomCategory('');
      } else {
        setCategory('Outra');
        setCustomCategory(editingProduct.category || '');
      }
      setUnit(editingProduct.unit || 'UN');
      setMinStock(String(editingProduct.minStock ?? 5));
      setCurrentStock(String(editingProduct.currentStock ?? 0));
      setCostPrice(editingProduct.costPrice ? String(editingProduct.costPrice) : '');
      setSalePrice(editingProduct.salePrice ? String(editingProduct.salePrice) : '');
    } else {
      setName('');
      setSku('');
      setCategory('Geral');
      setCustomCategory('');
      setUnit('UN');
      setMinStock('5');
      setCurrentStock('0');
      setCostPrice('');
      setSalePrice('');
    }
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome do produto.');
      return;
    }

    const finalCategory = category === 'Outra' ? (customCategory.trim() || 'Geral') : category;
    const parsedMin = Math.max(0, parseFloat(minStock) || 0);
    const parsedCurrent = Math.max(0, parseFloat(currentStock) || 0);
    const parsedCost = Math.max(0, parseFloat(costPrice.replace(',', '.')) || 0);
    const parsedSale = Math.max(0, parseFloat(salePrice.replace(',', '.')) || 0);

    const productData: Product = {
      id: editingProduct?.id || ('prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      establishmentId,
      name: name.trim(),
      sku: sku.trim() || undefined,
      category: finalCategory,
      unit,
      minStock: parsedMin,
      currentStock: parsedCurrent,
      costPrice: parsedCost,
      salePrice: parsedSale,
      createdAt: editingProduct?.createdAt,
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSave(productData);
      onClose();
    } catch (err) {
      alert('Erro ao salvar produto. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                {editingProduct ? 'Editar Produto do Estoque' : 'Cadastrar Novo Produto'}
              </h3>
              <p className="text-xs text-slate-500">Controle de insumos, mercadorias e embalagens</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Nome do Produto / Mercadoria *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Coca-Cola Lata 350ml, Pão Brioche, Caixa Kraft..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Barcode className="h-3.5 w-3.5 text-slate-400" />
                <span>Código / SKU (Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: BEB-001, 789123456..."
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span>Unidade de Medida</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Categoria</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DEFAULT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Outra">+ Outra Categoria</option>
              </select>
            </div>

            {category === 'Outra' && (
              <div>
                <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">
                  Nome da Nova Categoria
                </label>
                <input
                  type="text"
                  placeholder="Digite a categoria personalizada..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-indigo-600" />
              <span>Controle de Quantidades</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  {editingProduct ? 'Estoque Atual' : 'Estoque Inicial'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <span>Estoque Mínimo (Alerta)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="5"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-black text-amber-950 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              O sistema avisará visualmente quando o estoque estiver igual ou abaixo do estoque mínimo.
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <p className="text-[11px] font-black uppercase text-emerald-900 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span>Preços e Custos (Opcional)</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Preço de Custo Unitário (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">
                  Preço de Venda Unitário (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-black shadow-md flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Produto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
