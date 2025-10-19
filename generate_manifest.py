import os
import json

# MANIFEST_PATH теперь указывает на trello/manifest.json, как вы использовали ранее
MANIFEST_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "trello_addon_card_time", "manifest.json")

def write_manifest(backend_url: str):
    manifest_data = {
        "name": "Card Tracker",
        "description": "Track card history, time, members, and more.",
        "icon": {
            "url": "https://example.com/icon.png"
        },
        "author": "Your Name",
        # Убираем "connect" -> "iframe", потому что не используем iframe
        # Добавляем "content" или "show-settings" для отображения в боковой панели
        # Ключ "show-settings" будет обработан в powerup.js через window.TrelloPowerUp.initialize
        # Поэтому "content" или "show-settings" указывает на URL, который *может* быть iframe,
        # но в новом подходе он не нужен. Оставляем минимальный manifest.
        # Важно: "capabilities" можно указать, если нужно.
        # "content" или "show-settings" определяется в powerup.js
        # В новом подходе, мы не используем iframe, а рендерим UI напрямую через t.render()
        # Поэтому manifest.json может быть проще, но Trello всё ещё нужно знать, что Power-Up существует и что он может делать.
        # Оставим минимальный набор, указав scopes.
        # "connect" с "iframe" убираем.
        # "content" - это для отображения в Content Area (ниже боковой панели).
        # "show-settings" - это для отображения в боковой панели (как в новом подходе).
        # Нам нужно указать, что Power-Up *может* использовать "show-settings" или "content".
        # Но сама логика определяется в powerup.js.
        # Поэтому в manifest.json укажем scopes и name, остальное минималистично или для других функций.
        # Уберём "connect" и оставим только основное.
        # Trello Developer Dashboard всё равно требует указать iframe URL, если вы используете connect.
        # Если мы НЕ используем connect.iframe, но используем t.render(), нам нужно быть осторожными.
        # На практике, Trello может всё равно ожидать "connect" для Power-Up.
        # Попробуем указать "connect" с "public" или "iframe", но в iframe будет минимальный контент или редирект.
        # ИЛИ, указать "connect" и в iframe URL дать адрес, который просто генерирует UI через t.render().
        # Но это возвращает нас к iframe.
        # ЛУЧШЕЕ РЕШЕНИЕ: Указать "connect" с iframe, но в этом iframe отдавать минимальный HTML,
        # который НЕ использует powerup.html, а использует powerup.js напрямую и вызывает t.render().
        # Или, указать "connect" с iframe, и в powerup.js проверить, внутри iframe ли мы или в render().
        # Но это усложнение.
        # ПРАВИЛЬНОЕ РЕШЕНИЕ: Указать "connect" с iframe URL, но этот URL будет возвращать HTML,
        # который сразу же использует t.render() и отображает UI в боковой панели.
        # Это означает, что iframe существует, но его содержимое минимально и быстро отдаёт управление Trello UI.
        # Это НЕ решает проблему таймаута, если iframe не инициализируется быстро.
        # ИЛИ: НЕ использовать "connect" в manifest.json, а использовать "content" или "show-settings" напрямую.
        # Но как Trello знает, что вызывать?
        # ПРАВИЛЬНО: Power-Up РЕГИСТРИРУЕТСЯ с "connect.iframe". В этом iframe ЗАПУСКАЕТСЯ powerup.js.
        # powerup.js ИСПОЛЬЗУЕТ window.TrelloPowerUp.initialize({...}) и ОПРЕДЕЛЯЕТ, что отображать:
        # - через t.render() (в боковой панели, как мы хотим).
        # - через t.popup().
        # - через card-buttons.
        # Значит, "iframe.url" в manifest.json ВСЁ ЕЩЁ НУЖЕН, чтобы Trello загрузил powerup.js.
        # Но powerup.js внутри НЕ должен зависеть от долгой инициализации iframe.
        # ВЫВОД: НЕ удаляем "connect.iframe" из manifest.json.
        # Меняем powerup.js, чтобы он использовал t.render() внутри window.TrelloPowerUp.initialize.
        # Меняем powerup.html на минимальный HTML, который подключает powerup.js и вызывает initialize.
        # Этот минимальный HTML можно создать как отдельный файл или генерировать в FastAPI.
        # ПОЭТОМУ: Удаляем старый powerup.html.
        # Создаём новый, минимальный, например, inline_powerup.html или генерируем его в FastAPI.
        # Или, даём iframe URL, который отдаёт этот минимальный HTML.
        # Но проще: app.get("/powerup.html") отдаёт минимальный HTML.
        # manifest.json -> iframe.url = /powerup.html
        # /powerup.html -> подключает powerup.js и вызывает initialize.
        # powerup.js -> использует t.render().
        # Это решает таймаут, если powerup.js быстро вызывает initialize и t.render.

        # Итак, manifest.json ДОЛЖЕН содержать "connect.iframe", если мы хотим, чтобы Trello вызвал наш powerup.js.
        # Но мы хотим, чтобы UI был встроенный.
        # Значит, iframe.url указывает на маршрут в FastAPI, который отдаёт минимальный HTML.
        # Этот HTML подключает powerup.js.
        # powerup.js вызывает initialize и возвращает UI через t.render().
        # Это работает и избегает таймаута iframe, потому что iframe быстро инициализируется.
        # ПОЭТОМУ: iframe.url НУЖЕН. Он будет /powerup.html, который мы создадим в FastAPI.
        # А не тот, который был в frontend и содержал UI.

        # ЗАМЕНИМ iframe.url на маршрут, который будет отдавать минимальный HTML.
        # Но мы его пока не создали. Создадим в main.py.
        # А в manifest.json пока укажем URL, который будет отдавать этот новый HTML.
        # Например, если мы создадим маршрут /powerup_frame.html в main.py, то:
        # "url": f"{backend_url}/powerup_frame.html"

        # Но для простоты и единообразия, пусть будет /powerup.html, но от FastAPI.
        # Тогда main.py должен отдавать НОВЫЙ powerup.html, а не из frontend.

        # ПЕРЕФОРМУЛИРУЕМ: manifest.json НУЖНО обновить, чтобы iframe.url указывал на маршрут в FastAPI,
        # который отдаёт НОВЫЙ HTML (минималистичный), который подключает powerup.js и вызывает initialize.
        # Этот маршрут мы создадим в main.py.

        # Поэтому, пока что, в manifest.json указываем URL, который будет создан в main.py.
        # Предположим, это будет /powerup_frame.html
        # "url": f"{backend_url}/powerup_frame.html"

        # Но давайте использовать /powerup.html, переопределив его в main.py.
        # Тогда iframe.url = {backend_url}/powerup.html

        # ИТОГ: ОСТАВЛЯЕМ connect.iframe, но URL будет на FastAPI маршрут.
        # Этот маршрут отдаст новый HTML, который использует t.render().

        # --- Обновлённый manifest_data ---
        # scopes: read необходим для получения данных карточки
        # connect.iframe.url: должен указывать на маршрут в FastAPI, отдающий минималистичный HTML
        # Этот маршрут будет определён в main.py
    }
    manifest_data["scopes"] = ["read"]
    manifest_data["connect"] = {
        "iframe": {
            # ВАЖНО: Этот URL должен совпадать с маршрутом в main.py
            # Мы его определим ниже как /powerup_frame.html или /powerup.html
            # Предположим, мы используем /powerup_frame.html для ясности
            "url": f"{backend_url}/powerup_frame.html",
            # "callback" не обязателен, если не используем callback-эндпоинты
            # "callback": {
            #     "url": f"{backend_url}/callback"
            # }
        }
    }
    # Добавляем capabilities
    manifest_data["capabilities"] = [
        "board-buttons",
        "card-buttons",
        "card-badges",
        "card-detail-badges",
        "show-settings"
    ]
    # Убираем "content", если не планируем использовать его
    # manifest_data["content"] = {
    #     "url": f"{backend_url}/content"
    # }

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, indent=2)

if __name__ == "__main__":
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    print(f"Using backend URL: {backend_url}")
    write_manifest(backend_url)
    print(f"Manifest {MANIFEST_PATH} created.")