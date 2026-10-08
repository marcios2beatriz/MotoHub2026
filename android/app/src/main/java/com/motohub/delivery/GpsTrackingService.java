package com.motohub.delivery;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.Granularity;

// ✅ NOVO: Imports para HTTP e JSON
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Foreground Service para rastreamento GPS contínuo em background
 * Mantém o GPS ativo mesmo com app minimizado ou usando outro app de navegação
 * Inspirado no comportamento do iFood, Uber, 99, etc.
 */
public class GpsTrackingService extends Service {
    
    private static final String CHANNEL_ID = "gps_tracking_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long UPDATE_INTERVAL = 10000; // 10 segundos (otimizado para economizar banco de dados - 70% menos writes)
    private static final long FASTEST_INTERVAL = 5000; // 5 segundos
    private static final float MIN_DISTANCE = 5; // 5 metros
    private static final long GPS_WATCHDOG_INTERVAL = 20000; // 20 segundos (reduzido para detectar problemas mais rápido)
    private static final long WAKELOCK_RENEWAL_INTERVAL = 8 * 60 * 1000; // 8 minutos (renova antes de expirar)
    private static final long LOCATION_REFRESH_INTERVAL = 15000; // 15 segundos - força refresh do GPS
    
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location lastLocation;
    private long lastUpdateTime = 0;
    private long lastGpsCheckTime = 0;
    
    // ✅ NOVO: Flag para controlar se serviço já está rodando
    private boolean isServiceRunning = false;
    
    // ✅ NOVO: Supabase configuration
    private String supabaseUrl;
    private String supabaseKey;
    private String currentUserId;
    private String currentUserName; // ✅ NOVO: Nome do usuário logado
    
    // WakeLock para manter CPU ativa em background
    private android.os.PowerManager.WakeLock wakeLock;
    
    // ✅ NOVO: Handler thread dedicado para location updates
    private android.os.HandlerThread handlerThread;
    private android.os.Handler locationHandler;
    private Runnable gpsWatchdog;
    private Runnable locationRefresher; // ✅ NOVO: Força refresh periódico do GPS
    private Runnable notificationUpdater; // ✅ NOVO: Atualiza notificação constantemente
    
    @Override
    public void onCreate() {
        super.onCreate();
        android.util.Log.d("GpsTrackingService", "onCreate() called");
        
        // ✅ NOVO: Inicializar credenciais do Supabase
        initializeSupabase();
        
        // ✅ CRÍTICO: Solicitar desabilitar otimizações de bateria
        requestIgnoreBatteryOptimizations();
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        setupLocationCallback();
        createNotificationChannel();
        acquireWakeLock();
        
        // ✅ NOVO: Criar thread dedicada para location updates
        handlerThread = new android.os.HandlerThread("GpsLocationThread", 
            android.os.Process.THREAD_PRIORITY_FOREGROUND); // ✅ PRIORIDADE MÁXIMA
        handlerThread.start();
        locationHandler = new android.os.Handler(handlerThread.getLooper());
        
        android.util.Log.d("GpsTrackingService", "Service created with WakeLock and dedicated thread");
    }
    
    /**
     * ✅ NOVO: Solicita ao sistema para ignorar otimizações de bateria
     * Isso é o que iFood, Uber, 99 fazem!
     */
    private void requestIgnoreBatteryOptimizations() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                android.util.Log.w("GpsTrackingService", 
                    "⚠️ App NÃO está na whitelist de bateria - Isso pode causar problemas!");
                android.util.Log.w("GpsTrackingService", 
                    "💡 SOLUÇÃO: Ir em Configurações → Bateria → Otimização de bateria → MotoHub → Não otimizar");
                
