@echo off
rem Importador da Evolucao Fotografia (v0.6). Duplo clique: prepara o Python
rem na primeira vez, pede a pasta do cartao e monta os pacotes de sessao.
setlocal
cd /d "%~dp0.."
if not exist "importador\.venv\Scripts\python.exe" (
  echo Preparando o importador pela primeira vez. Isso leva um ou dois minutos...
  py -3 -m venv importador\.venv || goto :erro
  importador\.venv\Scripts\python -m pip install --quiet --upgrade pip
  importador\.venv\Scripts\python -m pip install --quiet -r importador\requirements.txt || goto :erro
)
importador\.venv\Scripts\python -m importador %*
echo.
pause
exit /b 0
:erro
echo.
echo Nao foi possivel preparar o Python. Confira se o Python 3 esta instalado (py --version).
pause
exit /b 1
