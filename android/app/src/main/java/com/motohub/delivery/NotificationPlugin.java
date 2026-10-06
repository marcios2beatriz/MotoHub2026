package com.motohub.delivery;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin Capacitor para notificações nativas Android
 * Permite disparar notificações da barra de status do JavaScript
 */
@CapacitorPlugin(name = "NativeNotification")
public class NotificationPlugin extends Plugin {
    
    private NotificationService notificationService;
    
    @Override
    public void load() {
        super.load();
        notificationService = new NotificationService(getContext());
    }
    
    /**
     * Envia notificação de chat
     * Parâmetros:
     * - title: Título da notificação
     * - message: Mensagem a exibir
     * - fromUserName: Nome de quem enviou
     */
    @PluginMethod
    public void sendChatNotification(PluginCall call) {
        String title = call.getString("title");
        String message = call.getString("message");
        String fromUserName = call.getString("fromUserName", "Usuário");
        
        if (title == null || message == null) {
            call.reject("Title and message are required");
            return;
        }
        
        try {
            notificationService.sendChatNotification(title, message, fromUserName);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to send chat notification: " + e.getMessage());
        }
    }
    
    /**
     * Envia notificação de escala
     * Parâmetros:
     * - title: Título da notificação
     * - message: Detalhes da escala
     */
    @PluginMethod
    public void sendScheduleNotification(PluginCall call) {
        String title = call.getString("title");
        String message = call.getString("message");
        
        if (title == null || message == null) {
            call.reject("Title and message are required");
            return;
        }
        
        try {
            notificationService.sendScheduleNotification(title, message);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to send schedule notification: " + e.getMessage());
        }
    }
    
    /**
     * Envia notificação geral
     * Parâmetros:
     * - title: Título da notificação
     * - message: Mensagem a exibir
     */
    @PluginMethod
    public void sendGeneralNotification(PluginCall call) {
        String title = call.getString("title");
        String message = call.getString("message");
        
        if (title == null || message == null) {
            call.reject("Title and message are required");
            return;
        }
        
        try {
            notificationService.sendGeneralNotification(title, message);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to send general notification: " + e.getMessage());
        }
    }
}
