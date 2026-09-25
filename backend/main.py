"""
OnboardAI - FastAPI Backend Service
Complete RESTful API for OnboardAI Employee Onboarding Platform
"""

import os
import json
import sqlite3
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, EmailStr, Field

try:
    from database import get_db_connection, init_db, UPLOADS_DIR
except ImportError:
    from .database import get_db_connection, init_db, UPLOADS_DIR

# Ensure DB is initialized
init_db()

app = FastAPI(
    title="OnboardAI API",
    description="Enterprise Employee Onboarding & Skill Assessment API",
    version="1.0.0"
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Pydantic Request / Response Models
# ==========================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

class LoginResponse(BaseModel):
    success: bool
    user: Optional[UserResponse] = None
    message: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    user_id: int
    topic_id: int
    score: int = Field(ge=0, le=100)

class CodingSubmitRequest(BaseModel):
    user_id: int
    language: str = "Dart"
    passed: bool

class CoachRequest(BaseModel):
    question: str


# ==========================================
# In-Memory Assessment Quiz Bank
# ==========================================
QUIZ_BANK: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {
            "id": 1,
            "question": "What are the four core values that define the company culture?",
            "options": [
                "Extreme Ownership, Radical Candor, Customer Obsession, Continuous Learning",
                "Speed, Competition, Secrecy, Individual Performance",
                "Profit First, Minimum Effort, Bureaucracy, Strict Hierarchy",
                "Isolation, Perfectionism, Rigid Deadlines, Status Quo"
            ],
            "correct": 0,
            "explanation": "Our four foundational pillars are Extreme Ownership, Radical Candor, Customer Obsession, and Continuous Learning."
        },
        {
            "id": 2,
            "question": "Which organizational structure does the company embrace?",
            "options": [
                "Rigid 8-tier top-down hierarchy",
                "Flat, cross-functional squads with asynchronous collaboration",
                "No leadership or designated roles",
                "Strict regional silos with no cross-talk"
            ],
            "correct": 1,
            "explanation": "We operate in agile, cross-functional squads blending engineering, design, and product with healthy async workflows."
        },
        {
            "id": 3,
            "question": "What is the primary mission of OnboardAI / our organization?",
            "options": [
                "Selling customer telemetry without consent",
                "Empowering global workforces through seamless, secure, intelligent human-centric technology",
                "Automating all human jobs away entirely",
                "Building proprietary walled gardens"
            ],
            "correct": 1,
            "explanation": "Our mission is to empower global workforces through seamless, secure, and intelligent human-centric technology."
        }
    ],
    2: [
        {
            "id": 1,
            "question": "What are the standard core synchronization overlap hours?",
            "options": [
                "7:00 AM to 11:00 AM",
                "10:00 AM to 3:00 PM in your local timezone",
                "6:00 PM to 12:00 AM midnight",
                "No overlapping hours allowed"
            ],
            "correct": 1,
            "explanation": "Our core sync overlap hours are 10:00 AM to 3:00 PM local time to facilitate squad coordination while respecting deep work."
        },
        {
            "id": 2,
            "question": "How many days in advance should standard annual vacation leave be requested?",
            "options": [
                "At least 5 business days in advance via HR Portal",
                "No notice is required, just don't log in",
                "3 months in advance minimum",
                "24 hours prior"
            ],
            "correct": 0,
            "explanation": "Standard annual vacation requests should be submitted at least 5 business days in advance for smooth squad coverage."
        },
        {
            "id": 3,
            "question": "What is the company's policy regarding workplace harassment or discrimination?",
            "options": [
                "Permitted during non-working hours",
                "Strict zero-tolerance policy with immediate investigation and action",
                "Handled only if reported multiple times",
                "Advisory guidelines with no formal consequences"
            ],
            "correct": 1,
            "explanation": "We maintain an absolute zero-tolerance policy towards harassment, discrimination, and retaliation."
        }
    ],
    3: [
        {
            "id": 1,
            "question": "What is the mandatory password requirement for corporate accounts?",
            "options": [
                "Any 6 digit number",
                "16+ character passphrases/passkeys stored in 1Password with MFA mandatory",
                "The word 'Password123' changed once a year",
                "Single-factor password without MFA"
            ],
            "correct": 1,
            "explanation": "We mandate 16+ character unique passphrases or passkeys managed via 1Password, enforced with hardware/app-based MFA."
        },
        {
            "id": 2,
            "question": "You receive an email claiming to be IT demanding you click a link to avoid account suspension. What should you do?",
            "options": [
                "Immediately click and enter your password",
                "Forward the email to all teammates",
                "Inspect sender headers, do not click, and report via /security-alert",
                "Reply asking if the email is legitimate"
            ],
            "correct": 2,
            "explanation": "Never click suspicious urgency links. Inspect sender domains and report immediately to Security via `/security-alert` or the incident hotline."
        },
        {
            "id": 3,
            "question": "What is MFA fatigue attack and how should you respond?",
            "options": [
                "A computer virus; restart your laptop",
                "An attacker flooding your phone with MFA prompts; deny prompts and alert Security immediately",
                "A battery exhaustion bug; plug in the charger",
                "An authorized IT test; click approve to clear it"
            ],
            "correct": 1,
            "explanation": "MFA fatigue happens when an attacker spams approval requests hoping you approve out of frustration. Always reject unexpected pushes and report immediately."
        }
    ],
    4: [
        {
            "id": 1,
            "question": "What is sound null safety in Dart?",
            "options": [
                "Dart converts null values to zeros automatically",
                "A type system guarantee that variables cannot be null unless explicitly declared nullable with '?'",
                "Dart does not support null values at all",
                "A runtime audio alert whenever a null exception occurs"
            ],
            "correct": 1,
            "explanation": "Sound null safety ensures at compile-time that non-nullable types can never contain null, eliminating null-pointer crashes."
        },
        {
            "id": 2,
            "question": "What does the following Dart code output?\n`void main() { int sum = 0; for (int i = 1; i <= 3; i++) { sum += i; } print(sum); }`",
            "options": [
                "3",
                "6",
                "5",
                "9"
            ],
            "correct": 1,
            "explanation": "The loop adds 1 + 2 + 3 = 6."
        },
        {
            "id": 3,
            "question": "Which keyword is used in Dart to declare a variable whose value cannot be reassigned after runtime initialization?",
            "options": [
                "static",
                "final",
                "volatile",
                "dynamic"
            ],
            "correct": 1,
            "explanation": "'final' specifies that a variable can be assigned once and cannot be reassigned thereafter."
        }
    ],
    5: [
        {
            "id": 1,
            "question": "Which of the following is classified as Sensitive / Restricted PII?",
            "options": [
                "The company's public Twitter handle",
                "Social Security Number / Tax Identification and payment credentials",
                "The corporate address listed on the website",
                "Open source library documentation"
            ],
            "correct": 1,
            "explanation": "National identity numbers, financial information, biometric data, and health records are restricted, high-risk PII."
        },
        {
            "id": 2,
            "question": "What does the 'Principle of Least Privilege' mean?",
            "options": [
                "Everyone gets full root access to save time",
                "Employees only receive access to the specific data and systems strictly required to perform their role",
                "Only executives can access company email",
                "Junior developers cannot read documentation"
            ],
            "correct": 1,
            "explanation": "Least privilege mandates giving users only the minimal necessary permissions needed for legitimate work."
        },
        {
            "id": 3,
            "question": "Under GDPR and modern privacy standards, what does 'Data Minimization' require?",
            "options": [
                "Storing files in compressed .zip format only",
                "Collecting only adequate, relevant, and strictly necessary data for specified purposes",
                "Deleting all corporate databases every 30 days",
                "Selling data in smaller batches"
            ],
            "correct": 1,
            "explanation": "Data minimization mandates limiting personal data collection to what is directly necessary for the intended purpose."
        }
    ]
}


