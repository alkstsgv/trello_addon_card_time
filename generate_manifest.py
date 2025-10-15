import os
import json

MANIFEST_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "trello-addon", "manifest.json")

def write_manifest(backend_url: str):
    manifest_data = {
        "name": "Card Tracker",
        "description": "Track card history, time, members, and more.",
        "icon": {
            "url": "https://example.com/icon.png"
        },
        "author": "Your Name",
        "connect": {
            "iframe": {
                "url": f"{backend_url}/static/powerup.html",  # <-- Используем /static
                "callback": {
                    "url": f"{backend_url}/callback"
                }
            }
        },
        "content": {
            "url": f"{backend_url}/content"
        },
        "apiVersion": "1.0",
        "scopes": [
            "read"
        ]
    }
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, indent=2)

if __name__ == "__main__":
    backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
    print(f"Using backend URL: {backend_url}")
    write_manifest(backend_url)
    print(f"Manifest {MANIFEST_PATH} created.")