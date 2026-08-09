📝 Prompt Engineering — AI Technical Interviewer

Purpose: Single source of truth for the prompts, prompt contracts, interview behavior, evaluation logic, fallback behavior, and prompt-to-code flow used by the AI Technical Interviewer.

📌 Table of Contents

Prompt Architecture

System Prompt

Initial Interview Trigger

Conversation Turn Behavior

Feedback & Evaluation Prompt

Fallback Question Bank

Model Routing & Prompt Delivery

Prompt Variables & Context

Interview Rules & Behavioral Contract

Session Lifecycle

Design Decisions

Implementation Notes

Prompt Maintenance Checklist

1. Prompt Architecture

The application uses prompts at three major stages:

Candidate Profile
      │
      ▼
┌──────────────────────────┐
│ System Prompt             │
│ Persona + Scope + Rules  │
│ + Candidate + Curriculum │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Initial Trigger Prompt    │
│ Starts the interview      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Conversation Loop         │
│ Candidate Answer          │
│        ↓                  │
│ AI Follow-up / Next Q.    │
└────────────┬─────────────┘
             │
             ▼
       Minimum 8 questions
             │
             ▼
┌──────────────────────────┐
│ Evaluation Prompt         │
│ Transcript → JSON         │
└────────────┬─────────────┘
             │
             ▼
      Structured Feedback

The prompt layer is backed by session state maintained in agent.js. The state contains the candidate profile, conversation messages, and turn count.

2. System Prompt

Purpose: Defines the interviewer persona, allowed technical scope, candidate-specific behavior, progression rules, and conversational constraints. The candidate profile and full curriculum are injected into the prompt.

Production System Prompt

You are AI Interview Agent.
Topics: RAG, Vector DBs, Prompt Engineering,
Agentic AI, MCP, AI Deployment, Production AI.

Rules:
- NEVER ask generic programming questions.
- NEVER ask about RESTful APIs, variables, functions, classes or generic programming.
- Only ask about: RAG, Vector DBs, Prompt Engineering, Agentic AI, MCP, AI Deployment, Production AI Systems.
- Only quiz completed_missions.
- Skip skipped_topics.
- Min 8 questions, 4 topics.
- Acknowledge each answer specifically.
- Follow up if answer is vague.
- PROGRESSIVE DIFFICULTY: For every specific domain, always start with a Basic question. If answered correctly, progress to a Medium question, and then a Hard question.
- EXPLICIT CORRECTION: If the candidate's answer is wrong or incorrect, explicitly tell them that the answer is wrong and correct them before moving on.

Data: {candidate_profile} {curriculum_json} {conversation_history}

GOOD examples of transitions:
"That's a solid foundation, and it connects
directly to what I want to ask next."

BAD examples (NEVER use these):
"Great answer!"
"That's correct!"
"Excellent!"
"Good job!"

RULE 2 — ONE QUESTION ONLY:
Ask exactly ONE question per response.
Never ask two questions in the same message.

RULE 3 — NATURAL LANGUAGE:
Occasionally use human filler phrases
(max once every 4 questions):
"Right, right. So following up..."
"Mmm okay. Let me push back slightly..."
"That's an interesting way to frame it..."

RULE 4 — BUILD ON PREVIOUS ANSWERS:
Always reference earlier answers when relevant.
"Earlier you mentioned X — how does that
connect to Y?"

RULE 5 — GREETING:
Begin with: "Hi [name], I'm your AI Cohort interviewer. Let's assess your cohort learnings. " then immediately ask the first technical question tailored to my background as a {job_role}.
Do NOT say "Hi candidate" — use their actual name.

Current interview context: {conversation_history}
Candidate profile: {candidate_profile}
Curriculum: {curriculum_json}

Prompt Responsibilities

Area

Prompt responsibility

Persona

Establishes the AI as the cohort interviewer

Scope control

Restricts questions to the intended AI topics

Mission gating

Questions only completed missions and skips skipped topics

Difficulty

Basic → Medium → Hard progression within a domain

Correction

Explicitly corrects incorrect answers

Follow-up

Requests elaboration when an answer is vague

Conversation

References earlier candidate answers

Question count

Requires at least 8 questions

Topic coverage

