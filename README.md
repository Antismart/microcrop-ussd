# 🌾 MicroCrop USSD - Farmer Registration Service

A robust USSD application built for farmer registration in Kenya, integrated with Africa's Talking USSD Gateway. This service allows farmers to register their details through simple USSD codes on any mobile phone.

## 📱 Features

### Core Functionality
- **📝 Farmer Registration**: Complete registration flow with name, county, crop type, and farm size
- **📍 Location Support**: Predefined counties + custom county input for flexibility
- **🌱 Crop Management**: Support for major crops (Maize, Wheat, Rice, etc.) + custom crop types
- **✅ Registration Confirmation**: Review and confirm details before final registration
- **📊 Status Checking**: Check existing registration status anytime
- **💾 Data Persistence**: In-memory storage with easy database integration

### Technical Features
- **🔄 Session Management**: Robust session handling with automatic cleanup
- **⏱️ Timeout Protection**: Prevents hanging sessions and incomplete responses
- **🛡️ Error Recovery**: Graceful handling of session timeouts and network issues
- **📈 Monitoring**: Real-time session tracking and health monitoring
- **🧪 Testing Tools**: Interactive web-based USSD tester for development

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Africa's Talking account
- ngrok (for local testing)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Antismart/microcrop-ussd.git
   cd microcrop-ussd
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Expose local server (for testing)**
   ```bash
   ngrok http 3000
   ```

### Africa's Talking Setup

1. **Create USSD Channel**
   - Log into your Africa's Talking account
   - Navigate to USSD → Channels
   - Create a new channel with your assigned USSD code

2. **Configure Webhook URL**
   - Set your ngrok URL as the callback URL: `https://your-ngrok-url.ngrok.io/ussd`
   - Ensure it's a POST endpoint

3. **Test the Service**
   - Dial your USSD code from a registered phone number
   - Follow the registration flow

## 📞 USSD Flow

### Main Menu
```
*384*879568#

Welcome to Farmer Registration Service
Please select an option:
1. Register as new farmer
2. Check registration status  
3. Exit
```

### Registration Flow
```
1. Enter full name
2. Select county (predefined or custom)
3. Select crop type (predefined or custom)
4. Enter farm size in acres
5. Confirm details
6. Registration complete
```

### Sample Session
```
User: *384*879568#
App:  Welcome to Farmer Registration Service
      Please select an option:
      1. Register as new farmer
      2. Check registration status
      3. Exit

User: 1
App:  Welcome to Farmer Registration
      Please enter your full name:

User: John Doe
App:  Enter your county location:
      1. Nairobi  2. Kiambu  3. Machakos
      4. Nakuru   5. Meru    6. Kisumu
      7. Mombasa  8. Other

User: 1
App:  Select your main crop:
      1. Maize    2. Wheat   3. Rice
      4. Beans    5. Potatoes 6. Tea
      7. Coffee   8. Sugarcane 9. Other

User: 1
App:  Enter your farm size in acres:
      (Example: 2.5 or 10)

User: 5
App:  Confirm your details:
      Name: John Doe
      County: Nairobi
      Crop: Maize
      Farm: 5 acres
      
      1. Confirm & Register
      2. Cancel

User: 1
App:  Registration successful!
      Thank you John Doe.
      You will receive SMS confirmation shortly.
      For assistance, call 0700000000
```

## 🛠️ API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ussd` | Main USSD callback endpoint (Africa's Talking) |
| `GET` | `/` | Service information and status |
| `GET` | `/health` | Health check and statistics |

### Development & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/test` | Interactive USSD tester interface |
| `GET` | `/sessions` | View active USSD sessions |
| `GET` | `/farmers` | View registered farmers (development) |

### Health Check Response
```json
{
  "status": "running",
  "registeredFarmers": 15,
  "activeSessions": 3
}
```

## 🧪 Testing

