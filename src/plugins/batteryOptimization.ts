import { registerPlugin } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  /**
   * Verifica se o app está na whitelist de otimização de bateria
   */
  check(): Promise<{ isWhitelisted: boolean; message: string }>;
  
  /**
   * Solicita ao usuário para adicionar app na whitelist
   * CRÍTICO: Isso é o que iFood, Uber, 99 fazem!
   */
  request(): Promise<{ success: boolean; message: string }>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

export default BatteryOptimization;
