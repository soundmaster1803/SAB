; installer.nsh — SAB custom NSIS hooks
; nsExec runs processes hidden (CREATE_NO_WINDOW).

; ── preInit: very first thing in .onInit ──────────────────────────────────────
!macro preInit
  ; 1. Graceful shutdown via HTTP
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -Command "try{Invoke-RestMethod -Method POST -Uri http://127.0.0.1:7777/api/shutdown -TimeoutSec 2;exit 0}catch{exit 1}"'
  Pop $0
  IntCmp $0 0 sab_pre_ok sab_pre_skip sab_pre_skip
  sab_pre_ok:
    Sleep 2000
  sab_pre_skip:

  ; 2. Force-kill entire SAB process tree (/T kills children too)
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe'
  Pop $0

  ; 3. Delete registry keys via reg.exe (always available, no PowerShell policy issues)
  nsExec::Exec 'reg.exe delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" /f'
  Pop $0
  nsExec::Exec 'reg.exe delete "HKCU\Software\${APP_GUID}" /f'
  Pop $0
!macroend

; ── customInit: runs after initMultiUser ─────────────────────────────────────
; Belt-and-suspenders NSIS registry cleanup so uninstallOldVersion() returns
; immediately without running the old uninstaller.
!macro customInit
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_GUID}"
!macroend

; ── customCheckAppRunning: runs inside install Section, just before file copy ─
; This is the critical moment: kill SAB, wait for Windows Defender to finish
; any post-kill file scans, then delete the install directory so CopyFiles
; writes to a clean (empty) destination — no locked-file conflicts.
!macro customCheckAppRunning
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe'
  Pop $0
  Sleep 4000
  RMDir /r "$INSTDIR"
!macroend
