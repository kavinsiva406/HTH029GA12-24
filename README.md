# OnboardAI - AI-Powered Employee Onboarding Platform

**OnboardAI** is an enterprise onboarding platform designed to orient new hires across 5 foundational modules:
1. **Company Introduction**: Mission, Vision, Core Values, Culture, Org Structure, and Responsibilities
2. **HR Policies**: Attendance, Leave Policy (PTO), Working Hours, Code of Conduct, and Escalations
3. **Cybersecurity**: Password Safety, MFA, Phishing Defenses, Malware, and Incident Response
4. **Dart Programming**: Syntax, Variables, Control Flow, Loops, Functions, Collections, OOP, and Flutter
5. **Data Privacy**: PII Classification, Least Privilege, GDPR Compliance, and Breach Reporting

---

## 📁 Project Structure

```text
OnboardAI/
├── index.html               # Main frontend interface
├── style.css                # Premium modern SaaS design system
├── script.js                # Client logic connecting to FastAPI endpoints
│
└── backend/
    ├── main.py              # FastAPI application with REST endpoints
    ├── database.py          # SQLite schema, tables, and seeding logic
    ├── requirements.txt     # Python backend dependencies
    ├── uploads/             # Secure repository for uploaded employee PDFs
    └── onboardai.db         # Initialized SQLite database
```

---

## 🚀 Setup & Run Instructions

### 1. Backend (Python FastAPI + SQLite)

#### Prerequisites:
- Python 3.9+ installed
- SQLite3 (included in Python standard library)

#### Step 1: Navigate to the backend directory
```bash
cd backend
```

#### Step 2: Create and activate a virtual environment (recommended)
```bash
# macOS / Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
.\venv\Scripts\activate
```

#### Step 3: Install dependencies
```bash
pip install -r requirements.txt
```

#### Step 4: Initialize the database
```bash
python database.py
```
*This creates `onboardai.db` with all tables, seeds the demo account (`kavin@demo.com`), and inserts the complete 5-course curriculum.*

#### Step 5: Start the FastAPI backend server
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
The API will run at `http://127.0.0.1:8000`. Interactive OpenAPI documentation will be accessible at:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

---

### 2. Frontend (HTML, CSS & JavaScript)

The frontend can be served using VS Code **Live Server** or any static web server:

```bash
# Using Python built-in HTTP server:
python -m http.server 5500

# Or open index.html directly with VS Code Live Server extension (port 5500)
```

The frontend automatically connects to `http://127.0.0.1:8000` when served via Live Server. You can also configure or test the backend URL directly in the UI by clicking the status badge in the bottom-left sidebar.

---

## 🔑 Demo Account Credentials

- **Email**: `kavin@demo.com`
- **Password**: `123456`

*(A "Use Demo Login" quick-fill button is also provided on the sign-in screen.)*

---

## 📚 REST API Documentation

### Base URL:
`http://127.0.0.1:8000`

### Endpoints:

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | API status and root greeting | - |
| `GET` | `/health` | Health check & database connectivity | - |
| `POST` | `/login` | Authenticates employee credentials | `{"email": "...", "password": "..."}` |
| `GET` | `/topics` | Retrieves the list of all 5 courses | - |
| `GET` | `/learn/{topic_id}` | Detailed content, lessons, and quiz questions | - |
| `POST` | `/quiz/submit` | Records assessment score and attempts | `{"user_id": 1, "topic_id": 4, "score": 85}` |
| `GET` | `/progress/{user_id}` | Overview metrics, completed count, & recent activity | - |
| `POST` | `/coding/submit` | Records result of Dart code challenge | `{"user_id": 1, "language": "Dart", "passed": true}` |
| `GET` | `/coding/history/{user_id}` | Retrieves previous coding submissions | - |
| `POST` | `/coach` | AI Onboarding Assistant response | `{"question": "What is Dart?"}` |
| `POST` | `/documents/upload` | Uploads PDF onboarding documents | `multipart/form-data (user_id, file)` |
| `GET` | `/documents/{user_id}` | Lists all documents uploaded by user | - |

---

## 🛡️ Security Features
- **File Validation**: Strict PDF format validation both by file extension and MIME type.
- **Upload Size Limit**: 10 MB per document.
- **Safe Code Execution**: Sandboxed algorithm validation preventing arbitrary system code execution.
- **Input Sanitization**: Client and server side payload validation.
- **CORS Configured**: Secure cross-origin requests enabled for client integrations.
