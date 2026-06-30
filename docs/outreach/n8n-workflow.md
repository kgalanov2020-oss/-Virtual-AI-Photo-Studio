# n8n workflow: фотостудии -> email

## Вариант А: безопасный запуск через CSV

1. Собрать лиды локально:

```powershell
$env:GOOGLE_PLACES_API_KEY="ваш_google_places_key"
$env:OUTREACH_CITIES="Москва,Санкт-Петербург,Екатеринбург"
$env:OUTREACH_LIMIT="100"
$env:OUTREACH_PROMO_CODE="WELCOME"
node scripts/outreach/collect-photo-studios.mjs
node scripts/outreach/prepare-email-campaign.mjs
```

2. Проверить файл:

```text
tmp/outreach/photo-studio-leads.csv
```

3. В n8n создать workflow:

- Manual Trigger
- Read Binary File: `tmp/outreach/photo-studio-email-campaign.csv`
- Spreadsheet File: CSV to JSON
- IF: `email` is not empty
- IF: `status` is not `sent` and not `stop`
- Split In Batches: 10-20 за запуск
- Wait: 2-5 минут между письмами
- Send Email / SMTP: поля `email`, `subject`, `html`
- Append/Update Google Sheet или CSV: статус `sent`, дата отправки

## Вариант B: всё внутри n8n

Ноды:

1. Manual Trigger
2. Set: `cities`, `queries`, `promo_code`, `limit`
3. Code: собрать массив поисковых запросов
4. Split In Batches
5. HTTP Request: Google Places Text Search
6. Code: нормализовать `place_id`, `name`, `city`
7. HTTP Request: Google Places Details
8. HTTP Request: скачать сайт студии
9. Code: regex email из HTML
10. IF: email найден
11. Google Sheets: append lead
12. Send Email: отправлять только после ручной проверки статуса `approved`

Лучше сначала использовать вариант А: он проще, прозрачнее и меньше риск случайно отправить письма не тем адресатам.

## Настройки отправки

- Новый доменный ящик: `partners@virtualphotostudio.ru`
- Лимит первого дня: 20 писем
- Через 2-3 дня: 40-60 писем/день
- Не отправлять повторно на один домен чаще 1 раза в 14 дней
- Все ответы с `стоп`, `unsubscribe`, `не пишите` переносить в stop-list

## Тема письма

Варианты:

- `{{studio_name}}, AI-фотосессии для клиентов вашей студии`
- `Партнёрский тест AI-фотосессий для {{studio_name}}`
- `Как превратить селфи клиента в фотосессию в интерьере`

## Follow-up через 3-5 дней

Тема: `Можно показать короткий пример до/после?`

Текст:

```text
Здравствуйте!

Писал по поводу Virtual AI Photo Studio: сервис делает серию портретов в выбранном интерьере по обычным селфи клиента.

Пример до/после здесь:
https://virtualphotostudio.ru/

Могу открыть тест по промокоду {{promo_code}}, чтобы вы посмотрели результат на своих фото.

Если неактуально, ответьте "стоп".
```

