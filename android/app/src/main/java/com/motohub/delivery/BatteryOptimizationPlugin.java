package com.motohub.delivery;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin para verificar e solicitar whitelist de otimização de bateria
 * Essencial para GPS em background funcionar perfeitamente
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {
    
    @PluginMethod
    public void check(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) 
                getContext().getSystemService(getContext().POWER_SERVICE);
            
            if (pm != null) {
                boolean isWhitelisted = pm.isIgnoringBatteryOptimizations(
                    getContext().getPackageName()
                );
                
                android.util.Log.d("BatteryOptimizationPlugin", 
                    "isWhitelisted: " + isWhitelisted);
                
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("isWhitelisted", isWhitelisted);
                ret.put("message", isWhitelisted ? 
                    "App está otimizado para GPS em background" : 
                    "App precisa de permissão para GPS funcionar em background");
                call.resolve(ret);
                return;
            }
        }
        
        // Android < M ou erro
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("isWhitelisted", true);
        ret.put("message", "Não precisa de whitelist nesta versão do Android");
        call.resolve(ret);
    }
    
    @PluginMethod
    public void request(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) 
                getContext().getSystemService(getContext().POWER_SERVICE);
            
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                android.util.Log.d("BatteryOptimizationPlugin", 
                    "Launching BatteryOptimizationActivity");
                
                try {
                    Intent intent = new Intent(getContext(), BatteryOptimizationActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("success", true);
                    ret.put("message", "Solicitação de whitelist iniciada");
                    call.resolve(ret);
                    
                } catch (Exception e) {
                    android.util.Log.e("BatteryOptimizationPlugin", 
                        "Erro ao abrir activity: " + e.getMessage());
                    call.reject("Erro ao solicitar whitelist: " + e.getMessage());
                }
                
            } else {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("message", "App já está na whitelist");
                call.resolve(ret);
            }
        } else {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("message", "Não precisa de whitelist nesta versão do Android");
            call.resolve(ret);
        }
    }
}
