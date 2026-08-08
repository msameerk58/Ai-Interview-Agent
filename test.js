const candidate = {
  "id": "CAND-001",
  "name": "Sarah Johnson",
  "jobRole": "Senior Data Engineer",
  "yearsExperience": 9,
  "education": "MS Computer Science",
  "status": "COMPLETED"
};

async function runTest() {
  console.log("Starting Interview...");
  
  let res = await fetch("http://localhost:3000/api/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "test-session-123",
      candidate: candidate
    })
  });
  let data = await res.json();
  console.log("Agent:", data.reply);
  
  const turns = [
    "I'm ready. Yes, I learned about embeddings and vector databases.",
    "Embeddings represent text as vectors so we can measure semantic similarity.",
    "I used ChromaDB. It worked well for local testing.",
    "Yes, I built a RAG pipeline combining retrieval and prompt generation.",
    "I used basic prompt templates and few-shot examples.",
    "It was fun setting up the multi-agent orchestration.",
    "I used LangChain for orchestration.",
    "No, that's all for now."
  ];

  for (let message of turns) {
    console.log("---");
    console.log("Candidate:", message);
    if (data.done) {
        console.log("Interview ended early.");
        break;
    }
    res = await fetch("http://localhost:3000/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-session-123",
        message: message
      })
    });
    data = await res.json();
    console.log("Agent:", data.reply);
  }
  
  console.log("---");
  if (data.done) {
    console.log("Final Feedback:", JSON.stringify(data.feedback, null, 2));
  } else {
    console.log("Interview did not finish after 8 turns.");
  }
}

runTest();
