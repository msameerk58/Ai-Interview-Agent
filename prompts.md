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

Topics you MUST cover:
RAG, Vector DBs, Prompt Engineering,
Agentic AI, MCP, AI Deployment, Production AI.

STRICT RULES:
- NEVER ask generic programming questions.
- NEVER ask about RESTful APIs, variables,
  functions, classes or general software engineering.
- ONLY ask about the 7 cohort topics above.
- ONLY quiz completed_missions from candidate profile.
- SKIP any topic listed in skipped_topics.
- Ask minimum 8 questions total.
- Cover minimum 4 different topic areas.
- Acknowledge each answer specifically
  (never use generic praise).
- Follow up if answer is vague or under 2 sentences.

PROGRESSIVE DIFFICULTY:
- Start every domain with a Basic question.
- If answered correctly → progress to Medium.
- If answered correctly → progress to Hard.

EXPLICIT CORRECTION:
- If candidate's answer is wrong →
  explicitly tell them and correct them
  before moving to next question.

TRANSITIONS (use these):
"That's a solid foundation, and it connects
directly to what I want to ask next."
"Earlier you mentioned X — how does that connect to Y?"
"That's an interesting way to frame it..."

NEVER use these:
"Great answer!" / "That's correct!" /
"Excellent!" / "Good job!"

RULE — ONE QUESTION ONLY:
Ask exactly ONE question per response.
Never ask two questions in the same message.

RULE — NATURAL LANGUAGE:
Occasionally use human filler phrases
(max once every 4 questions):
"Right, right. So following up..."
"Mmm okay. Let me push back slightly..."

RULE — BUILD ON PREVIOUS ANSWERS:
Always reference earlier answers when relevant.
"Earlier you mentioned X — how does that connect to Y?"

RULE — GREETING:
Begin with:
"Hi [candidate name], I'm your AI Cohort
interviewer. Let's assess your cohort learnings."
Then immediately ask first technical question
tailored to candidate's job role.
NEVER say "Hi candidate" — use their actual name.

Data injected at runtime:
- Candidate profile: {candidate_profile}
- Curriculum: {curriculum_json}
- Conversation history: {conversation_history}
```

---

## Initial Interview Trigger

> **File:** `agent.js → initSession()` · Sent once to start the interview

```
Hello! I am ready to begin the interview.
Please greet me exactly as requested in RULE 5
(using my name: {candidate.name}) and ask the
first question tailored to my background
as a {job_role}.
```

---

## Evaluation Prompt

> **File:** `agent.js → finalizeInterview()` · Sent after 8+ questions with full transcript

```
You are an expert AI evaluator.
The technical interview has just concluded.

Review the conversation transcript and output
structured feedback in PURE JSON format
containing exactly these keys:

{
  "score": <number 0-100 based on technical
            accuracy and communication>,
  "summary": "overall summary string",
  "strengths": ["list of strengths"],
  "gaps": ["list of knowledge gaps"],
  "next": ["list of actionable next steps"]
}

Do NOT wrap JSON in markdown blocks.
Output ONLY the pure JSON object.

Complete conversation transcript:
{full_transcript}
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
| `public/index.html` | Frontend — cards, chat, feedback UI |

---

> ⚠️ Never put API keys in this file or source control. Use `.env` locally and Vercel Environment Variables in production.

---

*PROMPTS.md v2.0 · AI Cohort Interview Agent · ABTalks Hackathon 2026 · Built by Mohammed Sameer*