"use client";

import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import RiderDashboard from './pages/RiderDashboard';
import EstablishmentDashboard from './pages/EstablishmentDashboard';
import CustomerTracking from './pages/CustomerTracking';
import { db } from './utils/db';
import { requestNotificationPermission } from './utils/notifications';

// Componente para gerenciar a sincronização e permissões iniciais
function AppHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Puxar dados do Supabase na inicialização
    db.pullFromSupabase();

    // Solicitar permissão de notificações logo no início
    requestNotificationPermission();

    // Ouvir retomada do aplicativo em primeiro plano no Android/iOS
    let resumeListener: any = null;
    if (Capacitor.isNativePlatform()) {
      resumeListener = CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          db.pullFromSupabase();
        }
      });
    }

    // Sincronização periódica a cada 5 segundos para manter os dados atualizados em tempo real
    const syncInterval = setInterval(() => {
      const currentUser = db.getCurrentUser();
      if (currentUser) {
        db.pullFromSupabase();
      }
    }, 5000);

    return () => {
      clearInterval(syncInterval);
      if (resumeListener) {
        resumeListener.then((l: any) => l.remove()).catch(() => {});
      }
    };
  }, [navigate]);

  return <>{children}</>;
}

// Rota Protegida para Administrador
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    alert('Acesso negado. Esta área é restrita para administradores.');
    return <Navigate to={user.role === 'establishment' ? '/establishment' : '/rider'} replace />;
  }
  return <>{children}</>;
}

// Rota Protegida para Motoboy
function RiderRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'rider') {
    alert('Acesso negado. Esta área é restrita para motoboys.');
    return <Navigate to={user.role === 'establishment' ? '/establishment' : '/admin'} replace />;
  }
  return <>{children}</>;
}

// Rota Protegida para Estabelecimento
function EstablishmentRoute({ children }: { children: React.ReactNode }) {
  const user = db.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'establishment') {
    alert('Acesso negado. Esta área é restrita para estabelecimentos.');
    return <Navigate to={user.role === 'rider' ? '/rider' : '/admin'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AppHandler>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/track/:deliveryId" element={<CustomerTracking />} />
          
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          
          <Route 
            path="/rider" 
            element={
              <RiderRoute>
                <RiderDashboard />
              </RiderRoute>
            } 
          />

          <Route 
            path="/establishment" 
            element={
              <EstablishmentRoute>
                <EstablishmentDashboard />
              </EstablishmentRoute>
            } 
          />

          {/* Redirecionamento padrão */}
          <Route 
            path="*" 
            element={
              <Navigate 
                to={
                  db.getCurrentUser()?.role === 'admin' 
                    ? '/admin' 
                    : db.getCurrentUser()?.role === 'establishment'
                      ? '/establishment'
                      : '/rider'
                } 
                replace 
              />
            } 
          />
        </Routes>
      </AppHandler>
    </Router>
  );
}