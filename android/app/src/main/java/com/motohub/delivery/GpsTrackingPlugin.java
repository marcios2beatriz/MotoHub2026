package com.motohub.delivery;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Plugin Capacitor para controlar o GpsTrackingService
 * Permite iniciar/parar o foreground service do JavaScript
 */
@CapacitorPlugin(
    name = "GpsTracking",
    permissions = {
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        }),
        @Permission(alias = "backgroundLocation", strings = {
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        }),
        @Permission(alias = "notifications", strings = {
            Manifest.permission.POST_NOTIFICATIONS
        })
    }
)
public class GpsTrackingPlugin extends Plugin {
    
    private BroadcastReceiver locationReceiver;
    private boolean isReceiverRegistered = false;
    private PluginCall savedStartCall = null;
    
    @Override
    public void load() {
        super.load();
        setupLocationReceiver();
    }
    
    private void setupLocationReceiver() {
        locationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("GPS_LOCATION_UPDATE".equals(intent.getAction())) {
                    JSObject location = new JSObject();
                    location.put("latitude", intent.getDoubleExtra("latitude", 0));
                    location.put("longitude", intent.getDoubleExtra("longitude", 0));
                    location.put("accuracy", intent.getDoubleExtra("accuracy", 0));
                    location.put("speed", intent.getDoubleExtra("speed", 0));
                    location.put("bearing", intent.getDoubleExtra("bearing", 0));
                    location.put("timestamp", intent.getLongExtra("timestamp", 0));
                    
                    notifyListeners("locationUpdate", location);
                }
            }
        };
    }
    
    @PluginMethod
    public void startTracking(PluginCall call) {
        android.util.Log.d("GpsTrackingPlugin", "startTracking() called");
        
        // Verificar permissões de localização
        if (!hasLocationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Location permission missing, requesting...");
            savedStartCall = call;
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        
        // Android 10+ precisa de ACCESS_BACKGROUND_LOCATION
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Background location permission missing, requesting...");
            savedStartCall = call;
            requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermissionCallback");
            return;
        }
        
        // Android 13+ precisa de POST_NOTIFICATIONS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Notification permission missing, requesting...");
            savedStartCall = call;
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            return;
        }
        
        // Todas as permissões concedidas, iniciar serviço
        startGpsService(call);
    }
    
    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (hasLocationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Location permission granted");
            // Verificar próxima permissão
            startTracking(call);
        } else {
            android.util.Log.e("GpsTrackingPlugin", "Location permission denied");
            call.reject("Location permission denied. Please enable location access in settings.");
        }
    }
    
    @PermissionCallback
    private void backgroundLocationPermissionCallback(PluginCall call) {
        if (hasBackgroundLocationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Background location permission granted");
            // Verificar próxima permissão
            startTracking(call);
        } else {
            android.util.Log.e("GpsTrackingPlugin", "Background location permission denied");
            call.reject("Background location permission denied. GPS tracking may not work when app is minimized.");
            // Continuar mesmo assim para versões antigas
            startGpsService(call);
        }
    }
    
    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        if (hasNotificationPermission()) {
            android.util.Log.d("GpsTrackingPlugin", "Notification permission granted");
            startGpsService(call);
        } else {
            android.util.Log.e("GpsTrackingPlugin", "Notification permission denied");
            call.reject("Notification permission denied. GPS tracking notification won't appear.");
            // Tentar iniciar mesmo assim
            startGpsService(call);
        }
    }
    
    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }
    
    private boolean hasBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return true; // Não necessário em versões antigas
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }
    
    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true; // Não necessário em versões antigas
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }
    
    private void startGpsService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, GpsTrackingService.class);
        
        android.util.Log.d("GpsTrackingPlugin", "Starting GPS service with all permissions granted");
        
        try {
            // Registrar receiver se ainda não foi
            if (!isReceiverRegistered) {
                IntentFilter filter = new IntentFilter("GPS_LOCATION_UPDATE");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    context.registerReceiver(locationReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
                } else {
                    context.registerReceiver(locationReceiver, filter);
                }
                isReceiverRegistered = true;
                android.util.Log.d("GpsTrackingPlugin", "Location receiver registered");
            }
            
            // Iniciar foreground service
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.util.Log.d("GpsTrackingPlugin", "Starting foreground service (Android 8+)");
                context.startForegroundService(serviceIntent);
            } else {
                android.util.Log.d("GpsTrackingPlugin", "Starting service (Android <8)");
                context.startService(serviceIntent);
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "GPS tracking started successfully with all permissions");
            call.resolve(result);
            
            android.util.Log.d("GpsTrackingPlugin", "✅ GPS tracking started successfully!");
            
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingPlugin", "❌ Failed to start GPS service: " + e.getMessage());
            e.printStackTrace();
            call.reject("Failed to start GPS tracking: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void stopTracking(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, GpsTrackingService.class);
        
        try {
            context.stopService(serviceIntent);
            
            // Desregistrar receiver
            if (isReceiverRegistered) {
                context.unregisterReceiver(locationReceiver);
                isReceiverRegistered = false;
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "GPS tracking stopped");
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to stop GPS tracking: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isTracking", isReceiverRegistered);
        call.resolve(result);
    }
    
    @Override
    protected void handleOnDestroy() {
        if (isReceiverRegistered) {
            try {
                getContext().unregisterReceiver(locationReceiver);
                isReceiverRegistered = false;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        super.handleOnDestroy();
    }
}
