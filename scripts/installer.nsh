; installer.nsh — SAB custom NSIS hooks
; nsExec runs processes hidden (CREATE_NO_WINDOW).

; ── preInit: very first thing in .onInit ──────────────────────────────────────
!macro preInit
  ; Ask SAB to quit gracefully via its own endpoint, then force-kill.
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -Command "try{Invoke-RestMethod -Method POST -Uri http://127.0.0.1:7777/api/shutdown -TimeoutSec 2;exit 0}catch{exit 1}"'
  Pop $0
  IntCmp $0 0 sab_pre_responded sab_pre_nokill sab_pre_nokill
  sab_pre_responded:
    Sleep 2000
  sab_pre_nokill:
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000
!macroend

; ── customInit: runs after initMultiUser, still inside .onInit ────────────────
; Root cause of the dialog: uninstallOldVersion() runs the OLD uninstaller with
; the --updated flag, which triggers atomicRMDir. If any file is briefly locked
; (e.g. by Windows Defender scanning), atomicRMDir calls Abort → exit code ≠ 0
; → uninstallOldVersion retries 6 times → shows $(appCannotBeClosed).
;
; Fix: wipe the registry keys so uninstallOldVersion finds no old entry and
; returns immediately.  Also delete the install directory so atomicRMDir finds
; nothing even if the old uninstaller is somehow invoked anyway.
!macro customInit
  ; Read the actual install location set by the old installer, fall back to default.
  ReadRegStr $9 HKCU "Software\${APP_GUID}" "InstallLocation"
  StrCmp $9 "" sab_use_default_dir
    RMDir /r "$9"
    Goto sab_del_keys
  sab_use_default_dir:
    RMDir /r "$LOCALAPPDATA\Programs\SAB"
  sab_del_keys:
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_GUID}"
!macroend

; ── customCheckAppRunning: replaces the built-in dialog in CHECK_APP_RUNNING ──
!macro customCheckAppRunning
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000
!macroend
