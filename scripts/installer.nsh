; installer.nsh — SAB custom NSIS hooks (included by electron-builder)

; preInit: runs at the very start of .onInit, before any other checks
!macro preInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe' $0
  Sleep 2000
!macroend

; customInit: second kill attempt later in .onInit
!macro customInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe' $0
  Sleep 1000
!macroend

; customCheckAppRunning: replaces the built-in "app is running" dialog.
; Called at the start of the install section, right before files are written.
; We kill silently — no popup, no user interaction needed.
!macro customCheckAppRunning
  ExecWait '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe' $0
  Sleep 2000
!macroend
