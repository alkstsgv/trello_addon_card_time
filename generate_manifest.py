import os
import json

# MANIFEST_PATH теперь указывает на trello/manifest.json, как вы использовали ранее
MANIFEST_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "trello_addon_card_time", "manifest.json")

def write_manifest(backend_url: str):
    manifest_data = {
        "name": "Card Tracker",
        "description": "Track card history, time, members, and more.",
        "icon": {
            "url": "https://example.com/icon.png"
        },
        "author": "Your Name",
    }
    manifest_data["scopes"] = ["read"]
    manifest_data["connect"] = {
        "iframe": {
            "url": f"{backend_url}/powerup_frame.html"
        }
    }
    manifest_data["capabilities"] = [
        "board-buttons",
        "card-buttons",
        "card-badges",
        "card-detail-badges",
        "show-settings",
        "content"
    ]
    manifest_data["content"] = {
        "url": f"{backend_url}/content.html"
    }
    # Убираем "content", если не планируем использовать его
    # manifest_data["content"] = {
    #     "url": f"{backend_url}/content"
    # }

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, indent=2)

if __name__ == "__main__":
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    print(f"Using backend URL: {backend_url}")
    write_manifest(backend_url)
    print(f"Manifest {MANIFEST_PATH} created.")