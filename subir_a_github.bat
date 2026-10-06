@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title GESTCON - Subir a GitHub

rem ============================================================
rem  GESTCON - Crea el repositorio en GitHub y sube el codigo
rem  Colocar este archivo DENTRO de la carpeta del proyecto
rem  (la que contiene package.json y .github) y hacer doble clic.
rem ============================================================

cd /d "%~dp0"
echo.
echo  === GESTCON: publicar en GitHub ===
echo  Carpeta: %CD%
echo.

if not exist "package.json" (
  echo [ERROR] Esta carpeta no parece el proyecto: falta package.json.
  echo         Copia este archivo dentro de la carpeta gestcon y vuelve a ejecutarlo.
  goto :fin
)

rem ---------- 1. Comprobar herramientas ----------
rem Si se acaban de instalar, Windows puede no tenerlas aun en el PATH: buscarlas
for %%d in ("%ProgramFiles%\Git\cmd" "%ProgramFiles(x86)%\Git\cmd" "%LOCALAPPDATA%\Programs\Git\cmd" "%ProgramFiles%\GitHub CLI" "%LOCALAPPDATA%\Programs\GitHub CLI") do (
  if exist "%%~d" set "PATH=%%~d;!PATH!"
)
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git no esta instalado.
  echo         Instalalo desde https://git-scm.com/download/win y vuelve a ejecutar este archivo.
  goto :fin
)
where gh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] GitHub CLI no esta instalado.
  echo         Instalalo desde https://cli.github.com  o con:  winget install --id GitHub.cli
  echo         Despues cierra esta ventana y vuelve a ejecutar este archivo.
  goto :fin
)

rem ---------- 2. Iniciar sesion en GitHub ----------
gh auth status >nul 2>nul
if errorlevel 1 (
  echo Hay que iniciar sesion en GitHub. Se abrira el navegador para autorizar.
  echo.
  gh auth login --hostname github.com --git-protocol https --web
  if errorlevel 1 (
    echo [ERROR] No se pudo iniciar sesion en GitHub.
    goto :fin
  )
)
set "USUARIO="
for /f "delims=" %%u in ('gh api user --jq .login') do set "USUARIO=%%u"
if "%USUARIO%"=="" (
  echo [ERROR] No se pudo obtener el usuario de GitHub.
  goto :fin
)
echo Sesion iniciada como: %USUARIO%
echo.

rem ---------- 3. Preguntar nombre y visibilidad ----------
set "REPO=gestcon"
set /p "REPO=Nombre del repositorio [gestcon]: "
if "%REPO%"=="" set "REPO=gestcon"

echo.
echo Visibilidad del repositorio:
echo   1 = Privado (recomendado: el codigo no es visible para otros)
echo   2 = Publico
echo  (La pagina web de la aplicacion sera publica en ambos casos; solo contiene
echo   el programa, nunca datos ni plantillas.)
set "VIS=1"
set /p "VIS=Elige 1 o 2 [1]: "
set "VISFLAG=--private"
if "%VIS%"=="2" set "VISFLAG=--public"

rem ---------- 4. Preparar git ----------
if not exist ".git" (
  git init -b main
)
for /f "delims=" %%n in ('git config user.name') do set "GNAME=%%n"
for /f "delims=" %%e in ('git config user.email') do set "GMAIL=%%e"
if "%GNAME%"=="" git config user.name "%USUARIO%"
if "%GMAIL%"=="" git config user.email "%USUARIO%@users.noreply.github.com"

git branch -M main
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "GESTCON: actualizacion del proyecto"
)
git rev-parse HEAD >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No hay ningun commit que subir.
  goto :fin
)

rem ---------- 5. Crear el repositorio (si no existe) ----------
gh repo view "%USUARIO%/%REPO%" >nul 2>nul
if errorlevel 1 (
  echo.
  echo Creando el repositorio %USUARIO%/%REPO% ...
  gh repo create "%USUARIO%/%REPO%" %VISFLAG% --description "GESTCON - Gestion de patrocinios deportivos"
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el repositorio.
    goto :fin
  )
) else (
  echo.
  echo El repositorio %USUARIO%/%REPO% ya existe en GitHub: se usara tal cual.
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "https://github.com/%USUARIO%/%REPO%.git"
) else (
  git remote set-url origin "https://github.com/%USUARIO%/%REPO%.git"
)

rem ---------- 6. Activar GitHub Pages con GitHub Actions ----------
echo.
echo Activando GitHub Pages (origen: GitHub Actions) ...
gh api -X POST "repos/%USUARIO%/%REPO%/pages" -f build_type=workflow >nul 2>nul
if errorlevel 1 (
  gh api -X PUT "repos/%USUARIO%/%REPO%/pages" -f build_type=workflow >nul 2>nul
  if errorlevel 1 (
    set "PAGES_MANUAL=1"
  )
)

rem ---------- 7. Subir el codigo ----------
echo.
echo Subiendo el codigo ...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo subir. Si el repositorio ya tenia contenido distinto,
  echo         revisalo en https://github.com/%USUARIO%/%REPO%
  goto :fin
)

rem ---------- 8. Resumen ----------
echo.
echo  ============================================================
echo   LISTO. El codigo esta en:
echo     https://github.com/%USUARIO%/%REPO%
echo.
echo   El flujo de publicacion se esta ejecutando (tarda 1-2 minutos):
echo     https://github.com/%USUARIO%/%REPO%/actions
echo.
echo   Cuando termine en verde, la aplicacion estara en:
echo     https://%USUARIO%.github.io/%REPO%/
echo  ============================================================
if defined PAGES_MANUAL (
  echo.
  echo   AVISO: no se pudo activar Pages automaticamente. Hazlo a mano:
  echo     https://github.com/%USUARIO%/%REPO%/settings/pages
  echo     En "Source" elige "GitHub Actions". Despues, en la pestana Actions,
  echo     pulsa "Run workflow" en "Publicar en GitHub Pages".
)
echo.
echo   RECUERDA: datos.sqlite y las 8 plantillas Word NO se suben a GitHub.
echo   Copialos a la carpeta de red (datos.sqlite y la subcarpeta plantillas).
echo.
set /p "ABRIR=Abrir la pagina de Actions en el navegador? [S/n]: "
if /i not "%ABRIR%"=="n" start "" "https://github.com/%USUARIO%/%REPO%/actions"

:fin
echo.
pause
endlocal