# ==========================================
# Endpoints
# ==========================================

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "app": "OnboardAI API",
        "version": "1.0.0",
        "documentation": "/docs"
    }


@app.get("/health")
def health_check():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.now().isoformat(),
        "database": db_status
    }


@app.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, email, password FROM users WHERE email = ?",
        (payload.email.strip().lower(),)
    )
    user_row = cursor.fetchone()
    conn.close()

    if not user_row or user_row["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify credentials."
        )

    return LoginResponse(
        success=True,
        user=UserResponse(
            id=user_row["id"],
            name=user_row["name"],
            email=user_row["email"]
        ),
        message="Login successful. Welcome back!"
    )


@app.get("/topics")
def get_topics():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, description FROM topics ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    topics = [
        {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"]
        }
        for row in rows
    ]
    return {"success": True, "topics": topics}


@app.get("/learn/{topic_id}")
def get_learn_topic(topic_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, description, content FROM topics WHERE id = ?", (topic_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Topic with ID {topic_id} not found.")

    try:
        parsed_content = json.loads(row["content"])
    except Exception:
        parsed_content = {"overview": row["content"], "modules": [], "takeaways": []}

    # Attach quiz metadata if available
    quiz_questions = QUIZ_BANK.get(topic_id, [])

    return {
        "success": True,
        "topic": {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "content": parsed_content,
            "total_quiz_questions": len(quiz_questions),
            "quiz": quiz_questions
        }
    }


