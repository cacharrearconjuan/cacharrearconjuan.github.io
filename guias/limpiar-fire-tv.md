---
titulo: Limpiar el Fire TV con dumbtv
resumen: Quita los anuncios, la telemetría y las actualizaciones automáticas de cualquier Fire TV desde el PC, sin root. Y cómo dejarlo todo como estaba.
fecha: 2026-10-29
# video: https://www.youtube.com/watch?v=...
---

Se hace todo desde un PC con Windows, por la red, con [dumbtv](https://github.com/humblemuzzu/dumbtv), un proyecto de código abierto. Los comandos se escriben en Git Bash: cada bloque tiene su botón **Copiar**. Donde pone `IP_DEL_FIRETV`, escribe la IP de tu Fire TV.

## 1. Instalar Git Bash y adb

1. Instala [Git for Windows](https://git-scm.com), que trae Git Bash.
2. Descarga platform-tools de la [página oficial de Google](https://developer.android.com/tools/releases/platform-tools), en el enlace «Download SDK Platform-Tools for Windows».
3. Descomprímelo en `C:\`. Te queda `C:\platform-tools\adb.exe`.
4. Abre Git Bash. A partir de aquí, todo se escribe ahí. Esto, una sola vez:

```bash
echo 'export PATH="/c/platform-tools:$PATH"' >> ~/.bashrc
source ~/.bashrc
adb version
```

## 2. Preparar el Fire TV

1. Ve a **Configuración › Mi Fire TV › Acerca de** y pulsa OK 7 veces sobre el nombre del dispositivo. Se activan las opciones para desarrolladores.
2. Vuelve a **Mi Fire TV › Opciones para desarrolladores › Depuración ADB: activada**.
3. Apunta la IP. Está en **Mi Fire TV › Acerca de › Red**.

## 3. Descargar dumbtv y conectarse

```bash
cd ~
git clone https://github.com/humblemuzzu/dumbtv
cd dumbtv
adb connect IP_DEL_FIRETV:5555
```

La primera vez sale en la tele «¿Permitir depuración USB?». Marca **Permitir siempre desde este ordenador** y pulsa OK.

Comprueba la conexión:

```bash
adb devices
```

Tiene que poner `device`. Si pone `unauthorized`, falta aceptar el aviso de la tele.

Si tienes más de un aparato conectado por adb, indica cuál es el Fire TV:

```bash
export ADB_SERIAL=IP_DEL_FIRETV:5555
```

## 4. Diagnóstico, que no cambia nada

```bash
./scripts/preflight.sh
```

Dice qué aparato es y qué cambiaría, y guarda una foto de los ajustes para poder deshacerlo después.

## 5. Limpiar

```bash
./scripts/all.sh
```

Antes de tocar nada te hace unas preguntas, en inglés. Con Enter se queda la respuesta que va en mayúscula (`[Y/n]` es sí; `[y/N]` es no).

| Pregunta | Qué contestar |
|---|---|
| Do you watch Prime Video? | Sí, si lo ves. |
| Keep Alexa and the remote's voice button? | Sí, si usas Alexa o la voz del mando. |
| Replace Amazon's home screen with dumbtv home? | Sí. |
| Run the DNS filter on the TV? | Sí. |
| Fire OS 6 only: let system apps bypass the filter so the clock syncs? | No (Enter). |
| Replace the YouTube app with SmartTube? | Si quieres: sin anuncios ni Shorts. |
| Apps to remove | Ninguna (Enter). |
| Anything from the cleanup to keep | Nada (Enter). |

Después pide confirmación antes de cada paso y reinicia el Fire TV dos veces. Son unos 5 minutos.

## 6. Comprobar

```bash
./scripts/verify.sh
```

Todo tiene que salir en `ok` o `skip`, sin ningún `FAIL`. Si falla el filtro DNS o la pantalla de inicio, repítelos y vuelve a comprobar:

```bash
./scripts/dnsfilter.sh -y
./scripts/launcher.sh -y
./scripts/verify.sh
```

## Deshacerlo

Desde la misma carpeta. No la borres: ahí, en `report/`, está la foto de los ajustes de antes.

```bash
cd ~/dumbtv
./scripts/restore.sh
```

Reactiva todo lo desactivado, devuelve los ajustes de antes, quita la VPN del filtro, devuelve la pantalla de inicio de Amazon y reinicia. Vuelve la portada de Amazon, con sus anuncios.

`restore.sh` deja instaladas, pero apagadas, las apps que añadió. Cuando termine de reiniciarse, vuelve a conectar y bórralas:

```bash
adb connect IP_DEL_FIRETV:5555
adb uninstall dnsfilter.android
adb uninstall tv.dumbtv.home
```
