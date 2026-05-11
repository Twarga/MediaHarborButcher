import sqlite3
from datetime import datetime
from pathlib import Path


class Database:
    def __init__(self, db_path: str = "mediaharbor.db"):
        self.db_path = db_path
        self.conn = None
        self._init_db()
    
    def _init_db(self):
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS harvests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                domain TEXT,
                image_count INTEGER,
                video_count INTEGER,
                downloaded_files INTEGER,
                total_size INTEGER,
                output_dir TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        self.conn.commit()
    
    def save_harvest(self, url: str, image_count: int, video_count: int, 
                   downloaded: int, total_size: int, output_dir: str) -> int:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        
        cursor = self.conn.execute("""
            INSERT INTO harvests (url, domain, image_count, video_count, 
                           downloaded_files, total_size, output_dir)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (url, domain, image_count, video_count, downloaded, total_size, output_dir))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_history(self, limit: int = 20) -> list:
        cursor = self.conn.execute("""
            SELECT * FROM harvests 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_setting(self, key: str, default: str = "") -> str:
        cursor = self.conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row['value'] if row else default
    
    def set_setting(self, key: str, value: str):
        self.conn.execute("""
            INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
        """, (key, value))
        self.conn.commit()
    
    def close(self):
        if self.conn:
            self.conn.close()


def test_db():
    db = Database("/tmp/mediaharbor_test.db")
    
    # Save a harvest
    db.save_harvest(
        url="https://unsplash.com",
        image_count=100,
        video_count=0,
        downloaded=50,
        total_size=5000000,
        output_dir="/tmp/harvest"
    )
    
    # Get history
    history = db.get_history()
    print(f"History: {len(history)} items")
    if history:
        print(f"Last harvest: {history[0]['url']} - {history[0]['image_count']} images")
    
    # Get/set settings
    db.set_setting("output_dir", "/home/Downloads")
    print(f"Output dir: {db.get_setting('output_dir')}")
    
    db.close()
    print("Database test complete!")


if __name__ == "__main__":
    test_db()