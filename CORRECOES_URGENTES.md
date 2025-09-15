# 🚨 CORREÇÕES URGENTES - Aplicar Imediatamente

## Problema 1: react-native-maps não funciona na Web
**SOLUÇÃO:** Substitua o arquivo GoogleMapView.tsx pelo conteúdo web-compatível

### Passo 1: Substitua o GoogleMapView.tsx
1. **Pare o Expo** (Ctrl+C)
2. **Substitua** o conteúdo do arquivo `C:\transportdf-mvp\frontend\components\GoogleMapView.tsx`
3. **Cole** o conteúdo do arquivo `GoogleMapView_WEB_COMPATIBLE.tsx` (que criei)

## Problema 2: Network Error - Backend não conectando
**SOLUÇÃO:** Configure as URLs corretas

### Passo 2: Configure o .env
**Arquivo:** `C:\transportdf-mvp\frontend\.env`
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

### Passo 3: Inicie o Backend Local
1. **Abra novo terminal** em `C:\transportdf-mvp\backend\`
2. **Execute:**
```bash
pip install -r requirements.txt
python server.py
```

## Problema 3: Asset icon.png faltando
**SOLUÇÃO:** Crie um ícone simples ou remova do app.json

### Passo 4: Criar icon.png
1. **Crie uma pasta:** `C:\transportdf-mvp\frontend\assets\`
2. **Adicione qualquer imagem PNG** de 48x48 pixels chamada `icon.png`
3. **OU remova** a linha do icon no `app.json`

## Problema 4: Cache corrompido (InternalBytecode.js)
**SOLUÇÃO:** Limpe o cache do Metro

### Passo 5: Limpeza completa
```bash
cd C:\transportdf-mvp\frontend\
npx expo start --clear
```

## 🔧 Sequência Completa de Correção

### 1. Pare tudo
```bash
# No terminal do Expo: Ctrl+C
```

### 2. Substitua o GoogleMapView.tsx
```bash
# Substitua o conteúdo por GoogleMapView_WEB_COMPATIBLE.tsx
```

### 3. Configure .env
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

### 4. Inicie backend
```bash
cd C:\transportdf-mvp\backend\
python server.py
```

### 5. Limpe cache e reinicie
```bash
cd C:\transportdf-mvp\frontend\
npx expo start --clear
```

## ✅ Resultado Esperado
- ❌ Sem mais erros de react-native-maps na web
- ❌ Sem mais Network Error 
- ❌ Sem mais InternalBytecode.js error
- ✅ Interface de solicitação funcionando na web
- ✅ Backend conectando corretamente
- ✅ Google Maps funcionando no mobile (com chave)

## 🆘 Se ainda der erro
1. **Verifique** se o backend está rodando em http://localhost:8001
2. **Confirme** que o .env está na pasta frontend (não na raiz)
3. **Teste** fazer login primeiro antes de solicitar viagem
4. **Use** apenas no dispositivo móvel se quiser o mapa real

## 📱 Diferenças por Plataforma
- **Web:** Interface simplificada com lista de destinos
- **Mobile:** Mapa real do Google Maps (precisa da chave API)
- **Ambos:** Funcionalidade completa de solicitação de viagem