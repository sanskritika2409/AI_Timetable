# 📅 Schedulon — AI Resource Allocation & Timetable Engine

> Built for **Smart India Hackathon 2025** (Problem Statement PS-25091)  
> Deployed on **Kubernetes** with zero-downtime rollouts 🚀

---

## 🧠 What is this?

Schedulon is an AI/ML-powered conflict-resolution scheduling engine that **automatically generates academic timetables** for FYUP and ITEP programs. It eliminates manual scheduling errors, handles complex constraints, and deploys at scale using Docker & Kubernetes.

---

## ✨ Features

- ✅ Conflict-free timetable generation using AI/ML algorithms
- ✅ Supports FYUP and ITEP academic program structures (NEP aligned)
- ✅ Real-time schedule updates with zero manual intervention
- ✅ REST API backend for seamless frontend integration
- ✅ Dockerized & deployed on Kubernetes with zero-downtime rollouts
- ✅ Intuitive React-based UI for admin and faculty

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Node.js |
| Backend | Python |
| AI/ML | Custom conflict-resolution algorithms |
| DevOps | Docker, Kubernetes |
| Deployment | Kubernetes cluster with zero-downtime rollouts |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.9+
- Docker & Kubernetes (kubectl)

### Run locally

```bash
# Clone the repo
git clone https://github.com/sanskritika2409/AI_Timetable.git
cd AI_Timetable

# Install frontend dependencies
npm install

# Start frontend
npm start

# In a new terminal — start backend
pip install -r requirements.txt
python app.py
```

### Run with Docker

```bash
docker build -t schedulon .
docker run -p 3000:3000 schedulon
```

---

## 🏆 Hackathon Context

This project was built for **Smart India Hackathon 2025**, one of India's largest national-level hackathons. Problem Statement **PS-25091** required building an intelligent academic scheduling system compliant with the National Education Policy (NEP 2020).

---

## 👩‍💻 Author

**Sanskritika Awasthi**  
[LinkedIn](https://www.linkedin.com/in/sanskritika-awasthi-9400592a6) | [GitHub](https://github.com/sanskritika2409)
