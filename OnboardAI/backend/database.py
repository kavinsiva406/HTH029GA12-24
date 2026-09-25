"""
OnboardAI - Database Initialization and Helper Functions
SQLite Database layer for the OnboardAI platform.
"""

import os
import sqlite3
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "onboardai.db")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)


def get_db_connection():
    """Create and return a database connection with dict-like row access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables and seed default onboarding content."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    # 2. topics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            content TEXT NOT NULL
        )
    """)

    # 3. progress table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS progress (
            user_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, topic_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        )
    """)

    # 4. coding_tests table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS coding_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            language TEXT NOT NULL,
            passed BOOLEAN NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # 5. documents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Seed demo user if not exists
    cursor.execute("SELECT * FROM users WHERE email = ?", ("kavin@demo.com",))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            ("Kavin", "kavin@demo.com", "123456")
        )

    # Seed courses/topics if empty
    cursor.execute("SELECT COUNT(*) as count FROM topics")
    if cursor.fetchone()["count"] == 0:
        topics_seed = [
            (
                1,
                "Company Introduction",
                "Understand the company mission, core values, leadership vision, organizational culture, structure, and employee workplace responsibilities.",
                json.dumps({
                    "overview": "Welcome to the team! Our company introduction module sets the foundation for your journey. Here you will learn about our founding principles, how we operate, and the culture we foster across our distributed global teams.",
                    "modules": [
                        {
                            "title": "Company Mission & Vision",
                            "icon": "compass",
                            "content": "Our mission is to empower global workforces through seamless, secure, and intelligent human-centric technology. We envision a collaborative future where knowledge is frictionless, empowering every team member to achieve their highest potential."
                        },
                        {
                            "title": "Core Values & Culture",
                            "icon": "heart",
                            "content": "We operate on four foundational pillars: 1. Extreme Ownership: We take pride in delivering results with accountability. 2. Radical Candor: We communicate openly, respectfully, and proactively. 3. Customer Obsession: We solve real problems with empathy. 4. Continuous Learning: Curiosity is our super-power."
                        },
                        {
                            "title": "Organizational Structure & Workplace Environment",
                            "icon": "users",
                            "content": "We maintain a flat, cross-functional squad topology comprising Engineering, Product Design, Operations, and Customer Success. We embrace flexible asynchronous collaboration with core overlap hours, fostering deep work, psychological safety, and work-life balance."
                        },
                        {
                            "title": "Employee Responsibilities",
                            "icon": "check-circle",
                            "content": "As an employee, your responsibilities include: championing inclusive collaboration, respecting company assets, attending daily standups and quarterly town halls, and upholding our code of ethical conduct."
                        }
                    ],
                    "takeaways": [
                        "Always align daily decisions with customer value and core ethics.",
                        "Respect asynchronous communication etiquettes and transparent documentation.",
                        "Reach out early to peers and mentors whenever blockers arise."
                    ]
                })
            ),
            (
                2,
                "HR Policies",
                "Comprehensive guide to attendance, leave management, working hours, company holidays, workplace conduct, and HR procedures.",
                json.dumps({
                    "overview": "Our HR policies are designed to build a supportive, respectful, and high-performing workplace. This module covers essential guidelines on schedules, paid time off, benefits, code of conduct, and HR communication channels.",
                    "modules": [
                        {
                            "title": "Working Hours & Flexible Attendance",
                            "icon": "clock",
                            "content": "Standard full-time commitment is 40 hours per week. While core synchronization hours are 10:00 AM to 3:00 PM in your local timezone, flexible schedules are encouraged for non-synchronous deep work with prior squad alignment."
                        },
                        {
                            "title": "Leave Policy & Paid Time Off (PTO)",
                            "icon": "calendar",
                            "content": "Employees are entitled to 20 days of Annual Paid Vacation, 10 days of Sick & Wellness Leave, and 12 designated National Public Holidays. Leave requests should be submitted through the internal HR Portal at least 5 business days in advance."
                        },
                        {
                            "title": "Workplace Behaviour & Code of Conduct",
                            "icon": "shield",
                            "content": "We maintain a zero-tolerance policy towards harassment, discrimination, bullying, and retaliation. We require equal opportunity, mutual respect, and courteous professional language across all digital and in-person spaces."
                        },
                        {
                            "title": "Communication Guidelines & HR Escalations",
                            "icon": "message-square",
                            "content": "Slack is used for day-to-day chat, Gmail for formal communications, and Notion for company knowledge. For grievance resolution, confidential inquiries, or wellness support, employees can reach the HR People Partner directly via hr-support@company.internal."
                        }
                    ],
                    "takeaways": [
                        "Submit leave applications ahead of time for smooth squad handoffs.",
                        "Zero tolerance for workplace misconduct and bias.",
                        "Confidential grievance channels are available 24/7."
                    ]
                })
            ),
            (
                3,
                "Cybersecurity",
                "Critical cybersecurity awareness: password safety, phishing prevention, social engineering, safe browsing, and device protection.",
                json.dumps({
                    "overview": "Information security is everyone's responsibility. As a team member, you are the first line of defense against cyber threats, credential harvesting, malware, and data breaches.",
                    "modules": [
                        {
                            "title": "Password Security & Multi-Factor Authentication",
                            "icon": "key",
                            "content": "All company accounts require 16+ character passphrases or passkeys managed via 1Password. Multi-Factor Authentication (MFA) using hardware keys or authenticator apps is mandatory. Never share credentials via chat or email."
                        },
                        {
                            "title": "Phishing & Social Engineering Awareness",
                            "icon": "alert-triangle",
                            "content": "Phishing remains the #1 initial breach vector. Inspect sender email headers, beware of urgent calls to action, check URL destinations before clicking, and never approve unexpected MFA push prompts (MFA fatigue attacks)."
                        },
                        {
                            "title": "Malware, Safe Browsing & Device Security",
                            "icon": "laptop",
                            "content": "Company-issued laptops must have FileVault/BitLocker disk encryption enabled, automatic OS security updates turned on, and CrowdStrike EDR running. Never install unapproved browser extensions or cracked software."
                        },
                        {
                            "title": "Security Incident Reporting Protocol",
                            "icon": "bell",
                            "content": "If you suspect a compromised account, lost device, or accidental credential leak, report it immediately to security-response@company.internal or type `/security-alert` in Slack within 15 minutes without fear of reprimand."
                        }
                    ],
                    "takeaways": [
                        "Use unique generated passwords and mandate MFA everywhere.",
                        "Verify suspicious sender addresses and check URL targets.",
                        "Report suspected security incidents promptly without penalty."
                    ]
                })
            ),
            (
                4,
                "Dart Programming",
                "Master modern Dart programming: variables, typing, control flow, loops, functions, collections, OOP, and Flutter connectivity.",
                json.dumps({
                    "overview": "Dart is a modern, client-optimized, object-oriented language developed by Google. It powers Flutter applications and high-performance cross-platform software. This course provides an engineering-grade walkthrough of syntax and patterns.",
                    "modules": [
                        {
                            "title": "Dart Introduction & Type System",
                            "icon": "code",
                            "content": "Dart is statically typed with sound null safety. Variables can be declared with explicit types (int, double, String, bool) or inferred via `var` / `final` / `const`.\n\n```dart\nvoid main() {\n  String team = 'OnboardAI';\n  int newHires = 12;\n  double rating = 4.95;\n  bool isActive = true;\n  print('$team has $newHires members with $rating rating.');\n}\n```"
                        },
                        {
                            "title": "Control Flow & Loops",
                            "icon": "repeat",
                            "content": "Dart supports standard if/else statements, ternary operators, switch expressions, and robust loops including `for`, `for-in`, `while`, and `do-while`.\n\n```dart\nvoid main() {\n  // Sum of first N numbers\n  int n = 5;\n  int sum = 0;\n  for (int i = 1; i <= n; i++) {\n    sum += i;\n  }\n  print('Sum of first $n numbers: $sum'); // 15\n}\n```"
                        },
                        {
                            "title": "Functions, Lists & Maps",
                            "icon": "layers",
                            "content": "Functions are first-class citizens. Dart includes rich collection primitives with type parameters.\n\n```dart\nint calculateSum(int n) => (n * (n + 1)) ~/ 2;\n\nvoid main() {\n  List<String> modules = ['HR', 'Security', 'Dart'];\n  Map<String, int> scores = {'Kavin': 95, 'Sarah': 90};\n  print('Scores: $scores');\n}\n```"
                        },
                        {
                            "title": "Classes, OOP & Flutter Synergy",
                            "icon": "box",
                            "content": "Dart uses single inheritance with mixins and interfaces. It powers Flutter UI declarative composition seamlessly.\n\n```dart\nclass Employee {\n  final String name;\n  final String role;\n  Employee(this.name, this.role);\n  \n  void introduce() => print('Hello, I am $name, working as $role.');\n}\n```"
                        }
                    ],
                    "takeaways": [
                        "Dart utilizes sound null safety to eliminate null dereference crashes.",
                        "Use `final` for variables whose value won't change after runtime initialization.",
                        "Collection literals (List [], Map {}) are expressive and strongly typed."
                    ]
                })
            ),
            (
                5,
                "Data Privacy",
                "Learn data classification, sensitive PII handling, access controls, GDPR & privacy principles, and employee compliance standards.",
                json.dumps({
                    "overview": "Data privacy is a fundamental legal obligation and human right. In this module, you will learn how to handle customer information, protect Sensitive Personal Identifiable Information (SPII), and comply with global privacy frameworks.",
                    "modules": [
                        {
                            "title": "Data Classification Tiers",
                            "icon": "database",
                            "content": "Our data is categorized into 3 tiers: 1. Public Data: Marketing content, public docs. 2. Internal / Confidential: Roadmaps, source code, internal wikis. 3. Restricted / Sensitive PII: SSN/Tax IDs, medical records, financial data, passwords."
                        },
                        {
                            "title": "Least Privilege & Data Access Controls",
                            "icon": "lock",
                            "content": "Access to production systems, databases, and customer records is granted strictly on a need-to-know basis. Employees must never export customer PII to local machines, personal drives, or unapproved third-party SaaS tools."
                        },
                        {
                            "title": "Core Privacy Principles (GDPR & Global Norms)",
                            "icon": "file-text",
                            "content": "Key principles include: Purpose Limitation (collect only what is needed), Data Minimization (keep only as long as necessary), Accuracy, Integrity & Confidentiality, and Respect for User Rights (Right to be Forgotten & Data Portability)."
                        },
                        {
                            "title": "Employee Responsibilities & Breach Handling",
                            "icon": "alert-circle",
                            "content": "Never share customer data in unencrypted Slack channels. Always sanitize bug reports and telemetry logs. In case of suspected unauthorized disclosure, notify the Data Protection Officer (dpo@company.internal) immediately."
                        }
                    ],
                    "takeaways": [
                        "Never download sensitive customer PII to personal devices.",
                        "Strictly adhere to the principle of least privilege.",
                        "Promptly report data leakage incidents to the DPO."
                    ]
                })
            )
        ]

        for topic in topics_seed:
            cursor.execute(
                "INSERT INTO topics (id, title, description, content) VALUES (?, ?, ?, ?)",
                topic
            )

    # Seed initial progress for demo user
    cursor.execute("SELECT COUNT(*) as count FROM progress WHERE user_id = 1")
    if cursor.fetchone()["count"] == 0:
        cursor.execute("INSERT INTO progress (user_id, topic_id, score, attempts) VALUES (1, 1, 100, 1)")
        cursor.execute("INSERT INTO progress (user_id, topic_id, score, attempts) VALUES (1, 2, 85, 1)")
        cursor.execute("INSERT INTO progress (user_id, topic_id, score, attempts) VALUES (1, 3, 90, 2)")

    # Seed initial coding test for demo user
    cursor.execute("SELECT COUNT(*) as count FROM coding_tests WHERE user_id = 1")
    if cursor.fetchone()["count"] == 0:
        cursor.execute(
            "INSERT INTO coding_tests (user_id, language, passed, created_at) VALUES (1, 'Dart', 1, ?)",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),)
        )

    conn.commit()
    conn.close()
    print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
