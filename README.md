<div align="center">

# 🗼 ZimNOC
### Rural Network Operations & Coverage Intelligence Dashboard

**A browser-based telecom operations intelligence system for monitoring LTE tower health,  
simulating outages, visualising coverage gaps, and optimising rural connectivity across Zimbabwe.**

## What is ZimNOC?

ZimNOC is a **Network Operations Center (NOC) intelligence simulator** — the kind of operational tooling used by telecom engineers to monitor infrastructure health, detect failures, and plan rural connectivity expansion.

It is built around real-world telecom concepts: LTE tower topology, Dijkstra SPF routing (the same algorithm used in OSPF), CIDR subnet calculation, and coverage gap analysis. The dashboard runs entirely in a browser with a Node.js/Express REST API backend.

This project demonstrates:

- Telecom infrastructure and NOC operational thinking
- Full-stack JavaScript (browser frontend + REST API backend)
- Real networking algorithms implemented from scratch
- Production-grade API design, security, and error handling

---

## Features

### 🗺️ Zimbabwe LTE Tower Topology Map
Interactive SVG network graph of **15 towers** across Harare, Bulawayo, Gweru, Mutare, Masvingo, Kwekwe, and four rural nodes. Click any tower to open a detail panel. Backbone links render in status colour — green (online), amber (degraded), red (offline).

| City | Towers | Types |
|------|--------|-------|
| Harare | 4 | Macro BTS, Micro Cell |
| Bulawayo | 3 | Macro BTS, Micro Cell |
| Gweru | 1 | Macro BTS |
| Mutare | 1 | Macro BTS |
| Masvingo | 1 | Macro BTS |
| Kwekwe | 1 | Macro BTS |
| Rural nodes | 4 | Rural BTS |

Each node shows real-time status, subscriber load, bandwidth utilisation, uptime %, latency, and packet loss — all simulated with live metric drift.

---

### ⚡ Outage & Congestion Simulator
Mirrors real NOC incident management:

- **Failure injection** — takes any tower offline instantly; affected subscriber count calculated automatically
- **Congestion injection** — overloads a tower, doubling latency and spiking packet loss
- **Automatic rerouting** — Dijkstra SPF redistributes traffic to adjacent healthy nodes
- **Timestamped event log** — full audit trail of every simulation action
- **One-click restore** — returns all towers to baseline state

---

### 🔀 Dijkstra SPF Routing Engine
Shortest Path First — the same algorithm that powers OSPF in real networks:

- Select any source and destination tower pair
- Computes the optimal path weighted by latency and link capacity
- Automatically skips offline towers (fault-aware graph traversal)
- Displays hop count, total end-to-end latency, per-hop detail, and route cost
- The computed route animates live on the topology map

**Weight function:**
```
w(u → v) = latency(u) + latency(v) + (1000 / link_capacity_Mbps) × 5
```
A 1 Gbps fibre link costs ~5 units. A 34 Mbps rural microwave link costs ~150. Traffic is pushed naturally toward high-capacity paths.

---

### 📡 Rural Coverage Gap Analyzer
Identifies Zimbabwe's underserved zones and recommends optimal tower placement:

| Zone | Severity | Unserved Population | Distance to Tower |
|------|----------|-------------------|-------------------|
| Midlands Desert Zone | 🔴 High | 12,400 | 82 km |
| Eastern Highlands Gap | 🟡 Medium | 7,800 | 45 km |
| Mberengwa Dead Zone | 🔴 High | 9,200 | 68 km |
| Save Valley Fringe | 🔵 Low | 3,400 | 32 km |

Each gap includes a placement recommendation (macro BTS vs micro cell) with estimated subscriber gain.

---

### 📊 Live Telecom Metrics Dashboard
- **4 KPI sparkline charts** — throughput, latency, packet loss, active subscribers
- Metrics update every 2.5 seconds with realistic Gaussian-bounded drift
- Per-tower health matrix with load bars, latency, and packet loss colour-coding
- Live aggregate header: total subscribers, average load, average latency

---

### 🧮 CIDR Subnet Planner
Built-in IPv4 subnet calculator for planning new rural deployments — pure bitwise arithmetic, no external library:

