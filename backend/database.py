import sqlite3
from pathlib import Path


DEFAULTS = {
    "output_dir": str(Path.home() / "Downloads" / "MediaHarbor"),
    "images_subfolder": "images",
    "videos_subfolder": "videos",
    "per_site_folder": "true",
    "concurrent_downloads": "5",
    "stealth_mode": "true",
    "max_scrolls": "15",
    "scroll_delay": "1.0",
    "min_image_width": "100",
    "min_image_height": "100",
    "include_images": "true",
    "include_videos": "true",
    "allowed_formats": "",
}


class Database:
    def __init__(self, db_path: str = "mediaharbor.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init()

    def _init(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS harvests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                domain TEXT,
                image_count INTEGER DEFAULT 0,
                video_count INTEGER DEFAULT 0,
                downloaded_files INTEGER DEFAULT 0,
                total_size_mb REAL DEFAULT 0,
                output_dir TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        for k, v in DEFAULTS.items():
            self.conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v)
            )
        self.conn.commit()

    def get_settings(self) -> dict:
        rows = self.conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}

    def set_settings(self, data: dict):
        self.conn.executemany(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            data.items()
        )
        self.conn.commit()

    def save_harvest(self, url, domain, image_count, video_count,
                     downloaded_files, total_size_mb, output_dir) -> int:
        cur = self.conn.execute(
            """INSERT INTO harvests
               (url, domain, image_count, video_count, downloaded_files, total_size_mb, output_dir)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (url, domain, image_count, video_count, downloaded_files, total_size_mb, output_dir)
        )
        self.conn.commit()
        return cur.lastrowid

    def get_history(self, limit: int = 50) -> list:
        rows = self.conn.execute(
            "SELECT * FROM harvests ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def delete_harvest(self, id: int):
        self.conn.execute("DELETE FROM harvests WHERE id = ?", (id,))
        self.conn.commit()

    def close(self):
        self.conn.close()
