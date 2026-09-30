/**
 * Модерация отзывов: форма сайта → строка в таблице → письмо с кнопкой «Подтвердить».
 *
 * НАСТРОЙКА:
 * 1. Создай Google Таблицу с листом "reviews" и заголовками в 1-й строке:
 *    id | created | name | rating | text | status | token
 * 2. Расширения → Apps Script → вставь этот код.
 * 3. В CONFIG укажи свой email (куда слать письма) — обычно тот же аккаунт Google.
 * 4. Создать → Новый → Веб-приложение:
 *    - Запуск от имени: Меня
 *    - Доступ: Все (или Все, у кого есть ссылка)
 * 5. Скопируй URL веб-приложения в script.js сайта (WEB_APP_URL).
 *
 * С КАКОГО ЯЩИКА ПИСЬМА:
 * MailApp шлёт ОТ имени Google-аккаунта, который задеплоил скрипт.
 * Лучше делать таблицу+скрипт на аккаунте ЗАКАЗЧИКА → письма «от него себе».
 * Если скрипт на твоём Gmail — FROM будет твой ящик, а TO = CONFIG.ADMIN_EMAIL.
 */

var CONFIG = {
  // Куда приходят письма на модерацию (почта заказчика)
  ADMIN_EMAIL: "ЗАМЕНИ_НА_ПОЧТУ_ЗАКАЗЧИКА@gmail.com",
  // Имя листа
  SHEET_NAME: "reviews",
  // Подпись в письме
  SITE_NAME: "Atelier Claire (демо)",
};

function doGet(e) {
  e = e || { parameter: {} };
  var action = (e.parameter && e.parameter.action) || "list";

  if (action === "approve") {
    return handleApprove_(e.parameter.token || "");
  }
  if (action === "reject") {
    return handleReject_(e.parameter.token || "");
  }
  return json_(listApproved_());
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var data = JSON.parse(raw);
    var name = String(data.name || "").trim().slice(0, 80);
    var text = String(data.text || "").trim().slice(0, 1000);
    var rating = parseInt(data.rating, 10);
    if (!name || !text || !(rating >= 1 && rating <= 5)) {
      return json_({ ok: false, error: "bad_request" });
    }

    var id = Utilities.getUuid().slice(0, 8);
    var token = Utilities.getUuid().replace(/-/g, "");
    var sheet = getSheet_();
    sheet.appendRow([
      id,
      new Date().toISOString(),
      name,
      rating,
      text,
      "pending",
      token,
    ]);

    sendModerationEmail_(name, rating, text, token);
    return json_({ ok: true, id: id, status: "pending" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["id", "created", "name", "rating", "text", "status", "token"]);
  }
  return sheet;
}

function sendModerationEmail_(name, rating, text, token) {
  var base = ScriptApp.getService().getUrl();
  var approveUrl = base + "?action=approve&token=" + encodeURIComponent(token);
  var rejectUrl = base + "?action=reject&token=" + encodeURIComponent(token);
  var stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  var html =
    "<p>Новый отзыв с сайта <b>" +
    escape_(CONFIG.SITE_NAME) +
    "</b></p>" +
    "<p><b>Имя:</b> " +
    escape_(name) +
    "<br><b>Оценка:</b> " +
    rating +
    "/5 " +
    stars +
    "</p>" +
    "<p><b>Текст:</b><br>" +
    escape_(text).replace(/\n/g, "<br>") +
    "</p>" +
    '<p><a href="' +
    approveUrl +
    '" style="display:inline-block;padding:10px 16px;background:#2a7;color:#fff;text-decoration:none;border-radius:8px;">Подтвердить</a> ' +
    '&nbsp; <a href="' +
    rejectUrl +
    '" style="display:inline-block;padding:10px 16px;background:#999;color:#fff;text-decoration:none;border-radius:8px;">Отклонить</a></p>' +
    "<p style='color:#666;font-size:12px'>Письмо отправлено через Google Apps Script от аккаунта, который задеплоил скрипт.</p>";

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: "[" + CONFIG.SITE_NAME + "] Новый отзыв на модерацию",
    htmlBody: html,
  });
}

function handleApprove_(token) {
  var row = findByToken_(token);
  if (!row) return htmlPage_("Ссылка недействительна или устарела.");
  if (row.status === "approved") return htmlPage_("Отзыв уже опубликован.");
  setStatus_(row.rowNumber, "approved");
  return htmlPage_("Готово. Отзыв опубликован и появится на сайте.");
}

function handleReject_(token) {
  var row = findByToken_(token);
  if (!row) return htmlPage_("Ссылка недействительна или устарела.");
  setStatus_(row.rowNumber, "rejected");
  return htmlPage_("Отзыв отклонён. На сайте он не появится.");
}

function findByToken_(token) {
  if (!token) return null;
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][6]) === String(token)) {
      return {
        rowNumber: i + 1,
        status: String(values[i][5] || ""),
      };
    }
  }
  return null;
}

function setStatus_(rowNumber, status) {
  getSheet_().getRange(rowNumber, 6).setValue(status);
}

function listApproved_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][5]) !== "approved") continue;
    var rating = Number(values[i][3]) || 5;
    out.push({
      id: String(values[i][0]),
      name: String(values[i][2]),
      rating: rating,
      text: String(values[i][4]),
      stars: "★".repeat(Math.min(5, rating)) + "☆".repeat(Math.max(0, 5 - rating)),
    });
  }
  out.reverse();
  return { reviews: out };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function htmlPage_(msg) {
  var html =
    "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;max-width:32rem'>" +
    "<h1 style='font-size:1.25rem'>Модерация отзыва</h1>" +
    "<p>" +
    escape_(msg) +
    "</p>" +
    "<p style='color:#666'>Можно закрыть это окно и обновить страницу отзывов на сайте.</p>" +
    "</body></html>";
  return HtmlService.createHtmlOutput(html);
}

function escape_(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Тест из редактора: отправить пробное письмо на CONFIG.ADMIN_EMAIL */
function testEmail() {
  sendModerationEmail_("Тест", 5, "Проверка письма модерации", "test-token");
}
