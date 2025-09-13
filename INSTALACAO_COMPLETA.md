# 🚀 TRANSPORTDF MVP - INSTALAÇÃO COMPLETA

## 📋 **ARQUIVOS PARA BAIXAR/COPIAR**

### **ESTRUTURA DE PASTAS:**
```
transportdf-mvp/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── app/
│   │   ├── index.tsx
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── passenger/
│   │   │   └── dashboard.tsx
│   │   ├── driver/
│   │   │   └── dashboard.tsx
│   │   └── admin/
│   │       └── dashboard.tsx
│   ├── package.json
│   ├── app.json
│   └── .env
└── INSTALACAO_COMPLETA.md (este arquivo)
```

---

## 💻 **INSTALAÇÃO NO WINDOWS (SERVIDOR)**

### **PASSO 1: INSTALAR PRÉ-REQUISITOS**

**1.1 - Instalar Node.js:**
- Acesse: https://nodejs.org/
- Baixe a versão LTS (recomendada)
- Execute o instalador e siga as instruções
- Teste no CMD: `node --version` e `npm --version`

**1.2 - Instalar Python:**
- Acesse: https://python.org/downloads/
- Baixe Python 3.9+ para Windows
- ⚠️ **IMPORTANTE**: Marque "Add Python to PATH" durante instalação
- Teste no CMD: `python --version` e `pip --version`

**1.3 - Instalar MongoDB:**
- Acesse: https://www.mongodb.com/try/download/community
- Baixe MongoDB Community Server para Windows
- Execute o instalador (deixe as opções padrão)
- ⚠️ **IMPORTANTE**: Marque "Install MongoDB as a Service"

**1.4 - Instalar Git (opcional mas recomendado):**
- Acesse: https://git-scm.com/download/win
- Baixe e instale com configurações padrão

### **PASSO 2: CRIAR ESTRUTURA DO PROJETO**

**2.1 - Criar pastas:**
```cmd
mkdir C:\transportdf-mvp
cd C:\transportdf-mvp
mkdir backend
mkdir frontend
```

**2.2 - Copiar arquivos do backend:**
- Crie os arquivos: `server.py`, `requirements.txt`, `.env`
- Cole o conteúdo fornecido em cada arquivo

**2.3 - Copiar arquivos do frontend:**
- Crie todas as pastas e arquivos .tsx conforme estrutura
- Cole o conteúdo fornecido em cada arquivo

### **PASSO 3: CONFIGURAR BACKEND**

**3.1 - Instalar dependências Python:**
```cmd
cd C:\transportdf-mvp\backend
pip install -r requirements.txt
```

**3.2 - Testar backend:**
```cmd
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
- Acesse: http://localhost:8001/api/health
- Deve aparecer: `{"status": "healthy", "service": "Transport App Brasília MVP"}`

### **PASSO 4: CONFIGURAR FRONTEND**

**4.1 - Instalar Expo CLI globalmente:**
```cmd
npm install -g @expo/cli
```

**4.2 - Navegar para pasta frontend:**
```cmd
cd C:\transportdf-mvp\frontend
```

**4.3 - Instalar dependências:**
```cmd
npm install
```

**4.4 - Instalar dependências específicas do Expo:**
```cmd
npx expo install expo-router expo-location @react-native-async-storage/async-storage
npm install axios @expo/vector-icons @react-navigation/native @react-navigation/native-stack
```

**4.5 - Iniciar servidor frontend:**
```cmd
npx expo start
```
- Acesse: http://localhost:3000
- Deve aparecer a tela inicial do TransportDF

### **PASSO 5: EXECUTAR PROJETO COMPLETO**

**Terminal 1 (Backend):**
```cmd
cd C:\transportdf-mvp\backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 (Frontend):**
```cmd
cd C:\transportdf-mvp\frontend
npx expo start
```

**URLs de teste:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001/api/health

---

## 📱 **INSTALAÇÃO NOS CELULARES**

