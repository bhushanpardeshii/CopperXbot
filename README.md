# CopperX Telegram Bot

A Telegram bot for managing cryptocurrency transfers, withdrawals, and account operations through the CopperX platform.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Telegram Bot Token (obtain from [@BotFather](https://t.me/BotFather))
- CopperX API access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd copperxbot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
REDIS_URL=your_redis_url
```

4. Build and start the bot:
```bash
npm run build
npm start
```

## API Integration

The bot integrates with the CopperX API (`https://income-api.copperx.io/api`) for the following operations:

- Authentication (`/auth`)
- Wallet Management (`/wallets`)
- Transfers (`/transfers`)
- KYC Status (`/kycs`)

### Authentication Flow
1. Email OTP request
2. OTP verification
3. Session token management
4. Redis-based session storage

## Command Reference

### Basic Commands
- `/start` - Initialize the bot
- `/login` - Start authentication process
- `/logout` - End current session
- `/menu` - Display main menu

### Wallet Operations
- `/balance` - Check wallet balances
- `/wallets` - List all wallets
- `/send` - Initiate a transfer
- `/wallet-withdraw` - Initiate a withdrawal
- `/sendbatch` - Start batch transfer

### Account Information
- `/profile` - View user profile
- `/transfers` - View transaction history
- `/kycstatus` - Check KYC verification status

### Interactive Menu Buttons
- 👤 Profile
- 💰 Balance
- 👛 Wallets
- 📤 Send
- 📥 Withdraw
- 📦 Batch Send
- 💸 Transfers
- 🔍 KYC Status

## Troubleshooting Guide

### Common Issues

1. **Authentication Errors**
   - Verify your email address
   - Ensure OTP is entered correctly
   - Check if session has expired

2. **Transfer Issues**
   - Minimum transfer amount is 1 USDC
   - Verify wallet address format
   - Ensure sufficient balance

3. **Build Errors**
   ```bash
   npm install --save-dev @types/node @types/redis @types/uuid
   ```

4. **Redis Connection Issues**
   - Verify REDIS_URL in .env
   - Check Redis server status
   - Ensure proper network connectivity

### Error Messages

- `❌ Session expired` - Re-login required
- `❌ Invalid OTP` - Retry authentication
- `❌ Insufficient funds` - Check wallet balance
- `❌ Invalid wallet address` - Verify address format

### Building
```bash
npm run build   # Compiles TypeScript to JavaScript
npm run dev     # Runs in development mode with ts-node
```

## Security Considerations

- Session management using Redis
- OTP-based authentication
- Secure API communication
- Rate limiting implementation
- Environment variable protection
