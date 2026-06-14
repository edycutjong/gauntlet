<div align="center">
  <img src="docs/icon-animated.svg" alt="Gauntlet Logo" width="120">

  <h1>Gauntlet 🧤</h1>
  <p><em>Paid certification agent — hires your agent with 7 adversarial probes and delivers a scorecard</em></p>
  <img src="docs/readme-hero-animated.svg" alt="Gauntlet" width="100%">

  <br/>

  [![Live Demo](https://img.shields.io/badge/🚀_Live-Demo-06b6d4?style=for-the-badge)](https://mock.croo.network)
  [![Built for CROO Hackathon](https://img.shields.io/badge/DoraHacks-CROO_Hackathon_2026-8b5cf6?style=for-the-badge)](https://dorahacks.io)

  <br/>

  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
  [![CI](https://github.com/edycutjong/gauntlet/actions/workflows/ci.yml/badge.svg)](https://github.com/edycutjong/gauntlet/actions/workflows/ci.yml)

</div>

---

## 📸 See it in Action

<div align="center">
  <img src="docs/readme.png" alt="Gauntlet Demo" width="100%">
</div>

> **The Certification Workflow.** Agent Submitted → Gauntlet Pays Agent → Runs 7 Adversarial Probes → Collects Responses → Generates Scorecard PDF.

---

## 💡 The Problem & Solution
How do you know if an AI agent is safe, secure, and performs as advertised before giving it sensitive access?
**Gauntlet** is a Paid Certification Agent. It acts as an automated red-team for AI agents. You submit an agent to Gauntlet, it pays the agent to execute a series of tasks, but secretly injects 7 adversarial probes (prompt injection, hallucination testing, data extraction). Based on how the agent responds, Gauntlet generates a certified security scorecard.

**Key Features:**
- 🛡️ **Adversarial Probing:** Tests agents against 7 distinct attack vectors and failure modes.
- 💸 **Real-World Execution:** Actually hires and pays the target agent to test it in a live environment.
- 📄 **Scorecard Generation:** Delivers a comprehensive PDF scorecard detailing vulnerabilities and a final certification grade.

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js (TypeScript) |
| **Ecosystem** | Constellation A2A (croo-core) |
| **PDF Generation** | PDFKit |
| **Testing** | Vitest |

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- npm

### Installation
1. Clone: `git clone https://github.com/edycutjong/gauntlet.git`
2. Install: `npm install`
3. Run: `npm run dev`

## 🧪 Testing & CI

**4-stage pipeline:** Quality → Security → Build → Deploy Gate

```bash
# ── Code Quality ────────────────────────────
make lint          # ESLint
make typecheck     # TypeScript check
make test          # Run tests
make test-coverage # Coverage report
make ci            # Full quality gate

# ── Security ────────────────────────────────
make security-scan # npm audit + license check
```

| Layer | Tool | Status |
|---|---|---|
| Code Quality | ESLint + TypeScript | ✅ |
| Unit Testing | Vitest | ✅ |
| Security (SAST) | CodeQL | ✅ |
| Security (SCA) | Dependabot + npm audit | ✅ |
| Secret Scanning | TruffleHog | ✅ |

## 📁 Project Structure
```text
dorahacks-croo-gauntlet/
├── docs/              # README assets (hero, screenshots)
├── src/               # Application source code
├── scripts/           # Build and run scripts
├── __tests__/         # Vitest test suites
├── .github/           # CI workflows
└── README.md          # You are here
```

## 📄 License
[MIT](LICENSE) © 2026 Edy Cu

## 🙏 Acknowledgments
Built for the DoraHacks CROO Hackathon 2026.
