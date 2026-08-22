# 🤖 AI Technical Interviewer

A lightweight, browser-based technical interview simulator powered by a Node.js/Express backend and a Gemini AI interviewer — complete with live prompts, real-time scoring, and a configurable candidate curriculum.

---

## ✨ Features

- 🎙️ **Interactive interview flow** — conduct full technical interviews directly in the browser
- 🧠 **Gemini-backed AI interviewer** — dynamic, context-aware questions via the Gemini API
- 📊 **Live score & feedback sidebar** — real-time evaluation as the interview progresses
- 🔐 **Authentication flow** — Clean login and signup interfaces with state management
- 🎯 **Area of Interest Selection** — Dynamic topic selection to build a personalized 31-day curriculum
- 📈 **31-Day Progress Dashboard** — Comprehensive home screen to track daily streaks, scores, and schedule
- 🔁 **Rate-limit fallback** — graceful neutral responses when the API limit is reached
- ⚙️ **Configurable profiles** — customize candidate details and interview curriculum via JSON

---

## 🗂️ Project Structure

```
ai-technical-interviewer/
├── server.js           # Express backend — serves frontend & interview API
├── agent.js            # AI session logic, Gemini prompt builder & conversation state
├── curriculum.json     # Interview curriculum consumed by AI prompts
├── package.json        # Node.js dependencies and metadata
└── public/             # Static frontend assets and UI
    ├── login.html      # Authentication UI
    ├── interests.html  # Area of Interest selection & scheduling
    ├── dashboard.html  # 31-Day Progress Dashboard
    └── index.html      # Main Interview Chat UI
```

---

## 📋 Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ recommended |
| npm | Latest stable |
| Gemini API key | From [Google AI Studio](https://aistudio.google.com/) |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ai-technical-interviewer.git
cd ai-technical-interviewer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start the server

```bash
node server.js
```

### 5. Open in your browser

```
http://localhost:3000
```

---

## 🔌 API Reference

### `POST /api/interview`

The core endpoint that drives the entire interview session.

---

#### Start a new session

Send candidate details to initialize the interview:

```http
POST /api/interview
Content-Type: application/json
```

```json
{
  "sessionId": "session-abc123",
  "candidate": {
    "id": "CAND-001",
    "name": "Sarah Johnson",
    "jobRole": "Senior Data Engineer",
    "yearsExperience": 9,
    "education": "MS Computer Science",
    "status": "COMPLETED"
  }
}
```

---

#### Continue the conversation

Send a candidate message to proceed to the next question:

```http
POST /api/interview
Content-Type: application/json
```

```json
{
  "sessionId": "session-abc123",
  "message": "Your answer text here"
}
```

---

## ⚙️ Configuration

The `curriculum.json` file controls the interview structure and topics. Update it to tailor the interview for different roles, skill levels, or domains — no code changes required.

---

## 📝 Notes

- The frontend assumes the backend is running on the **same origin** (default: `localhost:3000`).
- The app uses **`@google/genai`** as the Gemini SDK.
- When the Gemini API rate limit is hit, the app automatically falls back to a neutral model response to keep the session flowing without interruption.

---

## 🛠️ Tech Stack

- **Backend** — Node.js, Express
- **AI** — Google Gemini via `@google/genai`
- **Frontend** — Static HTML/CSS/JS (React-like structure)
- **Config** — JSON-based curriculum and `.env` secrets

---