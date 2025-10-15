from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from ..app.database import get_db
from ..app import trello_api
from ..app.models import Card

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