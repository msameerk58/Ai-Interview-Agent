# PROMPTS.md — AI Cohort Interview Agent

**Hackathon:** ABTalks AI Cohort Hackathon 2026
**Builder:** Mohammed Sameer
**Live:** https://ai-interview-agent-cyan.vercel.app
**Repo:** https://github.com/msameerk58/Ai-Interview-Agent

---

## Models Used

| Purpose | Model |
|---|---|
| Interview Questions | Anthropic `claude-3-5-sonnet-20240620` |
| Interview Questions (fallback) | Google `gemini-1.5-flash` |
| Final Evaluation | Anthropic `claude-opus-4-6` |
| Final Evaluation (fallback) | Google `gemini-2.5-flash` |

---

## How It Works — Big Picture

```
┌─────────────────────────────────────────────────────┐
│                 Candidate selects profile            │
└────────────────────────┬────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│     System Prompt + Candidate Profile + Curriculum   │
└────────────────────────┬────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              AI asks first question                  │
└────────────────────────┬────────────────────────────┘
                         ↓
              ┌──────────────────┐
              │  Candidate answers│
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │ AI asks next Q   │ ◄── loops until 8+ questions
              └────────┬─────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│         Evaluation Prompt → JSON Feedback            │
└─────────────────────────────────────────────────────┘
```

---

## Model Fallback Flow

```
Interview Questions:
  Anthropic Sonnet  →  fails?  →  Gemini Flash  →  fails?  →  Fallback Bank

Final Evaluation:
  Anthropic Opus    →  fails?  →  Gemini 2.5 Flash
```

---

## Session Flow

```
1.  Candidate profile selected
2.  initSession()  →  stores profile, starts empty history, turnCount = 0
3.  System prompt built with candidate data
4.  Initial trigger sent  →  AI greets + asks Q1
      ↓
5.  Candidate answers
6.  handleTurn()  →  appends answer, rebuilds context, calls AI
7.  AI responds with next question
8.  turnCount++
      ↓
      repeat steps 5–8 ...
      ↓
9.  turnCount >= 8  →  finalizeInterview()
10. Evaluation prompt sent with full transcript
11. JSON feedback returned to frontend
12. Session state deleted
```

---

## System Prompt

> **File:** `agent.js` · Sent on every turn · Variables injected: `{candidate_profile}`, `{curriculum_json}`, `{conversation_history}`

```
You are AI Cohort Interview Agent.
ONLY ask questions from these 7 topics:
1. RAG & Retrieval pipelines
2. Vector Databases & Embeddings
3. Prompt Engineering techniques
4. Agentic AI & Agent loops
5. Model Context Protocol (MCP)
6. AI Deployment & serving
7. Production AI Systems & monitoring
QUESTION RULES:
- Start every topic with Basic question
- If answered well → ask Medium question
- If answered well → ask Hard question
- If answer is wrong → correct them explicitly
- If answer is vague → ask follow-up
- Reference previous answers in follow-ups
- Never ask about REST APIs, variables,
  functions, classes, OOP, Git, databases
- One question per response only
- Min 8 questions, 4 topics minimum
GOOD question examples:
Basic: "Explain how a RAG pipeline works"
Medium: "How do you choose chunk size in RAG?"
Hard: "How would you debug poor RAG retrieval quality?"
BAD questions (never ask these):
"What is a variable?"
"Explain REST API design"
"What is OOP?"
Candidate data: {candidate_profile}
Curriculum: {curriculum_json}
History: {conversation_history}
```

---

## Initial Interview Trigger

> **File:** `agent.js → initSession()` · Sent once to start the interview

```
Hello! I am ready to begin the interview.
Please greet me (using my name: {candidate.name})
and ask the first question.
```

---

## Evaluation Prompt

> **File:** `agent.js → finalizeInterview()` · Sent after 8+ questions with full transcript

