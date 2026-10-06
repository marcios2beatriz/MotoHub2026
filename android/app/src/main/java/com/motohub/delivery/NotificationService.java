package com.motohub.delivery;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Serviço de notificações nativas para Android
 * Exibe notificações na barra de status do dispositivo
 * Para chat, escalas, e outros eventos importantes
 */
public class NotificationService {
    
    private static final String CHANNEL_ID_CHAT = "motohub_chat_channel";
    private static final String CHANNEL_ID_SCHEDULE = "motohub_schedule_channel";
    private static final String CHANNEL_ID_GENERAL = "motohub_general_channel";
    
    private final Context context;
    private final NotificationManagerCompat notificationManager;
    
    public NotificationService(Context context) {
        this.context = context;
        this.notificationManager = NotificationManagerCompat.from(context);
        createNotificationChannels();
    }
    
    /**
     * Cria os canais de notificação necessários (Android 8.0+)
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Canal para mensagens de chat (alta prioridade, som e vibração)
            NotificationChannel chatChannel = new NotificationChannel(
                CHANNEL_ID_CHAT,
                "Mensagens e Chat",
                NotificationManager.IMPORTANCE_HIGH
            );
            chatChannel.setDescription("Notificações de mensagens de chat entre motoboy, estabelecimento e cliente");
            chatChannel.enableVibration(true);
            chatChannel.setVibrationPattern(new long[]{0, 200, 100, 200});
            chatChannel.setShowBadge(true);
            
            // Canal para notificações de escala (alta prioridade)
            NotificationChannel scheduleChannel = new NotificationChannel(
                CHANNEL_ID_SCHEDULE,
                "Escalas e Agendamentos",
                NotificationManager.IMPORTANCE_HIGH
            );
            scheduleChannel.setDescription("Notificações sobre criação, modificação ou cancelamento de escalas");
            scheduleChannel.enableVibration(true);
            scheduleChannel.setVibrationPattern(new long[]{0, 300, 100, 300});
            scheduleChannel.setShowBadge(true);
            
            // Canal para notificações gerais (média prioridade)
            NotificationChannel generalChannel = new NotificationChannel(
                CHANNEL_ID_GENERAL,
                "Notificações Gerais",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("Notificações gerais do sistema MotoHub");
            generalChannel.setShowBadge(true);
            
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(chatChannel);
                manager.createNotificationChannel(scheduleChannel);
                manager.createNotificationChannel(generalChannel);
            }
        }
    }
    
    /**
     * Envia notificação de mensagem de chat
     * @param title Título da notificação (ex: "💬 Mensagem de João")
     * @param message Conteúdo da mensagem
     * @param fromUserName Nome de quem enviou
     */
    public void sendChatNotification(String title, String message, String fromUserName) {
        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_CHAT)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 200, 100, 200, 100, 200})
            .setContentIntent(pendingIntent)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis());
        
        // Adiciona pessoa que enviou para notificações mais ricas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.addPerson(fromUserName);
        }
        
        int notificationId = (int) System.currentTimeMillis(); // ID único baseado no timestamp
        notificationManager.notify(notificationId, builder.build());
    }
    
    /**
     * Envia notificação de escala (criada/modificada/cancelada)
     * @param title Título da notificação (ex: "📅 Nova Escala")
     * @param message Detalhes da escala
     */
    public void sendScheduleNotification(String title, String message) {
        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_SCHEDULE)
            .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 100, 300})
            .setContentIntent(pendingIntent)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis());
        
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
    }
    
    /**
     * Envia notificação geral do sistema
     * @param title Título da notificação
     * @param message Conteúdo da notificação
     */
    public void sendGeneralNotification(String title, String message) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_GENERAL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis());
        
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
    }
}
