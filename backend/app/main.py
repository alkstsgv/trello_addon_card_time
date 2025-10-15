import os
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
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
    allow_origins=["*"],
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

# Подключаем powerup.html как корневой файл (отдаётся по /)
@app.get("/")
def read_root():
    from fastapi.responses import FileResponse
    # Возвращаем файл powerup.html из директории frontend
    return FileResponse(os.path.join("./frontend", "powerup.html"))

# Роут для доступа к powerup.html напрямую
@app.get("/powerup.html")
def serve_powerup():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join("./frontend", "powerup.html"))

# --- Удаляем старый блок ---
# @app.on_event("startup")
# def startup_event():
#     init_db()
# ----------------------------