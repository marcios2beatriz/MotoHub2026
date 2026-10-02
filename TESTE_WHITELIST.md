# 🧪 TESTE RÁPIDO - Whitelist de Bateria

## Passo 1: Verificar se App Solicita Whitelist

### Abrir Console do Chrome no Celular:

1. No celular, abrir Chrome
2. Digitar: `chrome://inspect`
3. No PC, abrir Chrome
4. Digitar: `chrome://inspect`
5. Clicar em "inspect" no MotoHub Delivery

### Ver Logs do JavaScript:

```javascript
// No console, digitar:
import('../plugins/batteryOptimization').then(m => m.default.check()).then(console.log)
```

**Resultado esperado:**
```json
{
  "isWhitelisted": false,
  "message": "App precisa de permissão..."
}
```

---

## Passo 2: Solicitar Whitelist Manualmente

### No console do Chrome (com app aberto):

```javascript
import('../plugins/batteryOptimization').then(m => m.default.request()).then(console.log)
```

**Deve abrir uma tela do Android perguntando sobre otimização de bateria!**

---

## Passo 3: Ver Logs Nativos (Android)

### PowerShell (Windows):

```powershell
# Ver TODOS os logs do MotoHub
adb logcat -s "GpsTrackingService:*" "BatteryOptimization:*" "MainActivity:*"
```

ou

```powershell
# Ver apenas erros
adb logcat *:E
```

---

## 📋 Checklist de Verificação

- [ ] App instalado e aberto
- [ ] Popup de whitelist apareceu?
- [ ] Clicou em OK?
- [ ] Tela do Android abriu?
- [ ] Selecionou "Sim" / "Não otimizar"?
- [ ] GPS está ativo (ícone no topo da tela)?
- [ ] Trocar de app e GPS continua?

---

## 🔍 Se Popup NÃO Apareceu

O código JavaScript pode não estar rodando. Tente:

1. Desinstalar app completamente
2. Reinstalar APK v1.0.8
3. Limpar dados: Configurações → Apps → MotoHub → Armazenamento → Limpar dados
4. Abrir app e fazer login novamente

---

## 📱 Teste Alternativo (Sem Código)

### Configurar Manualmente (como teste):

```
Configurações → Bateria
→ Menu (3 pontos) → Otimização de bateria
→ Procurar "MotoHub Delivery"
→ Selecionar
→ Escolher "Não otimizar"
→ Confirmar
```

Depois, testar se GPS continua funcionando ao trocar de app.

Se funcionar assim, o problema é que o código não está solicitando automaticamente.
