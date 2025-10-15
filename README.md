# Trello Card Tracker

Структура проекта:
trello-card-tracker/
├── backend/
│ └── app/
│ ├── init.py
│ ├── main.py # FastAPI-приложение
│ ├── models.py # Модели SQLAlchemy (или Pydantic)
│ ├── schemas.py # Схемы Pydantic для валидации данных
│ ├── database.py # Подключение к базе данных (использует .env)
│ ├── trello_api.py # Интеграция с Trello API (использует .env)
│ └── routes/
│ ├── card.py # Роуты для работы с карточками
│ ├── export.py # Экспорт данных
│ └── settings.py # Настройки пользователя
├── frontend/
│ ├── powerup.html # HTML-файл для Trello Power-Up
│ ├── powerup.js # JavaScript-логика Power-Up
│ └── powerup.css # Стили Power-Up
├── db/
│ └── tracker.db # База данных SQLite (создаётся автоматически)
├── trello/
│ └── manifest.json # Манифест Trello Power-Up
├── .env # Локальные настройки (не коммитится)
├── .env_orig # Шаблон для .env (коммитится)
├── .gitignore # Исключает приватные и временные файлы
└── requirements.txt # Зависимости Python (включая python-dotenv)