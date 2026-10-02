import { registerPlugin } from '@capacitor/core';

export interface KeepAwakePlugin {
  /**
   * Mantém a tela sempre ligada
   */
  keepAwake(): Promise<void>;

  /**
   * Permite que a tela desligue normalmente
   */
  allowSleep(): Promise<void>;

  /**
   * Verifica se keep awake está ativo
   */
  isKeptAwake(): Promise<{ isKeptAwake: boolean }>;

  /**
   * Mantém a tela ligada enquanto estiver carregando (dimmed)
   */
  keepAwakeDimmed(): Promise<void>;
}

const KeepAwake = registerPlugin<KeepAwakePlugin>('KeepAwake', {
  web: () => import('./keepAwakeWeb').then(m => new m.KeepAwakeWeb()),
});

export { KeepAwake };
