const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || file.mimetype.startsWith("text/");
    cb(ok ? null : new Error("Upload a PDF or text file."), ok);
  }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();

function extractTopics(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.length > 35);
  const stop = new Set(("the a an and or but if then is are was were be been being to of in on for from with by as at this that these those it its into about can may might will would should have has had not than also such each more most other some any all their there what when where which who how why use used using").split(" "));
  const counts = new Map();
  const words = cleaned.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [];
  for (const word of words) {
    if (!stop.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count }));
  const chunks = sentences.slice(0, 40);
  const topics = keywords.slice(0, 8).map((k, i) => {
    const related = chunks.filter(s => s.toLowerCase().includes(k.word));
    return { id: `topic-${i + 1}`, name: k.word.charAt(0).toUpperCase() + k.word.slice(1), frequency: k.count,
      excerpt: related[0] ? related[0].slice(0, 260) : `Review how “${k.word}” is used in your uploaded material.`,
      status: "Needs review", mastery: 0 };
  });
  return { topics, keywords, sentenceCount: sentences.length, wordCount: words.length };
}

function makeQuestions(topics, sourceText) {
  const sentences = sourceText.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 45);
  return topics.slice(0, 8).map((topic, i) => {
    const matching = sentences.find(s => s.toLowerCase().includes(topic.name.toLowerCase()));
    const context = matching || topic.excerpt;
    return {
      id: `q-${i + 1}`, topic: topic.name,
      question: `According to your uploaded notes, which topic should you review in this sentence/context?`,
      context: context.slice(0, 320),
      options: [topic.name, topics[(i + 1) % topics.length]?.name || "Key definitions", topics[(i + 2) % topics.length]?.name || "Worked examples", "General introduction"].filter((v, idx, arr) => arr.indexOf(v) === idx).slice(0, 4),
      answer: topic.name,
      explanation: `This question is generated from the topic keywords and excerpt extracted from your own document. Re-read the context and connect it to the topic label.`
    };
  }).filter(q => q.options.length === 4);
}

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "LearnLoop", timestamp: new Date().toISOString() }));

app.post("/api/materials", upload.single("material"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a PDF or text file first." });
    let text;
    if (req.file.mimetype === "application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf")) {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else {
      text = req.file.buffer.toString("utf8");
    }
    if (!text.trim()) return res.status(422).json({ error: "No selectable text found. Scanned/image-only PDFs need OCR, which this demo does not include yet." });
    const analysis = extractTopics(text);
    if (!analysis.topics.length) return res.status(422).json({ error: "Not enough readable text to extract topics. Try a text-based PDF or TXT file." });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const questions = makeQuestions(analysis.topics, text);
    const record = { id, fileName: req.file.originalname, uploadedAt: new Date().toISOString(), analysis, questions, text: text.slice(0, 200000), attempts: [], revisionDays: [1, 3, 7, 14] };
    sessions.set(id, record);
    res.status(201).json({ id, fileName: record.fileName, uploadedAt: record.uploadedAt, analysis, questions: questions.map(({ answer, ...q }) => q), revisionDays: record.revisionDays });
  } catch (err) { next(err); }
});

app.get("/api/materials/:id", (req, res) => {
  const record = sessions.get(req.params.id);
  if (!record) return res.status(404).json({ error: "Study session not found. Upload your material again." });
  const wrongByTopic = {};
  for (const attempt of record.attempts) if (!attempt.correct) wrongByTopic[attempt.topic] = (wrongByTopic[attempt.topic] || 0) + 1;
  res.json({
    id: record.id, fileName: record.fileName, uploadedAt: record.uploadedAt, analysis: record.analysis,
    questions: record.questions.map(({ answer, ...q }) => q), attempts: record.attempts,
    totalAttempts: record.attempts.length, correctAttempts: record.attempts.filter(a => a.correct).length,
    wrongByTopic, revisionDays: record.revisionDays
  });
});

app.post("/api/materials/:id/answer", (req, res) => {
  const record = sessions.get(req.params.id);
  if (!record) return res.status(404).json({ error: "Study session not found." });
  const { questionId, answer } = req.body || {};
  const question = record.questions.find(q => q.id === questionId);
  if (!question || typeof answer !== "string") return res.status(400).json({ error: "Choose an answer for a valid question." });
  const correct = answer === question.answer;
  const attempt = { questionId, topic: question.topic, answer, correct, attemptedAt: new Date().toISOString() };
  record.attempts.push(attempt);
  res.json({ correct, correctAnswer: question.answer, explanation: question.explanation, attempt, adaptiveMessage: correct ? "Good work. Keep this topic in your revision cycle." : `Add “${question.topic}” to your next revision session and try another question after reviewing the excerpt.` });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is too large. Maximum size is 8 MB." });
  if (err.message === "Upload a PDF or text file.") return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong processing the file. Please try another PDF or TXT file." });
});

app.listen(PORT, () => console.log(`LearnLoop running on port ${PORT}`));