Requires at least 4 topics

Question format

Exactly one question per response

Greeting

Uses the candidate's actual name and job role

3. Initial Interview Trigger

Purpose: Starts a new interview after the candidate profile has been submitted.

Runtime Trigger

Hello! I am ready to begin the interview. Please greet me exactly as requested in RULE 5 (using my name: {candidate.name}) and ask the exact first question specified in RULE 5.

The trigger is sent by initSession() after the candidate profile has been stored in the session.

Expected Behavior

Use the candidate's actual name.

Introduce the interviewer.

Mention that the interview assesses cohort learnings.

Immediately ask the first technical question.

Tailor the opening question to the candidate's job role.

Start with foundational difficulty.

4. Conversation Turn Behavior

Each subsequent candidate response is appended to the session conversation.

Runtime Flow

Candidate Answer
      │
      ▼
Add answer to conversation history
      │
      ▼
Rebuild system prompt
      │
      ├── Candidate profile
      ├── Curriculum
      └── Conversation history
      │
      ▼
Call primary available model
      │
      ▼
Sanitize generated reply
      │
      ▼
Return one interviewer response

Conversation Constraints

The interviewer should:

Stay within the cohort curriculum.

Ask only one question per response.

Avoid generic programming questions.

Build on previous answers where relevant.

Follow up on vague answers.

Progress difficulty within a domain.

Correct incorrect answers explicitly.

Maintain a natural interview conversation.

Reach at least 8 questions before completion.

5. Feedback & Evaluation Prompt

Purpose: Evaluates the complete interview transcript after the interview reaches the minimum question threshold.

Production Evaluation Prompt

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

The complete conversation transcript is appended to the evaluation prompt.

Feedback Contract

Field

Type

Meaning

score

number

Overall score from 0–100

summary

string

High-level performance summary

strengths

string[]

Areas demonstrated well

gaps

string[]

Knowledge gaps or weak areas

next

string[]

Actionable improvement steps

Evaluation Requirements

The evaluator should assess:

Technical accuracy.

Communication quality.

Demonstrated understanding of the interview topics.

Specific strengths.

Specific knowledge gaps.

Practical next steps.

6. Fallback Question Bank

When both configured model calls fail, the application uses deterministic fallback questions.

Core AI Topics

RAG

Let's start with RAG. Can you explain the basic concept of a Retrieval-Augmented Generation pipeline?

In a RAG system, how do you decide between semantic search and keyword search for retrieval?

How would you optimize a RAG pipeline that is suffering from high latency and irrelevant context retrieval?

Vector Databases

Moving on to Vector Databases. What exactly is a vector embedding?

What is the difference between vector database index types like HNSW and IVF-PQ?

How do you handle scaling and partition pruning in a distributed Vector Database?

Prompt Engineering

Let's discuss Prompt Engineering. What is the difference between zero-shot and few-shot prompting?

How does Chain-of-Thought prompting improve the reasoning capabilities of an LLM?

What strategies would you use to prevent prompt injection attacks in a public-facing application?

Agentic AI

Now on to Agentic AI. What is the difference between a simple LLM chain and an AI Agent?

Can you explain the ReAct (Reasoning and Acting) framework in the context of Agentic workflows?

How do you design a multi-agent orchestration system to handle conflicting agent decisions?

MCP

Regarding Model Context Protocol (MCP), what problem does it solve for LLMs?

How does MCP securely connect an LLM to external databases and APIs?

Describe how you would implement a custom MCP server to expose legacy enterprise data to an LLM.

AI Deployment

For AI Deployment, what is the most common way to serve an LLM in production?

How do you handle streaming responses and token rate limits when serving LLMs to thousands of users?

What is your approach to achieving zero-downtime deployments for large, stateful AI models?

Production AI Systems

Finally, looking at Production AI Systems, what are LLM hallucinations?

How do you automatically evaluate and mitigate hallucinations and bias in LLM outputs?

Explain your strategy for continuous monitoring and automated fine-tuning of an LLM in production.

Role-Specific Fallback Behavior

The fallback implementation also contains role-specific question banks for:

Data Engineer

DevOps Engineer

AI Engineer

Backend / Software Engineer

Analyst / Marketing / Manager / HR

