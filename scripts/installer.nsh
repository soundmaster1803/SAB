; installer.nsh — SAB custom NSIS hooks (included by electron-builder)
; Runs before any installer UI so the user never sees the "app is running" error.

!macro customInit
  ; Kill SAB and all its child processes (bridge runs as child of main Electron process)
  ExecWait 'cmd /C "taskkill /F /T /IM SAB.exe >nul 2>&1"' $0
  Sleep 2000
!macroend