### 1. Web-based Tester
Visit `http://localhost:3000/test` for an interactive USSD testing interface that simulates a mobile phone experience.

### 2. Manual Testing with cURL
```bash
# Start new session
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test123&phoneNumber=%2B254712345678&text="

# Continue session  
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=test123&phoneNumber=%2B254712345678&text=1"
```

### 3. Live Testing
Use your Africa's Talking USSD code with a real mobile phone to test the complete flow.

## 🏗️ Architecture

### Session Management
- **In-memory storage** for active sessions with automatic cleanup
- **5-minute session timeout** with periodic cleanup
- **Session recovery** for lost or expired sessions
- **Immediate cleanup** for completed sessions

### Error Handling
- **Timeout protection** (25-second response limit)
- **Empty response safeguards**
- **Graceful session recovery**
- **Comprehensive error logging**

### Data Structure
```javascript
// Session Data
{
  sessionId: {
    phoneNumber: "+254712345678",
    stage: "SELECT_CROP",
    farmerData: {
      name: "John Doe",
      county: "Nairobi", 
      crop: "Maize",
      farmSize: 5
    },
    lastActivity: 1692123456789,
    createdAt: 1692123400000
  }
}

// Farmer Database
{
  "+254712345678": {
    name: "John Doe",
    county: "Nairobi",
    crop: "Maize", 
    farmSize: 5,
    phoneNumber: "+254712345678",
    registrationDate: "8/15/2025, 9:30:00 PM"
  }
}
```

## 🔧 Configuration

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
SESSION_TIMEOUT=300000       # Session timeout in ms (default: 5 minutes)
```

### Customization Options

1. **Counties**: Modify the `counties` object in the `/ussd` handler
2. **Crops**: Update the `crops` object for different crop types
3. **Validation**: Adjust farm size validation in the `ENTER_FARM_SIZE` stage
4. **Messages**: Customize USSD messages in the generation functions

## 📊 Monitoring & Debugging

### Logs
The application provides comprehensive logging for:
- Incoming USSD requests
- Session state changes
- Registration completions
- Error conditions
- Session cleanup activities

### Monitoring Endpoints
- **`/health`**: Service health and statistics
- **`/sessions`**: Active session monitoring
- **`/farmers`**: Registration data (development only)

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Session expires quickly | Check Africa's Talking timeout settings |
| Empty responses | Review input level logic and fallback handling |
| Registration not saving | Verify session stage transitions |
| Network timeouts | Ensure stable internet and proper ngrok setup |

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment
   export NODE_ENV=production
   export PORT=80
   ```

2. **Process Management** (using PM2)
   ```bash
   npm install -g pm2
   pm2 start index.js --name "microcrop-ussd"
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy** (using Nginx)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Clone and setup
git clone https://github.com/Antismart/microcrop-ussd.git
cd microcrop-ussd
npm install

# Start development server
npm run dev

# Test the USSD flow
open http://localhost:3000/test
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **USSD Testing**: Visit `/test` endpoint for interactive testing
- **API Documentation**: All endpoints documented above
- **Session Management**: Automatic handling with monitoring tools

### Contact
- **Email**: support@microcrop.ke
- **Phone**: +254 700 000 000
- **GitHub Issues**: [Create an issue](https://github.com/Antismart/microcrop-ussd/issues)

### Africa's Talking Resources
- [USSD Documentation](https://developers.africastalking.com/docs/ussd)
- [API Reference](https://developers.africastalking.com/docs/ussd/overview)
- [Testing Guidelines](https://developers.africastalking.com/docs/ussd/testing)

## 🔄 Changelog

### v1.0.0 (August 15, 2025)
- ✅ Initial release with complete USSD registration flow
- ✅ Robust session management and error handling
- ✅ Interactive web-based testing interface
- ✅ Comprehensive monitoring and debugging tools
- ✅ Production-ready deployment configuration

---

**Built with ❤️ for Kenya's farming community**

*Empowering farmers through accessible technology*
