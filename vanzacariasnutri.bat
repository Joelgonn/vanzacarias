@echo off
echo ======================================
echo   Iniciando DeepSeek Harness...
echo ======================================
cd /d "C:\Users\joelg\Documents\Vanusa\vanzacariasnutri"

start /B npx @deepseek-ai/dsh web

echo Aguardando servidor iniciar...
timeout /t 5 /nobreak >nul

start http://127.0.0.1:3080

echo ======================================
echo   Harness rodando em: http://127.0.0.1:3080
echo   Feche esta janela para parar o servidor
echo ======================================
pause