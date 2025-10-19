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

    # Получаем полную историю действий для подсчета перемещений по пользователям и времени участников
    try:
        actions = get_card_actions(card_id)
        # Создаем словарь для подсчета перемещений каждым пользователем
        member_move_counts = {}
        members_dict = {}

        # Сначала собираем информацию о членах
        for action in actions:
            member = action.get("memberCreator", {})
            if member.get("id") and member.get("id") not in members_dict:
                members_dict[member["id"]] = {
                    "id": member["id"],
                    "username": member.get("username", ""),
                    "fullName": member.get("fullName", "")
                }

        for action in actions:
            if action.get("type") == "updateCard":
                data = action.get("data", {})
                if data.get("listBefore") and data.get("listAfter"):
                    member_id = action.get("idMemberCreator")
                    if member_id and member_id in members_dict:
                        member_name = members_dict[member_id].get("fullName", members_dict[member_id].get("username", member_id))
                        if member_name not in member_move_counts:
                            member_move_counts[member_name] = {}
                        list_name = data.get("listAfter", {}).get("name")
                        if list_name:
                            member_move_counts[member_name][list_name] = member_move_counts[member_name].get(list_name, 0) + 1

        move_counts_by_member = member_move_counts

        # Подсчет времени участников на основе действий addMemberToCard и removeMemberFromCard
        member_sessions = {}  # member_id -> list of (join_time, leave_time or None)
        current_members = {}  # member_id -> join_time

        # Сортируем действия по времени
        sorted_actions = sorted(actions, key=lambda x: x.get("date", ""))

        for action in sorted_actions:
            action_type = action.get("type")
            member_id = action.get("idMemberCreator")
            action_date = datetime.fromisoformat(action.get("date").replace("Z", "+00:00")).replace(tzinfo=None)

            if action_type == "addMemberToCard" and member_id:
                if member_id not in current_members:
                    current_members[member_id] = action_date
                    if member_id not in member_sessions:
                        member_sessions[member_id] = []
                    member_sessions[member_id].append([action_date, None])

            elif action_type == "removeMemberFromCard" and member_id:
                if member_id in current_members:
                    join_time = current_members[member_id]
                    # Находим последнюю незавершенную сессию
                    for session in reversed(member_sessions.get(member_id, [])):
                        if session[1] is None:
                            session[1] = action_date
                            break
                    del current_members[member_id]

        # Завершаем все незавершенные сессии текущим временем
        current_time = datetime.now()
        for member_id, sessions in member_sessions.items():
            for session in sessions:
                if session[1] is None:
                    session[1] = current_time

        # Вычисляем общее время для каждого участника
        member_time_stats = {}
        for member_id, sessions in member_sessions.items():
            if member_id in members_dict:
                member_name = members_dict[member_id].get("fullName", members_dict[member_id].get("username", member_id))
                total_time = sum((session[1] - session[0]).total_seconds() for session in sessions if session[1])
                appears_count = len(sessions)
                leaves_count = sum(1 for session in sessions if session[1] is not None)

                member_time_stats[member_name] = {
                    "total_time": total_time,
                    "appears_count": appears_count,
                    "leaves_count": leaves_count,
                    "sessions": sessions
                }

        time_per_member = {name: stats["total_time"] for name, stats in member_time_stats.items()}

    except Exception as e:
        print(f"Error getting actions for move counts and member time: {e}")
        move_counts_by_member = {}
        time_per_member = {}

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

        # Подсчет времени в колонке
        if action.action_type in ["createCard", "moveCardToList", "updateCard"] and action.list_name:
            if current_list and list_start_time:
                elapsed = (action.date - list_start_time).total_seconds()
                time_per_list[current_list] = time_per_list.get(current_list, 0) + elapsed
            current_list = action.list_name
            list_start_time = action.date

        # Подсчет времени на участнике - теперь учитываем всех пользователей, которые работали с карточкой
        # Используем member_id из действия перемещения карточки
        if action.action_type in ["createCard", "moveCardToList", "updateCard"] and action.member_id:
            member_id = action.member_id
            if member_id:
                # Если это новый участник или другой участник
                if current_member != member_id:
                    # Сохраняем время предыдущего участника
                    if current_member and member_start_time:
                        elapsed = (action.date - member_start_time).total_seconds()
                        time_per_member[current_member] = time_per_member.get(current_member, 0) + elapsed

                    # Начинаем отсчет для нового участника
                    current_member = member_id
                    member_start_time = action.date

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
        "move_counts_by_member": move_counts_by_member,
        "member_time_stats": member_time_stats if 'member_time_stats' in locals() else {}
    }