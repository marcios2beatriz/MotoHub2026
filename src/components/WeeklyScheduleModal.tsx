"use client";

import React, { useState } from 'react';
import { X, CalendarDays, Check, AlertTriangle, Users, Search } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: User[];
  establishments: Establishment[];
  weeklyForm: {
    riderId: string;
    establishmentId: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
    weekStart: string;
    days: { seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean; dom: boolean };
  };
  setWeeklyForm: React.Dispatch<React.SetStateAction<{
    riderId: string;
    establishmentId: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
    weekStart: string;
    days: { seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean; dom: boolean };
  }>>;
  weeklyPreview: { date: string; label: string; conflict: boolean; key: string; enabled: boolean }[];
  setWeeklyPreview: React.Dispatch<React.SetStateAction<{ date: string; label: string; conflict: boolean; key: string; enabled: boolean }[]>>;
  weeklyStep: 'form' | 'preview';
  setWeeklyStep: (step: 'form' | 'preview') => void;
  buildWeeklyPreview: (form: any) => void;
  onSave: () => void;
  getShiftLabel: (shift: string) => string;
  selectedRiderIds: string[];
  setSelectedRiderIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function WeeklyScheduleModal({
  isOpen,
  onClose,
  riders,
  establishments,
  weeklyForm,
  setWeeklyForm,
  weeklyPreview,
  setWeeklyPreview,
  weeklyStep,
  setWeeklyStep,
  buildWeeklyPreview,
  onSave,
  getShiftLabel,
  selectedRiderIds,
  setSelectedRiderIds
}: WeeklyScheduleModalProps) {
  const [searchRider, setSearchRider] = useState('');

  if (!isOpen) return null;

  const activeRiders = riders.filter(r => r.active);
  const filteredRiders = activeRiders.filter(r => 
    r.name.toLowerCase().includes(searchRider.toLowerCase()) ||
    r.cpf.includes(searchRider)
  );

  const isAllSelected = activeRiders.length > 0 && selectedRiderIds.length === activeRiders.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRiderIds([]);
      setWeeklyForm(prev => ({ ...prev, riderId: '' }));
    } else {
      const allIds = activeRiders.map(r => r.id);
      setSelectedRiderIds(allIds);
      if (allIds.length > 0) {
        setWeeklyForm(prev => ({ ...prev, riderId: allIds[0] }));
      }
    }
  };

  const toggleSelectRider = (id: string) => {
    setSelectedRiderIds(prev => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter(item => item !== id);
      } else {
        next = [...prev, id];
      }
      if (next.length > 0) {
        setWeeklyForm(f => ({ ...f, riderId: next[0] }));
      } else {
        setWeeklyForm(f => ({ ...f, riderId: '' }));
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
              Escala Semanal Automática
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {weeklyStep === 'form' ? 'Configure a escala para um ou múltiplos motoboys' : 'Revise os dias antes de confirmar'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {weeklyStep === 'form' && (
          <div className="space-y-4">
            {/* SELEÇÃO MÚLTIPLA DE MOTOBOYS */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Motoboy(s) ({selectedRiderIds.length} selecionado{selectedRiderIds.length !== 1 ? 's' : ''})
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
              </div>

              <div className="relative mb-2">
                <input
                  type="text"
                  placeholder="Filtrar motoboys por nome..."
                  value={searchRider}
                  onChange={(e) => setSearchRider(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>

              <div className="border border-slate-200 rounded-xl p-2 max-h-36 overflow-y-auto space-y-1 bg-slate-50/50">
                {filteredRiders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Nenhum motoboy encontrado.</p>
                ) : (
                  filteredRiders.map(rider => {
                    const isChecked = selectedRiderIds.includes(rider.id);
                    return (
                      <div
                        key={rider.id}
                        onClick={() => toggleSelectRider(rider.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                          isChecked ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isChecked && <Check className="h-3 w-3" />}
                          </div>
                          <span className={`font-semibold truncate ${isChecked ? 'text-emerald-950 font-bold' : 'text-slate-700'}`}>
                            {rider.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{rider.phone}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento Target</label>
              <select
                required
                value={weeklyForm.establishmentId}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, establishmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecione um Estabelecimento</option>
                {establishments.filter(e => e.active).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semana (início na segunda-feira)</label>
              <input
                type="date"
                value={weeklyForm.weekStart}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, weekStart: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
                <select
                  value={weeklyForm.shift}
                  onChange={(e: any) => setWeeklyForm({ ...weeklyForm, shift: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                  <option value="night">Noite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
                <input
                  type="time"
                  value={weeklyForm.startTime}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Término</label>
                <input
                  type="time"
                  value={weeklyForm.endTime}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias de Funcionamento</label>
              <div className="grid grid-cols-7 gap-1">
                {(['seg','ter','qua','qui','sex','sab','dom'] as const).map((key, idx) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWeeklyForm({ ...weeklyForm, days: { ...weeklyForm.days, [key]: !weeklyForm.days[key] } })}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors border ${
                      weeklyForm.days[key]
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-400 border-slate-200 line-through'
                    }`}
                  >
                    {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][idx]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Clique para ativar/desativar os dias da semana</p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedRiderIds.length === 0) {
                    alert('Selecione pelo menos um motoboy.');
                    return;
                  }
                  if (!weeklyForm.establishmentId || !weeklyForm.weekStart) {
                    alert('Preencha o estabelecimento e a semana de início.');
                    return;
                  }
                  if (!Object.values(weeklyForm.days).some(Boolean)) {
                    alert('Selecione pelo menos um dia da semana.');
                    return;
                  }
                  buildWeeklyPreview(weeklyForm);
                }}
                disabled={selectedRiderIds.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                Pré-visualizar ({selectedRiderIds.length} motoboy(s)) →
              </button>
            </div>
          </div>
        )}

        {weeklyStep === 'preview' && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-xl text-sm space-y-1 border border-slate-200">
              <p>
                <span className="font-bold text-slate-600">Motoboy(s):</span>{' '}
                <span className="font-extrabold text-indigo-700">
                  {selectedRiderIds.map(id => riders.find(r => r.id === id)?.name).filter(Boolean).join(', ')}
                </span>
              </p>
              <p><span className="font-semibold text-slate-600">Estabelecimento:</span> {establishments.find(e => e.id === weeklyForm.establishmentId)?.name}</p>
              <p><span className="font-semibold text-slate-600">Turno:</span> {getShiftLabel(weeklyForm.shift)} ({weeklyForm.startTime} - {weeklyForm.endTime})</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias gerados — desmarque se necessário</label>
              <div className="space-y-2">
                {weeklyPreview.map((day) => (
                  <div
                    key={day.date}
                    onClick={() => setWeeklyPreview((prev) =>
                      prev.map((d) => d.date === day.date ? { ...d, enabled: !d.enabled } : d)
                    )}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      !day.enabled
                        ? 'bg-slate-50 border-slate-200 opacity-50'
                        : day.conflict
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        day.enabled ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                      }`}>
                        {day.enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${day.enabled ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {day.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    {day.conflict && day.enabled && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Conflito detectado
                      </span>
                    )}
                    {!day.enabled && (
                      <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">Ignorado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWeeklyStep('form')}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!weeklyPreview.some((d) => d.enabled)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold shadow-sm"
                >
                  Confirmar para {selectedRiderIds.length} motoboy(s)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}