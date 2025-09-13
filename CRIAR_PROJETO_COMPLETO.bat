@echo off
echo ========================================
echo CRIANDO PROJETO TRANSPORTDF MVP
echo ========================================

REM Criar estrutura de pastas
mkdir C:\transportdf-mvp
cd C:\transportdf-mvp
mkdir backend
mkdir frontend
cd frontend
mkdir app
cd app
mkdir auth
mkdir passenger
mkdir driver
mkdir admin
cd ..
cd ..

echo Estrutura de pastas criada em C:\transportdf-mvp

REM Criar backend/.env
echo MONGO_URL=mongodb://localhost:27017 > backend\.env
echo DB_NAME=transportdf >> backend\.env

REM Criar backend/requirements.txt
(
echo fastapi==0.110.1
echo uvicorn==0.25.0
echo python-dotenv^>=1.0.1
echo pymongo==4.5.0
echo pydantic^>=2.6.4
echo email-validator^>=2.2.0
echo pyjwt^>=2.10.1
echo passlib^>=1.7.4
echo motor==3.3.1
echo python-jose[cryptography]^>=3.3.0
echo requests^>=2.31.0
echo geopy
echo haversine
echo bcrypt
echo python-multipart^>=0.0.9
) > backend\requirements.txt

REM Criar frontend/.env
echo EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 > frontend\.env

echo ========================================
echo Estrutura básica criada!
echo Agora você precisa copiar os arquivos de código
echo que eu vou mostrar na sequência
echo ========================================
pause