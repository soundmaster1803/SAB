; SAB Cleaner — удаляет старую версию SAB перед установкой новой

Unicode True
Name "SAB Cleaner"
OutFile "SAB-Cleaner.exe"
RequestExecutionLevel user
ShowInstDetails nevershow
InstProgressFlags smooth

!include "LogicLib.nsh"

Page instfiles

Section "Clean"

  DetailPrint "SAB Cleaner — подготовка к установке новой версии..."

  ; Спрашиваем подтверждение
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "SAB Cleaner$\r$\n$\r$\nУдалит старую версию SAB с этого компьютера.$\r$\nКонфиг камер предложим сохранить отдельно.$\r$\n$\r$\nПродолжить?" \
    IDOK do_clean IDCANCEL abort

  abort:
    Abort "Отменено."

  do_clean:

  ; Остановить SAB
  DetailPrint "Останавливаю SAB..."
  ExecWait 'taskkill /IM "SAB.exe" /F' $0
  Sleep 1000

  ; Запустить встроенный деинсталлятор (если установлено через Setup.exe)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAB" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Запускаю деинсталлятор..."
    ExecWait '"$0" /S'
    Sleep 3000
  ${EndIf}

  ; Удалить папку приложения если осталась
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\SAB"
    DetailPrint "Удаляю папку приложения..."
    RMDir /r "$LOCALAPPDATA\Programs\SAB"
  ${EndIf}

  ; Удалить записи в реестре
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAB"
  DetailPrint "Реестр очищен."

  ; Спросить про конфиг
  ${If} ${FileExists} "$APPDATA\SAB\*"
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Сохранить конфиг?$\r$\n$\r$\nВ нём хранятся IP камер и настройки ATEM.$\r$\nЕсли оставишь — новая версия подхватит их." \
      IDYES done IDNO del_data

    del_data:
      DetailPrint "Удаляю конфиг..."
      RMDir /r "$APPDATA\SAB"
  ${EndIf}

  done:
  DetailPrint "Готово!"
  MessageBox MB_OK|MB_ICONINFORMATION \
    "Готово.$\r$\n$\r$\nУстанавливай новую версию из Setup .exe"

SectionEnd
