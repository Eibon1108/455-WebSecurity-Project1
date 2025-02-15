const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Used for securely hashing and verifying passwords
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // WebSocket server attached to the HTTP server

const clients = new Set();
const MAX_CLIENTS = 10;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup to manage user authentication
app.use(session({
    secret: 'securechat_secret', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false }
}));

// Serve login page when users visit the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../app', 'login.html'));
});

// Serve chat page, accessible only to logged-in users
app.get('/chat', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized. Please log in first.");
    }
    res.sendFile(path.join(__dirname, '../app', 'index.html'));
});

// Load users from a file to persist data across restarts
const usersFile = 'users.json';
let users = [];

if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile));
}

// Handles user registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (users.some(user => user.username === username)) {
        return res.status(400).json({ message: "Username already exists" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password securely
        const newUser = { username, password: hashedPassword };

        users.push(newUser);
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); // Save user data to file

        console.log("User registered:", username);
        console.log("Hashed password stored:", hashedPassword);

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Handles user login and session management
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile));
    }

    const user = users.find(u => u.username === username);

    if (!user) {
        console.log("Username not found:", username);
        return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
        console.log("Checking password for:", username);
        console.log("Stored password (hashed):", user.password);
        console.log("Entered password:", password);

        const isMatch = await bcrypt.compare(password, user.password); // Compare entered password with stored hashed password

        if (!isMatch) {
            console.log("Password mismatch for user:", username);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        req.session.user = username; // Store username in session after successful login
        console.log("Login successful for:", username);
        res.status(200).json({ message: "Login successful", redirect: "/chat" });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Handles WebSocket connections for real-time chat
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`New client connected from ${clientIp}`);

    if (clients.size >= MAX_CLIENTS) {
        ws.send("Connection rejected: Too many users.");
        ws.close();
        return;
    }

    clients.add(ws);
    ws.send("Welcome to SecureChat!");

    const RATELIMIT = 3; //this limits the rate to whatever number you want
    var count = 0; //this is too keep track of how many messages have been sent

    ws.on('message', (message) => {
    console.log('Received from ' + clientIp + ': ' + message);//changed the console log


    count = count + 1; //this adds to the count
    console.log('Number of messages = ' + count); //shows the number of messages in console
   
    //Rate Limit Code
    if (count == RATELIMIT) { //if message count equals ratelimit then
        console.log('Number of message exceeds rate limit of ' + RATELIMIT); //log message in console
        ws.close(); //disconnect
    }


    // Handles incoming messages from clients
    ws.on('message', (message) => {
        console.log(`Received from ${clientIp}: ${message}`);

        // Broadcast the message to all connected clients except the sender
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    // Handles client disconnection
    ws.on('close', () => {
        console.log(`Client from ${clientIp} disconnected`);
        clients.delete(ws);
        });
    });
});

// Start the HTTP and WebSocket server
const PORT = 8080;
const SERVER_IP = '0.0.0.0';
server.listen(PORT, SERVER_IP, () => {
    console.log(`Server running at http://${SERVER_IP}:${PORT}`);
});