                // Não podemos solicitar aqui (precisa ser de uma Activity)
                // Mas podemos logar para avisar o usuário
            } else {
                android.util.Log.d("GpsTrackingService", 
                    "✅ App está na whitelist de bateria - GPS deve funcionar perfeitamente!");
            }
        }
    }
    
    /**
     * ✅ NOVO: Inicializa credenciais do Supabase e pega usuário logado
     */
    private void initializeSupabase() {
        try {
            android.util.Log.d("GpsTrackingService", "🔧 Iniciando initializeSupabase()");
            
            // Pegar credenciais do arquivo de recursos
            supabaseUrl = getString(R.string.supabase_url);
            // ⚠️ MUDANÇA: Usar service_role_key para ter permissão total
            supabaseKey = getString(R.string.supabase_service_key);
            android.util.Log.d("GpsTrackingService", "✅ Credenciais carregadas - URL: " + supabaseUrl.substring(0, 30) + "...");
            
            // ✅ NOVO: Tentar pegar userId e userName de GPS_TRACKING_PREFS primeiro (setado pelo plugin)
            SharedPreferences gpsPrefs = getSharedPreferences("GPS_TRACKING_PREFS", Context.MODE_PRIVATE);
            currentUserId = gpsPrefs.getString("USER_ID", null);
            String currentUserName = gpsPrefs.getString("USER_NAME", null);
            
            if (currentUserId != null && !currentUserId.isEmpty()) {
                android.util.Log.d("GpsTrackingService", "✅ UserId encontrado em GPS_TRACKING_PREFS: " + currentUserId);
                if (currentUserName != null && !currentUserName.isEmpty()) {
                    android.util.Log.d("GpsTrackingService", "✅ UserName encontrado: " + currentUserName);
                    // Salvar nome do usuário em variável de instância
                    this.currentUserName = currentUserName;
                }
            } else {
                android.util.Log.w("GpsTrackingService", "⚠️ UserId não encontrado em GPS_TRACKING_PREFS, tentando CapacitorStorage...");
                
                // Fallback: tentar CapacitorStorage (compatibilidade com código antigo)
                SharedPreferences capPrefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String currentUserJson = capPrefs.getString("currentUser", null);
                
                if (currentUserJson != null && !currentUserJson.isEmpty()) {
                    JSONObject userObj = new JSONObject(currentUserJson);
                    currentUserId = userObj.getString("id");
                    currentUserName = userObj.optString("name", null);
                    if (currentUserName != null && !currentUserName.isEmpty()) {
                        this.currentUserName = currentUserName;
                    }
                    android.util.Log.d("GpsTrackingService", "✅ UserId encontrado em CapacitorStorage: " + currentUserId);
                } else {
                    android.util.Log.e("GpsTrackingService", "❌ UserId não encontrado em nenhum lugar!");
                }
            }
            
            if (currentUserId != null && !currentUserId.isEmpty()) {
                android.util.Log.d("GpsTrackingService", "✅ Supabase inicializado com sucesso para usuário: " + currentUserId + " (" + (this.currentUserName != null ? this.currentUserName : "Nome desconhecido") + ")");
            } else {
                android.util.Log.e("GpsTrackingService", "❌ FALHA: Não foi possível obter userId - GPS NÃO SERÁ SALVO NO SUPABASE");
            }
            
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingService", "❌ Erro ao inicializar Supabase: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * ✅ NOVO: Salva localização diretamente no Supabase (sem depender do JavaScript)
     */
    private void saveLocationToSupabase(Location location) {
        // Executar em thread separada para não bloquear a main thread
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                if (currentUserId == null || currentUserId.isEmpty()) {
                    android.util.Log.w("GpsTrackingService", "⚠️ NÃO SALVANDO: userId está null ou vazio");
                    return;
                }
                
                android.util.Log.d("GpsTrackingService", "💾 Iniciando salvamento no Supabase para userId: " + currentUserId);
                
                // Criar timestamp ISO 8601
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                String timestamp = sdf.format(new Date());
                
                // Montar JSON
                JSONObject json = new JSONObject();
                json.put("rider_id", currentUserId);
                json.put("rider_name", currentUserName != null && !currentUserName.isEmpty() ? currentUserName : "Motoboy"); // ✅ NOVO: Usa nome real ou fallback
                json.put("lat", location.getLatitude());
                json.put("lng", location.getLongitude());
                json.put("updated_at", timestamp);
                
                android.util.Log.d("GpsTrackingService", "📤 JSON preparado: name=" + (currentUserName != null ? currentUserName : "Motoboy") + ", lat=" + location.getLatitude() + ", lng=" + location.getLongitude());
                
                // Fazer requisição HTTP POST
                URL url = new URL(supabaseUrl + "/rest/v1/rider_locations");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000); // 10s timeout
                conn.setReadTimeout(10000);
                
                // Enviar dados
                byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(input, 0, input.length);
                }
                
                // Verificar resposta
                int responseCode = conn.getResponseCode();
                if (responseCode >= 200 && responseCode < 300) {
                    android.util.Log.d("GpsTrackingService", 
                        String.format("✅ Localização salva no Supabase: lat=%.5f, lng=%.5f", 
                            location.getLatitude(), location.getLongitude()));
                } else {
                    android.util.Log.w("GpsTrackingService", 
                        "⚠️ Resposta não-OK do Supabase: " + responseCode);
                }
                
            } catch (Exception e) {
                android.util.Log.e("GpsTrackingService", "❌ Erro ao salvar no Supabase: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }
    
    /**
     * ✅ NOVO: Deleta localização do Supabase quando motoboy faz logout
     * Isso remove o ícone do mapa e economiza recursos do banco de dados
     */
    private void deleteLocationFromSupabase() {
        // Executar em thread separada para não bloquear a main thread
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                if (currentUserId == null || currentUserId.isEmpty()) {
                    android.util.Log.w("GpsTrackingService", "⚠️ NÃO DELETANDO: userId está null ou vazio");
                    return;
                }
                
                android.util.Log.d("GpsTrackingService", "🗑️ Deletando localização do Supabase para userId: " + currentUserId);
                
                // Fazer requisição HTTP DELETE
                URL url = new URL(supabaseUrl + "/rest/v1/rider_locations?rider_id=eq." + currentUserId);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("DELETE");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("apikey", supabaseKey);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                conn.setConnectTimeout(10000); // 10s timeout
                conn.setReadTimeout(10000);
                
                // Verificar resposta
                int responseCode = conn.getResponseCode();
                if (responseCode >= 200 && responseCode < 300) {
                    android.util.Log.d("GpsTrackingService", 
                        "✅ Localização deletada do Supabase - motoboy removido do mapa");
                } else {
                    android.util.Log.w("GpsTrackingService", 
                        "⚠️ Resposta não-OK ao deletar do Supabase: " + responseCode);
                }
                
            } catch (Exception e) {
                android.util.Log.e("GpsTrackingService", "❌ Erro ao deletar do Supabase: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }
    
    /**
     * Adquire WakeLock para manter CPU ativa mesmo com tela apagada
     * Essencial para celulares Vivo/Xiaomi/Samsung
     */
    private void acquireWakeLock() {
        try {
            // Libera WakeLock anterior se existir
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                    android.util.Log.d("GpsTrackingService", "WakeLock anterior liberado");
                } catch (Exception e) {
                    android.util.Log.w("GpsTrackingService", "Erro ao liberar WakeLock antigo: " + e.getMessage());
                }
            }
            
            android.os.PowerManager powerManager = 
                (android.os.PowerManager) getSystemService(POWER_SERVICE);
            
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    android.os.PowerManager.PARTIAL_WAKE_LOCK,
                    "MotoHub::GpsTrackingWakeLock"
                );
                wakeLock.setReferenceCounted(false); // ✅ CRÍTICO: Evita liberação acidental
                
                // ✅ CRÍTICO: Timeout de 10 minutos, mas será renovado antes de expirar
                // Usar timeout infinito pode ser bloqueado por alguns fabricantes
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutos
                android.util.Log.d("GpsTrackingService", "✅ WakeLock acquired with 10min timeout");
                
                // Agendar renovação automática do WakeLock a cada 8 minutos (antes de expirar)
                scheduleWakeLockRenewal();
            }
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingService", "❌ Failed to acquire WakeLock: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Renova o WakeLock periodicamente para evitar expiração
     */
    private void scheduleWakeLockRenewal() {
        if (locationHandler != null) {
            // Cancelar renovações anteriores
            locationHandler.removeCallbacksAndMessages("WAKELOCK_RENEWAL");
            
            locationHandler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (wakeLock != null) {
                        boolean wasHeld = wakeLock.isHeld();
                        android.util.Log.d("GpsTrackingService", 
                            "🔄 WakeLock renewal - was held: " + wasHeld);
                        
                        // Sempre readquire, mesmo se não estava held
                        acquireWakeLock();
                    }
                }
            }, WAKELOCK_RENEWAL_INTERVAL);
            
            android.util.Log.d("GpsTrackingService", 
                "✅ WakeLock renewal agendada para " + (WAKELOCK_RENEWAL_INTERVAL/1000/60) + " minutos");
        }
    }
    
    /**
     * GPS Watchdog - Verifica se GPS está rodando e reativa se necessário
     * CRÍTICO: Resolve problema do GPS parar silenciosamente
     */
    private void startGpsWatchdog() {
        gpsWatchdog = new Runnable() {
            @Override
            public void run() {
                long now = System.currentTimeMillis();
                long timeSinceLastGps = now - lastGpsCheckTime;
                
                android.util.Log.d("GpsTrackingService", 
                    "🔍 GPS WATCHDOG CHECK - Last GPS: " + (timeSinceLastGps/1000) + "s ago");
                
                // Verificar estado do WakeLock
                if (wakeLock != null) {
                    boolean wakeLockHeld = wakeLock.isHeld();
                    android.util.Log.d("GpsTrackingService", 
                        "🔋 WakeLock status: " + (wakeLockHeld ? "HELD ✅" : "NOT HELD ⚠️"));
                    
                    if (!wakeLockHeld) {
                        android.util.Log.w("GpsTrackingService", "⚠️ WakeLock perdido! Reacquirindo...");
                        acquireWakeLock();
                    }
                }
                
                // Se não recebeu GPS por mais de 45 segundos, reiniciar
                // (Aumentado de 60 para dar margem ao GPS fixar após restart)
                if (timeSinceLastGps > 45000) {
                    android.util.Log.w("GpsTrackingService", 
                        "⚠️⚠️⚠️ GPS WATCHDOG: Sem updates por " + (timeSinceLastGps/1000) + "s - REINICIANDO GPS!");
                    
                    // Parar e reiniciar location updates
                    try {
                        if (fusedLocationClient != null && locationCallback != null) {
                            fusedLocationClient.removeLocationUpdates(locationCallback);
                            android.util.Log.d("GpsTrackingService", "GPS removido para restart");
                        }
                    } catch (Exception e) {
                        android.util.Log.e("GpsTrackingService", "Erro ao remover GPS: " + e.getMessage());
                    }
                    
                    // Aguardar 2 segundos e reiniciar (tempo para GPS provider se resetar)
                    locationHandler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            android.util.Log.d("GpsTrackingService", "🔄 Reiniciando GPS...");
                            startLocationUpdates();
                            lastGpsCheckTime = System.currentTimeMillis(); // Reset do timestamp
                            android.util.Log.d("GpsTrackingService", "✅ GPS reiniciado pelo watchdog");
                        }
                    }, 2000);
                    
                } else {
                    android.util.Log.d("GpsTrackingService", 
                        "✅ GPS WATCHDOG: OK - último update há " + (timeSinceLastGps/1000) + "s");
                }
                
                // Agendar próxima verificação
                if (locationHandler != null) {
                    locationHandler.postDelayed(gpsWatchdog, GPS_WATCHDOG_INTERVAL);
                }
            }
        };
        
        // Iniciar primeira verificação após 30 segundos
        if (locationHandler != null) {
                                                                                                                                                    lastGpsCheckTime = System.currentTimeMillis(); // Inicializa timestamp
                                                                                                                                                    locationHandler.postDelayed(gpsWatchdog, GPS_WATCHDOG_INTERVAL);
                                                                                                                                                    android.util.Log.d("GpsTrackingService", "✅ GPS Watchdog iniciado (verifica a cada 20s)");
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                            
    /**
     * ✅ NOVO: Location Refresher - Força GPS a continuar ativo
     * CRÍTICO: Alguns fabricantes pausam GPS quando app vai para background
     * Solução: Pedir última localização periodicamente para "acordar" o GPS
     */
    private void startLocationRefresher() {
        locationRefresher = new Runnable() {
            @Override
            public void run() {
                android.util.Log.d("GpsTrackingService", "🔄 Location Refresher - Forçando GPS refresh");
                
                // Pedir última localização conhecida
                // Isso "acorda" o GPS e força o sistema a continuar enviando updates
                try {
                    fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
                        if (location != null) {
                            long age = System.currentTimeMillis() - location.getTime();
                            android.util.Log.d("GpsTrackingService", 
                                String.format("📍 Last location age: %.1fs", age/1000.0));
                            
                            // Se localização está muito velha (>30s), pode significar que GPS parou
                            if (age > 30000) {
                                android.util.Log.w("GpsTrackingService", 
                                    "⚠️ Last location muito antiga! GPS pode ter parado.");
                            }
                        } else {
                            android.util.Log.w("GpsTrackingService", 
                                "⚠️ getLastLocation() retornou null - GPS pode ter parado");
                        }
                    }).addOnFailureListener(e -> {
                        android.util.Log.e("GpsTrackingService", 
                            "❌ Erro ao obter last location: " + e.getMessage());
                    });
                } catch (SecurityException e) {
                    android.util.Log.e("GpsTrackingService", "❌ Sem permissão de localização!");
                }
                
                // Agendar próximo refresh
                if (locationHandler != null) {
                    locationHandler.postDelayed(locationRefresher, LOCATION_REFRESH_INTERVAL);
                }
            }
        };
        
        // Iniciar primeiro refresh após 15 segundos
        if (locationHandler != null) {
            locationHandler.postDelayed(locationRefresher, LOCATION_REFRESH_INTERVAL);
            android.util.Log.d("GpsTrackingService", "✅ Location Refresher iniciado (refresh a cada 15s)");
        }
    }
    
    /**
     * ✅ NOVO: Notification Updater - Mantém foreground service VIVO
     * CRÍTICO: Apps como iFood atualizam notificação constantemente
     * Isso força o Android a manter o serviço ativo
     */
    private void startNotificationUpdater() {
        notificationUpdater = new Runnable() {
            @Override
            public void run() {
                android.util.Log.d("GpsTrackingService", "🔔 Atualizando notificação para manter serviço vivo");
                
                // Atualizar notificação com timestamp atual
                // Isso "prova" ao sistema que o serviço está ativo
                if (lastLocation != null) {
                    updateNotification(lastLocation);
                } else {
                    // Mesmo sem localização, atualiza para mostrar que está rodando
                    updateNotificationWithStatus("Aguardando GPS fixar...");
                }
                
                // Agendar próxima atualização em 10 segundos
                if (locationHandler != null) {
                    locationHandler.postDelayed(notificationUpdater, 10000);
                }
            }
        };
        
        // Iniciar primeira atualização após 10 segundos
        if (locationHandler != null) {
            locationHandler.postDelayed(notificationUpdater, 10000);
            android.util.Log.d("GpsTrackingService", "✅ Notification Updater iniciado (atualiza a cada 10s)");
        }
    }
    
    /**
     * Atualiza notificação com status customizado
     */
    private void updateNotificationWithStatus(String status) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MotoHub - GPS Ativo")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // 🔥 CRÍTICO
            .setPriority(NotificationCompat.PRIORITY_DEFAULT) // 🔥 MUDADO
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setShowWhen(false) // 🔥 MUDADO: false para estabilidade
            .setLocalOnly(true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }
        
        Notification notification = builder.build();
        
        // 🔥 CRÍTICO: Flags para garantir permanência
        notification.flags |= Notification.FLAG_NO_CLEAR;
        notification.flags |= Notification.FLAG_ONGOING_EVENT;
        
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            try {
                manager.notify(NOTIFICATION_ID, notification);
            } catch (Exception e) {
                android.util.Log.e("GpsTrackingService", "Erro ao atualizar notificação: " + e.getMessage());
            }
        }
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        android.util.Log.d("GpsTrackingService", "=====================================");
        android.util.Log.d("GpsTrackingService", "onStartCommand() called - flags: " + flags + ", startId: " + startId);
        
        // ✅ CRÍTICO: Se serviço já está rodando, apenas retornar sem recriar canal/notificação
        if (isServiceRunning) {
            android.util.Log.d("GpsTrackingService", "⚠️ Serviço JÁ está rodando, ignorando novo startCommand");
            android.util.Log.d("GpsTrackingService", "=====================================");
            return START_STICKY;
        }
        
        // Marcar serviço como rodando
        isServiceRunning = true;
        
        // Criar canal de notificação ANTES de tudo
        createNotificationChannel();
        
        // Criar notificação
        Notification notification = createNotification();
        if (notification == null) {
            android.util.Log.e("GpsTrackingService", "❌ ERRO: Notification é null!");
            isServiceRunning = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        
        android.util.Log.d("GpsTrackingService", "✅ Notificação criada com sucesso");
        
        // INICIAR FOREGROUND SERVICE
        try {
            android.util.Log.d("GpsTrackingService", "Chamando startForeground()...");
            
            // ✅ NOVO: Para Android 10+ (API 29+), especificar tipo de foreground service
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+)
                startForeground(
                    NOTIFICATION_ID, 
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                );
                android.util.Log.d("GpsTrackingService", "✅ startForeground() com tipo LOCATION (Android 10+)");
            } else {
                startForeground(NOTIFICATION_ID, notification);
                android.util.Log.d("GpsTrackingService", "✅ startForeground() executado (Android < 10)");
            }
            
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingService", "❌ ERRO no startForeground(): " + e.getMessage());
            e.printStackTrace();
            isServiceRunning = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        
        // Garantir WakeLock está ativo
        if (wakeLock == null || !wakeLock.isHeld()) {
            android.util.Log.d("GpsTrackingService", "WakeLock não está ativo, reacquiring...");
            acquireWakeLock();
        }
        
        // Iniciar atualizações de localização
        android.util.Log.d("GpsTrackingService", "Iniciando location updates...");
        startLocationUpdates();
        
        // ✅ NOVO: Iniciar GPS Watchdog (verifica se GPS está rodando a cada 20s)
        startGpsWatchdog();
        
        // ✅ NOVO: Iniciar Location Refresher (força GPS a continuar ativo a cada 15s)
        startLocationRefresher();
        
        // ✅ NOVO: Iniciar Notification Updater (mantém foreground service vivo)
        startNotificationUpdater();
        
        android.util.Log.d("GpsTrackingService", "✅ Serviço completamente inicializado!");
        android.util.Log.d("GpsTrackingService", "WakeLock held: " + (wakeLock != null && wakeLock.isHeld()));
        android.util.Log.d("GpsTrackingService", "=====================================");
        
        // START_REDELIVER_INTENT: Mais forte que START_STICKY
        // Se sistema matar, reinicia com mesmo intent
        return START_REDELIVER_INTENT;
    }
    
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        android.util.Log.d("GpsTrackingService", "⚠️ onTaskRemoved() - App foi fechado pelo usuário");
        android.util.Log.d("GpsTrackingService", "Serviço continua rodando em background...");
        
        // ✅ MELHORADO: Restart mais robusto
        scheduleServiceRestart();
    }
    
    /**
     * Agenda restart do serviço usando AlarmManager
     * Mais confiável que simplesmente confiar no sistema
     */
    private void scheduleServiceRestart() {
        android.util.Log.d("GpsTrackingService", "📅 Agendando restart preventivo do serviço...");
        
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), GpsTrackingService.class);
            
            android.app.PendingIntent restartPendingIntent = android.app.PendingIntent.getService(
                getApplicationContext(),
                1,
                restartServiceIntent,
                android.app.PendingIntent.FLAG_ONE_SHOT | android.app.PendingIntent.FLAG_IMMUTABLE
            );
            
            android.app.AlarmManager alarmService = 
                (android.app.AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            
            if (alarmService != null) {
                // Reinicia após 2 segundos
                alarmService.set(
                    android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP, // WAKEUP garante que dispara mesmo em doze
                    android.os.SystemClock.elapsedRealtime() + 2000,
                    restartPendingIntent
                );
                android.util.Log.d("GpsTrackingService", "✅ Restart agendado para 2s (com WAKEUP)");
            }
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingService", "❌ Erro ao agendar restart: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void setupLocationCallback() {
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) {
                    return;
                }
                
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    processLocationUpdate(location);
                }
            }
        };
    }
    
    private void processLocationUpdate(Location location) {
        long currentTime = System.currentTimeMillis();
        lastGpsCheckTime = currentTime; // ✅ Atualiza timestamp do watchdog
        
        android.util.Log.d("GpsTrackingService", 
            String.format("📍 Location received: lat=%.5f, lng=%.5f, accuracy=%.1fm, speed=%.1fkm/h",
                location.getLatitude(), location.getLongitude(), 
                location.getAccuracy(), location.getSpeed() * 3.6));
        
        // Filtro inteligente: só processa se moveu distância significativa OU passou tempo suficiente
        boolean shouldUpdate = false;
        
        if (lastLocation == null) {
            shouldUpdate = true;
            android.util.Log.d("GpsTrackingService", "✅ First location update");
        } else {
            float distance = location.distanceTo(lastLocation);
            long timeDiff = currentTime - lastUpdateTime;
            
            // Atualiza se:
            // 1. Moveu mais de 5 metros
            // 2. OU passou mais de 3 segundos E moveu pelo menos 1 metro (evita drift do GPS)
            if (distance > MIN_DISTANCE || (timeDiff > UPDATE_INTERVAL && distance > 1)) {
                shouldUpdate = true;
                android.util.Log.d("GpsTrackingService", 
                    String.format("✅ Update: distance=%.1fm, timeDiff=%ds", distance, timeDiff/1000));
            } else {
                android.util.Log.d("GpsTrackingService", 
                    String.format("⏭️ Skip: distance=%.1fm, timeDiff=%ds (too close or too soon)", 
                        distance, timeDiff/1000));
            }
        }
        
        if (shouldUpdate) {
            lastLocation = location;
            lastUpdateTime = currentTime;
            
            // Envia localização para o JavaScript
            sendLocationToJS(location);
            
            // ✅ NOVO: Salva diretamente no Supabase (não depende mais do JavaScript!)
            saveLocationToSupabase(location);
            
            // Atualiza notificação com velocidade atual
            updateNotification(location);
            
            android.util.Log.d("GpsTrackingService", "✅ Location sent to JS, Supabase, and notification updated");
        }
    }
    
    private void sendLocationToJS(Location location) {
        // Cria intent broadcast para o WebView capturar
        Intent intent = new Intent("GPS_LOCATION_UPDATE");
        intent.putExtra("latitude", location.getLatitude());
        intent.putExtra("longitude", location.getLongitude());
        intent.putExtra("accuracy", location.getAccuracy());
        intent.putExtra("speed", location.getSpeed() * 3.6); // m/s para km/h
        intent.putExtra("bearing", location.getBearing());
        intent.putExtra("timestamp", location.getTime());
        sendBroadcast(intent);
    }
    
    private void startLocationUpdates() {
        android.util.Log.d("GpsTrackingService", "Configurando LocationRequest...");
        
        // ✅ CONFIGURAÇÃO ULTRA-AGRESSIVA PARA BACKGROUND
        // Mudanças: Intervalo mais curto, sem delay, força foreground importance
        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            UPDATE_INTERVAL
        )
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL)
            .setMinUpdateDistanceMeters(MIN_DISTANCE)
            .setWaitForAccurateLocation(false)
            .setMaxUpdateDelayMillis(0) // ✅ NOVO: 0 = sem delay (entrega imediata)
            .setGranularity(Granularity.GRANULARITY_FINE)
            .setDurationMillis(Long.MAX_VALUE)
            .setIntervalMillis(UPDATE_INTERVAL) // ✅ NOVO: Força intervalo exato
            .build();
        
        try {
            android.util.Log.d("GpsTrackingService", "Solicitando location updates...");
            android.util.Log.d("GpsTrackingService", "Priority: PRIORITY_HIGH_ACCURACY");
            android.util.Log.d("GpsTrackingService", "Update Interval: " + UPDATE_INTERVAL + "ms");
            android.util.Log.d("GpsTrackingService", "Fastest Interval: " + FASTEST_INTERVAL + "ms");
            android.util.Log.d("GpsTrackingService", "Min Distance: " + MIN_DISTANCE + "m");
            
            // ✅ VERIFICAR SE TEMOS PERMISSÃO ANTES DE SOLICITAR
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                int fineLocationPerm = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION);
                int coarseLocationPerm = checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION);
                
                android.util.Log.d("GpsTrackingService", "Fine Location Permission: " + 
                    (fineLocationPerm == android.content.pm.PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
                android.util.Log.d("GpsTrackingService", "Coarse Location Permission: " + 
                    (coarseLocationPerm == android.content.pm.PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
                
                if (fineLocationPerm != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.e("GpsTrackingService", "❌ ERRO CRÍTICO: Sem permissão FINE_LOCATION!");
                    android.util.Log.e("GpsTrackingService", "GPS NÃO PODE SER INICIADO SEM PERMISSÃO!");
                    return;
                }
            }
            
            // ✅ USAR HANDLER DEDICADO ao invés de MainLooper
            // MainLooper pode ser pausado quando app vai para background
            android.util.Log.d("GpsTrackingService", "Chamando fusedLocationClient.requestLocationUpdates()...");
            
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                locationHandler.getLooper() // ✅ Looper dedicado
            );
            
            android.util.Log.d("GpsTrackingService", "✅ Location updates iniciados com thread dedicada");
            android.util.Log.d("GpsTrackingService", "✅ GPS deveria aparecer na barra de status AGORA!");
            
            // Log inicial da localização atual
            fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
                if (location != null) {
                    android.util.Log.d("GpsTrackingService", 
                        String.format("📍 Localização inicial: lat=%.5f, lng=%.5f, accuracy=%.1fm",
                            location.getLatitude(), location.getLongitude(), location.getAccuracy()));
                } else {
                    android.util.Log.w("GpsTrackingService", "⚠️ getLastLocation() retornou null - GPS pode demorar a fixar");
                }
            }).addOnFailureListener(e -> {
                android.util.Log.e("GpsTrackingService", "❌ ERRO ao obter última localização: " + e.getMessage());
            });
            
        } catch (SecurityException e) {
            android.util.Log.e("GpsTrackingService", "❌❌❌ ERRO DE PERMISSÃO ao iniciar updates: " + e.getMessage());
            android.util.Log.e("GpsTrackingService", "Isso significa que as permissões não foram concedidas corretamente!");
            android.util.Log.e("GpsTrackingService", "GPS NÃO VAI FUNCIONAR!");
            e.printStackTrace();
        } catch (IllegalStateException e) {
            android.util.Log.e("GpsTrackingService", "❌❌❌ ERRO DE ESTADO ao iniciar updates: " + e.getMessage());
            android.util.Log.e("GpsTrackingService", "Possivelmente Google Play Services não está disponível!");
            e.printStackTrace();
        } catch (Exception e) {
            android.util.Log.e("GpsTrackingService", "❌❌❌ ERRO DESCONHECIDO ao iniciar updates: " + e.getMessage());
            android.util.Log.e("GpsTrackingService", "Tipo do erro: " + e.getClass().getName());
            e.printStackTrace();
        }
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.util.Log.d("GpsTrackingService", "Criando canal de notificação (Android 8+)...");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) {
                android.util.Log.e("GpsTrackingService", "❌ NotificationManager é null!");
                return;
            }
            
            // ✅ CORREÇÃO: Não deletar o canal se ele já existir
            // Deletar canal enquanto foreground service está ativo causa crash no Android!
            NotificationChannel existingChannel = manager.getNotificationChannel(CHANNEL_ID);
            if (existingChannel != null) {
                android.util.Log.d("GpsTrackingService", "✅ Canal já existe, reutilizando");
                return; // Canal já existe, não precisa recriar
            }
            
            android.util.Log.d("GpsTrackingService", "Criando novo canal de notificação...");
            
            // 🔥 NOVO CANAL COM IMPORTANCE_DEFAULT (crucial!)
            // IMPORTANCE_HIGH causa problemas em alguns fabricantes (Xiaomi, Vivo)
            // iFood usa DEFAULT para evitar que usuário possa mudar
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Rastreamento GPS",
                NotificationManager.IMPORTANCE_DEFAULT // 🔥 MUDADO: DEFAULT ao invés de HIGH
            );
            
            channel.setDescription("Mantém o GPS ativo para rastreamento em tempo real do motoboy");
            channel.setShowBadge(false);
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setSound(null, null); // Sem som
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(false);
            
            // 🔥 NOVO: Marcar como canal de serviço essencial
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                channel.setImportance(NotificationManager.IMPORTANCE_DEFAULT);
            }
            
            manager.createNotificationChannel(channel);
            android.util.Log.d("GpsTrackingService", "✅ Canal criado com sucesso!");
        }
    }
    
    private Notification createNotification() {
        android.util.Log.d("GpsTrackingService", "Criando notificação...");
        
        // Intent para abrir o app quando clicar na notificação
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        // 🔥 NOTIFICAÇÃO ESTILO iFOOD - permanente, non-dismissível, SEM cronômetro (mais estável)
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MotoHub - GPS Ativo")
            .setContentText("Rastreando localização em tempo real")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // 🔥 CRÍTICO: true = não pode fechar por swipe
            .setPriority(NotificationCompat.PRIORITY_DEFAULT) // 🔥 DEFAULT (não HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(false) // 🔥 MUDADO: false para evitar crash
            .setOnlyAlertOnce(true) // 🔥 Não vibra/toca toda vez que atualiza
            .setAutoCancel(false) // 🔥 Não fecha ao clicar
            .setLocalOnly(true); // 🔥 Não replica em wearables
        
        // 🔥 ANDROID 10+ (API 29+): Definir tipo de foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }
        
        Notification notification = builder.build();
        
        // 🔥 CRÍTICO: Flags adicionais para garantir que não seja removível
        notification.flags |= Notification.FLAG_NO_CLEAR;
        notification.flags |= Notification.FLAG_ONGOING_EVENT;
        
        if (notification != null) {
            android.util.Log.d("GpsTrackingService", "✅ Notificação construída - non-dismissível (sem cronômetro para estabilidade)");
        } else {
            android.util.Log.e("GpsTrackingService", "❌ Notificação é null!");
        }
        
        return notification;
    }
    
    private void updateNotification(Location location) {
        float speedKmh = location.getSpeed() * 3.6f;
        String speedText = speedKmh > 1 ? String.format("%.0f km/h", speedKmh) : "Parado";
        
        // 🔥 Calcular tempo desde último update
        long timeSinceUpdate = System.currentTimeMillis() - location.getTime();
        String timeAgo = timeSinceUpdate < 10000 ? "agora" : String.format("%ds atrás", timeSinceUpdate/1000);
        
        // Intent para abrir o app
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MotoHub - GPS Ativo")
            .setContentText(String.format("%s • %s", speedText, timeAgo))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // 🔥 CRÍTICO
            .setPriority(NotificationCompat.PRIORITY_DEFAULT) // 🔥 MUDADO
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOnlyAlertOnce(true) // 🔥 Não alerta a cada update
            .setAutoCancel(false) // 🔥 Não fecha ao clicar
            .setShowWhen(false) // 🔥 MUDADO: false para estabilidade
            .setLocalOnly(true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }
        
        Notification notification = builder.build();
        
        // 🔥 CRÍTICO: Flags para garantir permanência
        notification.flags |= Notification.FLAG_NO_CLEAR;
        notification.flags |= Notification.FLAG_ONGOING_EVENT;
        
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        android.util.Log.d("GpsTrackingService", "⚠️⚠️⚠️ onDestroy() - Service está sendo destruído!");
        android.util.Log.d("GpsTrackingService", "Cleaning up e agendando restart...");
        
        // ✅ CRÍTICO: Resetar flag de serviço rodando
        isServiceRunning = false;
        
        // ✅ NOVO: Deletar localização do Supabase quando serviço é destruído (logout)
        deleteLocationFromSupabase();
        
        // Agendar restart do serviço para garantir continuidade do GPS
        scheduleServiceRestart();
        
        // Cancelar GPS Watchdog
        if (locationHandler != null && gpsWatchdog != null) {
            locationHandler.removeCallbacks(gpsWatchdog);
            android.util.Log.d("GpsTrackingService", "GPS Watchdog cancelado");
        }
        
        // ✅ NOVO: Cancelar Location Refresher
        if (locationHandler != null && locationRefresher != null) {
            locationHandler.removeCallbacks(locationRefresher);
            android.util.Log.d("GpsTrackingService", "Location Refresher cancelado");
        }
        
        // ✅ NOVO: Cancelar Notification Updater
        if (locationHandler != null && notificationUpdater != null) {
            locationHandler.removeCallbacks(notificationUpdater);
            android.util.Log.d("GpsTrackingService", "Notification Updater cancelado");
        }
        
        // Cancelar renovação do WakeLock
        if (locationHandler != null) {
            locationHandler.removeCallbacksAndMessages(null);
        }
        
        // Parar location updates
        if (fusedLocationClient != null && locationCallback != null) {
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback);
                android.util.Log.d("GpsTrackingService", "Location updates stopped");
            } catch (Exception e) {
                android.util.Log.e("GpsTrackingService", "Erro ao parar location updates: " + e.getMessage());
            }
        }
        
        // Liberar WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                android.util.Log.d("GpsTrackingService", "WakeLock released");
            } catch (Exception e) {
                android.util.Log.e("GpsTrackingService", "Erro ao liberar WakeLock: " + e.getMessage());
            }
        }
        
        // ✅ NOVO: Parar thread dedicada
        if (handlerThread != null) {
            handlerThread.quitSafely();
            try {
                handlerThread.join(1000); // Aguarda até 1s
            } catch (InterruptedException e) {
                android.util.Log.w("GpsTrackingService", "Handler thread interrupted during shutdown");
            }
            android.util.Log.d("GpsTrackingService", "Handler thread stopped");
        }
        
        android.util.Log.d("GpsTrackingService", "✅ Service cleanup completed - restart scheduled");
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
