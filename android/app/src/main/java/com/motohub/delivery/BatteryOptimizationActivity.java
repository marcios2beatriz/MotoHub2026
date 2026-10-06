package com.motohub.delivery;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

/**
 * Activity para solicitar ao usuário desabilitar otimizações de bateria
 * Isso é o que iFood, Uber, 99 fazem para garantir GPS em background!
 */
public class BatteryOptimizationActivity extends Activity {
    
    private static final String TAG = "BatteryOptimization";
    private static final int REQUEST_CODE = 1234;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "BatteryOptimizationActivity started");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Log.d(TAG, "App NÃO está na whitelist - solicitando ao usuário");
                
                try {
                    // Solicitar ao usuário para adicionar app na whitelist
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivityForResult(intent, REQUEST_CODE);
                    
                    Log.d(TAG, "✅ Intent lançado com sucesso");
                    
                } catch (Exception e) {
                    Log.e(TAG, "❌ Erro ao solicitar whitelist: " + e.getMessage());
                    e.printStackTrace();
                    
                    // Fallback: abrir configurações gerais de bateria
                    try {
                        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        startActivity(intent);
                        finish();
                    } catch (Exception e2) {
                        Log.e(TAG, "❌ Erro no fallback: " + e2.getMessage());
                        finish();
                    }
                }
                
            } else {
                Log.d(TAG, "✅ App JÁ está na whitelist - nada a fazer");
                finish();
            }
        } else {
            Log.d(TAG, "Android < M - não precisa de whitelist");
            finish();
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                
                if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Log.d(TAG, "✅✅✅ SUCESSO! App agora está na whitelist!");
                    Log.d(TAG, "GPS em background agora deve funcionar perfeitamente!");
                } else {
                    Log.w(TAG, "⚠️ Usuário recusou adicionar na whitelist");
                    Log.w(TAG, "GPS pode parar em background");
                }
            }
        }
        
        finish();
    }
}
