from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from io import StringIO, BytesIO
import csv
import json
from xml.etree.ElementTree import Element, SubElement, tostring
from ..app.database import get_db
from ..app import trello_api
from sqlalchemy.orm import Session

router = APIRouter()

def dict_to_csv(data: dict):
    """Преобразует словарь в CSV строку."""
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Value"])
    for key, value in data.items():
        if isinstance(value, dict):
            value = json.dumps(value)
        writer.writerow([key, value])
    output.seek(0)
    return output.getvalue()

def dict_to_xml(data: dict):
    """Преобразует словарь в XML строку."""
    root = Element("metrics")
    for key, value in data.items():
        child = SubElement(root, key)
        if isinstance(value, dict):
            child.text = json.dumps(value)
        else:
            child.text = str(value)
    return tostring(root, encoding="unicode")

def dict_to_excel_bytes(data: dict):
    """Преобразует словарь в Excel файл (BytesIO)."""
    import pandas as pd
    df = pd.DataFrame(list(data.items()), columns=["Metric", "Value"])
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Metrics")
    output.seek(0)
    return output

@router.get("/export/{card_id}")
def export_card_data(
    card_id: str,
    format: str = Query("json", regex="^(json|csv|xml|xlsx)$"),
    db: Session = Depends(get_db)
):
    try:
        metrics = trello_api.calculate_card_metrics(card_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if format == "json":
        return metrics
    elif format == "csv":
        content = dict_to_csv(metrics)
        return StreamingResponse(StringIO(content), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=card_{card_id}_metrics.csv"})
    elif format == "xml":
        content = dict_to_xml(metrics)
        return StreamingResponse(StringIO(content), media_type="application/xml", headers={"Content-Disposition": f"attachment; filename=card_{card_id}_metrics.xml"})
    elif format == "xlsx":
        content = dict_to_excel_bytes(metrics)
        return StreamingResponse(content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=card_{card_id}_metrics.xlsx"})
    else:
        raise HTTPException(status_code=400, detail="Format not supported")