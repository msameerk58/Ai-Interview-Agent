# 📝 Prompt Engineering — AI Technical Interviewer

This document logs all prompts used to build and drive the AI Technical Interviewer prototype, including the interviewer persona, session triggers, evaluation logic, and API fallback strings.

---

## 📌 Table of Contents

1. [System Prompt](#1-system-prompt)
2. [Initial Trigger Prompt](#2-initial-trigger-prompt)
3. [Feedback & Evaluation Prompt](#3-feedback--evaluation-prompt)
4. [Rate Limit Fallback Messages](#4-rate-limit-fallback-messages)
5. [How It All Fits Together](#5-how-it-all-fits-together)

---

## 1. System Prompt

> **Purpose:** Establishes the AI interviewer's persona, topic scope, behavioral rules, and expected JSON output format. Injected at the start of every session.

```text
You are Alex, AI Cohort Interview Agent.
Topics: RAG, Vector DBs, Prompt Engineering,
Agentic AI, MCP, AI Deployment, Production AI.

Rules:
- Only ask about cohort topics
- Only quiz completed_missions
- Skip skipped_topics
- Min 8 questions, 4 topics
- Acknowledge each answer specifically
- Follow up if answer is vague

Data: {candidate_profile} {curriculum_json} {conversation_history}

JSON response only:
{"next_question":"","is_follow_up":false,
"topic_area":"","interview_complete":false}
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| Named persona ("Alex") | Creates a consistent, addressable interviewer identity |
| Explicit topic list | Prevents the AI from drifting outside cohort scope |
| `completed_missions` constraint | Ensures questions match what the candidate has actually studied |
| Minimum 8 questions / 4 topics | Guarantees breadth and prevents premature session endings |
| Strict JSON output | Enables reliable frontend parsing without post-processing |

---

## 2. Initial Trigger Prompt

> **Purpose:** Seeds the first turn of every new session. Sent from the frontend immediately after the candidate profile is submitted to `/api/interview`.

```text
Hello! I am ready to begin the interview. Please provide a brief welcoming
intro statement, and then immediately ask me my first basic foundational question.
```

**Behavior this prompt enforces:**
- Forces a warm, human-feeling opening before the first question
- Anchors difficulty at a foundational level to ease the candidate in
- Signals to the AI that the interview clock has started

---

## 3. Feedback & Evaluation Prompt

> **Purpose:** Sent at the end of the interview to generate structured, parseable feedback from the full conversation transcript.

```text
You are an expert AI evaluator. The technical interview has just concluded.
Review the conversation transcript and output structured feedback in pure JSON
format containing exactly the following keys:

{
  "score": <number between 0 and 100 based on technical accuracy and communication>,
  "summary": "overall summary string",
  "strengths": ["list of strengths"],
  "gaps": ["list of knowledge gaps"],
  "next": ["list of actionable next steps"]
}

Do NOT wrap the JSON in markdown blocks. Output purely the JSON object.
```

**Expected JSON output shape:**

| Field | Type | Description |
|---|---|---|
| `score` | `number` (0–100) | Composite score across technical accuracy and communication |
| `summary` | `string` | High-level narrative of the candidate's performance |
| `strengths` | `string[]` | Specific areas where the candidate performed well |
| `gaps` | `string[]` | Knowledge gaps or weak areas identified during the session |
| `next` | `string[]` | Actionable recommendations for the candidate to improve |

---

## 4. Rate Limit Fallback Messages

> **Purpose:** Displayed when the Gemini API returns a rate limit or quota error. Keeps the interview flowing without exposing API failures to the candidate.

**Fallback A — Prompt for elaboration:**

```text
*(Mock Response due to API rate limit)* That's an interesting point. Could you
elaborate a bit more on your approach, or maybe explain another way to solve it?
```

**Fallback B — Graceful pivot to next question:**

```text
Let's continue with the next question while the system reconnects.
What is your approach to designing scalable services?
```

**When each fallback is used:**

| Fallback | Trigger condition |
|---|---|
| Fallback A | First rate-limit hit in a turn — buys time without changing topic |
| Fallback B | Persistent failure — gracefully moves the session forward |

---

## 5. How It All Fits Together

The prompts above operate as a pipeline across the full session lifecycle:

```
Session Start
     │
     ▼
[System Prompt]  ←──── candidate_profile + curriculum_json injected here
     │
     ▼
[Initial Trigger Prompt]  ←── frontend sends this to /api/interview on load
     │
     ▼
[Conversation Loop]
     │   ┌─────────────────────────────────┐
     ├──▶│  User answer → /api/interview   │
     │   │  AI reply (JSON) → next_question│
     │   └────────────┬────────────────────┘
     │                │  (on API error)
     │                ▼
     │         [Fallback Message A or B]
     │
     ▼ (interview_complete: true)
[Feedback & Evaluation Prompt]
     │
     ▼
Structured JSON feedback rendered in sidebar
```

**Additional notes:**

- The system prompt is merged with `candidate_profile` and the full content of `curriculum.json` before each Gemini call.
- The AI is intentionally seeded to start easy (foundational questions) and increase difficulty as the session progresses — this is enforced by prompt design, not code logic.
- All session state (conversation history, topic coverage, question count) is maintained in `agent.js` and re-injected into each prompt turn.
- The frontend never directly constructs prompts — all prompt assembly happens server-side in `agent.js`.

---
