if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const anthropicClient = process.env.ANTHROPIC_API_KEY ? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
}) : null;

const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
}) : null;

// Load curriculum to give to the model
const curriculum = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'curriculum.json'), 'utf-8'));

// State store: sessionId -> state
// state = { candidate, messages: [], turnCount }
const sessions = new Map();

const SYSTEM_PROMPT = `You are Alex, AI Cohort Interview Agent.
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
Begin with: "Hi [name], I'm Alex, your AI Cohort interviewer. Let's assess your cohort learnings. Starting with —" then ask the first question.
Do NOT say "Hi candidate" — use their actual name.

Current interview context: {conversation_history}
Candidate profile: {candidate_profile}
Curriculum: {curriculum_json}`;

function buildSystemPrompt(candidate) {
    return `${SYSTEM_PROMPT}

Candidate Profile:
${JSON.stringify(candidate, null, 2)}

Curriculum:
${JSON.stringify(curriculum, null, 2)}
`;
}

function mapMessagesForClaude(messages) {
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}

function mapMessagesForGemini(messages) {
    return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
}

async function callAnthropic(systemInstruction, messages) {
    if (!anthropicClient) {
        throw new Error('Anthropic API key not configured');
    }

    const requestMessages = [
        { role: 'user', content: systemInstruction },
        ...mapMessagesForClaude(messages)
    ];

    const response = await anthropicClient.messages.create({
        model: 'claude-opus-4-6',
        messages: requestMessages,
        max_tokens: 1024,
        temperature: 0.7,
    });

    return response.content;
}

async function callGemini(systemInstruction, messages) {
    if (!geminiClient) {
        throw new Error('Gemini API key not configured');
    }

    const formattedMessages = mapMessagesForGemini(messages);
    const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedMessages,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        }
    });

    return response.text;
}

const fallbackQuestions = [
    "To start us off, could you explain what a variable is in programming and why it's a fundamental concept?",
    "Great. Next, what is the difference between a function and a class in programming?",
    "How does an API help different software components communicate with each other?",
    "In a data engineering context, what does a data pipeline do and why is it important?",
    "What is the difference between batch processing and stream processing?",
    "How do you ensure data quality when you build data systems?",
    "Describe one way you would scale a service to handle more users without sacrificing reliability."
];

function createFallbackReply(messages, turnCount) {
    if (messages.length === 1 && messages[0].role === 'user') {
        return `Hi Candidate, I'm Alex, your AI Cohort interviewer. Let's assess your cohort learnings. Starting with — Can you explain how a RAG pipeline works and why it's preferred over a standalone LLM?`;
    }

    const index = Math.min(turnCount, fallbackQuestions.length - 1);
    return `Thanks for your answer. ${fallbackQuestions[index]}`;
}

async function generateReply(systemInstruction, messages, turnCount = 0) {
    if (anthropicClient) {
        try {
            const result = await callAnthropic(systemInstruction, messages);
            if (result) return result;
        } catch (error) {
            console.error('Anthropic request failed:', error.message || error);
            if (!geminiClient) {
                return createFallbackReply(messages, turnCount);
            }
        }
    }

    if (geminiClient) {
        try {
            const result = await callGemini(systemInstruction, messages);
            if (result) return result;
        } catch (error) {
            console.error('Gemini request failed:', error.message || error);
        }
    }

    return createFallbackReply(messages, turnCount);
}

async function initSession(sessionId, candidate) {
    const state = {
        candidate,
        messages: [],
        turnCount: 0
    };
    sessions.set(sessionId, state);

    const systemPrompt = buildSystemPrompt(candidate);
    
    // Use deterministic fallback to ensure consistent greeting format for the first question.
    const introMsg = createFallbackReply(
        [{ role: "user", content: "Hello! I am ready to begin the interview. Please provide a brief welcoming intro statement, and then immediately ask me my first basic foundational question." }],
        0
    );
    
    // sanitize any embedded personal name to the generic 'Candidate'
    const sanitizedIntro = typeof introMsg === 'string'
        ? introMsg.replace(new RegExp(candidate.name, 'gi'), 'Candidate').replace(/\bcandidate\b/gi, 'Candidate')
        : introMsg;
    state.messages.push({ role: "assistant", content: sanitizedIntro });
    state.turnCount = 1;

    return {
        reply: sanitizedIntro,
        done: false
    };
}

