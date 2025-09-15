# 🔄 PLANO DE SINCRONIZAÇÃO: Windows 10 ↔ Docker Container

## 📋 OBJETIVO
Transformar seu Windows 10 em um ambiente Docker/container idêntico ao meu, garantindo 100% de compatibilidade.

## 🏗️ ESTRUTURA ATUAL DO PROJETO (Container)

```
C:\transportdf-mvp\
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py
├── frontend/
│   ├── .env
│   ├── app.json
│   ├── package.json
│   ├── metro.config.js
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── yarn.lock
│   ├── package-lock.json
│   ├── app/
│   │   ├── index.tsx
│   │   ├── admin.tsx
│   │   ├── driver.tsx
│   │   ├── passenger.tsx
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── admin/
│   │   │   ├── index.tsx
│   │   │   └── dashboard.tsx
│   │   ├── driver/
│   │   │   ├── index.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── history.tsx
│   │   └── passenger/
│   │       ├── index.tsx
│   │       ├── dashboard.tsx
│   │       └── history.tsx
│   ├── components/
│   │   ├── ChatComponent.tsx
│   │   ├── GoogleMapView.tsx ⚠️ VERSÃO ATUAL (com problema web)
│   │   ├── MockMapView.tsx
│   │   ├── TripMapView.tsx
│   │   └── useGoogleMaps.ts
│   └── assets/
│       ├── fonts/
│       └── images/
└── README.md
```

## 🔧 ARQUIVOS MODIFICADOS/CRIADOS RECENTEMENTE

### ✅ Arquivos Prontos para Download:
1. **`/app/GoogleMapView_FINAL_WEB_SAFE.tsx`** - Nova versão 100% compatível com web
2. **`/app/frontend/app/passenger/dashboard.tsx`** - Integração com Google Maps
3. **`/app/frontend/components/useGoogleMaps.ts`** - Hook para Google Maps
4. **`/app/backend/server.py`** - Backend com todas as APIs

### ⚠️ Arquivos .env que precisam ser configurados:

**Frontend (.env):**
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

**Backend (.env):**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="transportdf_mvp"
```

## 🚀 PROCESSO DE SINCRONIZAÇÃO

### FASE 1: Preparação do Windows
1. **Instalar Docker Desktop** no Windows 10
2. **Instalar Node.js** (versão 18+)
3. **Instalar Python** (versão 3.9+)
4. **Instalar MongoDB** (ou usar Docker)
5. **Instalar Git** (opcional, mas recomendado)

### FASE 2: Estrutura de Pastas
```bash
# Criar estrutura no Windows
mkdir C:\transportdf-mvp
mkdir C:\transportdf-mvp\backend
mkdir C:\transportdf-mvp\frontend
mkdir C:\transportdf-mvp\frontend\app
mkdir C:\transportdf-mvp\frontend\components
mkdir C:\transportdf-mvp\frontend\assets
```

### FASE 3: Download e Sincronização
Sempre que eu fizer alterações, informarei:

**FORMATO DE NOTIFICAÇÃO:**
```
🔄 SINCRONIZAR ARQUIVOS:
- Arquivo: /caminho/para/arquivo.tsx
- Ação: CRIAR/ATUALIZAR/DELETAR
- Descrição: O que foi alterado
- Comando Windows: onde colocar no seu PC
```

## 📥 PRIMEIRA SINCRONIZAÇÃO (AGORA)

### 1. Baixe estes arquivos do meu ambiente:

**Backend:**
- `📁 /app/backend/server.py` → `C:\transportdf-mvp\backend\server.py`
- `📁 /app/backend/requirements.txt` → `C:\transportdf-mvp\backend\requirements.txt`

**Frontend - Arquivos Base:**
- `📁 /app/frontend/package.json` → `C:\transportdf-mvp\frontend\package.json`
- `📁 /app/frontend/app.json` → `C:\transportdf-mvp\frontend\app.json`
- `📁 /app/frontend/metro.config.js` → `C:\transportdf-mvp\frontend\metro.config.js`
- `📁 /app/frontend/tsconfig.json` → `C:\transportdf-mvp\frontend\tsconfig.json`

**Frontend - Screens:**
- `📁 /app/frontend/app/index.tsx` → `C:\transportdf-mvp\frontend\app\index.tsx`
- `📁 /app/frontend/app/passenger/dashboard.tsx` → `C:\transportdf-mvp\frontend\app\passenger\dashboard.tsx`
- (todos os outros arquivos da pasta app/)

**Frontend - Components:**
- `📁 /app/GoogleMapView_FINAL_WEB_SAFE.tsx` → `C:\transportdf-mvp\frontend\components\GoogleMapView.tsx`
- `📁 /app/frontend/components/ChatComponent.tsx` → `C:\transportdf-mvp\frontend\components\ChatComponent.tsx`
- `📁 /app/frontend/components/useGoogleMaps.ts` → `C:\transportdf-mvp\frontend\components\useGoogleMaps.ts`

### 2. Crie os arquivos .env:

**`C:\transportdf-mvp\frontend\.env`:**
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

**`C:\transportdf-mvp\backend\.env`:**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="transportdf_mvp"
```

## ⚙️ COMANDOS DE INICIALIZAÇÃO

### Backend:
```bash
cd C:\transportdf-mvp\backend
pip install -r requirements.txt
python server.py
```

### Frontend:
```bash
cd C:\transportdf-mvp\frontend
npm install
npx expo start
```

## 🔔 PROTOCOLO DE NOTIFICAÇÃO

A partir de agora, sempre que eu modificar algo, informarei:

```
🔄 SINCRONIZAÇÃO NECESSÁRIA:
Arquivo: components/GoogleMapView.tsx
Ação: ATUALIZAR
Motivo: Corrigido bug na busca de destinos
Downloads: [link para baixar]
Comando: Substitua C:\transportdf-mvp\frontend\components\GoogleMapView.tsx
```

## ✅ VANTAGENS DESTA ABORDAGEM

1. **100% Compatibilidade** - Mesmo ambiente, mesmos resultados
2. **Sincronização em Tempo Real** - Atualizações imediatas
3. **Debugging Conjunto** - Posso testar e você implementa
4. **Sem Conflitos de Versão** - Dependências sempre alinhadas
5. **Ambiente de Produção** - Pronto para deploy

## 🚀 PRÓXIMOS PASSOS

1. **Você confirma** se quer seguir este plano
2. **Eu preparo** todos os arquivos para download
3. **Você configura** o ambiente Windows
4. **Iniciamos** a sincronização contínua

**Está pronto para começar a sincronização?**