## AuthShield

AI Security Ecosystem for OAuth Supply Chain Risk Visibility

AuthShield is a hackathon-ready security intelligence platform that helps teams understand how connected AI and SaaS tools can become an attack path. It gives security and product teams a visual trust graph, risk scoring, live alert handling, and breach propagation simulation in one experience.

## Why We Chose This Project

Modern teams connect dozens of tools using OAuth. These integrations increase velocity but also create hidden transitive risk.

One compromised integration can cascade across:
- code repositories
- cloud infrastructure
- collaboration suites
- internal data platforms

AuthShield was chosen to solve a practical and urgent challenge:

How can a team quickly understand blast radius before damage spreads?

This project is designed for demo clarity and real-world relevance:
- clear visual risk storytelling for non-security judges
- concrete technical backend logic for engineering judges
- immediate business value framing for product judges

## Problem Statement

Organizations usually track tools individually, not as an interconnected trust graph.

Key pain points:
- security posture is fragmented across many dashboards
- alerts are hard to prioritize by propagation risk
- incident teams cannot quickly estimate blast radius
- non-expert stakeholders cannot understand attack paths fast enough

## Solution Overview

AuthShield combines:
- centralized OAuth-connected tool inventory
- deterministic risk scoring
- graph-based relationship mapping
- breach simulation using graph traversal
- alert triage and resolution flow

Result: faster incident understanding, better prioritization, and stronger communication across security, engineering, and leadership.

## Core Features

### 1. Dashboard Intelligence
- organization risk score snapshot
- connected tools and critical tools counters
- active alert counts
- trend-oriented KPI style for quick executive reading

### 2. Interactive Trust Graph
- visual map of connected tools and relationships
- node hover and click-to-pin inspection
- risk color coding by severity
- quick jump from graph node to simulation

### 3. Breach Simulator
- select compromised tool
- select incident entry clue (how attacker likely entered)
- compute propagation path and blast radius
- estimate time to compromise
- list affected systems and recommended actions

### 4. Alert Operations
- severity filtering
- investigate action
- resolve action with live state updates

### 5. Tool Governance Center
- search, category filter, risk filter, and sorting
- per-tool detail review modal
- revoke status handling
- direct Run Breach action from each tool

### 6. Login-First Demo Flow
- refresh forces login page for deterministic demo start
- avoids stale-session blank-state issues during judging

## Architecture

### High-Level Components

- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: FastAPI (Python)
- Data Layer: Mock data + in-memory alert state
- Risk Engine: deterministic score rules
- Simulation Engine: graph BFS propagation

### Request Flow

1. Frontend calls backend API endpoints.
2. Backend enriches tool data with computed risk score and label.
3. Frontend renders dashboard, graph, tools, and alerts.
4. Simulation endpoint runs BFS over tool connections.
5. Frontend displays impact metrics and recommended actions.

### API Endpoints

- GET /api/dashboard
- GET /api/tools
- GET /api/graph
- GET /api/alerts
- POST /api/alerts/{alert_id}/resolve
- POST /api/simulate

## Risk Model Details

Risk score is a bounded 0-100 deterministic score.

Scoring factors:
- OAuth scopes
	- admin or full_access: +25 each
	- write or delete: +15 each
	- read or send: +5 each
- connected systems
	- critical systems (AWS, GitHub, MongoDB, Google Workspace): +10 each
	- other systems: +5 each

Risk labels:
- 80-100: Critical
- 60-79: High
- 40-59: Medium
- below 40: Low

## Simulation Model Details

Simulation uses graph traversal from a selected trigger tool.

Algorithm:
- build undirected adjacency from trust connections
- perform breadth-first traversal
- collect visited tools and affected systems
- compute estimated compromise time from graph distance depth

Simulation output includes:
- propagation_path
- blast_radius
- affected_systems
- time_to_compromise_minutes
- recommended_actions

Frontend incident-entry clue selection adds display-side multipliers for scenario storytelling without mutating backend truth.

## Technology Stack

Frontend:
- HTML5
- CSS3
- Vanilla JavaScript (ES modules)
- Canvas API for graph rendering

Backend:
- Python 3.11
- FastAPI
- Uvicorn
- Pydantic
- NetworkX dependency included for graph ecosystem compatibility

Dev and Packaging:
- Docker
- single-container startup script for frontend and backend

## Project Structure

- frontend_demo
	- index.html
	- styles.css
	- script.js
	- src/services/api.js
- backend_demo/backend
	- main.py
	- security_engine.py
	- mock_data.py
	- requirements.txt
- Dockerfile
- start.sh

## How To Run Locally

### Prerequisites
- Python 3.10+
- pip

### 1. Start Backend

Open terminal in backend_demo/backend and run:

uvicorn main:app --host 127.0.0.1 --port 8000 --reload

Backend docs:

http://localhost:8000/docs

### 2. Start Frontend

Open terminal in frontend_demo and run:

python -m http.server 3000

Frontend:

http://localhost:3000

## How To Run With Docker

From project root, build image:

docker build -t authshield-demo .

Run container:

docker run --rm -p 3000:3000 -p 8000:8000 authshield-demo

Access:
- frontend: http://localhost:3000
- backend: http://localhost:8000
- api docs: http://localhost:8000/docs

## What Makes AuthShield Unique

### 1. Security Storytelling + Technical Depth

Most demos either look good or are technically meaningful. AuthShield does both:
- visually understandable for judges
- algorithmically grounded under the hood

### 2. Propagation-First Thinking

Instead of isolated tool risk, AuthShield models network spread and blast radius, which is closer to real incident response needs.

### 3. Human-Readable Incident Entry Clues

Simulation input is phrased as user-observable behavior, helping non-security users make correct scenario choices.

### 4. End-to-End Demo Flow

Single journey:
- login
- posture review
- graph inspection
- breach simulation
- alert response
- tool governance

### 5. Judge-Friendly Reliability

Dockerized run path and deterministic mock data reduce demo failure risk during live evaluation.

## Hackathon Evaluation Mapping

### Innovation
- combines OAuth governance, graph simulation, and security UX in one unified workflow

### Technical Implementation
- FastAPI backend
- deterministic risk engine
- graph traversal simulation
- responsive frontend state management

### Practical Impact
- can improve incident triage speed
- improves stakeholder communication during active incidents

### Demo Quality
- clear visual hierarchy
- actionable outputs
- reproducible setup via Docker

## Known Limitations

- mock data, not production integrations
- in-memory alert state (resets on restart)
- frontend attack clue multipliers are for scenario illustration

## Future Enhancements

- real OAuth provider connectors
- persistent database for alerts and tool history
- anomaly detection over integration behavior
- role-based access control and audit logs
- SIEM export and webhook integrations
- real-time graph updates via WebSockets

## Team Pitch One-Liner

AuthShield turns invisible OAuth trust chains into visible, actionable security intelligence before one compromised tool becomes an organization-wide breach.