- Computes network address, subnet mask, broadcast address
- First and last usable host
- Total usable host count
- Clear validation errors for invalid input

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser Client                         │
│                                                              │
│   ┌────────────┐  ┌──────────┐  ┌────────────────────────┐  │
│   │  Topology  │  │   SPF    │  │   Outage Simulator     │  │
│   │  SVG Map   │  │  Router  │  │   + Event Audit Log    │  │
│   └────────────┘  └──────────┘  └────────────────────────┘  │
│   ┌────────────┐  ┌──────────────────────────────────────┐  │
│   │  Coverage  │  │    Live KPI Sparklines  (pure SVG)   │  │
│   │  Gap Panel │  └──────────────────────────────────────┘  │
│   └────────────┘                                             │
│                    React 18 · CSS Variables · SVG             │
└─────────────────────────────┬────────────────────────────────┘
                              │  REST  /api/v1/
┌─────────────────────────────▼────────────────────────────────┐
│                      Express.js Backend                       │
│                                                              │
│   Helmet (CSP/HSTS)  ·  CORS  ·  Rate Limiting (per-route)  │
│   Input Validation   ·  Typed Error Hierarchy                │
│   Dijkstra SPF  ·  Simulation Engine  ·  CIDR Calculator     │
│   Timestamped Audit Log  ·  Pagination  ·  Morgan Logging    │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 (CDN/UMD) | Component-based UI, hooks |
| Pure SVG | Interactive topology map and sparkline charts |
| CSS Custom Properties | Dark-theme design token system |
| Babel Standalone | In-browser JSX transpilation |

> **No build step required.** Open `index.html` directly in any modern browser.

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js 18+ | Runtime |
| Express 4 | HTTP framework |
| Helmet | Security headers (CSP, HSTS, X-Frame-Options…) |
| express-rate-limit | Per-route abuse prevention |
| cors | Controlled cross-origin access |
| morgan | HTTP request logging |

### Algorithms
| Algorithm | Where Used |
|-----------|-----------|
| Dijkstra SPF | Routing engine — frontend and backend |
| Bitwise CIDR | Subnet calculator — no external library |
| Gaussian drift | Live metric simulation |
| Load redistribution | Post-failure traffic rerouting |

---

## Getting Started

### Prerequisites
- **Node.js 18+** — for the backend API
- Any modern browser — Chrome, Firefox, Edge, or Safari

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ZimNOC.git
cd ZimNOC
```

> **Note:** If your folder name contains special characters (e.g. `&`), rename it first — Node.js and some shells don't handle `&` in paths well.

### 2. Open the frontend

No install needed. Just open the file:

```bash

# Windows
start index.html
```

The dashboard runs fully standalone. The backend API is optional — the simulator works entirely in-browser.

### 3. Run the backend API (optional)

```bash
npm install

npm run dev      # development — auto-restarts on file changes
npm start        # production
```

API runs at: **`http://localhost:4000`**

---



### Towers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/towers` | List towers — filter by `status`, `city`, `type`; supports `page` + `limit` |
| `GET` | `/towers/:id` | Single tower detail |
| `PATCH` | `/towers/:id` | Partial update (`status`, `load`, `bandwidth`, `lat_ms`, `packet_loss`, `subscribers`) |
| `GET` | `/summary` | Network-wide aggregate KPIs |

```bash


## Project Structure

```
ZimNOC/
├── index.html      # Complete frontend — React 18, SVG topology map, live metrics
├── server.js       # Express REST API — routing, simulation, CIDR, security
├── package.json    # Dependencies and npm scripts
└── README.md       # This file
```

---

## Roadmap

- [ ] WebSocket live push — real-time metric updates from backend to browser
- [ ] Persistent storage — replace in-memory store with SQLite or PostgreSQL
- [ ] JWT authentication — NOC user roles (admin, engineer, viewer)
- [ ] Export — PDF and CSV reports for coverage gap analysis
- [ ] Mobile-responsive layout for field engineers
- [ ] Historical trends — 24h / 7d / 30d metric retention with charts

---

Built with telecom infrastructure awareness, NOC operational thinking,  
and production-grade engineering standards.

**Zimbabwe 🇿🇼 · LTE Infrastructure · Network Operations**