@app.post("/quiz/submit")
def submit_quiz(payload: QuizSubmitRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if user exists
    cursor.execute("SELECT id FROM users WHERE id = ?", (payload.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    # Check if topic exists
    cursor.execute("SELECT id FROM topics WHERE id = ?", (payload.topic_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Topic not found.")

    cursor.execute(
        "SELECT score, attempts FROM progress WHERE user_id = ? AND topic_id = ?",
        (payload.user_id, payload.topic_id)
    )
    existing = cursor.fetchone()

    if existing:
        new_attempts = existing["attempts"] + 1
        # Keep highest score achieved or latest
        new_score = max(existing["score"], payload.score)
        cursor.execute(
            "UPDATE progress SET score = ?, attempts = ? WHERE user_id = ? AND topic_id = ?",
            (new_score, new_attempts, payload.user_id, payload.topic_id)
        )
    else:
        cursor.execute(
            "INSERT INTO progress (user_id, topic_id, score, attempts) VALUES (?, ?, ?, 1)",
            (payload.user_id, payload.topic_id, payload.score)
        )

    conn.commit()
    conn.close()

    passed = payload.score >= 70
    return {
        "success": True,
        "score": payload.score,
        "passed": passed,
        "message": "Congratulations! You passed the assessment." if passed else "Score recorded. You can review the material and retake the quiz to improve your score."
    }


@app.get("/progress/{user_id}")
def get_user_progress(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify user
    cursor.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    # Get total topics
    cursor.execute("SELECT id, title FROM topics ORDER BY id ASC")
    all_topics = cursor.fetchall()
    total_topics = len(all_topics)

    # Get user progress records
    cursor.execute(
        "SELECT topic_id, score, attempts FROM progress WHERE user_id = ?",
        (user_id,)
    )
    progress_rows = {row["topic_id"]: row for row in cursor.fetchall()}

    completed_count = 0
    total_score = 0
    topic_breakdown = []

    for t in all_topics:
        t_id = t["id"]
        rec = progress_rows.get(t_id)
        score = rec["score"] if rec else 0
        attempts = rec["attempts"] if rec else 0
        is_completed = score >= 70

        if is_completed:
            completed_count += 1
        total_score += score

        topic_breakdown.append({
            "topic_id": t_id,
            "title": t["title"],
            "score": score,
            "attempts": attempts,
            "status": "Completed" if is_completed else ("In Progress" if attempts > 0 else "Pending")
        })

    pending_count = total_topics - completed_count
    overall_percentage = int((completed_count / total_topics * 100)) if total_topics > 0 else 0
    avg_score = int(total_score / total_topics) if total_topics > 0 else 0

    # Get coding test status
    cursor.execute(
        "SELECT passed, created_at FROM coding_tests WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user_id,)
    )
    coding_row = cursor.fetchone()
    if coding_row:
        coding_status = "Passed" if coding_row["passed"] else "Failed"
        coding_date = coding_row["created_at"]
    else:
        coding_status = "Not Attempted"
        coding_date = None

    # Get recent activity
    recent_activity = []
    if coding_row:
        recent_activity.append({
            "type": "coding",
            "title": "Dart Coding Assessment",
            "detail": f"Status: {coding_status}",
            "timestamp": coding_date or "Recently"
        })

    for item in topic_breakdown:
        if item["attempts"] > 0:
            recent_activity.append({
                "type": "quiz",
                "title": f"Quiz: {item['title']}",
                "detail": f"Score: {item['score']}% ({item['attempts']} attempt{'s' if item['attempts'] > 1 else ''})",
                "timestamp": "Completed" if item["score"] >= 70 else "Needs Review"
            })

    conn.close()

    return {
        "success": True,
        "user_id": user_id,
        "user_name": user["name"],
        "overall_percentage": overall_percentage,
        "completed_courses": completed_count,
        "pending_courses": pending_count,
        "total_courses": total_topics,
        "average_score": avg_score,
        "coding_test_status": coding_status,
        "recent_activity": recent_activity[:6],
        "topics": topic_breakdown
    }


@app.post("/coding/submit")
def submit_coding_test(payload: CodingSubmitRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE id = ?", (payload.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO coding_tests (user_id, language, passed, created_at) VALUES (?, ?, ?, ?)",
        (payload.user_id, payload.language, 1 if payload.passed else 0, timestamp)
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "passed": payload.passed,
        "language": payload.language,
        "submitted_at": timestamp,
        "message": "Dart coding test submitted successfully! All test cases passed." if payload.passed else "Dart test submitted. Some test cases failed. Please review your logic and retry."
    }


@app.get("/coding/history/{user_id}")
def get_coding_history(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, language, passed, created_at FROM coding_tests WHERE user_id = ? ORDER BY id DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    history = [
        {
            "id": row["id"],
            "language": row["language"],
            "passed": bool(row["passed"]),
            "created_at": row["created_at"]
        }
        for row in rows
    ]

    return {"success": True, "history": history}


@app.post("/coach")
def ai_coach(payload: CoachRequest):
    """
    AI Onboarding Assistant endpoint.
    Answers company onboarding, HR policies, cybersecurity, Dart, and data privacy questions.
    Architected for future LLM integration.
    """
    q = payload.question.strip().lower()
    if not q:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Contextual knowledge bank
    if "dart" in q:
        answer = (
            "Dart is an open-source, client-optimized, object-oriented programming language developed by Google. "
            "It features sound null safety, strong typing with type inference, and Ahead-of-Time (AOT) as well as Just-In-Time (JIT) compilation. "
            "Dart powers Flutter, enabling high-performance mobile, web, and desktop applications from a single codebase. "
            "Key concepts to master in your onboarding include variables (final/const), control structures, collections (List, Map), and classes."
        )
    elif "phish" in q or "social engineering" in q:
        answer = (
            "Phishing is a deceptive attack where cyber adversaries pose as legitimate entities (like IT Support or executives) "
            "to trick employees into revealing credentials or clicking malicious links. "
            "Key defense protocols: 1) Verify sender email domains carefully, 2) Never approve unexpected MFA push notifications (MFA fatigue), "
            "3) Hover over URLs to inspect true targets, and 4) Immediately report suspected phishing to security-response@company.internal or via `/security-alert` in Slack."
        )
    elif "hr" in q or "policy" in q or "leave" in q or "attendance" in q or "vacation" in q:
        answer = (
            "Our HR policy provides: 1) Standard full-time workweek of 40 hours with core sync hours between 10:00 AM and 3:00 PM local time. "
            "2) 20 days Annual Vacation, 10 days Sick/Wellness leave, and 12 public holidays. "
            "3) Requests should be submitted at least 5 business days in advance via the HR Portal. "
            "4) Strict zero-tolerance for harassment, bias, or discrimination. For confidential assistance, reach out to hr-support@company.internal."
        )
    elif "privacy" in q or "gdpr" in q or "pii" in q or "data" in q:
        answer = (
            "Data Privacy ensures customer and corporate data is protected under international standards such as GDPR and CCPA. "
            "Core principles: 1) Purpose Limitation & Data Minimization (only collect what is necessary), 2) Least Privilege Access (only access records required for your role), "
            "3) Never export customer PII to personal computers or public AI tools, and 4) Promptly report suspected disclosures to the Data Protection Officer (dpo@company.internal)."
        )
    elif "culture" in q or "value" in q or "mission" in q or "vision" in q or "company" in q:
        answer = (
            "Our company culture is anchored on four pillars: Extreme Ownership (delivering with accountability), Radical Candor (proactive and respectful feedback), "
            "Customer Obsession (empathetic problem-solving), and Continuous Learning. "
            "We operate in flat cross-functional squads with asynchronous-first collaboration, empowering you to do deep, meaningful work while maintaining balance."
        )
    else:
        answer = (
            f"Regarding your query on '{payload.question}': As part of your onboarding at OnboardAI, "
            "remember to review the 5 core modules: Company Introduction, HR Policies, Cybersecurity, Dart Programming, and Data Privacy. "
            "If you need specific policy details or technical clarification, feel free to ask about any module or reach out to your designated onboarding buddy!"
        )

    return {
        "success": True,
        "question": payload.question,
        "answer": answer
    }


@app.post("/documents/upload")
def upload_document(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):
    # Security validation 1: Filename and extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF documents (.pdf) are permitted."
        )

    # Security validation 2: MIME type check
    if file.content_type not in ["application/pdf", "application/x-pdf", "application/acrobat"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file MIME type is not valid PDF."
        )

    # Check user exists
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    # Sanitize filename
    safe_filename = os.path.basename(file.filename)
    timestamp_prefix = datetime.now().strftime("%Y%m%d_%H%M%S_")
    stored_name = f"{timestamp_prefix}{safe_filename}"
    file_path = os.path.join(UPLOADS_DIR, stored_name)

    # Max size 10MB limit enforcement
    max_size = 10 * 1024 * 1024
    size = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > max_size:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds maximum allowed size of 10 MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {str(e)}")

    upload_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO documents (user_id, filename, uploaded_at) VALUES (?, ?, ?)",
        (user_id, safe_filename, upload_timestamp)
    )
    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "success": True,
        "document": {
            "id": doc_id,
            "user_id": user_id,
            "filename": safe_filename,
            "uploaded_at": upload_timestamp,
            "size_bytes": size
        },
        "message": f"Document '{safe_filename}' uploaded successfully."
    }


@app.get("/documents/{user_id}")
def get_user_documents(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, user_id, filename, uploaded_at FROM documents WHERE user_id = ? ORDER BY id DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    docs = [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "filename": row["filename"],
            "uploaded_at": row["uploaded_at"]
        }
        for row in rows
    ]

    return {"success": True, "documents": docs}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
