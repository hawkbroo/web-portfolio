"""Локальный демо модерации отзывов (имитация Google Apps Script).

Письма не шлёт — пишет HTML в data/outbox и отдаёт ссылки подтверждения.
Для боя: задеплой google-apps-script/Code.gs и впиши WEB_APP_URL в script.js.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "reviews.json"
OUTBOX = ROOT / "data" / "outbox"
HOST = "127.0.0.1"
PORT = 8790
BASE = f"http://{HOST}:{PORT}"


def load() -> dict:
    DATA.parent.mkdir(parents=True, exist_ok=True)
    OUTBOX.mkdir(parents=True, exist_ok=True)
    if not DATA.exists():
        data = {
            "reviews": [
                {
                    "id": "demo001",
                    "name": "Мария",
                    "rating": 5,
                    "text": "Стрижка села идеально, мастер всё объяснила.",
                    "status": "approved",
                    "token": "demo",
                },
                {
                    "id": "demo002",
                    "name": "Елена",
                    "rating": 5,
                    "text": "Тонирование мягкое, без желтизны.",
                    "status": "approved",
                    "token": "demo2",
                },
                {
                    "id": "demo003",
                    "name": "Анна",
                    "rating": 4,
                    "text": "Маникюр аккуратный.",
                    "status": "approved",
                    "token": "demo3",
                },
            ]
        }
        save(data)
        return data
    return json.loads(DATA.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def stars(n: int) -> str:
    n = max(1, min(5, int(n)))
    return "★" * n + "☆" * (5 - n)


def write_fake_email(name: str, rating: int, text: str, token: str) -> tuple[Path, str, str]:
    approve = f"{BASE}/?action=approve&token={token}"
    reject = f"{BASE}/?action=reject&token={token}"
    html = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:36rem;padding:1.5rem">
<h2>Новый отзыв (локальная имитация письма)</h2>
<p>В бою такое письмо придёт на почту заказчика<br>
<b>FROM:</b> Google-аккаунт, где задеплоен Apps Script<br>
<b>TO:</b> ADMIN_EMAIL в Code.gs</p>
<p><b>Имя:</b> {name}<br><b>Оценка:</b> {rating}/5 {stars(rating)}</p>
<p><b>Текст:</b><br>{text}</p>
<p><a href="{approve}">Подтвердить</a> · <a href="{reject}">Отклонить</a></p>
</body></html>"""
    path = OUTBOX / f"review-{token[:8]}.html"
    path.write_text(html, encoding="utf-8")
    print("FAKE EMAIL:", path)
    print("APPROVE:", approve)
    return path, approve, reject


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, msg: str) -> None:
        body = f"<html><body style='font-family:sans-serif;padding:2rem'><h1>Модерация</h1><p>{msg}</p></body></html>".encode(
            "utf-8"
        )
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        q = parse_qs(urlparse(self.path).query)
        action = (q.get("action") or ["list"])[0]
        token = (q.get("token") or [""])[0]
        data = load()

        if action == "approve":
            for r in data["reviews"]:
                if r.get("token") == token:
                    r["status"] = "approved"
                    save(data)
                    return self._html(200, "Отзыв опубликован. Обновите страницу сайта.")
            return self._html(404, "Ссылка недействительна.")

        if action == "reject":
            for r in data["reviews"]:
                if r.get("token") == token:
                    r["status"] = "rejected"
                    save(data)
                    return self._html(200, "Отзыв отклонён.")
            return self._html(404, "Ссылка недействительна.")

        approved = [
            {
                "id": r["id"],
                "name": r["name"],
                "rating": r["rating"],
                "text": r["text"],
                "stars": stars(r["rating"]),
            }
            for r in data["reviews"]
            if r.get("status") == "approved"
        ]
        self._json(200, {"reviews": approved})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return self._json(400, {"ok": False, "error": "bad_json"})

        name = str(payload.get("name") or "").strip()[:80]
        text = str(payload.get("text") or "").strip()[:1000]
        try:
            rating = int(payload.get("rating") or 0)
        except (TypeError, ValueError):
            rating = 0
        if not name or not text or rating < 1 or rating > 5:
            return self._json(400, {"ok": False, "error": "bad_request"})

        token = uuid.uuid4().hex
        review = {
            "id": uuid.uuid4().hex[:8],
            "name": name,
            "rating": rating,
            "text": text,
            "status": "pending",
            "token": token,
            "created": datetime.now(timezone.utc).isoformat(),
        }
        data = load()
        data["reviews"].insert(0, review)
        save(data)
        path, approve, reject = write_fake_email(name, rating, text, token)
        self._json(
            200,
            {
                "ok": True,
                "id": review["id"],
                "status": "pending",
                "demo": True,
                "approve_url": approve,
                "reject_url": reject,
                "fake_email": str(path),
            },
        )

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    load()
    print(f"Local reviews demo API: {BASE}")
    print("В script.js поставь WEB_APP_URL = этого адреса для локального теста.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
