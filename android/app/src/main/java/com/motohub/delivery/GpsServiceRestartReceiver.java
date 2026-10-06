package com.motohub.delivery;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * Receiver para reiniciar o serviço GPS em caso de:
 * - Device reboot (BOOT_COMPLETED)
 * - App atualizado (MY_PACKAGE_REPLACED)
 * - Sistema matar o serviço
 */
public class GpsServiceRestartReceiver extends BroadcastReceiver {
    
    private static final String TAG = "GpsServiceRestart";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "========================================");
        Log.d(TAG, "Receiver triggered! Action: " + action);
        
        if (action == null) {
            Log.w(TAG, "Action is null, ignoring");
            return;
        }
        
        // Verificar se devemos iniciar o serviço
        boolean shouldStartService = false;
        
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            Log.d(TAG, "✅ Device rebooted - checking if should restart GPS service");
            // Aqui você pode verificar SharedPreferences se o GPS estava ativo antes do reboot
            // Por simplicidade, vamos sempre tentar iniciar após boot
            shouldStartService = true;
            
        } else if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Log.d(TAG, "✅ App updated - restarting GPS service");
            shouldStartService = true;
            
        } else if ("RESTART_GPS_SERVICE".equals(action)) {
            // Action customizada para forçar restart
            Log.d(TAG, "✅ Manual restart requested");
            shouldStartService = true;
        }
        
        if (shouldStartService) {
            try {
                Intent serviceIntent = new Intent(context, GpsTrackingService.class);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Android 8+ requer startForegroundService
                    Log.d(TAG, "Starting service with startForegroundService (Android 8+)");
                    context.startForegroundService(serviceIntent);
                } else {
                    Log.d(TAG, "Starting service with startService (Android < 8)");
                    context.startService(serviceIntent);
                }
                
                Log.d(TAG, "✅ GPS Tracking Service restarted successfully!");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to restart GPS service: " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        Log.d(TAG, "========================================");
    }
}
