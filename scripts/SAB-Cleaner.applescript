-- SAB Cleaner
-- Удаляет старую версию SAB перед установкой новой

on run
	set appExists to false
	set dataExists to false

	-- Проверяем наличие приложения
	try
		do shell script "test -d '/Applications/SAB.app' && echo yes || echo no"
		if result is "yes" then set appExists to true
	end try

	-- Проверяем наличие пользовательских данных
	set dataPath to (path to application support folder from user domain as text) & "SAB"
	set posixData to POSIX path of dataPath
	try
		do shell script "test -d " & quoted form of posixData & " && echo yes || echo no"
		if result is "yes" then set dataExists to true
	end try

	if not appExists and not dataExists then
		display dialog "SAB не найден на этом Mac." & return & "Ничего удалять не нужно." buttons {"OK"} default button "OK" with title "SAB Cleaner" with icon note
		return
	end if

	-- Предупреждение
	set msg to "Подготовка к установке новой версии SAB." & return & return
	if appExists then set msg to msg & "• /Applications/SAB.app — будет удалён" & return
	if dataExists then set msg to msg & "• Конфиг камер и ATEM — будет предложено сохранить" & return

	display dialog msg buttons {"Отмена", "Продолжить"} default button "Продолжить" cancel button "Отмена" with title "SAB Cleaner" with icon caution

	-- Остановить SAB если работает
	try
		do shell script "pkill -x 'SAB' 2>/dev/null; sleep 0.5; true"
	end try

	-- Удалить приложение
	if appExists then
		do shell script "rm -rf '/Applications/SAB.app'"
	end if

	-- Спросить про конфиг
	if dataExists then
		display dialog "Сохранить конфиг?" & return & return & "В нём хранятся IP камер и настройки ATEM." & return & "Если оставишь — новая версия подхватит их." buttons {"Удалить конфиг", "Оставить"} default button "Оставить" with title "SAB Cleaner"
		if button returned of result is "Удалить конфиг" then
			do shell script "rm -rf " & quoted form of posixData
		end if
	end if

	display dialog "Готово." & return & "Устанавливай новую версию из DMG." buttons {"OK"} default button "OK" with title "SAB Cleaner" with icon note
end run
