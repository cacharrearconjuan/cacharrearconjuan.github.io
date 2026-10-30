---
titulo: Limpiar una tele TD Systems con Android TV
resumen: Quita los anuncios, el reconocimiento de contenido y las apps que sobran de una TD Systems con Android TV 14 (placa Changhong «redwood»), pon una pantalla de inicio limpia y haz que encienda en ella. Y cómo dejarlo todo como estaba.
fecha: 2026-10-30
# video: https://www.youtube.com/watch?v=...
---

Se hace todo desde un PC con Windows, por la red, con [Clean Your TV](https://github.com/Gathin23/cleanyourtv), un proyecto de código abierto (licencia MIT) con listas probadas por su comunidad. Nada se desinstala: las apps solo se **desactivan**, y antes de tocar nada se guarda el estado de la tele para poder deshacerlo.

**¿Para qué teles sirve?** Para la TD Systems K40DLC19GLE y las teles con la misma placa: Changhong «redwood» con Android TV 14. Se venden también como realme de 40", CHiQ DVB92CQ, ERGO DVB92YC, RCA AI PONT SA y AIWA AW32B4SMG. Si tu tele es otra, busca la lista de tu modelo en la carpeta [`examples`](https://github.com/Gathin23/cleanyourtv/tree/main/examples) del proyecto: esta guía no te vale tal cual.

Los comandos se escriben en **PowerShell**: cada bloque tiene su botón **Copiar**. Donde pone `IP_DE_LA_TELE`, escribe la IP de tu tele.

## 1. Lo que necesitas en el PC

1. **Python 3**, desde [python.org](https://www.python.org/downloads/). Durante la instalación, marca **Add python.exe to PATH**.
2. **Git for Windows**, desde [git-scm.com](https://git-scm.com).
3. **Docker Desktop**, desde [docker.com](https://www.docker.com/products/docker-desktop/). Sirve para compilar la pantalla de inicio sin instalar Java ni Android Studio. Si te pide instalar WSL2, acepta y reinicia el PC. Déjalo abierto mientras sigues la guía.

Ten a mano el **mando** de la tele y la **contraseña de tu Wi-Fi**, por si la tele la olvidara.

## 2. Preparar la tele

1. Ve a **Ajustes › Preferencias del dispositivo › Información** y pulsa OK 7 veces sobre **Compilación** (puede llamarse «Compilación del SO de Android TV»). Se activan las opciones para desarrolladores.
2. Vuelve atrás, entra en **Opciones para desarrolladores** y activa **Depuración por USB**. En esta placa eso abre también la conexión por red.
3. Apunta la IP de la tele. Está en **Ajustes › Red e Internet**, entrando en tu red.
4. **Fija esa IP en el router** (en su web, busca «reserva de DHCP» o «IP estática» y asocia la tele a su IP actual). Es importante: el estado guardado para deshacer va asociado a la IP, y esta tele puede cambiarla al reiniciar.

## 3. Descargar Clean Your TV y comprobar la tele

Abre **PowerShell** y escribe:

```powershell
cd ~
git clone https://github.com/Gathin23/cleanyourtv
cd cleanyourtv
py -m venv tools\venv
tools\venv\Scripts\python.exe -m pip install -r tools\requirements.txt
```

Ahora prepara la ventana. **Esto hay que repetirlo cada vez que abras una ventana nueva de PowerShell** (para seguir la guía otro día, por ejemplo):

```powershell
cd ~\cleanyourtv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:TV_HOST = "IP_DE_LA_TELE"
```

Comprueba que llega a la tele:

```powershell
tools\venv\Scripts\python.exe -I tools\tv.py --probe
```

La primera vez sale en la tele «¿Permitir depuración USB?». Marca **Permitir siempre desde este ordenador** y pulsa **Aceptar**. Repite el comando: tiene que salir el modelo, `redwood` y Android 14. Si sale otra cosa, para aquí: esta guía no es para tu tele.

## 4. Tu lista: decide qué conservar

Copia la lista de tu placa a tu carpeta de usuario y ábrela:

```powershell
copy examples\rca-ai-pont\debloat.txt "$HOME\td-k40.txt"
notepad "$HOME\td-k40.txt"
```

Cada línea que no empieza por `#` es una app que se desactivará. Para **conservar** algo, pon `#` al principio de su línea y guarda:

| Línea | Ponle `#` si quieres conservar… |
|---|---|
| `com.homwee.upgrade` y `com.homwee.dmt.upgrade` | las actualizaciones de la tele |
| `com.google.android.katniss` | el micrófono del mando |
| `com.homwee.mmp.fileexplorer` y `com.homwee.mmp.imageplayer` | ver archivos y fotos de un USB |
| `com.homwee.mmp.screenshare` y `com.homwee.multiscreenshare` | duplicar la pantalla del móvil |
| `com.google.android.tv.remote.service` | usar el móvil como mando |
| `com.google.android.tts` | la lectura de voz |
| `com.homwee.alexacontrol` | Alexa en la tele |

No añadas nada que no esté en la lista. Lo que hace funcionar la TDT, las entradas HDMI y el mando ya está fuera a propósito.

**Después no muevas ni borres `td-k40.txt`**: para deshacer hace falta el mismo archivo en el mismo sitio.

## 5. Limpiar

```powershell
.\tools\disable.ps1 "$HOME\td-k40.txt"
```

Antes de tocar nada guarda el estado de la tele (en `C:\Users\TU_USUARIO\.cleanyourtv\`). Luego desactiva las apps de la lista, una a una. Tiene protecciones propias:

- Se niega a desactivar lo que Android y la TDT necesitan para arrancar.
- Si el asistente de configuración es el que guarda tu Wi-Fi, lo deja como está, para que la tele no la olvide.
La pantalla de inicio de Google no está en la lista: la desactiva el paso siguiente, y solo cuando la nueva ya funciona.

Algún aviso amarillo de «Skipping…» es normal: son esas protecciones.

## 6. Instalar la pantalla de inicio limpia

Con Docker Desktop abierto:

```powershell
.\tools\docker-build.ps1
```

La primera vez tarda unos minutos: descarga lo necesario para compilar (ocupa alrededor de 1,5 GB). Después:

```powershell
$env:SKIP_BUILD = "1"
.\launcher\build-and-install.ps1 -HomeKeyService
cd ~\cleanyourtv
```

Instala la pantalla de inicio, la pone como predeterminada y comprueba que arranca. Solo entonces desactiva la de Google; si algo falla, la deja como estaba. `-HomeKeyService` activa un pequeño servicio de la propia pantalla de inicio que hace falta para el paso siguiente.

## 7. Que la tele encienda en la pantalla de inicio

En esta placa, al encender desde el enchufe la tele va directa a la TV en directo. Para que vaya a la pantalla de inicio, crea su configuración:

```powershell
mkdir "$HOME\tema-td"
notepad "$HOME\tema-td\config.json"
```

Pega esto en el Bloc de notas y guarda:

```json
{
  "dock_apps": [
    "com.google.android.youtube.tv",
    "com.android.vending"
  ],
  "hidden_apps": [
    "com.mediatek.wwtv.tvcenter",
    "com.android.tv.settings",
    "com.cltv.fast"
  ],
  "live_tv_package": "com.mediatek.wwtv.tvcenter",
  "power_on_home": true
}
```

`dock_apps` son las apps de la fila principal: cámbialas por las tuyas si quieres. `hidden_apps` oculta la TV en directo y los Ajustes (siguen accesibles desde los botones de arriba) y una app de canales con anuncios que la tele reactiva sola en cada encendido.

Envíala a la tele:

```powershell
.\tools\theme.ps1 "$HOME\tema-td"
cd ~\cleanyourtv
```

## 8. Comprobar que todo va bien

1. Apaga la tele **desde el enchufe**, espera unos segundos y enciéndela: tiene que llegar a la pantalla de inicio nueva.
2. Pulsa **Inicio** en el mando: también.
3. Prueba la **TV en directo** (TDT) y las **entradas HDMI** desde la pantalla de inicio.
4. Prueba a **mantener pulsado el volumen**. En otra tele Changhong, el servicio del paso 6 hizo que dejara de subir de golpe al mantenerlo. Si te pasa y te molesta, deshaz solo eso con el apartado 9.

Si una actualización de la tele vuelve a activar algo, compruébalo y corrígelo con:

```powershell
tools\venv\Scripts\python.exe -I tools\check.py "$HOME\td-k40.txt"
tools\venv\Scripts\python.exe -I tools\check.py --fix "$HOME\td-k40.txt"
```

Siempre dirá que `com.cltv.fast` ha vuelto: la tele la reactiva en cada encendido. Es normal, y la pantalla de inicio la tiene oculta.

## 9. Dejarlo todo como estaba

Abre PowerShell y prepara la ventana como en el paso 3 (`cd`, `Set-ExecutionPolicy` y `$env:TV_HOST`). La tele tiene que tener la depuración USB activada y la misma IP.

1. Reactiva todo lo desactivado y devuelve la pantalla de inicio de Google:

```powershell
.\tools\restore.ps1 "$HOME\td-k40.txt"
```

Solo reactiva lo que desactivó la limpieza: lo que ya venía desactivado de fábrica, sigue igual.

2. Quita la pantalla de inicio limpia y su servicio:

```powershell
tools\venv\Scripts\python.exe -I tools\tv.py "pm uninstall com.gathin.tvhome"
's=$(settings get secure enabled_accessibility_services); case "$s" in null|"") settings put secure accessibility_enabled 0 ;; esac' | tools\venv\Scripts\python.exe -I tools\tv.py --batch
```

El segundo comando apaga la accesibilidad solo si no queda ningún otro servicio que la use.

3. Apaga la tele desde el enchufe y vuelve a encenderla.

**Para quitar solo el servicio del paso 6** (por ejemplo, por lo del volumen) sin deshacer nada más:

```powershell
's=$(settings get secure enabled_accessibility_services); [ "$s" = null ] && s=""; n=$(echo "$s" | tr ":" "\n" | grep -v "com.gathin.tvhome/.*HomeKeyService" | tr "\n" ":" | sed "s/:*$//"); settings put secure enabled_accessibility_services "$n"; [ -z "$n" ] && settings put secure accessibility_enabled 0; echo hecho' | tools\venv\Scripts\python.exe -I tools\tv.py --batch
```

Quita ese servicio y deja los demás como estaban. La tele volverá a encender en la TV en directo, y con **Inicio** irás a la pantalla limpia. Volver a instalar sin `-HomeKeyService` no lo quita: el instalador conserva los servicios que ya estaban activos.

**Si cambias de PC o borras la carpeta `.cleanyourtv`**, ya no se puede deshacer exactamente como estaba. Guarda una copia de `C:\Users\TU_USUARIO\.cleanyourtv\` y de `td-k40.txt` en otro sitio.

**Último recurso:** un restablecimiento de fábrica (en **Ajustes › Preferencias del dispositivo › Información**) deja la tele como nueva, pero borra también tus apps y cuentas.

## 10. Al terminar

Desactiva la **Depuración por USB** en las opciones para desarrolladores. Mientras está activa, cualquiera en tu red puede pedir acceso a la tele. Comprueba que queda cerrada:

```powershell
tools\venv\Scripts\python.exe -I tools\adb-closed.py IP_DE_LA_TELE
```

Para deshacer los cambios más adelante, vuelve a activarla.

## Créditos

- [Clean Your TV](https://github.com/Gathin23/cleanyourtv), de Gathin y su comunidad (licencia MIT): los scripts, la lista de esta placa y la pantalla de inicio.
- La lista `rca-ai-pont` la probaron sus colaboradores en la RCA, la realme, la AIWA, la CHiQ y la ERGO, que comparten placa y firmware.
