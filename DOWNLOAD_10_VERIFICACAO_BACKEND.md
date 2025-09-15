# 🚨 CORREÇÃO DO BUG - Network Error

## 🔍 **PROBLEMA IDENTIFICADO:**

Seu frontend ainda está tentando conectar com o ambiente **CLOUD/PREVIEW**:
```
EXPO_PUBLIC_BACKEND_URL=https://brasilia-rider.preview.emergentagent.com
```

Mas você quer rodar **LOCALMENTE** no seu Docker/container Windows.

## 🔧 **SOLUÇÃO IMEDIATA:**

### **1. Corrija o .env do Frontend**
```
Arquivo: C:\transportdf-mvp\frontend\.env
Substitua COMPLETAMENTE por: DOWNLOAD_09_FRONTEND_ENV_CORRETO.txt
```

### **2. Verifique se Backend está Rodando**
```bash
# No Windows, abra novo terminal:
cd C:\transportdf-mvp\backend
python server.py
```

**Deve aparecer:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

### **3. Teste a Conexão Backend**
```bash
# Abra outro terminal e teste:
curl http://localhost:8001/api/health
```

**Deve retornar:**
```json
{"status": "healthy"}
```

### **4. Reinicie o Expo**
```bash
cd C:\transportdf-mvp\frontend
npx expo start --clear
```

## ⚠️ **DIAGNÓSTICOS ADICIONAIS:**

### **Se o Backend NÃO Iniciar:**
```bash
# 1. Instale dependências:
cd C:\transportdf-mvp\backend
pip install -r requirements.txt

# 2. Verifique MongoDB:
# Certifique-se que MongoDB está rodando na porta 27017

# 3. Teste novamente:
python server.py
```

### **Se Ainda Der Network Error:**
1. **Firewall:** Verifique se Windows Firewall não está bloqueando porta 8001
2. **Proxy:** Desative proxy se estiver usando
3. **Antivírus:** Temporariamente desative para testar

## 📱 **TESTE COMPLETO:**

### **1. Backend Rodando:**
- ✅ Terminal mostra: `Uvicorn running on http://0.0.0.0:8001`
- ✅ Browser: `http://localhost:8001/docs` abre interface Swagger

### **2. Frontend Correto:**
- ✅ .env tem: `EXPO_PUBLIC_BACKEND_URL=http://localhost:8001`
- ✅ Expo reiniciado com `--clear`

### **3. Teste de Registro:**
- ✅ Abrir app no Expo Go
- ✅ Ir para registro de passageiro
- ✅ Preencher dados e clicar "Criar Conta"
- ✅ Não deve mais dar "Network Error"

## 🚀 **SEQUÊNCIA DE CORREÇÃO:**

1. **Pare o Expo** (Ctrl+C)
2. **Substitua** o .env com conteúdo correto
3. **Inicie Backend** em terminal separado
4. **Reinicie Expo** com `--clear`
5. **Teste registro** novamente

**APLIQUE ESTAS CORREÇÕES E ME INFORME O RESULTADO!** 🔧