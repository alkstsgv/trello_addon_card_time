from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..app.database import get_db
from ..app.models import User
from ..app.trello_api import get_board_lists

router = APIRouter()

class SettingsUpdate(BaseModel):
    username: str
    settings: dict

@router.post("/settings")
def update_user_settings(settings_data: SettingsUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == settings_data.username).first()
    if not user:
        user = User(username=settings_data.username)
        db.add(user)

    user.settings = str(settings_data.settings)  # Сохраняем как строку (можно JSON)
    db.commit()
    return {"message": "Settings updated"}

@router.get("/settings/{username}")
def get_user_settings(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"settings": user.settings}

@router.get("/board/{board_id}/lists")
def get_board_lists_endpoint(board_id: str):
    try:
        lists = get_board_lists(board_id)
        return lists
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))