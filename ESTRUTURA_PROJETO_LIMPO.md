# PROJETO LIMPO - ESTRUTURA FINAL

## 📂 Estrutura do Projeto Limpo

### BACKEND (/app/backend/)
- server.py         → API principal FastAPI
- requirements.txt  → Dependências Python

### FRONTEND (/app/frontend/)

#### 🎯 ROTAS PRINCIPAIS (/app/frontend/app/)
- index.tsx         → Tela inicial/seleção de modo
- admin.tsx         → Login admin
- driver.tsx        → Login motorista  
- passenger.tsx     → Login passageiro

#### 🔐 AUTENTICAÇÃO (/app/frontend/app/auth/)
- login.tsx         → Tela de login
- register.tsx      → Tela de registro

#### 🏠 DASHBOARDS (/app/frontend/app/*/dashboard.tsx)
- admin/dashboard.tsx     → Painel administrativo
- driver/dashboard.tsx    → Dashboard motorista
- passenger/dashboard.tsx → Dashboard passageiro

#### 🧩 COMPONENTES (/app/frontend/components/)
- ChatComponent.tsx → Sistema de chat reutilizável

#### ⚙️ CONFIGURAÇÕES
- app.json          → Configurações Expo
- package.json      → Dependências Node.js
- metro.config.js   → Configuração Metro bundler
- tsconfig.json     → Configuração TypeScript
- eslint.config.js  → Configuração ESLint

### 📄 DOCUMENTAÇÃO
- README.md         → Documentação principal
- test_result.md    → Histórico de testes

### 🎨 ASSETS (/app/frontend/assets/)
- fonts/            → Fontes personalizadas
- images/           → Ícones e splash screens


