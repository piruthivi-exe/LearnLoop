# LearnLoop — Personalized Study Coach 📚

LearnLoop is a portfolio web app that turns text-based study materials into a topic map, template-generated practice questions, a spaced-revision starter plan and a weak-topic report.

**Stack:** Node.js, Express, Multer, pdf-parse, HTML, CSS and vanilla JavaScript.

> **Prototype limitations:** This is not a full AI tutor. Topic extraction is based on frequent keywords; practice questions are template-generated from extracted topics and excerpts. Scanned/image-only PDFs are not OCR'd. The current session store is in-memory and resets when the server restarts. Do not upload confidential or sensitive materials.

## Features
- Upload PDF or TXT files up to 8 MB.
- Extract readable text from PDFs and plain-text files.
- Identify frequent keywords and display related sentence excerpts.
- Generate simple practice questions tied to extracted topic labels.
- Record correct and incorrect answers.
- Highlight topics with incorrect attempts.
- Show a 1-, 3-, 7- and 14-day revision starter schedule.
- Responsive UI and REST API.
- Render-compatible `PORT` configuration.

## Run locally
Requirements: Node.js 18 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Development mode:

```bash
npm run dev
```

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/materials` | Upload PDF/TXT; extract topics and create quiz |
| GET | `/api/materials/:id` | Get session and progress |
| POST | `/api/materials/:id/answer` | Record a quiz answer |

## Deploy to Render
1. Create a GitHub repository named `LearnLoop`.
2. Upload the project files. Do not upload `node_modules`.
3. In Render choose **New → Web Service** and connect the repository.
4. Use build command `npm install` and start command `npm start`.
5. Deploy and open the Render URL.

## Next improvements
- Replace keyword heuristics with a proper topic model or an LLM with user consent.
- Improve quiz quality with answer validation grounded in the uploaded document.
- Persist sessions and progress in PostgreSQL.
- Add spaced-repetition scheduling with actual due dates and reminders.
- Add OCR for scanned PDFs, upload security controls, rate limiting and deletion controls.
- Add authentication and user-specific progress.

## GitHub description
A Node.js study coach prototype that analyses PDF/TXT notes, extracts key topics, generates practice questions, tracks weak topics and offers a revision plan.

## LinkedIn post
📚 **Built LearnLoop — a Personalized Study Coach**

I wanted to explore how study notes could become more actionable than a document we read once and forget.

LearnLoop is a web app prototype that:
- Extracts recurring topics from PDF and TXT study material
- Generates practice questions linked to extracted topics
- Records quiz attempts and surfaces topics that need revision
- Provides a spaced-revision starter plan

**Tech stack:** Node.js, Express, PDF parsing, HTML, CSS and JavaScript. Deployed with Render.

This is an early prototype using keyword-based extraction and template-generated questions. Next, I plan to improve answer quality, add persistent progress storage and explore more capable document understanding.

Feedback and ideas are welcome!

#NodeJS #WebDevelopment #EdTech #BuildInPublic #Learning #PortfolioProject

## License
MIT.
