; installer.nsh — SAB custom NSIS hooks
; nsExec runs processes hidden (CREATE_NO_WINDOW).

; ── preInit: very first thing in .onInit ──────────────────────────────────────
; Strategy:
;   1. Ask SAB to quit gracefully via HTTP endpoint.
;   2. Force-kill SAB.exe.
;   3. Write a .ps1 script to %TEMP% and execute it (avoids inline quoting hell).
;      The script:
;        a. Finds the old uninstaller in the registry / default path.
;        b. Runs it WITHOUT --updated so atomicRMDir is never triggered.
;        c. Deletes both registry keys so uninstallOldVersion() returns immediately.
;        d. Removes the install dir if still present.
!macro preInit
  ; 1. Graceful shutdown via HTTP
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -Command "try{Invoke-RestMethod -Method POST -Uri http://127.0.0.1:7777/api/shutdown -TimeoutSec 2;exit 0}catch{exit 1}"'
  Pop $0
  IntCmp $0 0 sab_pre_ok sab_pre_skip sab_pre_skip
  sab_pre_ok:
    Sleep 2000
  sab_pre_skip:

  ; 2. Force-kill any remaining SAB.exe process
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000

  ; 3. Write cleanup script to %TEMP%
  FileOpen $8 "$TEMP\sab_cleanup.ps1" w
  FileWrite $8 "$$guid='${APP_GUID}'$\r$\n"
  FileWrite $8 "$$ik='HKCU:\Software\'+$$guid$\r$\n"
  FileWrite $8 "$$uk='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\'+$$guid$\r$\n"
  FileWrite $8 "$$d=(Get-ItemProperty $$ik -EA 0).InstallLocation$\r$\n"
  FileWrite $8 "if(-not $$d){$$d=$$env:LOCALAPPDATA+'\Programs\SAB'}$\r$\n"
  FileWrite $8 "$$e=$$d+'\Uninstall SAB.exe'$\r$\n"
  FileWrite $8 "if(-not (Test-Path $$e)){$$e=$$env:LOCALAPPDATA+'\Programs\SAB\Uninstall SAB.exe'}$\r$\n"
  FileWrite $8 "if(Test-Path $$e){$\r$\n"
  FileWrite $8 "  $$t=$$env:TEMP+'\sab_u.exe'$\r$\n"
  FileWrite $8 "  [IO.File]::Copy($$e,$$t,$$true)$\r$\n"
  FileWrite $8 "  Start-Process $$t '/S /KEEP_APP_DATA /currentuser' -Wait -EA 0$\r$\n"
  FileWrite $8 "  [IO.File]::Delete($$t)$\r$\n"
  FileWrite $8 "}$\r$\n"
  FileWrite $8 "Remove-Item $$uk -Recurse -EA 0$\r$\n"
  FileWrite $8 "Remove-Item $$ik -Recurse -EA 0$\r$\n"
  FileWrite $8 "if($$d -and (Test-Path $$d)){Remove-Item $$d -Recurse -Force -EA 0}$\r$\n"
  FileClose $8
  nsExec::Exec 'powershell.exe -WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\sab_cleanup.ps1"'
  Pop $0
  Delete "$TEMP\sab_cleanup.ps1"
!macroend

; ── customInit: runs after initMultiUser ─────────────────────────────────────
; Belt-and-suspenders: NSIS-level registry + dir cleanup in case preInit
; PowerShell step failed (e.g. policy restricted execution).
!macro customInit
  ReadRegStr $9 HKCU "Software\${APP_GUID}" "InstallLocation"
  StrCmp $9 "" sab_ci_default
    RMDir /r "$9"
    Goto sab_ci_keys
  sab_ci_default:
    RMDir /r "$LOCALAPPDATA\Programs\SAB"
  sab_ci_keys:
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\${APP_GUID}"
!macroend

; ── customCheckAppRunning: replaces the built-in retry dialog ─────────────────
!macro customCheckAppRunning
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM SAB.exe'
  Pop $0
  Sleep 1000
!macroend
