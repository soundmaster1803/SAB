; installer.nsh — SAB custom NSIS hooks

; ── preInit: runs at very start of .onInit, before any checks ─────────────────
!macro preInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 500
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 2000
!macroend

; ── customInit: second pass later in .onInit ──────────────────────────────────
!macro customInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 1500
!macroend

; ── customCheckAppRunning: replaces the built-in "app is running" dialog ──────
; Called in install section AND uninstall section before writing files.
; We kill silently and loop until the process is confirmed dead.
!macro customCheckAppRunning
  sabKillLoop:
    ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
    Sleep 800
    ; Check if still running via tasklist exit code (0 = found, 1 = not found)
    nsExec::ExecToStack 'cmd /C "tasklist /FI "IMAGENAME eq SAB.exe" /FO CSV 2>nul | find /I "SAB.exe" >nul 2>&1"'
    Pop $0
    ${If} $0 == 0
      Goto sabKillLoop
    ${EndIf}
!macroend
