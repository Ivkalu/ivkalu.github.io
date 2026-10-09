"""Generate assets/songs.json from the folder structure of assets/songs.

Every subfolder of assets/songs is a category, every audio file in it is a song.
- An optional leading number ("1 Electronic", "02 Mirage.mp3") sets the order
  and is stripped from the displayed name.
- Folders and files starting with "_" or "." are ignored (e.g. _hidden/).
- Files placed directly in assets/songs (outside a subfolder) are ignored.
- An image named cover.(jpg|jpeg|png|webp) in a folder becomes that category's
  cover, shown inside the circle on the player page.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SONGS_DIR = ROOT / "assets" / "songs"
OUTPUT = ROOT / "assets" / "songs.json"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}
COVER_NAMES = {"cover.jpg", "cover.jpeg", "cover.png", "cover.webp"}
PREFIX = re.compile(r"^(\d+)\s+(.+)$")


def sort_key_and_name(stem):
    match = PREFIX.match(stem)
    if match:
        return (0, int(match.group(1)), match.group(2).lower()), match.group(2)
    if stem.isdigit():
        # Songs named only by a number ("1", "2", ..., "10") keep that number as
        # the title and sort numerically instead of "1, 10, 2".
        return (0, int(stem), ""), stem
    return (1, 0, stem.lower()), stem


def visible(path):
    return not path.name.startswith(("_", "."))


def main():
    categories = []
    for folder in filter(visible, SONGS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        songs = []
        cover = None
        for file in filter(visible, folder.iterdir()):
            if file.is_file() and file.name.lower() in COVER_NAMES:
                cover = file.relative_to(ROOT).as_posix()
            if file.is_file() and file.suffix.lower() in AUDIO_EXTENSIONS:
                key, title = sort_key_and_name(file.stem)
                songs.append((key, {"title": title, "path": file.relative_to(ROOT).as_posix()}))
        if songs:
            key, name = sort_key_and_name(folder.name)
            category = {"name": name, "songs": [s for _, s in sorted(songs, key=lambda s: s[0])]}
            if cover:
                category["cover"] = cover
            categories.append((key, category))

    data = [c for _, c in sorted(categories, key=lambda c: c[0])]
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(data)} categories")


if __name__ == "__main__":
    main()
