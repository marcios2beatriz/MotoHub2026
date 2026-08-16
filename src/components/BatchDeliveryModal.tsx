"use client";

import React, { useState } from 'react';
import { X, Plus, Trash2, Layers, Check, Calculator, Clock, Calendar, Sparkles, FileText } from 'lucide-react';
import { User, Establishment, Delivery, db } from '../utils/db';

interface BatchRow {
  id: string;
  riderId: string;
  establishmentId: string;
  date: string;
  time: string;
  value: string;
  orderNumber: string;
  notes: string;
}

interface BatchDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: User[];
  establishments: Establishment[];
  defaultEstablishmentId?: string;
  defaultRiderId?: string;
  onSaved: () => void;
}

export default function BatchDeliveryModal({
  isOpen,
  onClose,
  riders,
  establishments,
  defaultEstablishmentId = '',
  defaultRiderId = '',
  onSaved
}: BatchDeliveryModalProps) {
  const activeRiders = riders.filter(r => r.active);
  const activeEsts = establishments.filter(e => e.active);

  // Valores padrão globais para preenchimento rápido
  const [globalDate, setGlobalDate] = useState<string>(db.getOperationalDateString());
  const [globalStartTime, setGlobalStartTime] = useState<string>('18:00');
  const [globalRiderId, setGlobalRiderId] = useState<string>(defaultRiderId || (activeRiders[0]?.id || ''));
  const [globalEstId, setGlobalEstId] = useState<string>(defaultEstablishmentId || (activeEsts[0]?.id || ''));
  const [globalStatus, setGlobalStatus] = useState<'active' | 'pending'>('active');

  // Modo de texto/colagem rápida
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Linhas do lote
  const createEmptyRow = (timeOverride?: string): BatchRow => ({
    id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    riderId: globalRiderId,
    establishmentId: globalEstId,
    date: globalDate,
    time: timeOverride || globalStartTime,
    value: '',
    orderNumber: '',
    notes: ''
  });

  const [rows, setRows] = useState<BatchRow[]>([
    createEmptyRow('18:00'),
    createEmptyRow('18:30'),
    createEmptyRow('19:00'),
    createEmptyRow('19:30'),
    createEmptyRow('20:00')
  ]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1];
    let nextTime = '19:00';
    if (lastRow && lastRow.time) {
      const [h, m] = lastRow.time.split(':').map(Number);
      const totalMins = (h * 60 + m + 15) % 1440;
      const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const nextM = String(totalMins % 60).padStart(2, '0');
      nextTime = `${nextH}:${nextM}`;
    }
    setRows(prev => [...prev, createEmptyRow(nextTime)]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      alert('É necessário manter pelo menos uma linha na tabela.');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof BatchRow, val: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleApplyGlobalSettings = () => {
    setRows(prev => prev.map((r, idx) => {
      const [h, m] = globalStartTime.split(':').map(Number);
      const totalMins = (h * 60 + m + idx * 15) % 1440;
      const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const nextM = String(totalMins % 60).padStart(2, '0');

      return {
        ...r,
        riderId: globalRiderId || r.riderId,
        establishmentId: globalEstId || r.establishmentId,
        date: globalDate || r.date,
        time: `${nextH}:${nextM}`
      };
    }));
  };

  // Parser para colar dados em massa (ex: linhas com "Valor Pedido", "15.00 1042", "12,50", etc)
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedRows: BatchRow[] = [];

    const [startH, startM] = globalStartTime.split(':').map(Number);

    lines.forEach((line, idx) => {
      // Procura valor monetário na linha
      const cleanLine = line.replace(/R\$/g, '').trim();
      const parts = cleanLine.split(/[\t,; ]+/).filter(Boolean);

      let val = '';
      let orderNum = '';
      let timeStr = '';

      const totalMins = (startH * 60 + startM + idx * 10) % 1440;
      const calcH = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const calcM = String(totalMins % 60).padStart(2, '0');
      timeStr = `${calcH}:${calcM}`;

      parts.forEach(part => {
        const normalized = part.replace(',', '.');
        if (!val && !isNaN(Number(normalized)) && Number(normalized) > 0) {
          val = Number(normalized).toFixed(2);
        } else if (!orderNum && (/^\d+$/.test(part) || /^#\d+/.test(part))) {
          orderNum = part.replace('#', '');
        }
      });

      if (val) {
        parsedRows.push({
          id: 'row_' + Date.now() + '_' + idx,
          riderId: globalRiderId,
          establishmentId: globalEstId,
          date: globalDate,
          time: timeStr,
          value: val,
          orderNumber: orderNum,
          notes: ''
        });
      }
    });

    if (parsedRows.length > 0) {
      setRows(parsedRows);
      setShowPasteMode(false);
      setPastedText('');
    } else {
      alert('Não foi possível identificar valores numéricos no texto colado.');
    }
  };

  // Métricas calculadas
  const validRows = rows.filter(r => {
    const val = parseFloat(r.value.replace(',', '.'));
    return !isNaN(val) && val > 0 && r.riderId && r.establishmentId && r.date;
  });

  const totalBatchValue = validRows.reduce((sum, r) => sum + parseFloat(r.value.replace(',', '.')), 0);

  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();

    if (validRows.length === 0) {
      alert('Preencha ao menos uma corrida com valor válido maior que zero.');
      return;
    }

    const allDeliveries = db.getDeliveries();
    const schedules = db.getSchedules();
    const nowStr = new Date().toISOString();

    const newDeliveries: Delivery[] = validRows.map((r, idx) => {
      const val = parseFloat(r.value.replace(',', '.'));
      
      // Tenta associar com escala existente
      const matchSchedule = schedules.find(s => 
        db.isSameUser(s.riderId, r.riderId) &&
        db.isSameEstablishment(s.establishmentId, r.establishmentId) &&
        db.isSameDayString(s.date, r.date)
      );

      return {
        id: 'd_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 4),
        riderId: r.riderId,
        establishmentId: r.establishmentId,
        date: r.date,
        time: r.time || '18:00',
        value: val,
        status: globalStatus,
        scheduleId: matchSchedule?.id,
        orderNumber: r.orderNumber.trim() || undefined,
        notes: r.notes.trim() || undefined,
        updatedAt: nowStr,
        paid: false
      };
    });

    db.setDeliveries([...allDeliveries, ...newDeliveries]);
    onSaved();
    onClose();

    alert(`🎉 ${newDeliveries.length} corridas lançadas com sucesso no lote!\n\nTotal: R$ ${totalBatchValue.toFixed(2)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-[99999] overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Lançamento de Corridas em Lote</span>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Rápido
                </span>
              </h3>
              <p className="text-xs text-slate-500">Lance múltiplos pedidos de um turno (ex: 15/08 das 18:00 às 23:59) de uma só vez</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de Configurações Globais Rápidas */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Preenchimento Padrão para Todas as Linhas
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowPasteMode(!showPasteMode)}
                className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{showPasteMode ? 'Ver Tabela' : 'Colar Lista de Valores'}</span>
              </button>
              <button
                type="button"
                onClick={handleApplyGlobalSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm"
              >
                Aplicar a Todas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motoboy Padrão</label>
              <select
                value={globalRiderId}
                onChange={(e) => setGlobalRiderId(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {activeRiders.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
              <select
                value={globalEstId}
                onChange={(e) => setGlobalEstId(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {activeEsts.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data do Turno</label>
              <input
                type="date"
                value={globalDate}
                onChange={(e) => setGlobalDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horário Inicial</label>
              <input
                type="time"
                value={globalStartTime}
                onChange={(e) => setGlobalStartTime(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Inicial</label>
              <select
                value={globalStatus}
                onChange={(e: any) => setGlobalStatus(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="active">Aprovada (Ativa)</option>
                <option value="pending">Pendente de Aprovação</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal de colagem rápida */}
        {showPasteMode ? (
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span>Cole a lista de corridas (uma por linha)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Você pode colar valores de uma planilha ou mensagem. Exemplo:<br/>
              <code>12.50 #1042</code> ou <code>15,00</code> ou <code>18.00 Pedido 55</code>
            </p>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="12.50 #1042&#10;15.00 #1043&#10;10.00 #1044&#10;22.50"
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteMode(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleParsePastedText}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Processar e Preencher Tabela
              </button>
            </div>
          </div>
        ) : (
          /* Tabela de Lançamento */
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase sticky top-0 z-10 border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="p-2.5 w-8">#</th>
                  <th className="p-2.5 w-36">Motoboy</th>
                  <th className="p-2.5 w-36">Estabelecimento</th>
                  <th className="p-2.5 w-24">Horário</th>
                  <th className="p-2.5 w-28">Valor (R$) *</th>
                  <th className="p-2.5 w-28">Nº Pedido</th>
                  <th className="p-2.5">Obs</th>
                  <th className="p-2.5 w-10 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                    
                    <td className="p-1.5">
                      <select
                        value={row.riderId}
                        onChange={(e) => handleUpdateRow(row.id, 'riderId', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Selecione...</option>
                        {activeRiders.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-1.5">
                      <select
                        value={row.establishmentId}
                        onChange={(e) => handleUpdateRow(row.id, 'establishmentId', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Selecione...</option>
                        {activeEsts.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-1.5">
                      <input
                        type="time"
                        value={row.time}
                        onChange={(e) => handleUpdateRow(row.id, 'time', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={row.value}
                        onChange={(e) => handleUpdateRow(row.id, 'value', e.target.value)}
                        className="w-full px-2 py-1 border border-emerald-300 bg-emerald-50/40 rounded text-xs font-black text-emerald-800 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>

                    <td className="p-1.5">
                      <input
                        type="text"
                        placeholder="Ex: 1042"
                        value={row.orderNumber}
                        onChange={(e) => handleUpdateRow(row.id, 'orderNumber', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    <td className="p-1.5">
                      <input
                        type="text"
                        placeholder="Obs..."
                        value={row.notes}
                        onChange={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Remover linha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer & Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>+ Adicionar Linha</span>
            </button>

            <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
              <span>{validRows.length} válida(s)</span>
              <span>•</span>
              <span className="text-emerald-600 font-black text-sm">
                Total: R$ {totalBatchValue.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={validRows.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>Gravar Lote ({validRows.length} Corridas)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}