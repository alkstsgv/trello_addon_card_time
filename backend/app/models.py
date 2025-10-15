from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    settings = Column(Text)  # JSON строка настроек

class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    trello_card_id = Column(String, unique=True, index=True)  # ID карточки в Trello
    created_at = Column(DateTime, default=datetime.utcnow)

class CardHistory(Base):
    __tablename__ = "card_history"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"))
    action_type = Column(String)  # например, moveCardToList, addMemberToCard
    list_name = Column(String)    # имя колонки
    member_id = Column(String)    # ID участника
    date = Column(DateTime)       # когда произошло действие

    card = relationship("Card", back_populates="history")

class CardStat(Base):
    __tablename__ = "card_stats"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"))
    total_time = Column(Integer)  # в секундах
    time_per_member = Column(Text)  # JSON: {"member_id": seconds, ...}
    time_per_list = Column(Text)    # JSON: {"list_name": seconds, ...}

    card = relationship("Card", back_populates="stats")

Card.history = relationship("CardHistory", back_populates="card")
Card.stats = relationship("CardStat", back_populates="card")