package com.motohub.delivery;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ⚠️ CRÍTICO: Registrar plugins ANTES do super.onCreate()
        registerPlugin(GpsTrackingPlugin.class);
        registerPlugin(NotificationPlugin.class);
        registerPlugin(BatteryOptimizationPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // ⚡ MANTER TELA SEMPRE LIGADA quando app está aberto
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        android.util.Log.d("MainActivity", "✅ FLAG_KEEP_SCREEN_ON ativado - tela não vai descansar");
    }
    @Override
    public void onDestroy() {
        // Liberar flag ao fechar app
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onDestroy();
    }
}
