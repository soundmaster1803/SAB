; installer.nsh — SAB custom NSIS hooks
; nsExec runs processes hidden (CREATE_NO_WINDOW).

; ── preInit: very first thing in .onInit ──────────────────────────────────────
!macro preInit
  ; Ask SAB to quit gracefully, then force-kill entire process tree.
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -Command "try{Invoke-RestMethod -Method POST -Uri http://127.0.0.1:7777/api/shutdown -TimeoutSec 2;exit 0}catch{exit 1}"'
  Pop $0
  IntCmp $0 0 sab_pre_ok sab_pre_skip sab_pre_skip
  sab_pre_ok:
    Sleep 2000
  sab_pre_skip:
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe'
  Pop $0
!macroend

; ── customInit: runs after initMultiUser, inside .onInit ─────────────────────
; Belt-and-suspenders: delete registry keys early so uninstallOldVersion()
; has nothing to find even if customCheckAppRunning somehow fails.
!macro customInit
  DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
!macroend

; ── customCheckAppRunning: runs inside install Section, before uninstallOldVersion ──
; This macro is compiled in BOTH installer and uninstaller contexts (uninstaller.nsh
; calls !insertmacro CHECK_APP_RUNNING inside un.checkAppRunning). Guard all
; installer-only code with !ifndef BUILD_UNINSTALLER.
; Strategy:
;   1. Kill SAB process tree.
;   2. Read InstallLocation from ${INSTALL_REGISTRY_KEY} (no GUID hardcoding).
;   3. Construct uninstaller path as "$R7\Uninstall ${PRODUCT_FILENAME}.exe".
;   4. Run old uninstaller WITHOUT --updated → atomicRMDir is NOT triggered → exits 0.
;   5. Wipe registry keys so uninstallOldVersion() finds nothing and returns.
;   6. Sleep 4 s so Defender finishes post-kill scans.
;   7. RMDir $INSTDIR so CopyFiles writes to a clean empty directory.
!macro customCheckAppRunning
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM SAB.exe'
  Pop $0
  !ifndef BUILD_UNINSTALLER
    ReadRegStr $R7 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
    StrCmp $R7 "" sab_car_no_old
      StrCpy $R8 "$R7\Uninstall ${PRODUCT_FILENAME}.exe"
      IfFileExists "$R8" 0 sab_car_no_old
        CopyFiles /SILENT "$R8" "$PLUGINSDIR\sab-old.exe"
        ExecWait '"$PLUGINSDIR\sab-old.exe" /S /KEEP_APP_DATA /currentuser _?=$R7' $0
    sab_car_no_old:
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
    Sleep 4000
    RMDir /r "$INSTDIR"
  !endif
!macroend
