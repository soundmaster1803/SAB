; SAB Cleaner — останавливает SAB и удаляет старую версию перед установкой новой

Unicode True
Name "SAB Cleaner"
OutFile "SAB-Cleaner.exe"
RequestExecutionLevel user
ShowInstDetails show
InstProgressFlags smooth

!include "LogicLib.nsh"

Page instfiles

Section "Clean"

  DetailPrint "SAB Cleaner — подготовка к установке новой версии..."

  ; Подтверждение
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "SAB Cleaner$\r$\n$\r$\nОстановит SAB и удалит старую версию с этого компьютера.$\r$\nКонфиг камер (IP, ATEM) предложим сохранить отдельно.$\r$\n$\r$\nПродолжить?" \
    IDOK do_clean IDCANCEL abort

  abort:
    Abort "Отменено."

  do_clean:

  ; Убиваем SAB и все его дочерние процессы (bridge запускается как child)
  DetailPrint "Останавливаю SAB..."
  ExecWait 'cmd /C "taskkill /F /T /IM SAB.exe >nul 2>&1"' $0
  Sleep 2500

  ; Запустить встроенный деинсталлятор (если установлено через Setup.exe)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAB" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Запускаю встроенный деинсталлятор..."
    ExecWait '"$0" /S'
    Sleep 3000
  ${EndIf}

  ; Удалить папку приложения если осталась после деинсталлятора
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\SAB"
    DetailPrint "Удаляю остатки папки приложения..."
    RMDir /r "$LOCALAPPDATA\Programs\SAB"
  ${EndIf}

  ; Убрать запись реестра
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SAB"
  DetailPrint "Реестр очищен."

  ; Спросить про конфиг камер
  ${If} ${FileExists} "$APPDATA\SAB\*"
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Сохранить конфиг камер?$\r$\n$\r$\nВ нём хранятся IP камер и настройки ATEM.$\r$\nЕсли оставишь — новая версия подхватит их автоматически." \
      IDYES done IDNO del_data

    del_data:
      DetailPrint "Удаляю конфиг..."
      RMDir /r "$APPDATA\SAB"
  ${EndIf}

  done:
  DetailPrint "Готово — можно запускать новый установщик."
  MessageBox MB_OK|MB_ICONINFORMATION \
    "Готово.$\r$\n$\r$\nSAB остановлен и удалён. Теперь запускай новый Setup .exe"

SectionEnd
