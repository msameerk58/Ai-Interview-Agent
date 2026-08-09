const express = require('express');
const cors = require('cors');
const { initSession, handleTurn } = require('./agent');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/candidates', (req, res) => {
    res.sendFile(path.join(__dirname, 'candidates.json'));
});

app.post('/api/interview', async (req, res) => {
    try {
        const { sessionId, candidate, message } = req.body;
        console.log('Incoming /api/interview request:', { sessionId, hasCandidate: !!candidate, hasMessage: !!message });

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        let response;
        if (candidate) {
            // Start interview
            response = await initSession(sessionId, candidate);
        } else if (message) {
            // Conversation turn
            response = await handleTurn(sessionId, message);
        } else {
            return res.status(400).json({ error: "Either candidate or message must be provided" });
        }

        res.json(response);
    } catch (error) {
        console.error("Error in /api/interview:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
