import io
import random
from pathlib import Path
import re
import sqlite3
from collections import Counter

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pypdf import PdfReader

BASE_DIR = Path(__file__).parent
DB_FILE = str(BASE_DIR / "learnloop.db")

STOP_WORDS = set(
    "the and for with that this from have has had are was were been will would "
    "can could not but into their there they them you your our also more most "
    "other some any which these those than then such its it's what when where".split()
)

app = FastAPI(title="LearnLoop")


# ---------- database ----------
def db():
    con = sqlite3.connect(DB_FILE)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = db()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY,
            name TEXT,
            text TEXT
        );
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY,
            topic_id INTEGER,
            correct INTEGER,
            ts TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    con.commit()
    con.close()


init_db()


# ---------- helpers ----------
def split_sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]


def keywords(text):
    words = re.findall(r"[A-Za-z]{4,}", text.lower())
    return [w for w in words if w not in STOP_WORDS]


def extract_topics(text, chunk_size=6):
    """Group sentences into chunks and name each chunk by its most common words."""
    sentences = split_sentences(text)
    topics = []
    for i in range(0, len(sentences), chunk_size):
        chunk = " ".join(sentences[i : i + chunk_size])
        common = [w for w, _ in Counter(keywords(chunk)).most_common(2)]
        if common:
            topics.append((" / ".join(common), chunk))
    return topics


# ---------- API ----------
@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    if file.filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        text = " ".join((page.extract_text() or "") for page in reader.pages)
    else:
        text = raw.decode("utf-8", errors="ignore")

    topics = extract_topics(text)
    con = db()
    for name, chunk in topics:
        con.execute("INSERT INTO topics (name, text) VALUES (?, ?)", (name, chunk))
    con.commit()
    con.close()
    return {"topics_added": len(topics)}


@app.get("/api/quiz")
def quiz():
    """Pick a topic (weak topics are more likely) and hide one keyword in a sentence."""
    con = db()
    topics = con.execute("SELECT * FROM topics").fetchall()
    if not topics:
        con.close()
        return {"error": "Upload some material first."}

    weights = []
    for t in topics:
        row = con.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(correct), 0) AS ok FROM answers WHERE topic_id = ?",
            (t["id"],),
        ).fetchone()
        accuracy = row["ok"] / row["n"] if row["n"] else 0.0
        weights.append(1.0 + (1.0 - accuracy) * 3)  # low accuracy -> higher weight
    con.close()

    topic = random.choices(topics, weights=weights)[0]
    sentences = [s for s in split_sentences(topic["text"]) if len(s) > 40]
    sentence = random.choice(sentences or [topic["text"]])
    words = keywords(sentence)
    if not words:
        return quiz()
    answer = max(words, key=len)
    question = re.sub(answer, "_____", sentence, count=1, flags=re.IGNORECASE)
    return {
        "topic_id": topic["id"],
        "topic": topic["name"],
        "question": question,
        "answer": answer,
    }


class Answer(BaseModel):
    topic_id: int
    given: str
    expected: str


@app.post("/api/answer")
def answer(a: Answer):
    correct = int(a.given.strip().lower() == a.expected.strip().lower())
    con = db()
    con.execute(
        "INSERT INTO answers (topic_id, correct) VALUES (?, ?)", (a.topic_id, correct)
    )
    con.commit()
    con.close()
    return {"correct": bool(correct)}


@app.get("/api/progress")
def progress():
    con = db()
    rows = con.execute(
        """
        SELECT t.name AS topic, COUNT(a.id) AS attempts,
               COALESCE(SUM(a.correct), 0) AS right_answers
        FROM topics t LEFT JOIN answers a ON a.topic_id = t.id
        GROUP BY t.id
        HAVING attempts > 0
        ORDER BY (1.0 * right_answers / attempts) ASC
        """
    ).fetchall()
    con.close()
    return [
        {
            "topic": r["topic"],
            "attempts": r["attempts"],
            "accuracy": round(100 * r["right_answers"] / r["attempts"]),
        }
        for r in rows
    ]


# serve the website page
@app.get("/")
def home():
    return FileResponse(BASE_DIR / "index.html")