Intern / Junior / Student

Distinguished / Architect / Lead / Principal

Important: These deterministic role-specific fallbacks should remain aligned with the same interview scope as the system prompt. The current implementation contains some broader software-engineering questions, so those questions should be reviewed whenever the prompt rules are tightened.

7. Model Routing & Prompt Delivery

The application supports two model providers in agent.js.

Interview Question Generation

Primary:
Anthropic client
        │
        ├── success → return response
        │
        └── failure
              │
              ▼
Secondary:
Gemini client
        │
        ├── success → return response
        │
        └── failure
              │
              ▼
Deterministic fallback question

Model Configuration

The current implementation uses:

Anthropic interview generation model: claude-3-5-sonnet-20240620

Gemini interview generation model: gemini-1.5-flash

Anthropic final evaluation model: claude-opus-4-6

Gemini final evaluation model: gemini-2.5-flash

The application uses the installed Anthropic SDK and Google GenAI SDK.

Prompt Delivery

For Gemini, the system prompt is supplied through systemInstruction.

For Anthropic interview generation, the current implementation sends the system instruction as the first user message before the conversation messages.

The final evaluation request sends the evaluation prompt together with the complete transcript.

8. Prompt Variables & Context

The prompt layer uses the following runtime information.

{candidate_profile}

Candidate information supplied to the interview session, including fields such as:

{
  "id": "CAND-001",
  "name": "Sarah Johnson",
  "jobRole": "Senior Data Engineer",
  "yearsExperience": 9,
  "education": "MS Computer Science",
  "status": "COMPLETED"
}

{curriculum_json}

The complete cohort curriculum loaded from curriculum.json.

The curriculum is organized as an AI Cohort covering 31 days and 8 modules, including:

Embeddings & Vector Search

LLM Core, Prompting & Fine-Tuning

Chatbot Application Build

Agentic AI & MCP

Evaluation, Security & Deployment

Production & Capstone

{conversation_history}

The current session conversation maintained by agent.js.

It contains the assistant's questions/replies and the candidate's answers so the interviewer can maintain context.

{job_role}

The candidate's job role, used to tailor the opening question.

9. Interview Rules & Behavioral Contract

Mandatory

Ask exactly one question at a time.

Ask only about allowed AI cohort topics.

Use completed missions as the basis for questioning.

Skip skipped topics.

Start a domain at Basic difficulty.

Increase to Medium and Hard after successful answers.

Explicitly correct incorrect answers.

Follow up when an answer is vague.

Reference earlier answers when relevant.

Ask at least 8 questions.

Cover at least 4 topic areas.

Use the candidate's actual name in the greeting.

Keep the conversation natural and interview-like.

Avoid

Do not use generic praise such as:

"Great answer!"
"That's correct!"
"Excellent!"
"Good job!"

Prefer contextual transitions such as:

"That's a solid foundation, and it connects directly to what I want to ask next."

"Earlier you mentioned X — how does that connect to Y?"

"That's an interesting way to frame it..."

Human filler phrases should be used occasionally, with a maximum frequency of roughly once every four questions.

10. Session Lifecycle

1. Candidate selected
        │
        ▼
2. initSession(sessionId, candidate)
        │
        ├── Store candidate
        ├── Create empty messages[]
        └── Set turnCount = 0
        │
        ▼
3. Build system prompt
        │
        ▼
4. Send initial interview trigger
        │
        ▼
5. Generate first interviewer response
        │
        ▼
6. Store assistant response
        │
        ▼
7. Candidate submits answer
        │
        ▼
8. handleTurn(sessionId, message)
        │
        ├── Append candidate answer
        ├── Rebuild prompt context
        ├── Generate next response
        └── Increment turn count
        │
        ▼
9. Minimum interview length reached
        │
        ▼
10. finalizeInterview()
        │
        ├── Build transcript
        ├── Run evaluation prompt
        ├── Parse JSON feedback
        └── Delete session state
        │
        ▼
11. Return:
    done = true
    feedback = structured evaluation

The backend exposes the interview through:

POST /api/interview

A new session includes a candidate object. Subsequent turns use the same sessionId with the candidate's latest message.

11. Design Decisions

Decision

Reason

