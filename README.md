# SOA Project — Group VII: Administrative Document Request Workflow (e-Government)

![Architecture](https://img.shields.io/badge/Architecture-Event--Driven%20SOA-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![NodeJS](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-AMQP-FF6600?logo=rabbitmq)
![Mailpit](https://img.shields.io/badge/Mailpit-SMTP-008080)

## 👥 Team Members
* **Medini Abderrazak**
* **Salles Yacine**
* **Project Type:** Classical Service-Oriented Architecture (SOA)

---

## 🏛️ System Architecture

The application is structured into decoupled, independent microservices following SOA principles, coordinated asynchronously via a RabbitMQ topic exchange and exposed through a unified API Gateway.

```
                               ┌────────────────────────────────────────────────┐
                               │           Client Interfaces                    │
                               │  - Web Portal (http://localhost:3000)          │
                               │  - Postman / Swagger (http://localhost:8000)   │
                               └──────────────────────┬─────────────────────────┘
                                                      │ HTTP / REST
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │           API Gateway (Port 8000)              │
                               │   Single Entry Point & Swagger Aggregator      │
                               └──┬───────────┬───────────────┬───────────────┬─┘
                                  │           │               │               │
            /api/students         │           │ /api/requests │               │ /api/documents
                 ┌────────────────┘           │               │               └────────────────┐
                 ▼                            ▼               ▼                                ▼
┌─────────────────────────────┐ ┌───────────────────────────┐ │ ┌────────────────────────────────┐
│       Student Service       │ │      Request Service      │ │ │        Document Service        │
│         (Port 8001)         │ │        (Port 8002)        │ │ │          (Port 8003)           │
│                             │ │                           │ │ │                                │
│ - Seeds DummyJSON /users    │ │ - Request State Machine:  │ │ │ - Generates PDF (PDFKit)       │
│ - Transcripts & Grades      │ │   SUBMITTED -> APPROVED   │ │ │ - Generates QR Code (qrcode)   │
│ - DB: students.json         │ │                / REJECTED │ │ │ - DB: documents-meta.json      │
└─────────────────────────────┘ └─────────────┬─────────────┘ │ │ - Storage: /storage/*.pdf      │
                                              │               │ └────────────────▲───────────────┘
                                              │ Publishes     │                  │
                                              │ Events        │                  │ Consumes
                                              ▼               ▼                  │ request.approved
                               ┌──────────────────────────────────────────────┐  │
                               │        RabbitMQ Message Broker (Port 5672)   │──┘
                               │        Exchange: soa.administrative.events   │
                               └──────────────────────┬───────────────────────┘
                                                      │ Consumes
                                                      │ request.approved & request.rejected
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │         Notification Service (Port 8004)     │
                               │ - Consumes approval & rejection events       │
                               │ - Dispatches HTML emails with PDF links      │
                               └──────────────────────┬───────────────────────┘
                                                      │ SMTP (Port 1025)
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │      Mailpit Email Server (Port 8025 Web)    │
                               │ Inspect sent emails with zero external setup │
                               └──────────────────────────────────────────────┘
```

---

## 📦 Service Registry & Ports

| Service | Port | Internal URL | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Client Web UI** | `3000` | `http://localhost:3000` | Student Request Portal, Admin Review Dashboard, QR Verifier |
| **API Gateway** | `8000` | `http://localhost:8000` | Reverse proxy single entry point & Unified Swagger UI |
| **Student Service** | `8001` | `http://localhost:8001` | DummyJSON student import, contact details, academic transcripts |
| **Request Service** | `8002` | `http://localhost:8002` | Request lifecycle state machine, event publisher |
| **Document Service**| `8003` | `http://localhost:8003` | PDFKit generation, verifiable QR codes, document storage |
| **Notification Service** | `8004` | `http://localhost:8004` | Event subscriber, transactional email dispatcher |
| **RabbitMQ Web UI** | `15672`| `http://localhost:15672` | Broker management console (`guest` / `guest`) |
| **Mailpit Web UI** | `8025` | `http://localhost:8025` | Local web inbox to view all sent student emails |

---

## 🔐 Role-Based Access Control (RBAC) & Security Architecture

The platform implements an **OAuth2/JWT-compatible Role-Based Access Control** security model (fulfilling the Keycloak extension requirement):

### Roles & Permissions Hierarchy
* **`ROLE_STUDENT`:**
  * Permissions: `requests:create`, `requests:read:own`, `documents:read:own`
  * Allowed to submit requests and view personal documents.
  * **Forbidden (HTTP 403)** from approving or rejecting requests.
* **`ROLE_REGISTRAR` (Academic Registrar / Administration Officer):**
  * Permissions: `requests:read:all`, `requests:decide`, `documents:read:all`, `students:read:all`
  * Full administrative authority to approve, reject, and inspect all requests.
* **`ROLE_AUDITOR` (Ministry Compliance Inspector):**
  * Permissions: `audit:read`, `requests:read:all`, `notifications:read:all`
  * Read-only compliance and audit trail inspection.

### Pre-Configured Personas for Demonstrations
* **Registrar Officer:** `Dr. Karima Benali` (`user-reg-1`)
* **Student #1:** `Abderrazak Medini` (`user-std-1` / `amedini`)
* **Student #2:** `Yacine Salles` (`user-std-2` / `ysalles`)
* **Ministry Auditor:** `Inspector Youssef Cherif` (`user-aud-1` / `auditor`)

---

## 🧪 Automated Test Suites

Run the end-to-end and security test suites directly from your terminal:

```bash
# 1. Run Full End-to-End SOA Lifecycle Test
npm test

# 2. Run Dedicated RBAC Security & Privilege Escalation Prevention Test
npm run test:rbac
```

---

## 🚀 One-Command Launch

Everything launches with a single command via Docker Compose:

```bash
docker compose up --build
```

To stop the system:
```bash
docker compose down
```

---

## 🖥️ User Interfaces & Endpoints

1. **Web Application:** [http://localhost:3000](http://localhost:3000)
2. **Unified Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
3. **Gateway Health Probe:** [http://localhost:8000/health](http://localhost:8000/health)
4. **Mailpit Email Inbox:** [http://localhost:8025](http://localhost:8025)
5. **RabbitMQ Management Dashboard:** [http://localhost:15672](http://localhost:15672) (User/Pass: `guest`/`guest`)

---

## 🧪 10-Minute Presentation / Demo Script

### Step 1: System Overview (2 Minutes)
1. Explain the architectural diagram: **Event-Driven SOA**, decoupled microservices, and single entry point gateway.
2. Show `docker-compose.yml` to demonstrate that every service has its own container, volume, and environment configuration.

### Step 2: System Startup & Health Check (1 Minute)
1. Run `docker compose up`.
2. Open [http://localhost:8000/health](http://localhost:8000/health) to show that all 4 microservices respond with `status: UP` and low latency.
3. Open [http://localhost:8000/docs](http://localhost:8000/docs) to showcase the unified OpenAPI/Swagger interface.

### Step 3: Happy Path — Request Submission & Approval (4 Minutes)
1. Open the Web Client at [http://localhost:3000](http://localhost:3000).
2. Go to **Student Request Portal**:
   * Select a student (e.g., *Abderrazak Medini* or any DummyJSON profile).
   * Note how their university, enrollment degree, and transcript GPA are loaded from Student Service.
   * Select **Certificate of Enrollment** (or **Academic Transcript**).
   * Enter purpose: *"Application for scholarship"* and click **Submit Request**.
3. Switch to the **Administration Review** tab:
   * View the new request marked with status `SUBMITTED`.
   * Click **✓ Approve**.
4. Show asynchronous event flow:
   * Switch to RabbitMQ console at [http://localhost:15672](http://localhost:15672) to highlight published/consumed messages.
   * Open Mailpit at [http://localhost:8025](http://localhost:8025) to show the **Instant Approval Email** received by the student.
   * Open the PDF preview / download link from Mailpit or the portal to view the generated certificate complete with official university heading, stamp, and **QR code**.

### Step 4: QR Code Verification (1 Minute)
1. In the Web Client, go to **Issued Documents & QR Check**.
2. Click the Document ID or copy it into the QR Code Verification tool.
3. Click **Verify Authenticity** to see that the Document Service validates the digital certificate.

### Step 5: Rejection Flow (1 Minute)
1. Submit another request from the Student Portal.
2. In the Admin Dashboard, click **✕ Reject** and provide a reason (e.g., *"Incomplete tuition records"*).
3. Open Mailpit at [http://localhost:8025](http://localhost:8025) to demonstrate the **Rejection Notice Email** explaining the administrative decision.

### Step 6: Postman & Wrap-up (1 Minute)
1. Import `soa-group7.postman_collection.json` into Postman to demonstrate automated API invocation.
2. Q&A.

---

## 📂 Project Structure

```
aos-demo/
├── docker-compose.yml              # Single-command multi-container orchestration
├── .env.example                    # Template environment variables
├── soa-group7.postman_collection.json # Automated test collection
├── README.md                       # Complete documentation & demo guide
│
├── shared/                         # Shared event definitions & RabbitMQ client
│   ├── contracts.js                # State machine & document types
│   ├── eventSchemas.js             # DTO factories for published events
│   └── rabbitmqClient.js           # Reusable RabbitMQ connection wrapper
│
├── gateway/                        # API Gateway (Port 8000)
│   ├── src/index.js                # Reverse proxy routing
│   ├── src/swaggerAggregator.js    # Merged OpenAPI documentation
│   └── Dockerfile
│
├── services/
│   ├── student-service/            # Port 8001: DummyJSON seeder & transcripts
│   │   ├── src/index.js
│   │   ├── src/seeder.js
│   │   ├── src/studentStore.js
│   │   ├── src/swagger.js
│   │   └── Dockerfile
│   │
│   ├── request-service/            # Port 8002: Request workflow & event publisher
│   │   ├── src/index.js
│   │   ├── src/requestStore.js
│   │   ├── src/rabbitmq.js
│   │   ├── src/swagger.js
│   │   └── Dockerfile
│   │
│   ├── document-service/           # Port 8003: PDFKit + QR Code generator
│   │   ├── src/index.js
│   │   ├── src/pdfGenerator.js
│   │   ├── src/qrGenerator.js
│   │   ├── src/documentStore.js
│   │   ├── src/rabbitmq.js
│   │   └── Dockerfile
│   │
│   └── notification-service/       # Port 8004: Mailpit email dispatcher & audit
│       ├── src/index.js
│       ├── src/mailer.js
│       ├── src/notificationStore.js
│       ├── src/rabbitmq.js
│       └── Dockerfile
│
└── frontend/                       # Port 3000: Responsive client web app
    ├── server.js
    ├── public/index.html
    ├── public/app.js
    ├── public/styles.css
    └── Dockerfile
```

