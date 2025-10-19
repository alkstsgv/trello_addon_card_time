from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from ..app.database import get_db
from ..app import trello_api
from ..app.models import Card, CardHistory

router = APIRouter()

@router.get("/card/{card_id}/fetch-history")
def fetch_and_save_card_history(card_id: str, db: Session = Depends(get_db)):
    try:
        actions = trello_api.get_card_actions(card_id)
        trello_api.save_card_history(card_id, actions, db)
        return {"message": f"История для карточки {card_id} сохранена", "count": len(actions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/card/{card_id}/metrics")
def get_card_metrics(card_id: str, db: Session = Depends(get_db)):
    try:
        metrics = trello_api.calculate_card_metrics(card_id, db)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# Новый эндпоинт для получения истории
@router.get("/card/{card_id}/history")
def get_card_history(card_id: str, db: Session = Depends(get_db)):
    db_card = db.query(Card).filter(Card.trello_card_id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found in database")

    history = db.query(CardHistory).filter(CardHistory.card_id == db_card.id).order_by(CardHistory.date).all()

    # Преобразуем в список словарей
    history_list = []
    for h in history:
        history_list.append({
            "id": h.id,
            "type": h.action_type,
            "date": h.date.isoformat(),
            "data": {
                "listName": h.list_name,
            },
            "memberCreator": {
                "id": h.member_id,
            }
        })

    return history_list

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