"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, PartnerRequest, Establishment } from '../utils/db';
import { 
  Bike, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  LogIn, 
  UserPlus, 
  X, 
  Store, 
  MapPin, 
  MessageSquare, 
  Building2, 
  UserCheck, 
  Compass, 
  TrendingUp, 
  Share2, 
  Sparkles, 
  ShieldCheck,
  Zap,
  Star,
  Activity,
  Layers,
  Phone
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEstModal, setShowEstModal] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'establishments' | 'riders'>('establishments');
  
  useEffect(() => {
    const user = db.getCurrentUser();
    if (user && user.active) {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'establishment') navigate('/establishment', { replace: true });
      else navigate('/rider', { replace: true });
    }
  }, [navigate]);

  // Form de Motoboy
  const [form, setForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    password: ''
  });

  // Form de Estabelecimento
  const [estForm, setEstForm] = useState({
    establishmentName: '',
    ownerName: '',
    phone: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    email: '',
    password: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data && !data.erro) {
          setEstForm(prev => ({
            ...prev,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }));
        }
      } catch (err) {
        console.warn('Erro ao buscar CEP:', err);
      }
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const allUsers = db.getUsers();
    const duplicateCpf = allUsers.find(u => u.cpf === form.cpf);
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === form.email.toLowerCase());

    if (duplicateCpf) {
      setError('Erro: CPF já cadastrado no sistema.');
      return;
    }
    if (duplicateEmail) {
      setError('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    const newRider: User = {
      id: 'u_' + Date.now(),
      name: form.name,
      cpf: form.cpf,
      phone: form.phone,
      email: form.email,
      role: 'rider',
      active: false,
      passwordHash: form.password
    };

    db.setUsers([...allUsers, newRider]);
    setSuccess(true);
    setForm({ name: '', cpf: '', phone: '', email: '', password: '' });
    
    setTimeout(() => {
      setShowRegisterModal(false);
      setSuccess(false);
    }, 2500);
  };

  const handleEstRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const allUsers = db.getUsers();
    const duplicateEmail = allUsers.find(u => u.email.toLowerCase() === estForm.email.toLowerCase());

    if (duplicateEmail) {
      setError('Erro: E-mail já cadastrado no sistema.');
      return;
    }

    const estId = 'e_' + Date.now();

    const newEst: Establishment = {
      id: estId,
      name: estForm.establishmentName,
      email: estForm.email,
      address: {
        street: estForm.street,
        number: estForm.number,
        complement: '',
        neighborhood: estForm.neighborhood,
        city: estForm.city,
        state: estForm.state,
        zipCode: estForm.zipCode
      },
      phone: estForm.phone,
      active: false
    };

    const newEstUser: User = {
      id: 'u_' + Date.now(),
      name: estForm.ownerName,
      cpf: db.generateUniqueDummyCpf(),
      phone: estForm.phone,
      email: estForm.email,
      role: 'establishment',
      active: false,
      passwordHash: estForm.password,
      establishmentId: estId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const formattedAddress = `${estForm.street}, ${estForm.number} - ${estForm.neighborhood}, ${estForm.city}/${estForm.state}`;
    const newRequest: PartnerRequest = {
      id: 'req_' + Date.now(),
      establishmentName: estForm.establishmentName,
      ownerName: estForm.ownerName,
      phone: estForm.phone,
      address: formattedAddress,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const allEsts = db.getEstablishments();
    db.setEstablishments([...allEsts, newEst]);
    db.setUsers([...allUsers, newEstUser]);

    const allRequests = db.getPartnerRequests();
    db.setPartnerRequests([...allRequests, newRequest]);

    setSuccess(true);
    setEstForm({
      establishmentName: '',
      ownerName: '',
      phone: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      email: '',
      password: ''
    });

    setTimeout(() => {
      setShowEstModal(false);
      setSuccess(false);
    }, 2500);
  };

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent("Olá! Gostaria de saber mais sobre o MotoHub para o meu negócio.");
    window.open(`https://wa.me/5583988623431?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative selection:bg-indigo-600 selection:text-white">
      
      {/* Background Soft Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] overflow-hidden pointer-events-none opacity-60">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
      </div>

      {/* Header / Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <img src="/logo.png" alt="MotoHub Logo" className="h-11 w-11 object-contain rounded-2xl shadow-md ring-1 ring-slate-200 group-hover:scale-105 transition-transform" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                MotoHub <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase font-mono font-bold tracking-wider">Delivery</span>
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">Gestão & Rastreamento em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center space-x-1.5 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border border-slate-200"
            >
              <LogIn className="h-4 w-4 text-indigo-600" />
              <span>Entrar</span>
            </button>
            <button 
              onClick={() => setShowEstModal(true)}
              className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border border-emerald-300 shadow-sm"
            >
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span>Seja Parceiro</span>
            </button>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden xs:inline">Quero ser</span> Entregador
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Lado Esquerdo */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Plataforma Inteligente de Escalas e Delivery</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-slate-900">
              Controle Total de <span className="text-indigo-600">Escalas & Entregas</span> em Tempo Real
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Conecte estabelecimentos gastronômicos a motoboys qualificados com rastreamento GPS contínuo, roteirização inteligente com menor percurso, link para cliente e fechamento financeiro transparente.
            </p>

            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3.5 pt-2">
              <button 
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-600/25 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Bike className="h-5 w-5" />
                <span>Cadastrar como Entregador</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
              
              <button 
                onClick={() => setShowEstModal(true)}
                className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 text-slate-800 px-6 py-4 rounded-2xl font-bold text-sm transition-all border border-slate-300 shadow-sm hover:border-slate-400"
              >
                <Building2 className="h-5 w-5 text-emerald-600" />
                <span>Cadastrar Estabelecimento</span>
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Sem Conflitos de Escala</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>GPS Ativo em Segundo Plano</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Link Direto para o Cliente</span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Card Mockup Refinado Claro */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <Activity className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-black text-slate-800">Painel Operacional</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  GPS ATIVO • AO VIVO
                </span>
              </div>

              <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 border border-indigo-100 p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      Em Entrega
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-base mt-1.5">Pedido #1042</h4>
                    <p className="text-xs text-slate-600">Hamburgueria Burgrill • Bodocongó</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-medium">Previsão</span>
                    <span className="text-base font-black text-emerald-600">6 min</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden p-0.5">
                    <div className="bg-gradient-to-r from-emerald-500 to-indigo-600 h-full w-3/4 rounded-full transition-all duration-500" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Saída: 19:15</span>
                    <span className="text-emerald-700 font-bold">75% Concluído</span>
                    <span>Chegada: 19:21</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Marcos Silva</p>
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Honda CG 160 • Online
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Hoje</p>
                  <p className="text-xs font-black text-emerald-600">12 Corridas</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                  <Compass className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700">Menor Rota 2-Opt</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700">Chat em Tempo Real</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Metrics Bar */}
      <section className="bg-white border-b border-slate-200 py-8 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">100%</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sincronização em Tempo Real</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">0 Conflitos</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Validação Automática de Escalas</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight">2 Horas</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Rastreio Ativo para o Cliente</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">Otimizado</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Menor Percurso Garantido</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Feito sob medida para toda a operação
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Escolha seu perfil e descubra como o MotoHub simplifica sua rotina diária:
            </p>

            <div className="flex justify-center pt-2">
              <div className="bg-slate-200/80 p-1.5 rounded-2xl border border-slate-200 flex items-center space-x-1 shadow-xs">
                <button
                  onClick={() => setActiveFeatureTab('establishments')}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 ${
                    activeFeatureTab === 'establishments'
                      ? 'bg-white text-indigo-700 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span>Para Estabelecimentos</span>
                </button>
                <button
                  onClick={() => setActiveFeatureTab('riders')}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 ${
                    activeFeatureTab === 'riders'
                      ? 'bg-white text-indigo-700 shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bike className="h-4 w-4" />
                  <span>Para Entregadores</span>
                </button>
              </div>
            </div>
          </div>

          {activeFeatureTab === 'establishments' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 hover:border-indigo-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit border border-indigo-100 group-hover:scale-110 transition-transform">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Central de Rastreamento ao Vivo</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Acompanhe exatamente onde os motoboys escalados para a sua loja estão no mapa, garantindo despachos mais rápidos e previsíveis.
                </p>
              </div>

              <div className="bg-white border border-slate-200 hover:border-emerald-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit border border-emerald-100 group-hover:scale-110 transition-transform">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Link de Rastreio para o Cliente</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Gere com um clique um link exclusivo para o cliente acompanhar o entregador chegando na porta de casa por até 2 horas.
                </p>
              </div>

              <div className="bg-white border border-slate-200 hover:border-purple-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl w-fit border border-purple-100 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Lançamento em Lote & Fechamento</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Lance dezenas de entregas simultaneamente e tenha o fechamento financeiro do turno por motoboy pronto sem planilhas confusas.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 hover:border-indigo-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit border border-indigo-100 group-hover:scale-110 transition-transform">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Navegador GPS Integrado</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Digite ou fale os endereços das entregas e deixe o algoritmo calcular automaticamente a ordem mais curta para você economizar tempo e combustível.
                </p>
              </div>

              <div className="bg-white border border-slate-200 hover:border-emerald-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit border border-emerald-100 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Escalas Claras dos Próximos 30 Dias</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Veja exatamente em quais lojas e turnos você trabalhará, com endereço completo, horários de início e término e avisos de alteração.
                </p>
              </div>

              <div className="bg-white border border-slate-200 hover:border-amber-300 p-6 rounded-3xl space-y-3.5 transition-all shadow-sm hover:shadow-md group">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit border border-amber-100 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Faturamento Transparente em Tempo Real</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Acompanhe seus ganhos acumulados por dia e turno na hora, sem surpresas no momento de receber seus pagamentos.
                </p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 border-y border-slate-200 py-16 sm:py-20 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-5 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 px-3.5 py-1 rounded-full text-xs font-bold border border-emerald-300 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
            <span>Atendimento Direto & Rápido</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Pronto para acelerar suas entregas?</h2>
          <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Fale diretamente com nossa equipe no WhatsApp para tirar dúvidas, fechar parcerias ou criar sua conta hoje mesmo!
          </p>

          <button
            onClick={handleWhatsAppContact}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-600/25 hover:scale-105"
          >
            <MessageSquare className="h-5 w-5" />
            <span>Falar com Administrador no WhatsApp</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white text-slate-500 py-10 mt-auto border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-2.5">
            <img src="/logo.png" alt="MotoHub Logo" className="h-6 w-6 object-contain rounded-lg" />
            <span className="font-bold text-slate-800 text-sm">MotoHub Delivery</span>
          </div>
          
          <p>&copy; {new Date().getFullYear()} MotoHub Delivery. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      <button
        onClick={handleWhatsAppContact}
        className="fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 z-50 flex items-center justify-center border-2 border-white shadow-emerald-500/30"
        title="Fale Conosco no WhatsApp"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* MODAL DE CADASTRO DE MOTOBOY */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Cadastro de Entregador</h3>
                  <p className="text-[11px] text-slate-500">Junte-se à nossa rede de motoqueiros</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowRegisterModal(false); setError(''); setSuccess(false); }} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-700 font-bold">
                {error}
              </div>
            )}

            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center space-y-2">
                <ShieldCheck className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">Cadastro Enviado com Sucesso!</h4>
                <p className="text-xs text-emerald-800">
                  Seus dados foram salvos. O administrador irá aprovar sua conta em breve para liberar seu acesso.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">CPF</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="(83) 99999-9999"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="joao@gmail.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
                  >
                    Concluir Cadastro
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE ESTABELECIMENTO */}
      {showEstModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Seja um Parceiro</h3>
                  <p className="text-[11px] text-slate-500">Cadastre seu restaurante ou loja</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowEstModal(false); setError(''); setSuccess(false); }} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-700 font-bold">
                {error}
              </div>
            )}

            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center space-y-2">
                <UserCheck className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">Solicitação Enviada!</h4>
                <p className="text-xs text-emerald-800">
                  Seus dados foram enviados. O administrador liberará seu acesso para você gerenciar seus entregadores.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEstRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nome do Estabelecimento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hamburgueria Burgrill"
                    value={estForm.establishmentName}
                    onChange={(e) => setEstForm({ ...estForm, establishmentName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Nome do Gerente</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos"
                      value={estForm.ownerName}
                      onChange={(e) => setEstForm({ ...estForm, ownerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Telefone WhatsApp</label>
                    <input
                      type="text"
                      required
                      placeholder="(83) 99999-9999"
                      value={estForm.phone}
                      onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Endereço da Loja</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-700 uppercase mb-1">CEP</label>
                      <input
                        type="text"
                        required
                        placeholder="58429-900"
                        value={estForm.zipCode}
                        onChange={(e) => setEstForm({ ...estForm, zipCode: e.target.value })}
                        onBlur={handleCepBlur}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Número</label>
                      <input
                        type="text"
                        required
                        placeholder="100"
                        value={estForm.number}
                        onChange={(e) => setEstForm({ ...estForm, number: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Rua / Bairro</label>
                    <input
                      type="text"
                      required
                      placeholder="Rua Aprígio Veloso, Bodocongó"
                      value={estForm.street}
                      onChange={(e) => setEstForm({ ...estForm, street: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Credenciais de Login</p>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">E-mail de Acesso</label>
                    <input
                      type="email"
                      required
                      placeholder="gerente@burgrill.com"
                      value={estForm.email}
                      onChange={(e) => setEstForm({ ...estForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Senha</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={estForm.password}
                      onChange={(e) => setEstForm({ ...estForm, password: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEstModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm"
                  >
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}