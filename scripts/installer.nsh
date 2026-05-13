; installer.nsh — SAB custom NSIS hooks
; Plain NSIS only — no LogicLib, no nested quotes, no loops.
;
; Why customInit does the heavy lifting:
;   uninstallOldVersion (installUtil.nsh) runs the OLD uninstaller silently and
;   shows $(appCannotBeClosed) after 5 failed attempts.  By wiping the registry
;   entries before the install section starts, uninstallOldVersion finds nothing
;   and returns early — no dialog.

!macro preInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 1000
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 3000
!macroend

!macro customInit
  ; 1. Kill all SAB.exe processes (main Electron + bridge child)
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 2000
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 1000

  ; 2. Read old install location and delete directory so files are not locked
  ReadRegStr $9 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  StrCmp $9 "" sab_no_old_dir
    RMDir /r "$9"
  sab_no_old_dir:

  ; 3. Wipe uninstall registry entries — uninstallOldVersion will find nothing
  ;    and skip its retry loop (which is the true source of the dialog).
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_GUID}"
!macroend

; Replaces the built-in "SAB cannot be closed" dialog in CHECK_APP_RUNNING.
; Belt-and-suspenders: customInit already killed SAB, but this catches any
; restart that happens between .onInit and the install section.
!macro customCheckAppRunning
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 800
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM SAB.exe' $0
  Sleep 2000
!macroend
