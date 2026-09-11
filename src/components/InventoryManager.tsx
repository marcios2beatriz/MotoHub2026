"use client";

import React, { useState } from 'react';
import { Product, StockMovement, db } from '../utils/db';
import { 
  Package, 
  Plus, 
  ArrowDownRight, 
  ArrowUpRight, 
  RotateCcw, 
  Search, 
  Filter, 
  AlertTriangle, 
  Tag, 
  Barcode, 
  Layers, 
  DollarSign, 
  Edit2, 
  Trash2, 
  History, 
  Boxes, 
  CheckCircle, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Download,
  Clock,
  Sparkles
} from 'lucide-react';
import ProductModal from './ProductModal';
import StockMovementModal from './StockMovementModal';

interface InventoryManagerProps {
  establishmentId: string;
  establishmentName: string;
  userName?: string;
}

export default function InventoryManager({
  establishmentId,
  establishmentName,
  userName = 'Gerente'
}: InventoryManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'movements'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'normal'>('all');

  // Modais
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementProductId, setMovementProductId] = useState<string | undefined>(undefined);
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');

  const [selectedProductForHistory, setSelectedProductForHistory] = useState<string | null>(null);

  const products = db.getProducts(establishmentId);
  const movements = db.getStockMovements(establishmentId, selectedProductForHistory || undefined);

  // Categorias únicas existentes nos produtos
  const categories = Array.from(new Set(products.map(p => p.category || 'Geral'))).filter(Boolean);

  // Métricas
  const totalProductsCount = products.length;
  const lowStockProducts = products.filter(p => Number(p.currentStock || 0) <= Number(p.minStock || 0) && Number(p.currentStock || 0) > 0);
  const outOfStockProducts = products.filter(p => Number(p.currentStock || 0) <= 0);
  const totalCostValue = products.reduce((sum, p) => sum + (Number(p.currentStock || 0) * Number(p.costPrice || 0)), 0);
  const totalSaleValue = products.reduce((sum, p) => sum + (Number(p.currentStock || 0) * Number(p.salePrice || 0)), 0);

  // Produtos filtrados
  const filteredProducts = products.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
      const matchCat = p.category ? p.category.toLowerCase().includes(q) : false;
      if (!matchName && !matchSku && !matchCat) return false;
    }

    if (categoryFilter !== 'all' && (p.category || 'Geral') !== categoryFilter) {
      return false;
    }

    const current = Number(p.currentStock || 0);
    const min = Number(p.minStock || 0);

    if (stockStatusFilter === 'out' && current > 0) return false;
    if (stockStatusFilter === 'low' && (current > min || current <= 0)) return false;
    if (stockStatusFilter === 'normal' && current <= min) return false;

    return true;
  }).sort((a, b) => {
    // Alerta de estoque baixo ou zerado primeiro
    const aIsAlert = Number(a.currentStock || 0) <= Number(a.minStock || 0);
    const bIsAlert = Number(b.currentStock || 0) <= Number(b.minStock || 0);
    if (aIsAlert && !bIsAlert) return -1;
    if (!aIsAlert && bIsAlert) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSaveProduct = async (productData: Product) => {
    await db.saveProduct(productData);
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir o produto "${name}" do estoque? Todo o histórico de movimentações deste item também será removido.`)) {
      await db.deleteProduct(id);
    }
  };

  const handleSaveMovement = async (movData: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const saved = await db.addStockMovement(movData);
    setShowMovementModal(false);
    return saved;
  };

  const handleQuickIn = (product: Product) => {
    setMovementProductId(product.id);
    setMovementType('in');
    setShowMovementModal(true);
  };

  const handleQuickOut = (product: Product) => {
    setMovementProductId(product.id);
    setMovementType('out');
    setShowMovementModal(true);
  };

  const handleExportMovementsCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data/Hora,Produto,Tipo,Quantidade,Estoque Anterior,Novo Estoque,Motivo,Custo Unitario (R$),Responsavel\n";
    movements.forEach(m => {
      const typeLabel = m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Saida' : 'Ajuste';
      const d = m.createdAt ? new Date(m.createdAt).toLocaleString('pt-BR') : '';
      csvContent += `"${d}","${m.productName || ''}","${typeLabel}",${m.quantity},${m.previousStock},${m.newStock},"${m.reason || ''}",${m.costPrice || 0},"${m.createdBy || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historico_estoque_${establishmentName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL DO ESTOQUE */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Boxes className="h-6 w-6 text-indigo-600" />
              <span>Controle de Estoque & Mercadorias</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastro de insumos, registro de entradas/compras, saídas, consumo e avisos de estoque mínimo
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setMovementProductId(undefined);
                setMovementType('in');
                setShowMovementModal(true);
              }}
              disabled={products.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
              title="Registrar entrada de mercadoria comprada de fornecedor"
            >
              <ArrowDownRight className="h-4 w-4" />
              <span>Entrada (+)</span>
            </button>

            <button
              onClick={() => {
                setMovementProductId(undefined);
                setMovementType('out');
                setShowMovementModal(true);
              }}
              disabled={products.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
              title="Registrar saída, consumo na cozinha ou descarte"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Saída (-)</span>
            </button>

            <button
              onClick={() => {
                setEditingProduct(null);
                setShowProductModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Novo Produto</span>
            </button>
          </div>
        </div>

        {/* CARDS DE RESUMO DO ESTOQUE */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Total de Produtos</span>
              <Package className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{totalProductsCount}</p>
            <p className="text-[10px] text-slate-400 font-medium">Itens cadastrados</p>
          </div>

          <div className={`border p-4 rounded-xl space-y-1 ${
            (lowStockProducts.length > 0 || outOfStockProducts.length > 0)
              ? 'bg-amber-50/80 border-amber-300' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Estoque em Alerta</span>
              <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-amber-950">
              {lowStockProducts.length + outOfStockProducts.length}
            </p>
            <p className="text-[10px] text-amber-800 font-bold">
              {outOfStockProducts.length} zerado(s) • {lowStockProducts.length} baixo(s)
            </p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-emerald-900">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Valor em Custo</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-800">
              R$ {totalCostValue.toFixed(2)}
            </p>
            <p className="text-[10px] text-emerald-700 font-semibold">Custo total estocado</p>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-indigo-900">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Valor em Venda</span>
              <DollarSign className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-950">
              R$ {totalSaleValue.toFixed(2)}
            </p>
            <p className="text-[10px] text-indigo-700 font-semibold">Projeção estimada</p>
          </div>
        </div>

        {/* ALERTA VISUAL SE HOUVER ITENS ZERADOS OU EM ESTOQUE BAIXO */}
        {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-950">
                  Atenção: Você possui {outOfStockProducts.length + lowStockProducts.length} produto(s) precisando de reposição no estoque!
                </p>
                <p className="text-[11px] text-amber-800">
                  {outOfStockProducts.map(p => p.name).concat(lowStockProducts.map(p => p.name)).slice(0, 3).join(', ')}
                  {outOfStockProducts.length + lowStockProducts.length > 3 ? ' e outros...' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => setStockStatusFilter('low')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex-shrink-0 shadow-sm"
            >
              Ver Itens em Alerta
            </button>
          </div>
        )}
      </div>

      {/* NAVEGAÇÃO DE SUB-ABAS (PRODUTOS / HISTÓRICO DE MOVIMENTAÇÕES) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveSubTab('products');
                setSelectedProductForHistory(null);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                activeSubTab === 'products' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Produtos & Quantidades ({products.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('movements')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                activeSubTab === 'movements' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Histórico de Entradas & Saídas ({movements.length})</span>
            </button>
          </div>

          {activeSubTab === 'movements' && movements.length > 0 && (
            <button
              onClick={handleExportMovementsCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm self-end sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Histórico (CSV)</span>
            </button>
          )}
        </div>

        {/* VISÃO 1: CATÁLOGO DE PRODUTOS */}
        {activeSubTab === 'products' && (
          <div className="space-y-4">
            {/* FILTROS E BUSCA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nome, SKU ou categoria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todas as Categorias ({categories.length})</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todos os Níveis de Estoque</option>
                  <option value="low">⚠️ Estoque Baixo (No Limite)</option>
                  <option value="out">❌ Zerado (Sem Estoque)</option>
                  <option value="normal">✅ Estoque Normal</option>
                </select>
              </div>
            </div>

            {/* TABELA DE PRODUTOS */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                <Package className="h-12 w-12 mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Nenhum produto encontrado</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {products.length === 0 ? 'Cadastre seu primeiro produto para começar a controlar o estoque!' : 'Tente ajustar os filtros de busca.'}
                  </p>
                </div>
                {products.length === 0 && (
                  <button
                    onClick={() => {
                      setEditingProduct(null);
                      setShowProductModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    + Cadastrar Primeiro Produto
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Produto / Mercadoria</th>
                      <th className="p-3.5">Categoria</th>
                      <th className="p-3.5 text-center">Estoque Atual</th>
                      <th className="p-3.5 text-center">Mínimo</th>
                      <th className="p-3.5 text-right">Preço de Custo</th>
                      <th className="p-3.5 text-right">Preço de Venda</th>
                      <th className="p-3.5 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => {
                      const cur = Number(p.currentStock || 0);
                      const min = Number(p.minStock || 0);
                      const isZero = cur <= 0;
                      const isLow = cur <= min && cur > 0;

                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/70 transition-colors ${
                          isZero ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''
                        }`}>
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900 text-sm">{p.name}</div>
                            {p.sku && (
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Barcode className="h-3 w-3" />
                                <span>{p.sku}</span>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                              {p.category || 'Geral'}
                            </span>
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-base font-black px-3 py-0.5 rounded-xl ${
                                isZero 
                                  ? 'bg-red-600 text-white shadow-xs' 
                                  : isLow 
                                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {cur} {p.unit || 'UN'}
                              </span>
                              {isZero && <span className="text-[9px] font-black text-red-600 uppercase mt-0.5">Sem Estoque</span>}
                              {isLow && <span className="text-[9px] font-black text-amber-700 uppercase mt-0.5">Estoque Baixo</span>}
                            </div>
                          </td>

                          <td className="p-3.5 text-center font-bold text-slate-400">
                            {min} {p.unit || 'UN'}
                          </td>

                          <td className="p-3.5 text-right font-bold text-slate-700">
                            {p.costPrice ? `R$ ${Number(p.costPrice).toFixed(2)}` : '—'}
                          </td>

                          <td className="p-3.5 text-right font-bold text-emerald-700">
                            {p.salePrice ? `R$ ${Number(p.salePrice).toFixed(2)}` : '—'}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Botão Rápido de Entrada */}
                              <button
                                onClick={() => handleQuickIn(p)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                                title="Dar Entrada de Mercadoria (+)"
                              >
                                <ArrowDownRight className="h-4 w-4" />
                              </button>

                              {/* Botão Rápido de Saída */}
                              <button
                                onClick={() => handleQuickOut(p)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
                                title="Registrar Saída / Consumo (-)"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </button>

                              {/* Ver Histórico Deste Item */}
                              <button
                                onClick={() => {
                                  setSelectedProductForHistory(p.id);
                                  setActiveSubTab('movements');
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                title="Ver Histórico de Movimentações deste Produto"
                              >
                                <History className="h-4 w-4" />
                              </button>

                              {/* Editar Produto */}
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setShowProductModal(true);
                                }}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar Cadastro do Produto"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              {/* Excluir Produto */}
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir Produto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VISÃO 2: HISTÓRICO DE ENTRADAS E SAÍDAS */}
        {activeSubTab === 'movements' && (
          <div className="space-y-4">
            {selectedProductForHistory && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">
                    Filtrando histórico apenas do produto: <strong>{products.find(p => p.id === selectedProductForHistory)?.name}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedProductForHistory(null)}
                  className="text-xs font-black text-indigo-600 hover:underline"
                >
                  Ver Todos os Produtos
                </button>
              </div>
            )}

            {movements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <History className="h-10 w-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">Nenhuma movimentação de estoque registrada ainda.</p>
                <p className="text-xs text-slate-500">As compras, reposições e saídas aparecerão aqui com data, quantidade e motivo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Data / Hora</th>
                      <th className="p-3.5">Produto</th>
                      <th className="p-3.5 text-center">Tipo</th>
                      <th className="p-3.5 text-center">Quantidade</th>
                      <th className="p-3.5 text-center">Estoque Antes → Depois</th>
                      <th className="p-3.5">Motivo / Justificativa</th>
                      <th className="p-3.5 text-right">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map(m => {
                      const isEntry = m.type === 'in';
                      const isExit = m.type === 'out';
                      const prod = products.find(p => p.id === m.productId);

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-semibold text-slate-700">
                            {m.createdAt ? new Date(m.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>

                          <td className="p-3.5 font-extrabold text-slate-900">
                            {m.productName || prod?.name || 'Produto'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase inline-flex items-center gap-1 ${
                              isEntry ? 'bg-emerald-100 text-emerald-800' : isExit ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isEntry && <ArrowDownRight className="h-3 w-3" />}
                              {isExit && <ArrowUpRight className="h-3 w-3" />}
                              {!isEntry && !isExit && <RotateCcw className="h-3 w-3" />}
                              <span>{isEntry ? 'Entrada (+)' : isExit ? 'Saída (-)' : 'Ajuste'}</span>
                            </span>
                          </td>

                          <td className="p-3.5 text-center font-black text-sm">
                            <span className={isEntry ? 'text-emerald-700' : isExit ? 'text-red-700' : 'text-blue-700'}>
                              {isEntry ? '+' : isExit ? '-' : ''}{m.quantity} {prod?.unit || 'UN'}
                            </span>
                          </td>

                          <td className="p-3.5 text-center font-bold text-slate-600">
                            <span className="text-slate-400">{m.previousStock}</span>
                            <span className="mx-1.5 text-slate-300">→</span>
                            <span className="text-slate-900 font-black">{m.newStock} {prod?.unit || 'UN'}</span>
                          </td>

                          <td className="p-3.5 font-medium text-slate-700">
                            {m.reason || '—'}
                          </td>

                          <td className="p-3.5 text-right font-semibold text-slate-500">
                            {m.createdBy || 'Sistema'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO DE PRODUTO */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        establishmentId={establishmentId}
        editingProduct={editingProduct}
        onSave={handleSaveProduct}
      />

      {/* MODAL DE MOVIMENTAÇÃO DE ESTOQUE (ENTRADA / SAÍDA) */}
      <StockMovementModal
        isOpen={showMovementModal}
        onClose={() => {
          setShowMovementModal(false);
          setMovementProductId(undefined);
        }}
        establishmentId={establishmentId}
        products={products}
        initialProductId={movementProductId}
        initialType={movementType}
        userName={userName}
        onSaveMovement={handleSaveMovement}
      />
    </div>
  );
}
