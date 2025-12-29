# TIKETI 🎫

> Modern Event Ticketing Platform with Microservices Architecture

## ⚡ Quick Start

### 원스텝 설치 (5-10분)

**Windows:**
```powershell
.\setup-tiketi.ps1
.\start_port_forwards.ps1
```

**Linux/WSL:**
```bash
./scripts/setup-tiketi.sh
./scripts/port-forward-all.sh
```

그런 다음 **http://localhost:3000** 접속!

**상세 가이드**: [QUICK_START.md](./QUICK_START.md)

## 📚 Documentation

- [Quick Start Guide](./QUICK_START.md)
- [MSA Architecture](./MSA_ARCHITECTURE.md)
- [Migration Plan](./MSA_MIGRATION_PLAN.md)

## 🏗️ Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React SPA |
| Backend | 3001 | Legacy API |
| Auth | 3002 | 인증 서비스 |
| Payment | 3003 | 결제 (Toss Payments) |
| Ticket | 3004 | 티켓 예매 |
| Stats | 3005 | 통계 분석 |

## 📄 License

MIT License
