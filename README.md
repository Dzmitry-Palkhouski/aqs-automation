# AQS / TestHarness: автоматизация в Edge IE mode

Сценарии из ручного исследования 25.11.2026, оформленные как Selenium-тесты (TypeScript, `selenium-webdriver`, IEDriverServer в режиме Edge IE).

| Файл | Что делает |
|---|---|
| `src/capture.ts` | **Запускается первым.** Открывает браузер под Selenium. Вы проходите сценарий руками и на каждом экране жмёте Enter в консоли. Скрипт сохраняет HTML и список полей (id, name, подпись, варианты списков) всех окон, диалогов и фреймов. |
| `src/locators.ts` | Все локаторы. Сейчас каждый равен `TODO`, их заполняем по снимкам из `captures/`. |
| `src/flows.ts` | Шаги AQS (вход, New Policy, Policy Information, локация, Rate с чтением ошибок, Issue) и неочевидные места, найденные при исследовании. |
| `src/aqs.ts` | Ожидания, переключение окон, select/checkbox, ожидание загрузки файла. |
| `src/config.ts` | Тестовые данные и URL; переопределяются через переменные окружения. |
| `tests/retrieval.test.ts` | TC-MTE-POLICY-RETRIEVAL-001: REST-запрос полиса из `aqs.local.json`, проверка PolicyNumber и PolicyId. |
| `tests/crime-policy.test.ts` | Новый полис Antique Auto Dealers с Crime / Employee Theft, Rate; Issue при `STOP_AFTER=issue`. |
| `tests/ocp-pa.test.ts` | OCP Commercial Auto (PA, PPT), Rate, затем пересчёт ставки Liability по алгоритму PPT LIA. |

## 1. Получение кода на VM

```powershell
cd $HOME\Downloads
git clone <repo-url> aqs-automation-git
cd aqs-automation-git
```

Обновление: `git pull`.

## 2. Подготовка на VM (один раз)

Скопируйте `aqs.local.example.json` в `aqs.local.json` и впишите адрес AQS и тестовый полис. Файл в `.gitignore`: внутренние адреса и номера полисов в репозиторий не попадают.

```powershell
npm install
npm run typecheck
```

Нужен `IEDriverServer.exe`: его путь передаётся в `IE_DRIVER_PATH`, либо он лежит в PATH. Скорее всего, он уже есть для Selenium Bridge, путь смотрите в `README.selenium.md`. Если в проекте есть своя фабрика драйвера для IE mode, можно подставить её в `src/driver.ts`.

Если Edge установлен не по стандартному пути, задайте его в `EDGE_PATH`.

## 3. Сбор локаторов (один ручной проход)

```powershell
npm run capture
```

Откроется Edge IE mode на стартовой странице AQS. Консоль управляется **только цифрами и Enter** (буквы через Horizon проходят ненадёжно):

| Клавиша | Действие |
|---|---|
| Enter | снимок всех окон, диалогов и фреймов в `captures\<время>\` |
| 1 | показать или скрыть жёлтые метки `#n id` / `#n @name` над полями текущего окна |
| 2 | список окон; `*` отмечает окно, к которому подключён Selenium |
| 3 / 4 | подключиться к следующему / самому новому окну (только что открытый диалог) |
| 5 | вывести поля текущего окна в консоль |
| 6 | снимок только текущего окна |
| 0 | выход (браузер остаётся открытым) |

После каждого перехода, открывшего новое окно или диалог, нажмите `4`, а затем `1` или `5`.

Порядок экранов для прохода в **этом** окне браузера (метки к снимкам не нужны: в имя файла попадает заголовок окна):

1. Войдите в AQS и на каждом экране нажимайте Enter в консоли:
   - стартовая страница → `start`
   - окно логина → `login`
   - Home → `home`, затем All Policies → `all policies`, New Policy (диалог) → `new policy type`
   - Policy Start → `policy start`, Policy Information (каждая вкладка) → `policy info`, `insured detail`
   - Location Address → `location`, LOB Action Menu → `lob`
   - Crime: `crime policy`, `crime state`, `crime class lookup`, `unit coverages`, `employee theft`
   - Commercial Auto: `cau policy`, `cau state`, `vehicle limits`, `common cov`, `vehicle summary`, `vehicle info`, `vehicle info 2`, `first party`, `vehicle coverages`, `rates factors`, `symbols`
   - после Rate → `rating errors`
   - любое «Application Message» → `app message`
   - Issue (по желанию): `policy numbering`, `policy documents`, `entered fields`, `issue options`
2. Для TestHarness в том же браузере откройте `.../AQS.PolicyAdministrationTest/Account/LogOn` (`harness logon`) и `.../PolicyRetrieval` (`retrieval`).
3. В конце нажмите `0`.

Снимки сохраняются в `captures\<время>\`. **Перенесите эту папку обратно на Mac**, по ней я заполню `src/locators.ts`. Поля паролей в JSON маскируются (`***`), но HTML-страницы могут содержать данные полисов, поэтому храните папку локально и не коммитьте её.

Новых полисов во время сбора создавать не обязательно: достаточно открыть экраны и нажать Cancel. Экраны внутри LOB и Issue, однако, открываются только у реального полиса.

## 4. Запуск тестов (после заполнения локаторов)

```powershell
$env:AQS_USER="..."; $env:AQS_PASSWORD="..."   # или войти вручную, когда тест попросит
npm run test:retrieval
npm run test:crime                    # по умолчанию до Rate
$env:STOP_AFTER="issue"; npm run test:crime
npm run test:ocp
```

`NEW_PATH_ID` закрепляет Path ID. По умолчанию на каждый запуск генерируется новый номер, перед стартом тест проверяет, что он свободен.

## Что известно заранее и уже учтено в коде

- Каждый уровень AQS открывается в своём окне, сообщения показываются как модальные «Application Message -- Webpage Dialog», а не JS alert.
- Path ID подставляет адрес в CA. Для PA адрес переписывается, иначе Rate падает с «Location Address State does not match».
- Для Commercial Auto без Covered Auto Symbols (символ 7 для Liability, PIP, UM, UIM, Comprehensive, Collision, Towing) Rate падает.
- После OK на Vehicle Information страница висит, пока не обработан скрытый диалог 1st Party Benefits.
- Bld # становится активным только после ухода фокуса из блока адреса.
- В комбобоксе Product Code ввод префикса может выбрать соседний пункт (Antique Auto **Umbrella**), поэтому значение проверяется.
- В той же Home-сессии New Policy иногда перестаёт открывать диалог. Помогает новый вход: тест каждый раз начинает с новой сессии.

## Открытые вопросы (проверятся на первом прогоне)

- **Скачивание в TestHarness.** В Edge IE mode может появиться панель Open/Save, которую Selenium не нажмёт. Тогда либо включить автосохранение загрузок политикой Edge на VM, либо отправлять форму запросом из теста. Для этого по снимку `retrieval` нужно узнать action формы.
- Комбобоксы Product Code / Primary State: это нативный `<select>` или самописный виджет, покажет снимок. `chooseCombo` поддерживает оба варианта, но XPath для пунктов списка придётся уточнить.
- `symbolCheckbox()` и `readFactors()` в OCP-тесте написаны вслепую и будут поправлены по снимкам `symbols` и `rates factors`.
- Тест не считается повторяемым, пока не пройдёт 2–3 раза подряд без правок.
