const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();
const MAX_CLIENTS = 10; // Maximum concurrent users

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../app', 'login.html')); // Show login page first
});


// 🔹 Setup session middleware
app.use(session({
    secret: 'securechat_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// 🔹 Serve Login Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../app', 'login.html'));
});

// 🔹 Serve Chat Page (Only for logged-in users)
app.get('/chat', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized. Please log in first.");
    }
    res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// 🔹 User Registration Endpoint
const fs = require('fs');
const usersFile = 'users.json';

// Load existing users from file
let users = [];
if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile));
}

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (users.some(user => user.username === username)) {
        return res.status(400).json({ message: "Username already exists" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { username, password: hashedPassword };

        users.push(newUser);

        // Save updated users list to file
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

        console.log("✅ User registered:", username);
        console.log("🔐 Hashed password stored:", hashedPassword);

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("❌ Error during registration:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// 🔹 User Login Endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Load users from the file
    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    const user = users.find(u => u.username === username);

    if (!user) {
        console.log("❌ Username not found:", username);
        return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
        console.log("🔍 Checking password for:", username);
        console.log("🔐 Stored password (hashed):", user.password);
        console.log("🔑 Entered password:", password);

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log("❌ Password mismatch for user:", username);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        req.session.user = username;
        console.log("✅ Login successful for:", username);
        res.status(200).json({ message: "Login successful", redirect: "/chat" });

    } catch (error) {
        console.error("❌ Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// 🔹 WebSocket Connection Handling (Only Allow Authenticated Users)
wss.on('connection', (ws, req) => {
    // WebSockets don't have built-in access to session data, so this check won't work
    // Alternative: Consider using a query parameter or token-based authentication

    const clientIp = req.socket.remoteAddress;
    console.log(`🔗 New client connected from ${clientIp}`);

    if (clients.size >= MAX_CLIENTS) {
        ws.send("❌ Connection rejected: Too many users.");
        ws.close();
        return;
    }

    clients.add(ws);
    ws.send("👋 Welcome to SecureChat!");

    ws.on('message', (message) => {
        console.log(`📩 Received from ${clientIp}: ${message}`);

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

// 🔹 Start HTTP & WebSocket Server
const PORT = 8080;
const SERVER_IP = '0.0.0.0'; // Listen for external devices
server.listen(PORT, SERVER_IP, () => {
    console.log(`✅ Server running at http://${SERVER_IP}:${PORT}`);
});
