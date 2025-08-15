const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse URL-encoded bodies (as sent by Africa's Talking)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// In-memory storage for farmer data
const farmerDatabase = {};

// In-memory session storage for registration flow
const sessionData = {};

// Session timeout management (5 minutes)
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions every minute
setInterval(() => {
    const now = Date.now();
    Object.keys(sessionData).forEach(sessionId => {
        if (sessionData[sessionId] && now - sessionData[sessionId].lastActivity > SESSION_TIMEOUT) {
            console.log(`Cleaning up expired session: ${sessionId}`);
            delete sessionData[sessionId];
        }
    });
}, 60000); // Check every minute

/**
 * Main USSD endpoint that handles all Africa's Talking requests
 * Expects POST requests with: sessionId, phoneNumber, serviceCode, text
 */
app.post('/ussd', (req, res) => {
    // Extract parameters from Africa's Talking
    const { sessionId, phoneNumber, text = '' } = req.body;
    
    // Log incoming request for debugging
    console.log(`USSD Request - SessionId: ${sessionId}, Phone: ${phoneNumber}, Text: "${text}"`);
    
    // Set response timeout to prevent hanging
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            console.error(`Response timeout for session: ${sessionId}`);
            res.set('Content-Type', 'text/plain');
            res.send('END Request timeout. Please try again.');
        }
    }, 25000); // 25 seconds timeout
    
    // Parse user input - Africa's Talking sends all inputs separated by *
    const userInputs = text.split('*').filter(input => input);
    const currentInput = userInputs[userInputs.length - 1] || '';
    const inputLevel = userInputs.length;
    
    // Initialize session data if new session
    if (!sessionData[sessionId]) {
        sessionData[sessionId] = {
            phoneNumber,
            stage: 'MAIN_MENU',
            farmerData: {},
            lastActivity: Date.now(),
            createdAt: Date.now()
        };
    } else {
        // Update last activity time
        sessionData[sessionId].lastActivity = Date.now();
    }
    
    let response = '';
    const session = sessionData[sessionId];
    
    // Handle case where session was lost/expired
    if (!session) {
        console.warn(`Session not found: ${sessionId}. Creating new session.`);
        sessionData[sessionId] = {
            phoneNumber,
            stage: 'MAIN_MENU',
            farmerData: {},
            lastActivity: Date.now(),
            createdAt: Date.now()
        };
        // Force restart from main menu
        response = generateMainMenu();
        sessionData[sessionId].stage = 'MAIN_MENU';
        clearTimeout(timeoutId);
        res.set('Content-Type', 'text/plain');
        res.send(response);
        return;
    }
    
    // Main USSD flow logic
    if (text === '') {
        // First interaction - show main menu
        response = generateMainMenu();
        session.stage = 'MAIN_MENU';
    } 
    else if (inputLevel === 1) {
        // User selected from main menu
        switch (currentInput) {
            case '1':
                // Start registration flow
                response = 'CON Welcome to Farmer Registration\n';
                response += 'Please enter your full name:';
                session.stage = 'ENTER_NAME';
                break;
            case '2':
                // Check registration status
                if (farmerDatabase[phoneNumber]) {
                    const farmer = farmerDatabase[phoneNumber];
                    response = `END Your Registration Details:\n`;
                    response += `Name: ${farmer.name}\n`;
                    response += `County: ${farmer.county}\n`;
                    response += `Crop: ${farmer.crop}\n`;
                    response += `Farm Size: ${farmer.farmSize} acres\n`;
                    response += `Registered: ${farmer.registrationDate}`;
                } else {
                    response = 'END You are not registered yet.\n';
                    response += 'Please dial again and select option 1 to register.';
                }
                cleanupSession(sessionId);
                break;
            case '3':
                // Exit
                response = 'END Thank you for using Farmer Registration Service.\n';
                response += 'Goodbye!';
                cleanupSession(sessionId);
                break;
            default:
                response = 'END Invalid option. Please try again.';
                cleanupSession(sessionId);
        }
    }
    else if (session.stage === 'ENTER_NAME' && inputLevel === 2) {
        // Save name and ask for county
        session.farmerData.name = currentInput;
        response = 'CON Enter your county location:\n';
        response += '1. Nairobi\n';
        response += '2. Kiambu\n';
        response += '3. Machakos\n';
        response += '4. Nakuru\n';
        response += '5. Meru\n';
        response += '6. Kisumu\n';
        response += '7. Mombasa\n';
        response += '8. Other';
        session.stage = 'SELECT_COUNTY';
    }
    else if (session.stage === 'SELECT_COUNTY' && inputLevel === 3) {
        // Process county selection
        const counties = {
            '1': 'Nairobi',
            '2': 'Kiambu',
            '3': 'Machakos',
            '4': 'Nakuru',
            '5': 'Meru',
            '6': 'Kisumu',
            '7': 'Mombasa'
        };
        
        if (currentInput === '8') {
            // User selected "Other"
            response = 'CON Please type your county name:';
            session.stage = 'ENTER_CUSTOM_COUNTY';
        } else if (counties[currentInput]) {
            session.farmerData.county = counties[currentInput];
            response = generateCropMenu();
            session.stage = 'SELECT_CROP';
        } else {
            response = 'END Invalid selection. Please try again.';
            cleanupSession(sessionId);
        }
    }
    else if (session.stage === 'ENTER_CUSTOM_COUNTY' && inputLevel === 4) {
        // Save custom county and proceed to crop selection
        session.farmerData.county = currentInput;
        response = generateCropMenu();
        session.stage = 'SELECT_CROP';
    }
    else if (session.stage === 'SELECT_CROP') {
        // Handle crop selection - this stage comes after county selection
        const crops = {
            '1': 'Maize',
            '2': 'Wheat',
            '3': 'Rice',
            '4': 'Beans',
            '5': 'Potatoes',
            '6': 'Tea',
            '7': 'Coffee',
            '8': 'Sugarcane'
        };
        
        if (currentInput === '9') {
            response = 'CON Please type your crop type:';
            session.stage = 'ENTER_CUSTOM_CROP';
        } else if (crops[currentInput]) {
            session.farmerData.crop = crops[currentInput];
            response = 'CON Enter your farm size in acres:\n';
            response += '(Example: 2.5 or 10)';
            session.stage = 'ENTER_FARM_SIZE';
        } else {
            response = 'END Invalid selection. Please try again.';
            cleanupSession(sessionId);
        }
    }
    else if (session.stage === 'ENTER_CUSTOM_CROP') {
        // Save custom crop and ask for farm size
        session.farmerData.crop = currentInput;
        response = 'CON Enter your farm size in acres:\n';
        response += '(Example: 2.5 or 10)';
        session.stage = 'ENTER_FARM_SIZE';
    }
    else if (session.stage === 'ENTER_FARM_SIZE') {
        // Validate and save farm size
        const farmSize = parseFloat(currentInput);
        if (isNaN(farmSize) || farmSize <= 0) {
            response = 'CON Invalid farm size. Please enter a valid number:\n';
            response += '(Example: 2.5 or 10)';
        } else {
            session.farmerData.farmSize = farmSize;
            // Show confirmation
            response = generateConfirmation(session.farmerData);
            session.stage = 'CONFIRM_REGISTRATION';
        }
    }
    else if (session.stage === 'CONFIRM_REGISTRATION') {
        // Handle confirmation
        if (currentInput === '1') {
            // Save to database
            const registrationData = {
                ...session.farmerData,
                phoneNumber,
                registrationDate: new Date().toLocaleString('en-KE', { 
                    timeZone: 'Africa/Nairobi' 
                })
            };
            farmerDatabase[phoneNumber] = registrationData;
            
            response = 'END Registration successful!\n';
            response += `Thank you ${session.farmerData.name}.\n`;
            response += 'You will receive SMS confirmation shortly.\n';
            response += 'For assistance, call 0700000000';
            
            // Log successful registration
            console.log('New farmer registered:', registrationData);
            
            cleanupSession(sessionId);
        } else if (currentInput === '2') {
            // Cancel registration
            response = 'END Registration cancelled.\n';
            response += 'Dial again to start over.';
            cleanupSession(sessionId);
        } else {
            response = 'END Invalid option. Registration cancelled.';
            cleanupSession(sessionId);
        }
    }
    else {
        // Fallback for any unexpected state
        console.log(`Unexpected state - Session: ${sessionId}, Stage: ${session.stage}, InputLevel: ${inputLevel}, Text: "${text}"`);
        
        // Try to recover by checking input level and guessing stage
        if (inputLevel === 1 && ['1', '2', '3'].includes(currentInput)) {
            // Looks like main menu selection, reset to main menu
            response = generateMainMenu();
            session.stage = 'MAIN_MENU';
        } else if (inputLevel === 0 || text === '') {
            // Empty input, show main menu
            response = generateMainMenu();
            session.stage = 'MAIN_MENU';
        } else {
            // Complete unknown state, end session
            response = 'END An error occurred. Please dial again to restart.';
            cleanupSession(sessionId);
        }
    }
    
    // Ensure response is never empty
    if (!response || response.trim() === '') {
        console.error(`Empty response detected - Session: ${sessionId}, Stage: ${session.stage}, InputLevel: ${inputLevel}, Text: "${text}"`);
        response = 'END System error. Please try again later.';
        cleanupSession(sessionId);
    }
    
    // Clear the timeout since we're sending a response
    clearTimeout(timeoutId);
    
    // Log the response for debugging
    console.log(`Response for ${sessionId}: "${response}"`);
    
    // Log session completion for END responses
    if (response.startsWith('END')) {
        console.log(`Session completed: ${sessionId}, Duration: ${Date.now() - session.createdAt}ms`);
    }
    
    // Send response back to Africa's Talking
    res.set('Content-Type', 'text/plain');
    res.send(response);
});

