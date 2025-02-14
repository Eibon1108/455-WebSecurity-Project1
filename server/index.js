const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();
const MAX_CLIENTS = 10; // Allow up to 10 users

app.use(cors());
const path = require('path');
app.use(express.static(path.join(__dirname, '../app')));

// Serve the front-end when users visit the server

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`🔗 New client connected from ${clientIp}`);

    if (clients.size >= MAX_CLIENTS) {
        console.log("⚠️ Maximum connections reached. Rejecting client.");
        ws.send("❌ Connection rejected: Too many users.");
        ws.close();
        return;
    }

    clients.add(ws);
    ws.send("👋 Welcome to SecureChat!");

   ws.on('message', (message) => {
    console.log('Received from ${clientIp}: ${message}');

    clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
        }
    });
   });
    ws.on('close', () => {
        console.log(`❌ Client from ${clientIp} disconnected`);
        clients.delete(ws);
    });
});

// Start HTTP & WebSocket server
const PORT = 8080;
const SERVER_IP = '0.0.0.0'; // Listens for external devices
server.listen(PORT, SERVER_IP, () => {
    console.log(`✅ Server running at SERVER_IP:${PORT}`);
    console.log(`✅ WebSocket running on ws://YOUR_LOCAL_IP:${PORT}`);
});
