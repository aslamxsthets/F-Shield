# F-Shield Deployment Guide

## 1. Local Development (Instant Start)
```bash
# 1. Clone repository & install dependencies
npm install

# 2. Start platform
npm run dev
# Or: python3 run.py
```
Access at `http://localhost:3000`.

## 2. Docker Deployment
```bash
# Start complete containerized stack
docker compose up -d --build
```

## 3. Environment Variables
Reference `.env.example`:
- `PORT`: HTTP port for full-stack service (default: `3000`)
- `NODE_ENV`: `development` | `production`
- `GEMINI_API_KEY`: Google GenAI API key for GenAI evidence explanations
- `JWT_SECRET`: Signing secret for JWT session tokens
- `BLOCKCHAIN_MODE`: `SIMULATED` (default) or `REAL`
- `BLOCKCHAIN_RPC_URL`: Optional RPC URL when using real blockchain mode

## 4. Health Verification Endpoints
- `GET /health`: Returns service health status, DB connectivity, AI provider state, and active ML configuration.
- `GET /ready`: Kubernetes readiness probe.