/**
 * Root endpoint - shows welcome message
 */
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Farmer USSD Registration Service</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .info { background: #e8f4f8; padding: 20px; border-radius: 8px; }
                    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                </style>
            </head>
            <body>
                <h1>🌾 Farmer USSD Registration Service</h1>
                <div class="info">
                    <h2>Service is Running!</h2>
                    <p>This is a USSD service endpoint. It only accepts POST requests.</p>
                    <h3>Available Endpoints:</h3>
                    <ul>
                        <li><code>POST /ussd</code> - Main USSD endpoint (for Africa's Talking)</li>
                        <li><code>GET /health</code> - Health check status</li>
                        <li><code>GET /farmers</code> - View registered farmers</li>
                        <li><code>GET /test</code> - Interactive USSD tester</li>
                    </ul>
                    <h3>Your ngrok URL:</h3>
                    <p><strong>${req.protocol}://${req.get('host')}/ussd</strong></p>
                    <p>Use this URL in your Africa's Talking USSD channel configuration.</p>
                    <br>
                    <a href="/test" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open USSD Tester</a>
                </div>
            </body>
        </html>
    `);
});

/**
 * GET endpoint for /ussd - returns helpful message
 */
app.get('/ussd', (req, res) => {
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'This endpoint only accepts POST requests from Africa\'s Talking',
        hint: 'Use POST method with sessionId, phoneNumber, and text parameters'
    });
});

/**
 * Debug endpoint to view current sessions
 */
app.get('/sessions', (req, res) => {
    const sessions = Object.keys(sessionData).map(sessionId => ({
        sessionId,
        phoneNumber: sessionData[sessionId].phoneNumber,
        stage: sessionData[sessionId].stage,
        lastActivity: new Date(sessionData[sessionId].lastActivity).toLocaleString(),
        duration: Date.now() - sessionData[sessionId].createdAt,
        farmerData: sessionData[sessionId].farmerData
    }));
    
    res.json({
        activeSessions: sessions.length,
        sessions
    });
});

/**
 * Health check endpoint - GET request
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running',
        registeredFarmers: Object.keys(farmerDatabase).length,
        activeSessions: Object.keys(sessionData).length
    });
});

/**
 * Interactive USSD Tester - Web interface for testing
 */
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>USSD Tester - Farmer Registration</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .phone-container {
                    background: #1a1a1a;
                    border-radius: 30px;
                    padding: 20px;
                    width: 100%;
                    max-width: 380px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .phone-screen {
                    background: #fff;
                    border-radius: 20px;
                    padding: 20px;
                    min-height: 500px;
                    display: flex;
                    flex-direction: column;
                }
                .ussd-header {
                    background: #4CAF50;
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .ussd-display {
                    background: #f5f5f5;
                    padding: 20px;
                    border-radius: 10px;
                    min-height: 250px;
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 20px;
                    border: 2px solid #e0e0e0;
                }
                .keypad {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .key {
                    background: #f0f0f0;
                    border: none;
                    padding: 20px;
                    font-size: 20px;
                    font-weight: bold;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .key:hover {
                    background: #e0e0e0;
                    transform: scale(0.95);
                }
                .key:active {
                    background: #d0d0d0;
                }
                .key.send {
                    background: #4CAF50;
                    color: white;
                    grid-column: span 2;
                }
                .key.send:hover {
                    background: #45a049;
                }
                .key.cancel {
                    background: #f44336;
                    color: white;
                }
                .key.cancel:hover {
                    background: #da190b;
                }
                .input-display {
                    background: white;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    border: 2px solid #4CAF50;
                    min-height: 50px;
                    font-size: 18px;
                    font-family: 'Courier New', monospace;
                }
                .status {
                    text-align: center;
                    padding: 10px;
                    background: #e8f4f8;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    font-size: 12px;
                }
                .session-ended {
                    background: #ffebee;
                    color: #c62828;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    margin-top: 20px;
                }
                .text-input {
                    width: 100%;
                    padding: 15px;
                    font-size: 16px;
                    border: 2px solid #4CAF50;
                    border-radius: 10px;
                    margin-bottom: 10px;
                    font-family: 'Courier New', monospace;
                }
                .action-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="phone-container">
                <div class="phone-screen">
                    <div class="ussd-header">
                        <strong>USSD Test Interface</strong>
                        <div style="font-size: 12px; margin-top: 5px;">*384*1234#</div>
                    </div>
                    
                    <div class="status">
                        Session ID: <span id="sessionId">-</span> | 
                        Phone: <span id="phoneNumber">+254712345678</span>
                    </div>
                    
                    <div class="ussd-display" id="ussdDisplay">
                        Press "Dial USSD" to start...
                    </div>
                    
                    <div id="inputSection">
                        <input type="text" id="textInput" class="text-input" placeholder="Enter your response..." disabled>
                        
                        <div class="keypad" id="keypad" style="display:none;">
                            <button class="key" onclick="appendNumber('1')">1</button>
                            <button class="key" onclick="appendNumber('2')">2</button>
                            <button class="key" onclick="appendNumber('3')">3</button>
                            <button class="key" onclick="appendNumber('4')">4</button>
                            <button class="key" onclick="appendNumber('5')">5</button>
                            <button class="key" onclick="appendNumber('6')">6</button>
                            <button class="key" onclick="appendNumber('7')">7</button>
                            <button class="key" onclick="appendNumber('8')">8</button>
                            <button class="key" onclick="appendNumber('9')">9</button>
                            <button class="key" onclick="clearInput()">Clear</button>
                            <button class="key" onclick="appendNumber('0')">0</button>
                            <button class="key" onclick="backspace()">←</button>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="key send" onclick="sendUSSD()" id="sendButton">Dial USSD</button>
                            <button class="key cancel" onclick="endSession()">End</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                let sessionId = '';
                let phoneNumber = '+254712345678';
                let textAccumulator = '';
                let sessionActive = false;
                let waitingForText = false;
                
                function generateSessionId() {
                    return 'test-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                }
                
                function appendNumber(num) {
                    if (sessionActive && !waitingForText) {
                        document.getElementById('textInput').value += num;
                    }
                }
                
                function clearInput() {
                    document.getElementById('textInput').value = '';
                }
                
                function backspace() {
                    const input = document.getElementById('textInput');
                    input.value = input.value.slice(0, -1);
                }
                
                async function sendUSSD() {
                    const input = document.getElementById('textInput').value;
                    const sendButton = document.getElementById('sendButton');
                    
                    if (!sessionActive) {
                        // Start new session
                        sessionId = generateSessionId();
                        textAccumulator = '';
                        sessionActive = true;
                        document.getElementById('sessionId').textContent = sessionId.substring(0, 20) + '...';
                        document.getElementById('phoneNumber').textContent = phoneNumber;
                        sendButton.textContent = 'Send';
                        document.getElementById('textInput').disabled = false;
                        document.getElementById('keypad').style.display = 'grid';
                    } else {
                        // Continue session
                        if (input) {
                            textAccumulator = textAccumulator ? textAccumulator + '*' + input : input;
                        }
                    }
                    
                    try {
                        const response = await fetch('/ussd', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: new URLSearchParams({
                                sessionId: sessionId,
                                phoneNumber: phoneNumber,
                                text: textAccumulator
                            })
                        });
                        
                        const data = await response.text();
                        displayResponse(data);
                        
                        // Clear input for next entry
                        document.getElementById('textInput').value = '';
                        
                        // Check if session ended
                        if (data.startsWith('END')) {
                            endSession();
                        } else {
                            // Check if we need text input or number input
                            const displayText = data.replace('CON ', '');
                            waitingForText = displayText.includes('enter') || 
                                           displayText.includes('Enter') || 
                                           displayText.includes('type') ||
                                           displayText.includes('Type');
                            
                            if (waitingForText) {
                                document.getElementById('keypad').style.display = 'none';
                                document.getElementById('textInput').placeholder = 'Type your answer...';
                            } else {
                                document.getElementById('keypad').style.display = 'grid';
                                document.getElementById('textInput').placeholder = 'Select option number...';
                            }
                        }
                        
                    } catch (error) {
                        console.error('Error:', error);
                        document.getElementById('ussdDisplay').textContent = 'Error: Could not connect to USSD service';
                    }
                }
                
                function displayResponse(response) {
                    let displayText = response;
                    if (response.startsWith('CON ')) {
                        displayText = response.substring(4);
                    } else if (response.startsWith('END ')) {
                        displayText = response.substring(4);
                    }
                    document.getElementById('ussdDisplay').textContent = displayText;
                }
                
                function endSession() {
                    sessionActive = false;
                    sessionId = '';
                    textAccumulator = '';
                    waitingForText = false;
                    document.getElementById('sendButton').textContent = 'Dial USSD';
                    document.getElementById('textInput').disabled = true;
                    document.getElementById('textInput').value = '';
                    document.getElementById('textInput').placeholder = 'Enter your response...';
                    document.getElementById('keypad').style.display = 'none';
                    document.getElementById('sessionId').textContent = '-';
                }
                
                // Allow Enter key to send
                document.getElementById('textInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        sendUSSD();
                    }
                });
                
                // Allow changing phone number
                document.getElementById('phoneNumber').addEventListener('click', function() {
                    if (!sessionActive) {
                        const newNumber = prompt('Enter phone number:', phoneNumber);
                        if (newNumber) {
                            phoneNumber = newNumber;
                            this.textContent = phoneNumber;
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

/**
 * Debug endpoint to view all registered farmers (for testing)
 */
app.get('/farmers', (req, res) => {
    res.json({
        count: Object.keys(farmerDatabase).length,
        farmers: farmerDatabase
    });
});

/**
 * Generate main menu
 */
function generateMainMenu() {
    let menu = 'CON Welcome to Farmer Registration Service\n';
    menu += 'Please select an option:\n';
    menu += '1. Register as new farmer\n';
    menu += '2. Check registration status\n';
    menu += '3. Exit';
    return menu;
}

/**
 * Generate crop selection menu
 */
function generateCropMenu() {
    let menu = 'CON Select your main crop:\n';
    menu += '1. Maize\n';
    menu += '2. Wheat\n';
    menu += '3. Rice\n';
    menu += '4. Beans\n';
    menu += '5. Potatoes\n';
    menu += '6. Tea\n';
    menu += '7. Coffee\n';
    menu += '8. Sugarcane\n';
    menu += '9. Other';
    return menu;
}

/**
 * Generate registration confirmation screen
 */
function generateConfirmation(data) {
    let confirmation = 'CON Confirm your details:\n';
    confirmation += `Name: ${data.name}\n`;
    confirmation += `County: ${data.county}\n`;
    confirmation += `Crop: ${data.crop}\n`;
    confirmation += `Farm: ${data.farmSize} acres\n\n`;
    confirmation += '1. Confirm & Register\n';
    confirmation += '2. Cancel';
    return confirmation;
}

/**
 * Clean up session data after completion
 */
function cleanupSession(sessionId) {
    // Immediate cleanup for END responses
    if (sessionData[sessionId]) {
        console.log(`Cleaning up session: ${sessionId}`);
        delete sessionData[sessionId];
    }
}

/**
 * Start the server
 */
app.listen(PORT, () => {
    console.log(`USSD Farmer Registration App running on port ${PORT}`);
    console.log(`USSD endpoint: http://localhost:${PORT}/ussd`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`View farmers: http://localhost:${PORT}/farmers`);
    console.log('\nReady to receive Africa\'s Talking USSD requests!');
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    console.log(`Total farmers registered: ${Object.keys(farmerDatabase).length}`);
    process.exit(0);
});