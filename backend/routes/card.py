from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from datetime import datetime
import requests
from ..app.database import get_db
from ..app.trello_api import get_card_actions
from ..app.models import Card, CardHistory

router = APIRouter()

@router.get("/card/{card_id}/fetch-history")
def fetch_and_save_card_history(card_id: str, db: Session = Depends(get_db)):
    try:
        print(f"Fetching history for card: {card_id}")
        from ..app import trello_api
        actions = trello_api.get_card_actions(card_id)
        print(f"Got {len(actions)} actions from Trello API")
        trello_api.save_card_history(card_id, actions, db)
        print(f"Saved history to database")
        return {"message": f"История для карточки {card_id} сохранена", "count": len(actions)}
    except Exception as e:
        print(f"Error in fetch-history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/card/{card_id}/metrics")
def get_card_metrics(card_id: str, db: Session = Depends(get_db)):
    try:
        print(f"Calculating metrics for card: {card_id}")
        from ..app import trello_api
        metrics = trello_api.calculate_card_metrics(card_id, db)
        print(f"Metrics calculated: {metrics}")
        return metrics
    except Exception as e:
        print(f"Error in metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
# Новый эндпоинт для получения истории (уникальные колонки)
@router.get("/card/{card_id}/history")
def get_card_history(card_id: str, db: Session = Depends(get_db)):
    db_card = db.query(Card).filter(Card.trello_card_id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found in database")

    history = db.query(CardHistory).filter(CardHistory.card_id == db_card.id).order_by(CardHistory.date).all()

    # Группируем по названию колонки и считаем количество посещений
    list_visits = {}
    for h in history:
        if h.list_name:
            if h.list_name not in list_visits:
                list_visits[h.list_name] = {
                    "count": 0,
                    "first_visit": h.date,
                    "last_visit": h.date
                }
            list_visits[h.list_name]["count"] += 1
            if h.date < list_visits[h.list_name]["first_visit"]:
                list_visits[h.list_name]["first_visit"] = h.date
            if h.date > list_visits[h.list_name]["last_visit"]:
                list_visits[h.list_name]["last_visit"] = h.date

    # Преобразуем в список словарей с уникальными колонками
    history_list = []
    for list_name, data in list_visits.items():
        history_list.append({
            "id": f"{card_id}_{list_name}",
            "type": "visitList",
            "date": data["first_visit"].isoformat(),
            "data": {
                "listName": list_name,
                "visitCount": data["count"]
            },
            "memberCreator": {
                "id": None,  # Не указываем конкретного пользователя для агрегированных данных
            }
        })

    # Сортируем по дате первого посещения
    history_list.sort(key=lambda x: x["date"])

    return history_list

# Новый эндпоинт для получения детальной истории
@router.get("/card/{card_id}/detailed-history")
def get_card_detailed_history(card_id: str, db: Session = Depends(get_db)):
    db_card = db.query(Card).filter(Card.trello_card_id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found in database")

    history = db.query(CardHistory).filter(CardHistory.card_id == db_card.id).order_by(CardHistory.date).all()

    # Получаем полную историю действий из Trello API для получения детальной информации
    try:
        actions = get_card_actions(card_id)
    except Exception as e:
        actions = []

    # Создаем словарь для быстрого поиска членов по ID
    members_dict = {}
    for action in actions:
        member = action.get("memberCreator", {})
        if member.get("id") and member.get("id") not in members_dict:
            members_dict[member["id"]] = {
                "id": member["id"],
                "username": member.get("username", ""),
                "fullName": member.get("fullName", "")
            }

    # Преобразуем историю в детальный формат
    detailed_history = []

    # Сначала обработаем создание карточки
    if history:
        first_history = history[0]
        # Найдем действие создания карточки
        create_action = None
        for action in actions:
            if action.get("type") == "createCard":
                create_action = action
                break

        if create_action:
            member_id = create_action.get("idMemberCreator")
            member_name = "N/A"
            if member_id and member_id in members_dict:
                member_name = members_dict[member_id].get("fullName", members_dict[member_id].get("username", member_id))

            detailed_history.append({
                "id": f"create_{first_history.id}",
                "type": "createCard",
                "date": first_history.date.isoformat(),
                "data": {
                    "listBefore": None,
                    "listAfter": first_history.list_name,
                    "moveTo": f"Создана → {first_history.list_name}"
                },
                "memberCreator": {
                    "id": member_id,
                    "name": member_name
                }
            })

    for h in history:
        # Пропускаем первую запись, если она уже обработана как создание
        if detailed_history and detailed_history[0]["id"] == f"create_{h.id}":
            continue

        # Находим соответствующее действие в полной истории для получения listBefore/listAfter
        list_before = None
        list_after = None
        member_name = "N/A"

        for action in actions:
            if (action.get("type") == "updateCard" and
                action.get("data", {}).get("listBefore") and
                action.get("data", {}).get("listAfter") and
                action.get("data", {}).get("listAfter", {}).get("name") == h.list_name):
                # Convert action datetime to naive (remove timezone) to match database datetime
                action_datetime = datetime.fromisoformat(action.get("date").replace("Z", "+00:00")).replace(tzinfo=None)
                if abs((action_datetime - h.date).total_seconds()) < 1:
                    list_before = action.get("data", {}).get("listBefore", {}).get("name")
                    list_after = action.get("data", {}).get("listAfter", {}).get("name")
                    member_id = action.get("idMemberCreator")
                    if member_id and member_id in members_dict:
                        member_name = members_dict[member_id].get("fullName", members_dict[member_id].get("username", member_id))
                    break

        detailed_history.append({
            "id": h.id,
            "type": h.action_type,
            "date": h.date.isoformat(),
            "data": {
                "listBefore": list_before,
                "listAfter": list_after,
                "moveTo": f"{list_before} → {list_after}" if list_before and list_after else None
            },
            "memberCreator": {
                "id": h.member_id,
                "name": member_name
            }
        })

    return detailed_history

# Новый эндпоинт для фильтрации
@router.get("/cards")
def get_filtered_cards(
    created_after: str = Query(None, description="Фильтр по дате создания (формат: YYYY-MM-DD)"),
    trello_card_id: str = Query(None, description="Фильтр по ID карточки (или её части)"),
    db: Session = Depends(get_db)
):
    query = db.query(Card)

    if created_after:
        try:
            date_obj = datetime.strptime(created_after, "%Y-%m-%d")
            query = query.filter(Card.created_at >= date_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if trello_card_id:
        query = query.filter(Card.trello_card_id.contains(trello_card_id))

    cards = query.all()
    return [{"id": c.id, "trello_card_id": c.trello_card_id, "created_at": c.created_at} for c in cards]

# Эндпоинт для получения списков доски
@router.get("/board/{board_id}/lists")
def get_board_lists(board_id: str):
    """
    Получает список активных колонок доски из Trello API.
    """
    try:
        from ..app.trello_api import BASE_URL, TRELLO_API_KEY, TRELLO_TOKEN
        url = f"{BASE_URL}/boards/{board_id}/lists"
        params = {
            "key": TRELLO_API_KEY,
            "token": TRELLO_TOKEN,
            "filter": "open"  # Только открытые (активные) списки
        }
        response = requests.get(url, params=params)
        if response.status_code == 200:
            lists = response.json()
            # Возвращаем только id и name
            return [{"id": lst["id"], "name": lst["name"]} for lst in lists]
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Error fetching lists: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))