async function handleTurn(sessionId, message) {
    const state = sessions.get(sessionId);
    if (!state) {
        throw new Error(`Session ${sessionId} not found`);
    }

    state.messages.push({ role: "user", content: message });
    
    // Minimum 8 questions required. We'll finalize at turn 8.
    if (state.turnCount >= 8) {
        return await finalizeInterview(sessionId, state);
    }

    const systemPrompt = buildSystemPrompt(state.candidate);
    const reply = await generateReply(systemPrompt, state.messages, state.turnCount);
    // sanitize model output: replace candidate real name with generic 'Candidate'
    const sanitizedReply = typeof reply === 'string'
        ? reply.replace(new RegExp(state.candidate.name, 'gi'), 'Candidate').replace(/\bcandidate\b/gi, 'Candidate')
        : reply;
    state.messages.push({ role: 'assistant', content: sanitizedReply });
    state.turnCount++;

    return {
        reply: sanitizedReply,
        done: false
    };
}

async function finalizeInterview(sessionId, state) {
    const feedbackSystemPrompt = `You are an expert AI evaluator. The technical interview has just concluded.
Review the conversation transcript and output structured feedback in pure JSON format containing exactly the following keys:
{
  "score": <number between 0 and 100 based on technical accuracy and communication>,
  "summary": "overall summary string",
  "strengths": ["list of strengths"],
  "gaps": ["list of knowledge gaps"],
  "next": ["list of actionable next steps"]
}
Do NOT wrap the JSON in markdown blocks. Output purely the JSON object.`;

    const transcript = state.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\\n\\n');
    
    let response;
    let errorMessage = null;

    if (anthropicClient) {
        try {
            response = await anthropicClient.messages.create({
                model: 'claude-opus-4-6',
                messages: [{ role: 'user', content: `${feedbackSystemPrompt}\n\n${transcript}` }],
                max_tokens: 1024,
                temperature: 0.2,
            });
        } catch (error) {
            console.error("Anthropic Error in finalizeInterview:", error.message || error);
            errorMessage = error.message || String(error);
        }
    }

    if (!response && geminiClient) {
        try {
            response = await geminiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: `${feedbackSystemPrompt}\n\n${transcript}` }] }],
                config: {
                    systemInstruction: feedbackSystemPrompt,
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                }
            });
        } catch (error) {
            console.error("Gemini Error in finalizeInterview:", error.message || error);
            errorMessage = error.message || String(error);
        }
    }

    if (!response) {
        console.error('Feedback generation failed:', errorMessage);
        response = {
            content: JSON.stringify({
                score: 85,
                summary: "*(Mock Summary due to API errors)* Overall, the candidate demonstrated solid foundational knowledge and clear communication skills.",
                strengths: ["Clear communication", "Good grasp of core concepts"],
                gaps: ["Advanced system architecture concepts"],
                next: ["Practice more complex, scenario-based architecture problems"]
            })
        };
    }

    let feedback;
    try {
        const text = ((response.content ?? response.text) || '').trim();
        // Remove markdown formatting if the model still wraps it
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        feedback = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse feedback JSON", e);
        feedback = {
            score: 0,
            summary: "Interview concluded. The AI struggled to format the final feedback.",
            strengths: [],
            gaps: [],
            next: []
        };
    }

    // Clean up session
    sessions.delete(sessionId);

    return {
        reply: "Thank you for your time. The interview is now complete. We will be in touch with your feedback.",
        done: true,
        feedback: feedback
    };
}

module.exports = {
    initSession,
    handleTurn
};
