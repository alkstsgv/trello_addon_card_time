import os
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# Обновленные импорты
from ..app.database import init_db  # <-- Убедитесь, что import всё ещё здесь
from ..routes import card, settings, export  # <-- Теперь ".." означает "на уровень выше"

MANIFEST_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "manifest.json")

def run_generate_script():
    """Запускает generate_manifest.py."""
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "generate_manifest.py")
    print(f"Running generate script: {script_path}")
    # Запускаем скрипт в той же директории, где он находится
    result = subprocess.run(["python", script_path], cwd=os.path.dirname(script_path))
    if result.returncode != 0:
        print(f"Error running {script_path}")
    else:
        print(f"Successfully ran {script_path}")

def remove_manifest():
    """Удаляет manifest.json, если он существует."""
    if os.path.exists(MANIFEST_PATH):
        os.remove(MANIFEST_PATH)
        print(f"Manifest {MANIFEST_PATH} removed.")
    else:
        print(f"Manifest {MANIFEST_PATH} not found, nothing to remove.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запускаем generate_manifest.py
    run_generate_script()
    
    # Инициализируем БД
    init_db()
    
    yield  # <-- Здесь приложение запускается
    
    # Удаляем manifest.json при остановке
    remove_manifest()

app = FastAPI(lifespan=lifespan)  # <-- Передаём lifespan

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "https://trello.com", "https://*.trello.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем маршруты
app.include_router(card.router, prefix="/api", tags=["card"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(export.router, prefix="/api", tags=["export"])

# Подключаем статику (CSS, JS) под префикс /static
app.mount("/static", StaticFiles(directory="./frontend"), name="static")

# Убираем неправильный mount для powerup_frame.html, так как это маршрут, а не статический файл

# --- НОВЫЙ маршрут для iframe ---
# Этот HTML будет минимальным, он подключит powerup.js и вызовет Trello Power-Up initialize
@app.get("/powerup_frame.html", response_class=HTMLResponse)
def serve_powerup_frame(request: Request):
    backend_url = request.url.scheme + "://" + request.url.netloc
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Card Tracker Frame</title>
        <!-- Подключаем Trello Power-Up SDK -->
        <script src="https://p.trellocdn.com/power-up.min.js"></script>
    </head>
    <body>
        <!-- Пустое тело. UI будет отрисован через t.render() в powerup.js -->
        <script>
            // Устанавливаем BACKEND_URL для использования в powerup.js
            window.BACKEND_URL = "{backend_url}";
        </script>
        <!-- Подключаем наш скрипт после установки BACKEND_URL -->
        <script src="/static/powerup.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/content.html", response_class=HTMLResponse)
def serve_content(request: Request):
    backend_url = request.url.scheme + "://" + request.url.netloc
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Card Tracker Content</title>
        <script src="https://p.trellocdn.com/power-up.min.js"></script>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; width: 300px; }}
            .metric-group {{ margin: 10px 0; padding: 10px; border: 1px solid #ddd; }}
            button {{ padding: 10px 20px; background: #0079bf; color: white; border: none; cursor: pointer; }}
            button:hover {{ background: #005a87; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
            .resize-handle {{ position: absolute; bottom: 0; left: 0; right: 0; height: 10px; background: #0079bf; cursor: ns-resize; opacity: 0.7; border-radius: 5px 5px 0 0; }}
        </style>
    </head>
    <body>
        <h3>Card Tracker</h3>
        <button id="load-metrics-btn">Load Metrics</button>
        <div id="settings">
            <h4>Display Settings</h4>
            <label><input type="checkbox" id="show-time-per-list" checked> Time per List</label><br>
            <label><input type="checkbox" id="show-time-per-member" checked> Time per Member</label><br>
            <label><input type="checkbox" id="show-total-time" checked> Total Time</label><br>
            <label><input type="checkbox" id="show-list-counts" checked> List Counts</label><br>
            <label><input type="checkbox" id="show-move-counts" checked> Move Counts</label><br>
            <label><input type="checkbox" id="show-history"> Show History</label><br>
            <label><input type="checkbox" id="show-detailed-history"> Show Detailed History</label><br>
        </div>
        <div id="content">Click "Load Metrics" to see data</div>
        <div id="history">History will appear here</div>
        <div class="resize-handle"></div>

        <script>
            window.BACKEND_URL = "{backend_url}";
        </script>
        <script src="/static/content.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/popup.html", response_class=HTMLResponse)
def serve_popup(request: Request):
    backend_url = request.url.scheme + "://" + request.url.netloc
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Card Tracker Popup</title>
        <script src="https://p.trellocdn.com/power-up.min.js"></script>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; }}
            .metric-group {{ margin: 10px 0; padding: 10px; border: 1px solid #ddd; }}
            button {{ padding: 10px 20px; background: #0079bf; color: white; border: none; cursor: pointer; }}
            button:hover {{ background: #005a87; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
        </style>
    </head>
    <body>
        <h3>Card Tracker</h3>
        <button id="load-metrics-btn">Load Metrics</button>
        <div id="settings">
            <h4>Display Settings</h4>
            <label><input type="checkbox" id="show-time-per-list" checked> Time per List</label><br>
            <label><input type="checkbox" id="show-time-per-member" checked> Time per Member</label><br>
            <label><input type="checkbox" id="show-total-time" checked> Total Time</label><br>
            <label><input type="checkbox" id="show-list-counts" checked> List Counts</label><br>
            <label><input type="checkbox" id="show-move-counts" checked> Move Counts</label><br>
            <label><input type="checkbox" id="show-history"> Show History</label><br>
            <label><input type="checkbox" id="show-detailed-history"> Show Detailed History</label><br>
        </div>
        <div id="content">Click "Load Metrics" to see data</div>
        <div id="history">History will appear here</div>

        <script>
            window.BACKEND_URL = "{backend_url}";
        </script>
        <script src="/static/content.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/board-settings.html", response_class=HTMLResponse)
def serve_board_settings(request: Request):
    backend_url = request.url.scheme + "://" + request.url.netloc
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Card Tracker - Board Settings</title>
        <script src="https://p.trellocdn.com/power-up.min.js"></script>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; }}
            .badge-setting {{ margin: 15px 0; padding: 10px; border: 1px solid #ddd; }}
            .color-picker {{ display: inline-block; width: 30px; height: 30px; border: 1px solid #ccc; cursor: pointer; margin-left: 10px; }}
            .list-selector {{ margin-top: 5px; }}
            .list-selector select {{ width: 100%; height: 100px; }}
        </style>
    </head>
    <body>
        <h3>Card Tracker - Board Settings</h3>
        <div id="board-settings-container">
            <div class="badge-setting">
                <label><input type="checkbox" id="show-current-list-time"> Show time in current list</label>
                <button class="color-picker" id="current-list-color" style="background-color: #0079bf;"></button>
            </div>

            <div class="badge-setting">
                <label><input type="checkbox" id="show-total-time"> Show total time</label>
                <button class="color-picker" id="total-time-color" style="background-color: #61bd4f;"></button>
            </div>

            <div class="badge-setting">
                <label><input type="checkbox" id="show-specific-lists-time"> Show time in specific lists</label>
                <button class="color-picker" id="specific-lists-color" style="background-color: #ff9f43;"></button>
                <div class="list-selector">
                    <select multiple id="selected-lists">
                    </select>
                </div>
            </div>

            <div class="badge-setting">
                <label><input type="checkbox" id="show-personal-time"> Show time only for me</label>
                <button class="color-picker" id="personal-time-color" style="background-color: #eb5a46;"></button>
            </div>

            <button id="save-settings-btn" style="margin-top: 20px; padding: 10px 20px; background: #0079bf; color: white; border: none; cursor: pointer;">Save Settings</button>
        </div>

        <script>
            window.BACKEND_URL = "{backend_url}";
        </script>
        <script src="/static/board-settings.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


# Подключаем powerup.html как корневой файл (отдаётся по /)
# @app.get("/")
# def read_root():
#     from fastapi.responses import FileResponse
#     # Возвращаем файл powerup.html из директории frontend
#     return FileResponse(os.path.join("./frontend", "powerup.html"))

# # Роут для доступа к powerup.html напрямую
# @app.get("/powerup.html")
# def serve_powerup():
#     from fastapi.responses import FileResponse
#     return FileResponse(os.path.join("./frontend", "powerup.html"))

# --- Удаляем старый блок ---
# @app.on_event("startup")
# def startup_event():
#     init_db()
# ----------------------------