; installer.nsh — SAB custom NSIS hooks
; nsExec::Exec runs processes hidden (CREATE_NO_WINDOW) — no console flashes.

!macro preInit
  ; Ask SAB to shut itself down via its HTTP endpoint.
  ; PowerShell exits 0 if SAB responded, 1 if not running / no endpoint.
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -Command "try{Invoke-RestMethod -Method POST -Uri http://127.0.0.1:7777/api/shutdown -TimeoutSec 2;exit 0}catch{exit 1}"'
  Pop $0
  ; Only wait for graceful exit if SAB actually responded (exit 0).
  IntCmp $0 0 sab_shutdown_ok sab_no_response sab_no_response
  sab_shutdown_ok:
    Sleep 2000
  sab_no_response:
  ; Force-kill anything named SAB.exe still alive.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000
!macroend

; Safety net: replaces the "SAB cannot be closed" dialog in CHECK_APP_RUNNING.
; By this point preInit already shut SAB down, so this almost never fires.
!macro customCheckAppRunning
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000
!macroend
