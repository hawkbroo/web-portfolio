/* ====== ОТЗЫВЫ: Google Apps Script или локальное демо ======
 * Бой: вставь URL веб-приложения Apps Script (из Code.gs).
 * Локально: запусти local-reviews-api.py и оставь URL ниже.
 */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyfFHzrbS3YzAFkFTX8ykCSeTrLGLPd6GwDz9beuO4CFOT4JsdkmhNpRDVHw-q2mCavOg/exec";

const TG = "spel21";

function openTelegram(text) {
  const url = `https://t.me/${TG}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}

function stars(n) {
  const r = Math.max(1, Math.min(5, Number(n) || 5));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderReviews(items) {
  const list = document.getElementById("reviews-list");
  const summary = document.getElementById("rating-summary");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<p class="section-lead">Пока нет опубликованных отзывов.</p>';
    if (summary) summary.innerHTML = "Средняя оценка: —";
    return;
  }

  const avg = items.reduce((s, r) => s + Number(r.rating), 0) / items.length;
  if (summary) {
    summary.innerHTML = `Средняя оценка: <strong>${avg.toFixed(1)}</strong> · ${items.length} отзыв(ов)`;
  }

  list.innerHTML = items
    .map(
      (r) => `
      <article class="review-card" data-rating="${r.rating}">
        <div class="stars" aria-label="${r.rating} из 5">${r.stars || stars(r.rating)}</div>
        <p>«${escapeHtml(r.text)}»</p>
        <footer>${escapeHtml(r.name)}</footer>
      </article>`
    )
    .join("");
}

async function loadReviews() {
  const list = document.getElementById("reviews-list");
  if (!list || !WEB_APP_URL) return;
  try {
    const res = await fetch(`${WEB_APP_URL}?action=list&_=${Date.now()}`);
    if (!res.ok) throw new Error("load");
    const data = await res.json();
    renderReviews(data.reviews || []);
  } catch {
    // оставляем демо-карточки из HTML, если API не запущен
  }
}

const reviewForm = document.getElementById("review-form");
if (reviewForm) {
  const statusEl = document.getElementById("review-status");
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!WEB_APP_URL) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Сначала укажите WEB_APP_URL в script.js (ссылка Apps Script).";
      }
      return;
    }

    const data = new FormData(reviewForm);
    const payload = {
      name: String(data.get("name") || "").trim(),
      rating: Number(data.get("rating") || 5),
      text: String(data.get("text") || "").trim(),
    };

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Отправляем…";
    }

    try {
      // text/plain — чтобы Google Apps Script реже упирался в CORS preflight
      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        throw new Error(body.error || "send_failed");
      }

      reviewForm.reset();
      const five = reviewForm.querySelector('input[name="rating"][value="5"]');
      if (five) five.checked = true;

      if (body.demo && body.approve_url) {
        statusEl.innerHTML =
          "Спасибо! В бою пришло бы письмо на почту. <strong>Локальное демо:</strong> " +
          `<a href="${body.approve_url}" target="_blank" rel="noopener">подтвердить отзыв</a>` +
          (body.reject_url
            ? ` · <a href="${body.reject_url}" target="_blank" rel="noopener">отклонить</a>`
            : "") +
          ". Потом обновите страницу.";
      } else {
        statusEl.textContent =
          "Спасибо! Отзыв отправлен. После подтверждения на почте владельца он появится на сайте.";
      }
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent =
          "Не удалось отправить. Для локального теста запустите local-reviews-api.py. Для боя — задеплойте Apps Script и вставьте URL.";
      }
    }
  });

  loadReviews();
}

const bookForm = document.getElementById("book-form");
if (bookForm) {
  const params = new URLSearchParams(window.location.search);
  const serviceField = document.getElementById("service-field");
  if (serviceField && params.get("service")) {
    const wanted = params.get("service");
    const match = Array.from(serviceField.options).find((o) => o.value === wanted);
    if (match) {
      serviceField.value = wanted;
      serviceField.querySelector("option[disabled]")?.removeAttribute("selected");
    }
  }

  bookForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(bookForm);
    const name = String(data.get("name") || "").trim();
    const service = String(data.get("service") || "").trim() || "не указана";
    const master = String(data.get("master") || "").trim() || "не указан";
    const day = String(data.get("day") || "").trim();
    const time = String(data.get("time") || "").trim();
    const when = [day, time].filter(Boolean).join(", ") || "не указано";
    const comment = String(data.get("comment") || "").trim();
    const msg = [
      "Запись в салон (демо Atelier Claire)",
      `Имя: ${name}`,
      `Услуга: ${service}`,
      `Мастер: ${master}`,
      `Когда: ${when}`,
      comment ? `Комментарий: ${comment}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    openTelegram(msg);
  });
}
