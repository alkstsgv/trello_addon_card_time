import requests
from dotenv import load_dotenv
import os
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Card, CardHistory, CardStat
from .database import SessionLocal

load_dotenv()

TRELLO_API_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")

print(f"TRELLO_API_KEY: {TRELLO_API_KEY}")  # <-- Временный лог
print(f"TRELLO_TOKEN: {TRELLO_TOKEN}")      # <-- Временный лог

BASE_URL = "https://api.trello.com/1"

def get_card_actions(card_id: str, token: str = None):
    """
    Получает историю действий по карточке.
    """
    url = f"{BASE_URL}/cards/{card_id}/actions"
    params = {
        "key": TRELLO_API_KEY,
        "token": token or TRELLO_TOKEN,
        "limit": 1000,
        "filter": "all"  # Добавлено согласно документации
    }
    response = requests.get(url, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Ошибка при получении действий: {response.status_code}, {response.text}")

def get_card_info(card_id: str, token: str = None):
    """
    Получает базовую информацию о карточке.
    """
    url = f"{BASE_URL}/cards/{card_id}"
    params = {
        "key": TRELLO_API_KEY,
        "token": token or TRELLO_TOKEN
    }
    response = requests.get(url, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Ошибка при получении карточки: {response.status_code}, {response.text}")

def save_card_history(card_id: str, actions: list, db: Session):
    """
    Сохраняет историю действий в базу данных.
    """
    # Проверяем, существует ли карточка в базе
    db_card = db.query(Card).filter(Card.trello_card_id == card_id).first()
    if not db_card:
        db_card = Card(trello_card_id=card_id)
        db.add(db_card)
        db.commit()
        db.refresh(db_card)

    # Удаляем старую историю, чтобы не дублировать
    db.query(CardHistory).filter(CardHistory.card_id == db_card.id).delete()

    # Получаем текущую колонку карточки
    card_info = get_card_info(card_id)
    current_list_name = card_info.get("idList")

    # Если есть текущая колонка, получаем её имя
    if current_list_name:
        list_url = f"{BASE_URL}/lists/{current_list_name}"
        list_params = {
            "key": TRELLO_API_KEY,
            "token": TRELLO_TOKEN
        }
        list_response = requests.get(list_url, params=list_params)
        if list_response.status_code == 200:
            current_list_name = list_response.json().get("name")

    for action in actions:
        action_type = action.get("type")
        data = action.get("data", {})
        list_before = data.get("listBefore", {})
        list_after = data.get("listAfter", {})
        member = data.get("member", {})
        date_str = action.get("date")

        member_id = member.get("id")
        date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))

        # Сохраняем только действия перемещения карточки между колонками
        if action_type == "updateCard" and list_before.get("name") and list_after.get("name"):
            # Это перемещение карточки - сохраняем целевую колонку
            history_entry = CardHistory(
                card_id=db_card.id,
                action_type=action_type,
                list_name=list_after.get("name"),
                member_id=member_id,
                date=date_obj
            )
            db.add(history_entry)
        elif action_type == "createCard":
            # Для создания карточки используем текущую колонку
            if current_list_name:
                history_entry = CardHistory(
                    card_id=db_card.id,
                    action_type=action_type,
                    list_name=current_list_name,
                    member_id=member_id,
                    date=date_obj
                )
                db.add(history_entry)

    db.commit()

def calculate_card_metrics(card_id: str, db: Session):
    """
    Вычисляет метрики по карточке на основе истории.
    Возвращает словарь с результатами.
    """
    db_card = db.query(Card).filter(Card.trello_card_id == card_id).first()
    if not db_card:
        raise ValueError("Карточка не найдена в базе")

    history = db.query(CardHistory).filter(CardHistory.card_id == db_card.id).order_by(CardHistory.date).all()

    if not history:
        return {"message": "Нет истории для этой карточки"}

    # Сортируем по времени
    history.sort(key=lambda x: x.date)

    # Переменные для подсчета
    time_per_list = {}
    time_per_member = {}
    total_time = 0

    # Статистика по колонкам
    list_counts = {}
    move_counts_by_member = {}

    # Временные переменные
    current_list = None
    current_member = None
    list_start_time = None
    member_start_time = None

    for i, action in enumerate(history):
        # Обновляем статистику перемещений
        if action.action_type in ["createCard", "moveCardToList", "updateCard"] and action.list_name:
            list_name = action.list_name
            if list_name:
                list_counts[list_name] = list_counts.get(list_name, 0) + 1
                creator_id = action.member_id  # Кто выполнил действие
                if creator_id:
                    move_counts_by_member[creator_id] = move_counts_by_member.get(creator_id, {})
                    move_counts_by_member[creator_id][list_name] = move_counts_by_member[creator_id].get(list_name, 0) + 1

        # Подсчет времени в колонке
        if action.action_type in ["createCard", "moveCardToList", "updateCard"] and action.list_name:
            if current_list and list_start_time:
                elapsed = (action.date - list_start_time).total_seconds()
                time_per_list[current_list] = time_per_list.get(current_list, 0) + elapsed
            current_list = action.list_name
            list_start_time = action.date

        # Подсчет времени на участнике
        if action.action_type == "addMemberToCard":
            member_id = action.member_id
            if member_id:
                if current_member and member_start_time:
                    elapsed = (action.date - member_start_time).total_seconds()
                    time_per_member[current_member] = time_per_member.get(current_member, 0) + elapsed
                current_member = member_id
                member_start_time = action.date
        elif action.action_type == "removeMemberFromCard":
            if current_member and member_start_time:
                elapsed = (action.date - member_start_time).total_seconds()
                time_per_member[current_member] = time_per_member.get(current_member, 0) + elapsed
                current_member = None
                member_start_time = None

    # Завершаем подсчет для последнего списка
    if current_list and list_start_time:
        elapsed = (history[-1].date - list_start_time).total_seconds()
        time_per_list[current_list] = time_per_list.get(current_list, 0) + elapsed

    # Завершаем подсчет для последнего участника
    if current_member and member_start_time:
        elapsed = (history[-1].date - member_start_time).total_seconds()
        time_per_member[current_member] = time_per_member.get(current_member, 0) + elapsed

    total_time = sum(time_per_list.values())

    # Возвращаем результат
    return {
        "total_time": total_time,
        "time_per_list": time_per_list,
        "time_per_member": time_per_member,
        "list_counts": list_counts,
        "move_counts_by_member": move_counts_by_member
    }