Candidate-aware greeting

Makes the interview personalized

Curriculum injection

Grounds questions in the cohort content

Completed-mission gating

Avoids testing material the candidate has not completed

Skipped-topic exclusion

Prevents questions on explicitly skipped material

Progressive difficulty

Creates a structured assessment instead of random questioning

One-question rule

Keeps the interview conversational and focused

Conversation history

Enables contextual follow-ups

Explicit correction

Makes the interview educational as well as evaluative

Minimum 8 questions

Prevents premature completion

Minimum 4 topics

Ensures breadth

Multi-provider model routing

Improves resilience when one provider fails

Deterministic fallback bank

Keeps the interview usable during model/API failure

Structured final JSON

Makes feedback easy for the frontend to render

12. Implementation Notes

Prompt vs. Code Responsibilities

The current design intentionally splits behavior between prompt instructions and application logic.

Prompt-controlled behavior:

Interviewer persona.

Topic restrictions.

Progressive difficulty instructions.

Answer acknowledgment.

Follow-up behavior.

Explicit correction.

Natural transitions.

Candidate-aware greeting.

Code-controlled behavior:

Session creation.

Session state storage.

Conversation history.

Turn counting.

Minimum 8-turn completion threshold.

Model provider fallback.

Deterministic fallback questions.

Candidate-name sanitization.

Final feedback parsing.

Session cleanup.

Important Consistency Check

The documented prompt rules say that the interviewer should avoid generic programming questions. However, the deterministic role-specific fallback bank currently includes broader questions for some roles, such as REST/gRPC, OOP, Git, APIs, and general software engineering.

If strict AI-topic-only behavior is required during API/model failures, those fallback questions should be replaced with questions from the approved AI cohort topic bank.

Output Contract Note

The final interview endpoint returns:

{
  "reply": "...",
  "done": false
}

When the interview is complete:

{
  "reply": "Thank you for your time. The interview is now complete. We will be in touch with your feedback.",
  "done": true,
  "feedback": {
    "score": 0,
    "summary": "...",
    "strengths": [],
    "gaps": [],
    "next": []
  }
}

The final evaluation prompt therefore has a strict JSON contract, while normal interview replies are returned as conversational text.

Security Note

Never place real API keys or secrets inside prompts.md, source control, documentation, or prompt text. Secrets belong in environment variables and should remain excluded from Git.

13. Prompt Maintenance Checklist

Before changing a production prompt, verify:

The change is consistent with technical-spec.md.

The change matches the actual behavior implemented in agent.js.

Candidate and curriculum variables are still injected correctly.

The one-question rule is preserved.

The minimum 8-question requirement is preserved.

At least 4 topics can be covered.

Completed and skipped missions are respected.

Progressive difficulty remains clear.

Incorrect answers receive explicit correction.

Vague answers can trigger useful follow-ups.

Final feedback still returns valid JSON.

Fallback questions do not violate the intended topic scope.

No API keys or other secrets are added to prompt documentation.

Prompt changes are tested with test.js and a representative candidate profile.

🔗 Related Project Files

File

Responsibility

agent.js

Prompt assembly, model calls, session state, fallbacks, evaluation

server.js

/api/interview endpoint and HTTP handling

curriculum.json

Cohort modules, missions, objectives, and learning scope

candidates.json

Candidate profiles and completed/skipped missions

technical-spec.md

Required API contract and interview flow

test.js

End-to-end interview flow test

README.md

Project setup, features, API usage, and architecture overview

Final Prompt Pipeline

Candidate Profile
      +
Curriculum
      +
Conversation History
      │
      ▼
┌──────────────────────────────┐
│ System Prompt                │
│                              │
│ Scope + Rules + Persona      │
│ Difficulty + Context         │
└──────────────┬───────────────┘
               │
               ▼
       Initial Trigger
               │
               ▼
      AI Interview Response
               │
               ▼
        Candidate Answer
               │
               └──────────────┐
                              │
                              ▼
                    Conversation History
                              │
                              ▼
                    Next AI Question
                              │
                       ... repeat ...
                              │
                              ▼
                         8+ Questions
                              │
                              ▼
                    Evaluation Prompt
                              │
                              ▼
                 Structured JSON Feedback