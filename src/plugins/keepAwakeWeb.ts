import { WebPlugin } from '@capacitor/core';
import type { KeepAwakePlugin } from './keepAwake';

export class KeepAwakeWeb extends WebPlugin implements KeepAwakePlugin {
  private wakeLock: any = null;

  async keepAwake(): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('⚡ Wake Lock ativado (web)');
      } catch (err) {
        console.error('Erro ao ativar wake lock:', err);
      }
    }
  }

  async allowSleep(): Promise<void> {
    if (this.wakeLock !== null) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('⚡ Wake Lock desativado (web)');
      } catch (err) {
        console.error('Erro ao desativar wake lock:', err);
      }
    }
  }

  async isKeptAwake(): Promise<{ isKeptAwake: boolean }> {
    return { isKeptAwake: this.wakeLock !== null };
  }

  async keepAwakeDimmed(): Promise<void> {
    // Web não suporta dimmed, usa normal
    return this.keepAwake();
  }
}