```
You are an expert AI technical evaluator.
Review this interview transcript carefully.
Return ONLY pure JSON, no markdown:
{
  "score": <0-100>,
  "grade": "A/B/C/D/F",
  "summary": "2-3 sentence overall assessment",
  "topic_scores": {
    "RAG": <0-100 or null if not covered>,
    "VectorDB": <0-100 or null>,
    "PromptEng": <0-100 or null>,
    "AgenticAI": <0-100 or null>,
    "MCP": <0-100 or null>,
    "Deployment": <0-100 or null>,
    "Production": <0-100 or null>
  },
  "strengths": [
    "Specific strength with example from interview",
    "Specific strength with example from interview",
    "Specific strength with example from interview"
  ],
  "gaps": [
    "Specific gap with exact question they struggled on",
    "Specific gap with exact question they struggled on"
  ],
  "study_plan": {
    "day1_2": "Specific topic to study",
    "day3_4": "Specific topic to study",
    "day5_7": "Specific topic to study"
  },
 "elevator_pitch": "One sentence candidate can use in real interviews",
  "interview_readiness": "Not Ready/Almost Ready/Ready/Interview-Ready"
}
Transcript: {full_transcript}
```

### Score Visibility by Turn

```
Q1 answered  →  max 20 pts shown
Q2 answered  →  max 35 pts shown
Q3 answered  →  max 50 pts shown
Q4+ answered →  full 100 pts unlocked
```

---

## Interview Rules at a Glance

```
MUST DO ✅                        NEVER DO ❌
──────────────────────────────    ──────────────────────────────
Ask ONE question per response     "Great answer!" / "Excellent!"
Stay in 7 cohort topics only      Generic programming questions
Quiz only completed missions       REST API / variables / functions
Skip skipped_topics               Ask two questions at once
Start every domain at Basic       Start at Hard difficulty
Progress Basic → Medium → Hard    Quiz skipped topics
Correct wrong answers explicitly
Follow up on vague answers
Reference earlier answers
Min 8 questions / 4 topics
Use candidate's real name
```

---

## Fallback Question Bank

Used when both Anthropic and Gemini are unavailable.

| Topic | Basic | Medium | Hard |
|---|---|---|---|
| **RAG** | Explain a RAG pipeline | Semantic vs keyword search | Optimize high-latency RAG |
| **Vector DBs** | What is a vector embedding? | HNSW vs IVF-PQ indexes | Distributed scaling & pruning |
| **Prompt Engineering** | Zero-shot vs few-shot | Chain-of-Thought reasoning | Prevent prompt injection |
| **Agentic AI** | LLM chain vs AI Agent | ReAct framework | Multi-agent conflict resolution |
| **MCP** | What problem does MCP solve? | Secure LLM ↔ API connection | Custom MCP server for legacy data |
| **AI Deployment** | Serving an LLM in production | Streaming + rate limits at scale | Zero-downtime deployments |
| **Production AI** | What are hallucinations? | Auto-evaluate hallucinations | Continuous monitoring + fine-tuning |

---

## Runtime Variables

| Variable | Source | Purpose |
|---|---|---|
| `{candidate_profile}` | `candidates.json` | Name, role, missions, skipped topics |
| `{curriculum_json}` | `curriculum.json` | Full 31-day cohort content |
| `{conversation_history}` | `agent.js` session | All previous Q&A turns |
| `{job_role}` | Candidate profile | Tailors the opening question |
| `{full_transcript}` | Built at turn 8+ | Sent to the evaluator |

---

## API Response Contract

```json
// During interview
{ "reply": "next interviewer question", "done": false }

// After 8+ questions
{
  "reply": "Thank you. The interview is now complete.",
  "done": true,
  "feedback": {
    "score": 75,
    "summary": "Strong fundamentals on RAG...",
    "strengths": ["Clear explanation of embeddings"],
    "gaps": ["Weak on deployment strategies"],
    "next": ["Revisit Days 20-25 on AI Deployment"]
  }
}
```

---

## Related Files

| File | Purpose |
|---|---|
| `agent.js` | Prompt assembly, model calls, session state, fallbacks |
| `server.js` | `/api/interview` endpoint |
| `curriculum.json` | 31-day cohort modules & missions |
| `candidates.json` | 9 candidate profiles |
| `public/login.html` | Frontend — Authentication & Sign Up |
| `public/interests.html` | Frontend — Area of Interest scheduling |
| `public/dashboard.html` | Frontend — 31-Day Progress Dashboard |
| `public/index.html` | Frontend — main interview chat & feedback UI |

---

> ⚠️ Never put API keys in this file or source control. Use `.env` locally and Vercel Environment Variables in production.

---

*PROMPTS.md v2.0 · AI Cohort Interview Agent · ABTalks Hackathon 2026 · Built by Mohammed Sameer*