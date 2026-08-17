"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User } from '../utils/db';
import { Lock, Mail, AlertTriangle, ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck, Sparkles, Bike } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = db.getCurrentUser();
    if (user && user.active) {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'establishment') navigate('/establishment', { replace: true });
      else navigate('/rider', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      let user: User | null | undefined = await db.fetchUserByEmail(cleanEmail);

      if (!user) {
        await db.pullFromSupabase();
        const users = db.getUsers();
        user = users.find(u => u.email.toLowerCase() === cleanEmail);
      }

      if (user) {
        if (user.passwordHash !== cleanPassword) {
          setError('Senha incorreta. Verifique os dados digitados.');
          setLoading(false);
          return;
        }

        if (!user.active) {
          setError('Seu cadastro está pendente de aprovação do administrador.');
          setLoading(false);
          return;
        }

        db.setCurrentUser(user);

        if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (user.role === 'establishment') {
          navigate('/establishment', { replace: true });
        } else {
          navigate('/rider', { replace: true });
        }
      } else {
        setError('E-mail não cadastrado no sistema.');
      }
    } catch (err: any) {
      console.warn('Erro ao autenticar:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-12 font-sans relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 bg-slate-900/90 backdrop-blur-2xl border border-slate-800 p-8 rounded-3xl shadow-2xl shadow-slate-950/80 relative z-10 ring-1 ring-slate-700/50">
        
        {/* Botão Voltar */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao início</span>
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <img src="/logo.png" alt="MotoHub Logo" className="mx-auto h-20 w-20 object-contain rounded-2xl shadow-xl ring-2 ring-indigo-500/30" />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">MotoHub Delivery</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">Entre com suas credenciais de acesso</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-500/40 p-3.5 rounded-2xl flex items-start space-x-2 text-xs text-red-200 font-semibold shadow-inner">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all disabled:opacity-50"
                  placeholder="seuemail@delivery.com"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-4 px-4 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-xl shadow-indigo-600/30 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Verificando credenciais...</span>
              </>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>

        {/* Security badge */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Acesso Seguro & Criptografado</span>
        </div>
      </div>
    </div>
  );
}