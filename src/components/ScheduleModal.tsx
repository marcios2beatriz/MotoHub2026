"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Users, Check, Search } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: User[];
  establishments: Establishment[];
  scheduleForm: {
    riderId: string;
    establishmentId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
  };
  setScheduleForm: React.Dispatch<React.SetStateAction<{
    riderId: string;
    establishmentId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
  }>>;
  selectedRiderIds: string[];
  setSelectedRiderIds: React.Dispatch<React.SetStateAction<string[]>>;
  scheduleConflictWarning: string;
  setScheduleConflictWarning: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  riders,
  establishments,
  scheduleForm,
  setScheduleForm,
  selectedRiderIds,
  setSelectedRiderIds,
  scheduleConflictWarning,
  setScheduleConflictWarning,
  onSave
}: ScheduleModalProps) {
  const [searchRider, setSearchRider] = useState('');

  if (!isOpen) return null;

  const activeRiders = riders.filter(r => r.active);
  const filteredRiders = activeRiders.filter(r => 
    r.name.toLowerCase().includes(searchRider.toLowerCase()) ||
    r.cpf.includes(searchRider) ||
    r.phone.includes(searchRider)
  );

  const isAllSelected = activeRiders.length > 0 && selectedRiderIds.length === activeRiders.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRiderIds([]);
      setScheduleForm(prev => ({ ...prev, riderId: '' }));
    } else {
      const allIds = activeRiders.map(r => r.id);
      setSelectedRiderIds(allIds);
      if (allIds.length > 0) {
        setScheduleForm(prev => ({ ...prev, riderId: allIds[0] }));
      }
    }
    setScheduleConflictWarning('');
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
        setScheduleForm(f => ({ ...f, riderId: next[0] }));
      } else {
        setScheduleForm(f => ({ ...f, riderId: '' }));
      }
      return next;
    });
    setScheduleConflictWarning('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Criar Escala de Motoboys</h3>
              <p className="text-xs text-slate-500">Escale um ou mais entregadores simultaneamente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {scheduleConflictWarning && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-xl flex items-start space-x-2 text-xs">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-bold">Atenção para Conflitos</p>
              <p className="text-amber-700 mt-0.5">{scheduleConflictWarning}</p>
            </div>
          </div>
        )}

        <form onSubmit={onSave} className="space-y-4">
          {/* SELEÇÃO MÚLTIPLA DE MOTOBOYS */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Selecione o(s) Motoboy(s) ({selectedRiderIds.length} selecionado{selectedRiderIds.length !== 1 ? 's' : ''})
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
              </button>
            </div>

            {/* Busca de motoboys */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Filtrar por nome do motoboy..."
                value={searchRider}
                onChange={(e) => setSearchRider(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            {/* Lista de Seleção com Checkboxes */}
            <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1 bg-slate-50/50">
              {filteredRiders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum motoboy ativo encontrado.</p>
              ) : (
                filteredRiders.map(rider => {
                  const isChecked = selectedRiderIds.includes(rider.id);
                  return (
                    <div
                      key={rider.id}
                      onClick={() => toggleSelectRider(rider.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                        isChecked ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <span className={`font-semibold truncate ${isChecked ? 'text-indigo-950 font-bold' : 'text-slate-700'}`}>
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
              value={scheduleForm.establishmentId}
              onChange={(e) => {
                setScheduleForm({ ...scheduleForm, establishmentId: e.target.value });
                setScheduleConflictWarning('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecione um Estabelecimento</option>
              {establishments.filter(e => e.active).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                required
                value={scheduleForm.date}
                onChange={(e) => {
                  setScheduleForm({ ...scheduleForm, date: e.target.value });
                  setScheduleConflictWarning('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
              <select
                required
                value={scheduleForm.shift}
                onChange={(e: any) => {
                  setScheduleForm({ ...scheduleForm, shift: e.target.value });
                  setScheduleConflictWarning('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noite</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Início</label>
              <input
                type="time"
                required
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Término</label>
              <input
                type="time"
                required
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={selectedRiderIds.length === 0 || !scheduleForm.establishmentId}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              Escalar {selectedRiderIds.length > 0 ? `${selectedRiderIds.length} Motoboy(s)` : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}