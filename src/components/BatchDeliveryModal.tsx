"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Layers, Check, Sparkles, FileText, Loader2, RotateCcw, Link2 } from 'lucide-react';
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
  deliveryType?: 'standard' | 'same_address';
  additionalValue?: string;
  additionalReason?: string;
  linkedOrderNumber?: string;
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
  const [isSaving, setIsSaving] = useState(false);

  // Modo de texto/colagem rápida
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const [rows, setRows] = useState<BatchRow[]>([]);

  // Função para reiniciar o lote com os valores padrão preenchidos em todas as linhas
  const resetToEmptyBatch = (riderId?: string, estId?: string, dateStr?: string, startTimeStr?: string) => {
    const initialRider = riderId !== undefined ? riderId : (defaultRiderId || (activeRiders[0]?.id || ''));
    const initialEst = estId !== undefined ? estId : (defaultEstablishmentId || (activeEsts[0]?.id || ''));
    const initialDate = dateStr || db.getOperationalDateString();
    const initialTime = startTimeStr || '18:00';

    setGlobalRiderId(initialRider);
    setGlobalEstId(initialEst);
    setGlobalDate(initialDate);
    setGlobalStartTime(initialTime);
    setPastedText('');
    setShowPasteMode(false);

    const [startH, startM] = initialTime.split(':').map(Number);

    const initialRows: BatchRow[] = [0, 15, 30, 45, 60].map((offsetMins, idx) => {
      const totalMins = (((startH || 18) * 60 + (startM || 0)) + offsetMins) % 1440;
      const hStr = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const mStr = String(totalMins % 60).padStart(2, '0');
      return {
        id: 'row_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
        riderId: initialRider,
        establishmentId: initialEst,
        date: initialDate,
        time: `${hStr}:${mStr}`,
        value: '8.00',
        orderNumber: '',
        notes: '',
        deliveryType: 'standard',
        additionalValue: '',
        additionalReason: '',
        linkedOrderNumber: ''
      };
    });

    setRows(initialRows);
  };

  useEffect(() => {
    if (isOpen) {
      resetToEmptyBatch();
    }
  }, [isOpen, defaultRiderId, defaultEstablishmentId]);

  const handleGlobalRiderChange = (newRiderId: string) => {
    setGlobalRiderId(newRiderId);
    setRows(prev => prev.map(r => ({ ...r, riderId: newRiderId })));
  };

  const handleGlobalEstChange = (newEstId: string) => {
    setGlobalEstId(newEstId);
    setRows(prev => prev.map(r => ({ ...r, establishmentId: newEstId })));
  };

  const handleGlobalDateChange = (newDate: string) => {
    setGlobalDate(newDate);
    setRows(prev => prev.map(r => ({ ...r, date: newDate })));
  };

  const handleGlobalStartTimeChange = (newStartTime: string) => {
    setGlobalStartTime(newStartTime);
    const [startH, startM] = (newStartTime || '18:00').split(':').map(Number);
    setRows(prev => prev.map((r, idx) => {
      const totalMins = (((startH || 18) * 60 + (startM || 0)) + idx * 15) % 1440;
      const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const nextM = String(totalMins % 60).padStart(2, '0');
      return {
        ...r,
        time: `${nextH}:${nextM}`
      };
    }));
  };

  if (!isOpen) return null;

  const handleAddRow = () => {
    let nextTime = '19:00';
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.time) {
        const [h, m] = lastRow.time.split(':').map(Number);
        const totalMins = ((h || 18) * 60 + (m || 0) + 15) % 1440;
        const nextH = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const nextM = String(totalMins % 60).padStart(2, '0');
        nextTime = `${nextH}:${nextM}`;
      }
    } else {
      nextTime = globalStartTime || '18:00';
    }

    const newRow: BatchRow = {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      riderId: globalRiderId || (activeRiders[0]?.id || ''),
      establishmentId: globalEstId || (activeEsts[0]?.id || ''),
      date: globalDate || db.getOperationalDateString(),
      time: nextTime,
      value: '8.00',
      orderNumber: '',
      notes: '',
      deliveryType: 'standard',
      additionalValue: '',
      additionalReason: '',
      linkedOrderNumber: ''
    };

    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([{
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        riderId: globalRiderId || (activeRiders[0]?.id || ''),
        establishmentId: globalEstId || (activeEsts[0]?.id || ''),
        date: globalDate || db.getOperationalDateString(),
        time: globalStartTime || '18:00',
        value: '8.00',
        orderNumber: '',
        notes: '',
        deliveryType: 'standard',
        additionalValue: '',
        additionalReason: '',
        linkedOrderNumber: ''
      }]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof BatchRow, val: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;

      if (field === 'deliveryType') {
        const nextType = val as 'standard' | 'same_address';
        const nextVal = nextType === 'same_address' ? '4.00' : '8.00';
        return {
          ...r,
          deliveryType: nextType,
          value: nextVal
        };
      }

      return { ...r, [field]: val };
    }));
  };

  const handleToggleSameAddress = (id: string, prevRowOrderNumber?: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const isCurrentlySame = r.deliveryType === 'same_address';
      const nextType = isCurrentlySame ? 'standard' : 'same_address';
      return {
        ...r,
        deliveryType: nextType,
        value: nextType === 'same_address' ? '4.00' : '8.00',
        linkedOrderNumber: nextType === 'same_address' ? (r.linkedOrderNumber || prevRowOrderNumber || '') : ''
      };
    }));
  };

  const handleApplyGlobalSettings = () => {
    const [startH, startM] = (globalStartTime || '18:00').split(':').map(Number);
    setRows(prev => prev.map((r, idx) => {
      const totalMins = (((startH || 18) * 60 + (startM || 0)) + idx * 15) % 1440;
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

  // Parser para colar dados em massa
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedRows: BatchRow[] = [];

    const [startH, startM] = (globalStartTime || '18:00').split(':').map(Number);

    lines.forEach((line, idx) => {
      const cleanLine = line.replace(/R\$/g, '').trim();
      const parts = cleanLine.split(/[\t,; ]+/).filter(Boolean);

      let val = '8.00';
      let orderNum = '';
      let timeStr = '';
      let isSame = false;

      const totalMins = (((startH || 18) * 60 + (startM || 0)) + idx * 10) % 1440;
      const calcH = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const calcM = String(totalMins % 60).padStart(2, '0');
      timeStr = `${calcH}:${calcM}`;

      parts.forEach(part => {
        const normalized = part.replace(',', '.');
        if (!isNaN(Number(normalized)) && Number(normalized) > 0) {
          const numVal = Number(normalized);
          val = numVal.toFixed(2);
          if (numVal === 4) isSame = true;
        } else if (!orderNum && (/^\d+$/.test(part) || /^#\d+/.test(part))) {
          orderNum = part.replace('#', '');
        }
      });

      parsedRows.push({
        id: 'row_' + Date.now() + '_' + idx,
        riderId: globalRiderId || (activeRiders[0]?.id || ''),
        establishmentId: globalEstId || (activeEsts[0]?.id || ''),
        date: globalDate || db.getOperationalDateString(),
        time: timeStr,
        value: val,
        orderNumber: orderNum,
        notes: '',
        deliveryType: isSame ? 'same_address' : 'standard',
        additionalValue: '',
        additionalReason: '',
        linkedOrderNumber: ''
      });
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
    const baseVal = parseFloat(r.value.replace(',', '.'));
    return !isNaN(baseVal) && baseVal > 0 && r.riderId && r.establishmentId && r.date;
  });

  const totalBatchValue = validRows.reduce((sum, r) => {
    const b = parseFloat(r.value.replace(',', '.')) || 0;
    const a = parseFloat((r.additionalValue || '0').replace(',', '.')) || 0;
    return sum + (b + a);
  }, 0);

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validRows.length === 0) {
      alert('Preencha ao menos uma corrida com valor válido maior que zero, motoboy e estabelecimento selecionados.');
      return;
    }

    // 1. Verificação de repetição interna no lote
    const seenBatchNumbers = new Set<string>();
    const internalDuplicates: string[] = [];

    for (const r of validRows) {
      const num = r.orderNumber.trim().replace('#', '');
      if (num) {
        if (seenBatchNumbers.has(num)) {
          internalDuplicates.push(num);
        } else {
          seenBatchNumbers.add(num);
        }
      }
    }

    if (internalDuplicates.length > 0) {
      const confirmInternal = confirm(
        `⚠️ Aviso: Há pedidos com o mesmo número dentro desta tabela de lançamento:\n\n• Pedido(s): #${internalDuplicates.join(', #')}\n\nDeseja confirmar o lançamento conjunto mesmo assim (ex: pedidos divididos entre motoboys)?`
      );
      if (!confirmInternal) return;
    }

    // 2. Verificação de repetição contra o banco de dados do dia operacional
    const dbDuplicates: { orderNumber: string; riderName: string }[] = [];
    for (const r of validRows) {
      const num = r.orderNumber.trim().replace('#', '');
      if (num) {
        const check = db.checkDuplicateOrderNumber(num, r.date, r.time);
        if (check.isDuplicate) {
          dbDuplicates.push({
            orderNumber: num,
            riderName: check.riderName || 'Outro entregador'
          });
        }
      }
    }

    if (dbDuplicates.length > 0) {
      const details = dbDuplicates.map(d => `• Pedido #${d.orderNumber} (já lançado por ${d.riderName})`).join('\n');
      const confirmDb = confirm(
        `⚠️ Aviso: Os seguintes pedidos já foram registrados hoje no sistema:\n\n${details}\n\nDeseja confirmar o lançamento complementar mesmo assim (ex: corrida dividida/adicional)?`
      );
      if (!confirmDb) return;
    }

    setIsSaving(true);
    try {
      const allDeliveries = db.getDeliveries();
      const schedules = db.getSchedules();
      const nowStr = new Date().toISOString();

      const newDeliveries: Delivery[] = validRows.map((r, idx) => {
        const baseVal = parseFloat(r.value.replace(',', '.')) || 0;
        const addVal = parseFloat((r.additionalValue || '0').replace(',', '.')) || 0;
        const totalVal = baseVal + addVal;
        const operationalDate = r.date || db.getOperationalDateString();

        const matchSchedule = schedules.find(s => 
          db.isSameUser(s.riderId, r.riderId) &&
          db.isSameEstablishment(s.establishmentId, r.establishmentId) &&
          db.isSameDayString(s.date, operationalDate)
        );

        return {
          id: 'd_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
          riderId: r.riderId,
          establishmentId: r.establishmentId,
          date: operationalDate,
          time: r.time || '18:00',
          value: totalVal,
          status: globalStatus,
          scheduleId: matchSchedule?.id,
          orderNumber: r.orderNumber.trim() ? r.orderNumber.trim().replace('#', '') : undefined,
          notes: r.notes.trim() || undefined,
          deliveryType: r.deliveryType || 'standard',
          additionalValue: addVal > 0 ? addVal : undefined,
          additionalReason: r.additionalReason?.trim() || undefined,
          linkedOrderNumber: r.deliveryType === 'same_address' ? (r.linkedOrderNumber?.trim().replace('#', '') || undefined) : undefined,
          updatedAt: nowStr,
          paid: false
        };
      });

      await db.setDeliveries([...allDeliveries, ...newDeliveries]);
      
      resetToEmptyBatch();
      onSaved();
      onClose();

      alert(`🎉 ${newDeliveries.length} corridas gravadas com sucesso!\n\nTotal: R$ ${totalBatchValue.toFixed(2)}`);
    } catch (err) {
      console.error('Erro ao salvar lote de corridas:', err);
      alert('Erro ao gravar o lote de corridas. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-[99999] overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[94vh] flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Lançamento de Corridas em Lote</span>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Mesmo Endereço (R$4) & Adicional com Motivo
                </span>
              </h3>
              <p className="text-xs text-slate-500">Alterne entre entrega padrão (R$8) e mesmo endereço (R$4) e justifique adicionais</p>
            </div>
          </div>
          <button 
            onClick={() => {
              resetToEmptyBatch();
              onClose();
            }} 
            disabled={isSaving} 
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
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
                onClick={() => resetToEmptyBatch(globalRiderId, globalEstId, globalDate, globalStartTime)}
                className="text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors mr-1"
                title="Limpar e reiniciar todas as linhas"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpar Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPasteMode(!showPasteMode)}
                className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{showPasteMode ? 'Ver Tabela' : 'Colar Lista'}</span>
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
                onChange={(e) => handleGlobalRiderChange(e.target.value)}
                className="w-full px-2 py-1.5 border border-indigo-300 rounded-lg bg-white font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                onChange={(e) => handleGlobalEstChange(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {activeEsts.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                value={globalDate}
                onChange={(e) => handleGlobalDateChange(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horário Inicial</label>
              <input
                type="time"
                value={globalStartTime}
                onChange={(e) => handleGlobalStartTimeChange(e.target.value)}
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
              Exemplos aceitos: <code>8.00 #1042</code> ou <code>4.00 #1043</code> ou <code>10.50</code>
            </p>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="8.00 #1042&#10;4.00 #1043&#10;8.00 #1044&#10;12.00 #1045"
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
                  <th className="p-2 w-7 text-center">#</th>
                  <th className="p-2 w-32">Motoboy</th>
                  <th className="p-2 w-28">Tipo / Endereço</th>
                  <th className="p-2 w-20">Horário</th>
                  <th className="p-2 w-20">Nº Pedido</th>
                  <th className="p-2 w-20 text-right">Base (R$)</th>
                  <th className="p-2 w-20 text-right">+ Adicional</th>
                  <th className="p-2 w-20 text-right">Total</th>
                  <th className="p-2 w-44">Motivo do Adicional</th>
                  <th className="p-2">Vínculo / Obs</th>
                  <th className="p-2 w-10 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, index) => {
                  const isSame = row.deliveryType === 'same_address';
                  const baseNum = parseFloat(row.value.replace(',', '.')) || 0;
                  const addNum = parseFloat((row.additionalValue || '0').replace(',', '.')) || 0;
                  const rowTotal = (baseNum + addNum).toFixed(2);
                  const prevOrderNumber = index > 0 ? rows[index - 1]?.orderNumber : undefined;

                  return (
                    <tr key={row.id} className={`hover:bg-slate-50/70 ${isSame ? 'bg-purple-50/40' : ''}`}>
                      <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                      
                      <td className="p-1.5">
                        <select
                          value={row.riderId}
                          onChange={(e) => handleUpdateRow(row.id, 'riderId', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        >
                          <option value="">Selecione...</option>
                          {activeRiders.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Botão Tipo de Corrida */}
                      <td className="p-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSameAddress(row.id, prevOrderNumber)}
                          className={`w-full px-2 py-1 rounded text-[10px] font-black transition-all flex items-center justify-center gap-1 border ${
                            isSame 
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                          title="Alternar entre Entrega Padrão (R$8) e Mesmo Endereço (R$4)"
                        >
                          {isSame ? (
                            <>
                              <Link2 className="h-3 w-3" />
                              <span>Mesmo (R$4)</span>
                            </>
                          ) : (
                            <span>Padrão (R$8)</span>
                          )}
                        </button>
                      </td>

                      <td className="p-1.5">
                        <input
                          type="time"
                          value={row.time}
                          onChange={(e) => handleUpdateRow(row.id, 'time', e.target.value)}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Nº Pedido"
                          value={row.orderNumber}
                          onChange={(e) => handleUpdateRow(row.id, 'orderNumber', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-center font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.value}
                          onChange={(e) => handleUpdateRow(row.id, 'value', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          placeholder="+ 0.00"
                          value={row.additionalValue || ''}
                          onChange={(e) => handleUpdateRow(row.id, 'additionalValue', e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 bg-amber-50/50 rounded text-xs font-bold text-amber-900 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                          title="Valor adicional por km extra, chuva, etc."
                        />
                      </td>

                      <td className="p-1.5 text-right font-black text-emerald-700">
                        R$ {rowTotal}
                      </td>

                      {/* Motivo do Adicional */}
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Ex: Cuités, Chuva..."
                          value={row.additionalReason || ''}
                          onChange={(e) => handleUpdateRow(row.id, 'additionalReason', e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300/80 bg-amber-50/30 rounded text-xs font-medium text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          title="Justificativa do valor adicional"
                        />
                      </td>

                      <td className="p-1.5">
                        {isSame ? (
                          <div className="flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                            <input
                              type="text"
                              placeholder="Vincular a #1042"
                              value={row.linkedOrderNumber || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'linkedOrderNumber', e.target.value)}
                              className="w-full px-2 py-1 border border-purple-300 bg-purple-50/60 rounded text-xs font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              title="Número do pedido principal entregue no mesmo local"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="Obs..."
                            value={row.notes}
                            onChange={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
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
                  );
                })}
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
              disabled={isSaving}
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
              onClick={() => {
                resetToEmptyBatch();
                onClose();
              }}
              disabled={isSaving}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={validRows.length === 0 || isSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gravando...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Gravar Lote ({validRows.length} Corridas)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}