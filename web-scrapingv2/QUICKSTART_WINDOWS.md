# Quick Start - Windows (No PostgreSQL Required!)

## ✅ What You Need
- Node.js 18+ (check: `node --version`)
- That's it! SQLite is included, Redis is optional.

## 🚀 Setup (3 Steps)

### 1. Backend Setup
```powershell
cd backend
npm install
npx playwright install chromium
npm run dev
```

Backend starts on: http://localhost:3000

### 2. Frontend Setup (New PowerShell Window)
```powershell
cd frontend
npm install
npm run dev
```

Frontend starts on: http://localhost:5173

### 3. Test It!
Open browser: http://localhost:5173
Search for: "iPhone 15"

## 📝 Notes

- **SQLite database** auto-creates at `backend/data/price_comparison.db`
- **Redis is optional** - system works without it (just no caching)
- **Logs** are in `backend/logs/`

## 🔧 Optional: Add Redis for Caching

Download: https://github.com/microsoftarchive/redis/releases
Or: `choco install redis-64`

Start: `redis-server`

## ❓ Troubleshooting

**Port already in use?**
```powershell
# Change port in backend/.env
PORT=3001
```

**Playwright install fails?**
```powershell
# Try with admin PowerShell
npx playwright install chromium --with-deps
```

**Module not found?**
```powershell
# Delete and reinstall
rm -r node_modules
npm install
```
