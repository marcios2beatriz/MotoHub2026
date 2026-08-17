"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User, PartnerRequest, Establishment } from '../utils/db';
import { 
  Bike, 
  Shield, 
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
  Zap,
  TrendingUp,
  Share2,
  Phone,
  Mail,
  Lock,
  Sparkles,
  ChevronRight,
  ShieldCheck
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

  // Form de Estabelecimento Desmembrado
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
  const [loadingCep, setLoadingCep] = useState(false);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      setLoadingCep(true);
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
      } finally {
        setLoadingCep(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-indigo-500 selection:text-white">
      
      {/* Glow Ambient Highlights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
              <Bike className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight flex items-center gap-1">
                MotoHub <span className="text-indigo-400 text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/60 uppercase font-mono">PRO</span>
              </span>
              <p className="text-[10px] text-slate-400 hidden sm:block font-medium tracking-wide">Gestão & Rastreamento em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center space-x-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border border-transparent hover:border-slate-700"
            >
              <LogIn className="h-4 w-4 text-indigo-400" />
              <span>Entrar</span>
            </button>
            <button 
              onClick={() => setShowEstModal(true)}
              className="hidden sm:flex items-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all border border-emerald-500/30 shadow-sm"
            >
              <Building2 className="h-4 w-4 text-emerald-400" />
              <span>Seja Parceiro</span>
            </button>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-indigo-600/30 border border-indigo-400/30"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden xs:inline">Quero ser</span> Entregador
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-28 overflow-hidden border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Lado Esquerdo: Textos & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 shadow-inner">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Plataforma Inteligente de Escalas e Delivery</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Controle Total de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-emerald-400">Escalas & Entregas</span> em Tempo Real
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Conecte estabelecimentos gastronômicos a motoboys qualificados com rastreamento GPS contínuo, roteirização com menor percurso, link para cliente e fechamento financeiro transparente.
            </p>

            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3.5 pt-2">
              <button 
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center justify-center space-x-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white px-7 py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-600/30 hover:scale-[1.02] border border-indigo-300/30"
              >
                <Bike className="h-5 w-5" />
                <span>Cadastrar como Entregador</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
              
              <button 
                onClick={() => setShowEstModal(true)}
                className="flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white px-6 py-4 rounded-2xl font-bold text-sm transition-all border border-slate-700 hover:border-slate-600 shadow-md"
              >
                <Building2 className="h-5 w-5 text-emerald-400" />
                <span>Cadastrar Estabelecimento</span>
              </button>
            </div>

            {/* Micro badges de garantia */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Sem Conflitos de Escala</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>GPS Ativo em Segundo Plano</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Link Direto para o Cliente</span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Mockup Interativo Visual */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-3xl blur-xl opacity-30 animate-pulse" />
              
              <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                
                {/* Header Mock Card */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    GPS LIVE • MTO-1042
                  </span>
                </div>

                {/* Pedido Ativo Simulação */}
                <div className="bg-gradient-to-br from-indigo-950/80 to-slate-950 border border-indigo-800/40 p-4 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-900/60 px-2 py-0.5 rounded-full">
                        Em Trânsito
                      </span>
                      <h4 className="font-extrabold text-white text-base mt-1">Pedido #1042</h4>
                      <p className="text-xs text-slate-400">Hamburgueria Burgrill • Bodocongó</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Previsão</span>
                      <span className="text-base font-black text-emerald-400">6 min</span>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full w-3/4 rounded-full animate-pulse" />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Saída: 19:15</span>
                      <span className="text-emerald-400 font-bold">75% Concluído</span>
                      <span>Chegada: 19:21</span>
                    </div>
                  </div>
                </div>

                {/* Status Entregador */}
                <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                      M
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Marcos Silva</p>
                      <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Honda CG 160 • Online
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Hoje</p>
                    <p className="text-xs font-black text-emerald-400">12 Corridas</p>
                  </div>
                </div>

                {/* Features Mini Pills */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center gap-2">
                    <Compass className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-slate-300">Roteirização 2-Opt</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-slate-300">Chat em Tempo Real</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Metrics Bar */}
      <section className="bg-slate-900 border-b border-slate-800/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">100%</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sincronização em Tempo Real</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">0 Conflitos</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Validação Automática de Escalas</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight">2 Horas</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rastreio Ativo para o Cliente</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">2-Opt Pro</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Menor Percurso Garantido</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Section */}
      <section className="py-16 sm:py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Feito sob medida para toda a operação
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Escolha seu perfil e descubra como o MotoHub simplifica sua rotina diária:
            </p>

            {/* Toggle Tabs */}
            <div className="flex justify-center pt-4">
              <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex items-center space-x-1 shadow-lg">
                <button
                  onClick={() => setActiveFeatureTab('establishments')}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 ${
                    activeFeatureTab === 'establishments'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span>Para Estabelecimentos</span>
                </button>
                <button
                  onClick={() => setActiveFeatureTab('riders')}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 ${
                    activeFeatureTab === 'riders'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bike className="h-4 w-4" />
                  <span>Para Entregadores</span>
                </button>
              </div>
            </div>
          </div>

          {/* Conteúdo Dinâmico das Abas */}
          {activeFeatureTab === 'establishments' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl w-fit border border-indigo-500/20">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Central de Rastreamento ao Vivo</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Acompanhe exatamente onde os motoboys escalados para a sua loja estão no mapa, garantindo despachos mais rápidos e previsíveis.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl w-fit border border-emerald-500/20">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Link de Rastreio para o Cliente</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Gere com um clique um link exclusivo para o cliente acompanhar o entregador chegando na porta de casa por até 2 horas.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-purple-600/10 text-purple-400 rounded-2xl w-fit border border-purple-500/20">
                  <DollarSign className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Lançamento em Lote & Fechamento</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Lance dezenas de entregas simultaneamente e tenha o fechamento financeiro do turno por motoboy pronto sem planilhas confusas.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl w-fit border border-indigo-500/20">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Navegador GPS Integrado</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Digite ou fale os endereços das entregas e deixe o algoritmo 2-Opt calcular automaticamente a ordem mais curta para você economizar gasolina.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl w-fit border border-emerald-500/20">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Escalas Claras para os Próximos 30 Dias</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Veja exatamente em quais lojas e turnos você trabalhará, com endereço completo, horários de início e término e avisos de alteração.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-6 rounded-3xl space-y-3 transition-all">
                <div className="p-3 bg-amber-600/10 text-amber-400 rounded-2xl w-fit border border-amber-500/20">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Faturamento Transparente em Tempo Real</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Acompanhe seus ganhos acumulados por dia e turno na hora, sem surpresas no momento de receber seus pagamentos.
                </p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border-y border-emerald-900/40 py-14 sm:py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-emerald-900/60 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-emerald-700/50">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Atendimento Rápido e Descomplicado</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white">Pronto para acelerar suas entregas?</h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Fale diretamente com nossa equipe no WhatsApp para tirar dúvidas, fechar parcerias ou tirar sua conta do papel hoje mesmo!
          </p>

          <button
            onClick={handleWhatsAppContact}
            className="inline-flex items-center space-x-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-emerald-500/20 hover:scale-105"
          >
            <MessageSquare className="h-5 w-5 text-slate-950" />
            <span>Falar com Administrador no WhatsApp</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-10 mt-auto border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Bike className="h-4 w-4" />
            </div>
            <span className="font-bold text-white text-sm">MotoHub Delivery</span>
          </div>
          
          <p>&copy; {new Date().getFullYear()} MotoHub Delivery. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      <button
        onClick={handleWhatsAppContact}
        className="fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-full shadow-2xl transition-all hover:scale-110 z-50 flex items-center justify-center border-2 border-white/20"
        title="Fale Conosco no WhatsApp"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* MODAL DE CADASTRO DE MOTOBOY */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-800 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Cadastro de Entregador</h3>
                  <p className="text-[11px] text-slate-400">Junte-se à nossa rede de motoqueiros</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowRegisterModal(false); setError(''); setSuccess(false); }} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-950/80 border border-red-800 p-3 rounded-xl text-xs text-red-300 font-bold">
                {error}
              </div>
            )}

            {success ? (
              <div className="bg-emerald-950/60 border border-emerald-800/80 p-5 rounded-2xl text-center space-y-2">
                <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Cadastro Enviado com Sucesso!</h4>
                <p className="text-xs text-emerald-300">
                  Seus dados foram salvos. O administrador irá aprovar sua conta em breve para liberar seu acesso.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">CPF</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="(83) 99999-9999"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="joao@gmail.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-800 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Seja um Parceiro</h3>
                  <p className="text-[11px] text-slate-400">Cadastre seu restaurante ou loja</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowEstModal(false); setError(''); setSuccess(false); }} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-950/80 border border-red-800 p-3 rounded-xl text-xs text-red-300 font-bold">
                {error}
              </div>
            )}

            {success ? (
              <div className="bg-emerald-950/60 border border-emerald-800/80 p-5 rounded-2xl text-center space-y-2">
                <UserCheck className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Solicitação Enviada!</h4>
                <p className="text-xs text-emerald-300">
                  Seus dados foram enviados. O administrador liberará seu acesso para você gerenciar seus entregadores.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEstRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Nome do Estabelecimento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hamburgueria Burgrill"
                    value={estForm.establishmentName}
                    onChange={(e) => setEstForm({ ...estForm, establishmentName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-400 uppercase mb-1">Nome do Gerente</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos"
                      value={estForm.ownerName}
                      onChange={(e) => setEstForm({ ...estForm, ownerName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-400 uppercase mb-1">Telefone WhatsApp</label>
                    <input
                      type="text"
                      required
                      placeholder="(83) 99999-9999"
                      value={estForm.phone}
                      onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">Endereço da Loja</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-400 uppercase mb-1">CEP</label>
                      <input
                        type="text"
                        required
                        placeholder="58429-900"
                        value={estForm.zipCode}
                        onChange={(e) => setEstForm({ ...estForm, zipCode: e.target.value })}
                        onBlur={handleCepBlur}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-400 uppercase mb-1">Número</label>
                      <input
                        type="text"
                        required
                        placeholder="100"
                        value={estForm.number}
                        onChange={(e) => setEstForm({ ...estForm, number: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-400 uppercase mb-1">Rua / Bairro</label>
                    <input
                      type="text"
                      required
                      placeholder="Rua Aprígio Veloso, Bodocongó"
                      value={estForm.street}
                      onChange={(e) => setEstForm({ ...estForm, street: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">Credenciais de Login</p>
                  <div>
                    <label className="block font-bold text-slate-400 uppercase mb-1">E-mail de Acesso</label>
                    <input
                      type="email"
                      required
                      placeholder="gerente@burgrill.com"
                      value={estForm.email}
                      onChange={(e) => setEstForm({ ...estForm, email: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-400 uppercase mb-1">Senha</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={estForm.password}
                      onChange={(e) => setEstForm({ ...estForm, password: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEstModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg"
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