### **iPhone 1 (MOTORISTA):**

**Passo 1: Instalar Expo Go**
- Abra a App Store
- Procure por "Expo Go"
- Instale o aplicativo oficial da Expo

**Passo 2: Conectar ao projeto**
- Certifique-se que o iPhone está na mesma rede WiFi do Windows
- No Windows, com `npx expo start` rodando, aparecerá um QR code
- Abra o Expo Go no iPhone
- Toque em "Scan QR Code"
- Escaneie o QR code que aparece no terminal do Windows

**Passo 3: Testar como motorista**
- No app que abrir, toque em "Motorista"
- Faça login com: `joao.motorista@email.com` / `motorista456`
- Ou crie uma nova conta escolhendo "Motorista"

### **iPhone 2 (PASSAGEIRO):**

**Passo 1: Instalar Expo Go**
- Mesmo processo do iPhone 1

**Passo 2: Conectar ao projeto**
- Mesmo processo do iPhone 1
- Use o mesmo QR code

**Passo 3: Testar como passageiro**
- No app que abrir, toque em "Passageiro"
- Faça login com: `maria.santos@email.com` / `senha123`
- Ou crie uma nova conta escolhendo "Passageiro"

### **Android (PASSAGEIRO):**

**Passo 1: Instalar Expo Go**
- Abra o Google Play Store
- Procure por "Expo Go"
- Instale o aplicativo oficial da Expo

**Passo 2: Conectar ao projeto**
- Certifique-se que o Android está na mesma rede WiFi do Windows
- Abra o Expo Go no Android
- Toque em "Scan QR Code"
- Escaneie o QR code que aparece no terminal do Windows

**Passo 3: Testar como passageiro**
- No app que abrir, toque em "Passageiro"
- Faça login com: `maria.santos@email.com` / `senha123`
- Ou crie uma nova conta escolhendo "Passageiro"

---

## 🧪 **CONTAS PRÉ-CRIADAS PARA TESTE**

### **ADMINISTRADOR (Windows/Navegador):**
```
Email: admin@transportdf.com
Senha: admin789
```

### **MOTORISTA (iPhone 1):**
```
Email: joao.motorista@email.com
Senha: motorista456
```

### **PASSAGEIRO (iPhone 2 e Android):**
```
Email: maria.santos@email.com
Senha: senha123
```

---

## 🔧 **SOLUÇÃO DE PROBLEMAS COMUNS**

### **Backend não inicia:**
- Verifique se MongoDB está rodando: `net start MongoDB`
- Verifique se Python está no PATH
- Reinstale dependências: `pip install -r requirements.txt`

### **Frontend não carrega:**
- Verifique se Node.js está instalado corretamente
- Limpe cache: `npx expo start -c`
- Reinstale dependências: `rm -rf node_modules && npm install`

### **Celular não conecta:**
- Verifique se estão na mesma rede WiFi
- Tente usar a URL tunnel que aparece no terminal
- Reinicie o Expo Go e tente novamente

### **QR Code não funciona:**
- Use a URL do tunnel manualmente no navegador do celular
- Verifique firewall do Windows
- Tente desativar/reativar WiFi nos dispositivos

---

## 🎯 **CENÁRIO DE TESTE COMPLETO**

### **1. Preparar Motorista (iPhone 1):**
- Abrir app via Expo Go
- Login como motorista
- Ativar status "ONLINE"

### **2. Solicitar Viagem (iPhone 2 ou Android):**
- Abrir app via Expo Go
- Login como passageiro
- Clicar "Solicitar Viagem"
- Preencher origem e destino
- Confirmar viagem

### **3. Aceitar Corrida (iPhone 1):**
- Ver nova corrida na lista
- Aceitar corrida
- Iniciar viagem
- Finalizar viagem

### **4. Monitorar (Windows):**
- Acessar http://localhost:3000
- Login como admin
- Ver estatísticas atualizadas

**🎉 PROJETO COMPLETO E FUNCIONAL!**