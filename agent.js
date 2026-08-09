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

const SYSTEM_PROMPT = `You are AI Interview Agent.
Topics: RAG, Vector DBs, Prompt Engineering,
Agentic AI, MCP, AI Deployment, Production AI.

Rules:
- NEVER ask generic programming questions.
- NEVER ask about RESTful APIs, variables, functions, classes or generic programming.
- Only ask about: RAG, Vector DBs, Prompt Engineering, Agentic AI, MCP, AI Deployment, Production AI Systems.
- Only quiz completed_missions
- Skip skipped_topics
- Min 8 questions, 4 topics
- Acknowledge each answer specifically
- Follow up if answer is vague
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
Curriculum: {curriculum_json}`;

function buildSystemPrompt(candidate) {
    const customizedPrompt = SYSTEM_PROMPT.replace('{job_role}', candidate.jobRole || 'candidate');
    return `${customizedPrompt}

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
        model: 'claude-3-5-sonnet-20240620',
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
        model: 'gemini-1.5-flash',
        contents: formattedMessages,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        }
    });

    return response.text;
}

const fallbackQuestions = [
    // RAG
    "Let's start with RAG. Can you explain the basic concept of a Retrieval-Augmented Generation pipeline?",
    "In a RAG system, how do you decide between semantic search and keyword search for retrieval?",
    "How would you optimize a RAG pipeline that is suffering from high latency and irrelevant context retrieval?",
    // Vector DBs
    "Moving on to Vector Databases. What exactly is a vector embedding?",
    "What is the difference between vector database index types like HNSW and IVF-PQ?",
    "How do you handle scaling and partition pruning in a distributed Vector Database?",
    // Prompt Engineering
    "Let's discuss Prompt Engineering. What is the difference between zero-shot and few-shot prompting?",
    "How does Chain-of-Thought prompting improve the reasoning capabilities of an LLM?",
    "What strategies would you use to prevent prompt injection attacks in a public-facing application?",
    // Agentic AI
    "Now on to Agentic AI. What is the difference between a simple LLM chain and an AI Agent?",
    "Can you explain the ReAct (Reasoning and Acting) framework in the context of Agentic workflows?",
    "How do you design a multi-agent orchestration system to handle conflicting agent decisions?",
    // MCP
    "Regarding Model Context Protocol (MCP), what problem does it solve for LLMs?",
    "How does MCP securely connect an LLM to external databases and APIs?",
    "Describe how you would implement a custom MCP server to expose legacy enterprise data to an LLM.",
    // AI Deployment
    "For AI Deployment, what is the most common way to serve an LLM in production?",
    "How do you handle streaming responses and token rate limits when serving LLMs to thousands of users?",
    "What is your approach to achieving zero-downtime deployments for large, stateful AI models?",
    // Production AI Systems
    "Finally, looking at Production AI Systems, what are LLM hallucinations?",
    "How do you automatically evaluate and mitigate hallucinations and bias in LLM outputs?",
    "Explain your strategy for continuous monitoring and automated fine-tuning of an LLM in production."
];

function sanitizeAgentReply(reply, candidate) {
    if (typeof reply !== 'string') return reply;
    let sanitized = reply;
    
    // Replace candidate name (both full name and first name)
    if (candidate && candidate.name) {
        const fullName = candidate.name;
        const firstName = candidate.name.split(' ')[0];
        sanitized = sanitized.replace(new RegExp(fullName, 'gi'), 'Candidate');
        if (firstName && firstName.length > 1) {
            sanitized = sanitized.replace(new RegExp('\\b' + firstName + '\\b', 'gi'), 'Candidate');
        }
    }
    
    // Replace references to Alex / Alex Chen / ALEX CHEN / ALEX
    sanitized = sanitized.replace(/Alex Chen/gi, 'AI Cohort Interview Agent')
                         .replace(/ALEX CHEN/g, 'AI COHORT INTERVIEW AGENT')
                         .replace(/\bAlex, your AI Cohort interviewer\b/gi, 'your AI Cohort interviewer')
                         .replace(/\bAlex\b/g, 'AI Cohort Interview Agent')
                         .replace(/\bALEX\b/g, 'AI COHORT INTERVIEW AGENT');

    // Also sanitize generic 'candidate' to 'Candidate'
    sanitized = sanitized.replace(/\bcandidate\b/gi, 'Candidate');
    
    return sanitized;
}

function createFallbackReply(messages, turnCount, candidate) {
    const role = candidate ? (candidate.jobRole || '').toLowerCase() : '';
    
    if (messages.length === 1 && messages[0].role === 'user') {
        const candidateName = candidate && candidate.name ? candidate.name : 'Candidate';
        let firstQuestion = "Can you walk me through how a RAG pipeline works?";
        
        if (role.includes('data engineer')) {
            firstQuestion = "Can you describe how you design a scalable data pipeline to ingest, clean, and load large datasets, and which tools you prefer?";
        } else if (role.includes('devops')) {
            firstQuestion = "Can you describe your approach to setting up a zero-downtime CI/CD deployment pipeline for containerized microservices?";
        } else if (role.includes('ai engineer') || role.includes('artificial intelligence')) {
            firstQuestion = "Can you explain how a RAG (Retrieval-Augmented Generation) pipeline works and why it is preferred over a standalone LLM?";
        } else if (role.includes('backend') || role.includes('software engineer')) {
            firstQuestion = "Can you describe how you design a RESTful API and what best practices you follow for versioning and authentication?";
        } else if (role.includes('analyst') || role.includes('marketing') || role.includes('manager') || role.includes('hr')) {
            firstQuestion = "Can you describe how you translate business goals and stakeholder requirements into clear technical specifications?";
        } else if (role.includes('intern') || role.includes('junior') || role.includes('student')) {
            firstQuestion = "Could you explain what version control is, and walk me through how you resolve a merge conflict in Git?";
        } else if (role.includes('distinguished') || role.includes('architect') || role.includes('lead') || role.includes('principal')) {
            firstQuestion = "How do you design a highly available, fault-tolerant system architecture that scales to millions of users?";
        }

        return `Hi ${candidateName}, I'm your AI Cohort interviewer. Let's assess your cohort learnings. ${firstQuestion}`;
    }

    let roleQuestions = fallbackQuestions;
    if (role.includes('data engineer')) {
        roleQuestions = [
            "How do you handle schema evolution and ensure data quality in your pipelines?",
            "What is the difference between batch and stream processing, and when would you choose Spark Streaming or Flink over batch MapReduce?",
            "What are the pros and cons of using a columnar format like Parquet vs row-oriented formats like Avro?",
            "How do you optimize slow database queries and what indexing strategies do you use?",
            "Can you describe how you'd scale a database system using sharding or partition pruning?",
            "Explain how you manage state and handle late-arriving data in streaming applications.",
            "Finally, how do you approach monitoring, logging, and alerting in data pipelines to detect failures?"
        ];
    } else if (role.includes('devops')) {
        roleQuestions = [
            "What is Infrastructure as Code (IaC) and how do you use Terraform or CloudFormation to prevent configuration drift?",
            "How do you manage secrets and configuration variables securely in environments like Kubernetes?",
            "Explain the difference between mutable and immutable infrastructure and why the latter is preferred.",
            "How do you set up application performance monitoring (APM) and alert routing using Prometheus, Grafana, or Datadog?",
            "What strategies do you employ to secure containerized applications and scan for vulnerabilities?",
            "Can you explain how Kubernetes namespaces, ingress controllers, and service meshes coordinate traffic?",
            "Finally, describe how you handle disaster recovery and database backups in a multi-region cloud deployment."
        ];
    } else if (role.includes('ai engineer') || role.includes('artificial intelligence')) {
        roleQuestions = [
            "What is the difference between vector database index types like HNSW and IVF-PQ, and how do they impact retrieval latency?",
            "How do you evaluate and mitigate hallucinations and bias in LLM outputs in production?",
            "What is the difference between prompt engineering (e.g. few-shot, CoT) and parameter-efficient fine-tuning (e.g. LoRA)?",
            "How do Agentic workflows and multi-agent orchestration differ from simple sequential LLM chains?",
            "Explain how the Model Context Protocol (MCP) helps connect an LLM to external databases and APIs.",
            "How do you handle streaming responses and token rate limits when serving LLMs to thousands of users?",
            "Finally, how do you handle security and guardrails to prevent prompt injection attacks?"
        ];
    } else if (role.includes('backend') || role.includes('software engineer')) {
        roleQuestions = [
            "What is the difference between REST and gRPC, and when would you choose gRPC for microservices communication?",
            "How does your preferred programming language handle concurrency, and how do you prevent race conditions?",
            "What are the best practices for designing idempotent API endpoints in a distributed system?",
            "How do you handle distributed transactions and maintain consistency across different microservices?",
            "What is horizontal scaling vs vertical scaling, and how do you use load balancers and caching (e.g. Redis) to improve scale?",
            "How do you handle rate-limiting and circuit-breaking to protect backend services from cascading failures?",
            "Finally, explain the CAP theorem and how it guides your database selection (SQL vs NoSQL)."
        ];
    } else if (role.includes('analyst') || role.includes('marketing') || role.includes('manager') || role.includes('hr')) {
        roleQuestions = [
            "How do you use data analytics and metrics (like KPI, ROI) to measure the success of a software project?",
            "What is your approach to prioritizing features in a product roadmap when different stakeholders have conflicting demands?",
            "Can you explain how A/B testing works and how you determine if the results are statistically significant?",
            "How do you perform user funnel analysis to identify drop-offs and friction in a software application?",
            "What techniques do you use to manage risk and identify potential bottlenecks early in a project lifecycle?",
            "How do you ensure smooth communication and alignment between non-technical stakeholders and engineering teams?",
            "Finally, describe a situation where you had to make a critical decision based on incomplete or ambiguous data."
        ];
    } else if (role.includes('intern') || role.includes('junior') || role.includes('student')) {
        roleQuestions = [
            "What is the difference between synchronous and asynchronous code execution, and when would you use async/await?",
            "What are the main principles of Object-Oriented Programming (OOP) and why are they useful?",
            "What is the difference between client-side rendering (CSR) and server-side rendering (SSR)?",
            "How do you write unit tests for your code, and why is software testing important?",
            "What is the difference between a stack and a queue, and can you give a real-world example of where each is used?",
            "How do relational databases work, and what is the purpose of primary and foreign keys?",
            "Finally, what are some best practices for writing clean, readable, and self-documenting code?"
        ];
    } else if (role.includes('distinguished') || role.includes('architect') || role.includes('lead') || role.includes('principal')) {
        roleQuestions = [
            "How do you manage technical debt in large, legacy systems while continuing to ship new features?",
            "What is your approach to threat modeling, compliance, and system security at the architectural level?",
            "How do you design APIs that are backwards compatible and easy to version across multiple teams?",
            "Explain the CAP theorem and how it influences your choice of databases and consistency models.",
            "How do you mentor senior engineers and align multiple autonomous teams around a cohesive technical vision?",
            "What strategies do you use to evaluate new technologies and decide whether to build, buy, or adopt open-source?",
            "Finally, describe how you handle disaster recovery and site reliability engineering (SRE) post-mortems."
        ];
    }

    const index = Math.min(turnCount - 1, roleQuestions.length - 1);
    // index should not go below 0
    const finalIndex = Math.max(0, index);
    return `Thanks for your answer. ${roleQuestions[finalIndex]}`;
}

async function generateReply(systemInstruction, messages, turnCount = 0, candidate) {
    if (anthropicClient) {
        try {
            const result = await callAnthropic(systemInstruction, messages);
            if (result) return result;
        } catch (error) {
            console.error('Anthropic request failed:', error.message || error);
            if (!geminiClient) {
                return createFallbackReply(messages, turnCount, candidate);
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

    return createFallbackReply(messages, turnCount, candidate);
}

async function initSession(sessionId, candidate) {
    const state = {
        candidate,
        messages: [],
        turnCount: 0
    };
    sessions.set(sessionId, state);

    const systemPrompt = buildSystemPrompt(candidate);
    
    const firstTurnPrompt = [
        {
            role: "user",
            content: `Hello! I am ready to begin the interview. Please greet me exactly as requested in RULE 5 (using my name: ${candidate.name}) and ask the exact first question specified in RULE 5.`
        }
    ];

    const reply = await generateReply(systemPrompt, firstTurnPrompt, 0, candidate);
    const sanitizedIntro = sanitizeAgentReply(reply, candidate);
    
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
    const reply = await generateReply(systemPrompt, state.messages, state.turnCount, state.candidate);
    const sanitizedReply = sanitizeAgentReply(reply, state.candidate);
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
