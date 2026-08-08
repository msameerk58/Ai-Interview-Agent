# AI Technical Interviewer

A lightweight Node.js interview simulator with a static React-like frontend and a Gemini-backed AI interviewer.

## Features

- Interactive technical interview flow in the browser
- Live interviewer prompts via `/api/interview`
- Sidebar score and feedback UI
- Fallback handling for API rate limits
- Configurable candidate profile and curriculum

## Project Structure

- `server.js` - Express backend serving the frontend and interview API
- `agent.js` - AI session logic, Gemini prompt builder, and conversation state
- `public/` - Static frontend assets and UI
- `curriculum.json` - Interview curriculum used by the AI prompts
- `package.json` - Node dependencies and metadata

## Requirements

- Node.js 18+ recommended
- npm
- A valid Gemini API key from Google Cloud

## Setup

1. Clone or download this repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root and add your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Run

Start the app:

```bash
node server.js
```

Then open:

```
http://localhost:3000
```

## API

### POST /api/interview

This endpoint drives the interview.

- To start a new session:

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

- To continue the conversation:

```json
{
  "sessionId": "session-abc123",
  "message": "Your answer text here"
}
```

## Notes

- The frontend assumes the backend is running on the same origin.
- The app uses the Gemini SDK from `@google/genai`.
- If the API rate limit is reached, the app falls back to a neutral model response to keep the interview flowing.

## License

ISC
