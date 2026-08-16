"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, User } from '../utils/db';
import { Lock, Mail, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Proteção: Se já estiver logado, redireciona para o dashboard correto
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

      // 1. Tenta buscar usuário atualizado diretamente no Supabase
      let user: User | null | undefined = await db.fetchUserByEmail(cleanEmail);

      // 2. Se não encontrou na consulta direta, tenta no cache local atualizando pelo pull
      if (!user) {
        await db.pullFromSupabase();
        const users = db.getUsers();
        user = users.find(u => u.email.toLowerCase() === cleanEmail);
      }

      if (user) {
        // Validação da senha
        if (user.passwordHash !== cleanPassword) {
          setError('Senha incorreta. Verifique os dados digitados.');
          setLoading(false);
          return;
        }

        if (!user.active) {
          setError('Seu cadastro está pendente de aprovação do administrador. Aguarde a liberação de acesso.');
          setLoading(false);
          return;
        }

        // Login realizado com sucesso
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 relative pt-12">
        {/* Botão Voltar */}
        <button 
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 flex items-center space-x-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao início</span>
        </button>

        <div className="text-center">
          <div className="mx-auto h-24 w-24 flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="MotoHub Delivery Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">MotoHub Delivery</h2>
          <p className="mt-2 text-sm text-slate-600">Faça login para acessar sua conta</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:bg-slate-50"
                  placeholder="exemplo@delivery.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:bg-slate-50"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all shadow-md hover:shadow-lg"
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
          </div>
        </form>
      </div>
    </div>
  );
}