import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup uploads directory
const uploadsDir = path.resolve(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('Invalid file type. Only PDF documents are permitted.'));
    }
    cb(null, true);
  }
});

// JSON store file for Node environment
const dataStorePath = path.resolve(process.cwd(), 'backend', 'store.json');

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

interface ProgressRecord {
  user_id: number;
  topic_id: number;
  score: number;
  attempts: number;
}

interface CodingRecord {
  id: number;
  user_id: number;
  language: string;
  passed: boolean;
  created_at: string;
}

interface DocRecord {
  id: number;
  user_id: number;
  filename: string;
  uploaded_at: string;
}

interface DataStore {
  users: User[];
  progress: ProgressRecord[];
  coding_tests: CodingRecord[];
  documents: DocRecord[];
}

function loadStore(): DataStore {
  if (fs.existsSync(dataStorePath)) {
    try {
      return JSON.parse(fs.readFileSync(dataStorePath, 'utf-8'));
    } catch {
      // fallback to initial
    }
  }
  const initial: DataStore = {
    users: [
      { id: 1, name: 'Kavin', email: 'kavin@demo.com', password: '123456' }
    ],
    progress: [
      { user_id: 1, topic_id: 1, score: 100, attempts: 1 },
      { user_id: 1, topic_id: 2, score: 85, attempts: 1 },
      { user_id: 1, topic_id: 3, score: 90, attempts: 2 }
    ],
    coding_tests: [
      {
        id: 1,
        user_id: 1,
        language: 'Dart',
        passed: true,
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      }
    ],
    documents: []
  };
  fs.writeFileSync(dataStorePath, JSON.stringify(initial, null, 2));
  return initial;
}

function saveStore(store: DataStore) {
  fs.writeFileSync(dataStorePath, JSON.stringify(store, null, 2));
}

// Topics bank
const TOPICS = [
  {
    id: 1,
    title: "Company Introduction",
    description: "Understand the company mission, core values, leadership vision, organizational culture, structure, and employee workplace responsibilities.",
    content: {
      overview: "Welcome to the team! Our company introduction module sets the foundation for your journey. Here you will learn about our founding principles, how we operate, and the culture we foster across our distributed global teams.",
      modules: [
        {
          title: "Company Mission & Vision",
          icon: "compass",
          content: "Our mission is to empower global workforces through seamless, secure, and intelligent human-centric technology. We envision a collaborative future where knowledge is frictionless, empowering every team member to achieve their highest potential."
        },
        {
          title: "Core Values & Culture",
          icon: "heart",
          content: "We operate on four foundational pillars:\n1. Extreme Ownership: We take pride in delivering results with accountability.\n2. Radical Candor: We communicate openly, respectfully, and proactively.\n3. Customer Obsession: We solve real problems with empathy.\n4. Continuous Learning: Curiosity is our super-power."
        },
        {
          title: "Organizational Structure & Workplace Environment",
          icon: "users",
          content: "We maintain a flat, cross-functional squad topology comprising Engineering, Product Design, Operations, and Customer Success. We embrace flexible asynchronous collaboration with core overlap hours, fostering deep work, psychological safety, and work-life balance."
        },
        {
          title: "Employee Responsibilities",
          icon: "check-circle",
          content: "As an employee, your responsibilities include: championing inclusive collaboration, respecting company assets, attending daily standups and quarterly town halls, and upholding our code of ethical conduct."
        }
      ],
      takeaways: [
        "Always align daily decisions with customer value and core ethics.",
        "Respect asynchronous communication etiquettes and transparent documentation.",
        "Reach out early to peers and mentors whenever blockers arise."
      ]
    }
  },
  {
    id: 2,
    title: "HR Policies",
    description: "Comprehensive guide to attendance, leave management, working hours, company holidays, workplace conduct, and HR procedures.",
    content: {
      overview: "Our HR policies are designed to build a supportive, respectful, and high-performing workplace. This module covers essential guidelines on schedules, paid time off, benefits, code of conduct, and HR communication channels.",
      modules: [
        {
          title: "Working Hours & Flexible Attendance",
          icon: "clock",
          content: "Standard full-time commitment is 40 hours per week. While core synchronization hours are 10:00 AM to 3:00 PM in your local timezone, flexible schedules are encouraged for non-synchronous deep work with prior squad alignment."
        },
        {
          title: "Leave Policy & Paid Time Off (PTO)",
          icon: "calendar",
          content: "Employees are entitled to 20 days of Annual Paid Vacation, 10 days of Sick & Wellness Leave, and 12 designated National Public Holidays. Leave requests should be submitted through the internal HR Portal at least 5 business days in advance."
        },
        {
          title: "Workplace Behaviour & Code of Conduct",
          icon: "shield",
          content: "We maintain a zero-tolerance policy towards harassment, discrimination, bullying, and retaliation. We require equal opportunity, mutual respect, and courteous professional language across all digital and in-person spaces."
        },
        {
          title: "Communication Guidelines & HR Escalations",
          icon: "message-square",
          content: "Slack is used for day-to-day chat, Gmail for formal communications, and Notion for company knowledge. For grievance resolution, confidential inquiries, or wellness support, employees can reach the HR People Partner directly via hr-support@company.internal."
        }
      ],
      takeaways: [
        "Submit leave applications ahead of time for smooth squad handoffs.",
        "Zero tolerance for workplace misconduct and bias.",
        "Confidential grievance channels are available 24/7."
      ]
    }
  },
  {
    id: 3,
    title: "Cybersecurity",
    description: "Critical cybersecurity awareness: password safety, phishing prevention, social engineering, safe browsing, and device protection.",
    content: {
      overview: "Information security is everyone's responsibility. As a team member, you are the first line of defense against cyber threats, credential harvesting, malware, and data breaches.",
      modules: [
        {
          title: "Password Security & Multi-Factor Authentication",
          icon: "key",
          content: "All company accounts require 16+ character passphrases or passkeys managed via 1Password. Multi-Factor Authentication (MFA) using hardware keys or authenticator apps is mandatory. Never share credentials via chat or email."
        },
        {
          title: "Phishing & Social Engineering Awareness",
          icon: "alert-triangle",
          content: "Phishing remains the #1 initial breach vector. Inspect sender email headers, beware of urgent calls to action, check URL destinations before clicking, and never approve unexpected MFA push prompts (MFA fatigue attacks)."
        },
        {
          title: "Malware, Safe Browsing & Device Security",
          icon: "laptop",
          content: "Company-issued laptops must have FileVault/BitLocker disk encryption enabled, automatic OS security updates turned on, and CrowdStrike EDR running. Never install unapproved browser extensions or cracked software."
        },
        {
          title: "Security Incident Reporting Protocol",
          icon: "bell",
          content: "If you suspect a compromised account, lost device, or accidental credential leak, report it immediately to security-response@company.internal or type `/security-alert` in Slack within 15 minutes without fear of reprimand."
        }
      ],
      takeaways: [
        "Use unique generated passwords and mandate MFA everywhere.",
        "Verify suspicious sender addresses and check URL targets.",
        "Report suspected security incidents promptly without penalty."
      ]
    }
  },
  {
    id: 4,
    title: "Dart Programming",
    description: "Master modern Dart programming: variables, typing, control flow, loops, functions, collections, OOP, and Flutter connectivity.",
    content: {
      overview: "Dart is a modern, client-optimized, object-oriented language developed by Google. It powers Flutter applications and high-performance cross-platform software. This course provides an engineering-grade walkthrough of syntax and patterns.",
      modules: [
        {
          title: "Dart Introduction & Type System",
          icon: "code",
          content: "Dart is statically typed with sound null safety. Variables can be declared with explicit types (int, double, String, bool) or inferred via `var` / `final` / `const`.\n\n```dart\nvoid main() {\n  String team = 'OnboardAI';\n  int newHires = 12;\n  double rating = 4.95;\n  bool isActive = true;\n  print('$team has $newHires members with $rating rating.');\n}\n```"
        },
        {
          title: "Control Flow & Loops",
          icon: "repeat",
          content: "Dart supports standard if/else statements, ternary operators, switch expressions, and robust loops including `for`, `for-in`, `while`, and `do-while`.\n\n```dart\nvoid main() {\n  // Sum of first N numbers\n  int n = 5;\n  int sum = 0;\n  for (int i = 1; i <= n; i++) {\n    sum += i;\n  }\n  print('Sum of first $n numbers: $sum'); // 15\n}\n```"
        },
        {
          title: "Functions, Lists & Maps",
          icon: "layers",
          content: "Functions are first-class citizens. Dart includes rich collection primitives with type parameters.\n\n```dart\nint calculateSum(int n) => (n * (n + 1)) ~/ 2;\n\nvoid main() {\n  List<String> modules = ['HR', 'Security', 'Dart'];\n  Map<String, int> scores = {'Kavin': 95, 'Sarah': 90};\n  print('Scores: $scores');\n}\n```"
        },
        {
          title: "Classes, OOP & Flutter Synergy",
          icon: "box",
          content: "Dart uses single inheritance with mixins and interfaces. It powers Flutter UI declarative composition seamlessly.\n\n```dart\nclass Employee {\n  final String name;\n  final String role;\n  Employee(this.name, this.role);\n  \n  void introduce() => print('Hello, I am $name, working as $role.');\n}\n```"
        }
      ],
      takeaways: [
        "Dart utilizes sound null safety to eliminate null dereference crashes.",
        "Use `final` for variables whose value won't change after runtime initialization.",
        "Collection literals (List [], Map {}) are expressive and strongly typed."
      ]
    }
  },
  {
    id: 5,
    title: "Data Privacy",
    description: "Learn data classification, sensitive PII handling, access controls, GDPR & privacy principles, and employee compliance standards.",
    content: {
      overview: "Data privacy is a fundamental legal obligation and human right. In this module, you will learn how to handle customer information, protect Sensitive Personal Identifiable Information (SPII), and comply with global privacy frameworks.",
      modules: [
        {
          title: "Data Classification Tiers",
          icon: "database",
          content: "Our data is categorized into 3 tiers:\n1. Public Data: Marketing content, public docs.\n2. Internal / Confidential: Roadmaps, source code, internal wikis.\n3. Restricted / Sensitive PII: SSN/Tax IDs, medical records, financial data, passwords."
        },
        {
          title: "Least Privilege & Data Access Controls",
          icon: "lock",
          content: "Access to production systems, databases, and customer records is granted strictly on a need-to-know basis. Employees must never export customer PII to local machines, personal drives, or unapproved third-party SaaS tools."
        },
        {
          title: "Core Privacy Principles (GDPR & Global Norms)",
          icon: "file-text",
          content: "Key principles include: Purpose Limitation (collect only what is needed), Data Minimization (keep only as long as necessary), Accuracy, Integrity & Confidentiality, and Respect for User Rights (Right to be Forgotten & Data Portability)."
        },
        {
          title: "Employee Responsibilities & Breach Handling",
          icon: "alert-circle",
          content: "Never share customer data in unencrypted Slack channels. Always sanitize bug reports and telemetry logs. In case of suspected unauthorized disclosure, notify the Data Protection Officer (dpo@company.internal) immediately."
        }
      ],
      takeaways: [
        "Never download sensitive customer PII to personal devices.",
        "Strictly adhere to the principle of least privilege.",
        "Promptly report data leakage incidents to the DPO."
      ]
    }
  }
];

const QUIZ_BANK: Record<number, any[]> = {
  1: [
    {
      id: 1,
      question: "What are the four core values that define the company culture?",
      options: [
        "Extreme Ownership, Radical Candor, Customer Obsession, Continuous Learning",
        "Speed, Competition, Secrecy, Individual Performance",
        "Profit First, Minimum Effort, Bureaucracy, Strict Hierarchy",
        "Isolation, Perfectionism, Rigid Deadlines, Status Quo"
      ],
      correct: 0,
      explanation: "Our four foundational pillars are Extreme Ownership, Radical Candor, Customer Obsession, and Continuous Learning."
    },
    {
      id: 2,
      question: "Which organizational structure does the company embrace?",
      options: [
        "Rigid 8-tier top-down hierarchy",
        "Flat, cross-functional squads with asynchronous collaboration",
        "No leadership or designated roles",
        "Strict regional silos with no cross-talk"
      ],
      correct: 1,
      explanation: "We operate in agile, cross-functional squads blending engineering, design, and product with healthy async workflows."
    },
    {
      id: 3,
      question: "What is the primary mission of OnboardAI / our organization?",
      options: [
        "Selling customer telemetry without consent",
        "Empowering global workforces through seamless, secure, intelligent human-centric technology",
        "Automating all human jobs away entirely",
        "Building proprietary walled gardens"
      ],
      correct: 1,
      explanation: "Our mission is to empower global workforces through seamless, secure, and intelligent human-centric technology."
    }
  ],
  2: [
    {
      id: 1,
      question: "What are the standard core synchronization overlap hours?",
      options: [
        "7:00 AM to 11:00 AM",
        "10:00 AM to 3:00 PM in your local timezone",
        "6:00 PM to 12:00 AM midnight",
        "No overlapping hours allowed"
      ],
      correct: 1,
      explanation: "Our core sync overlap hours are 10:00 AM to 3:00 PM local time to facilitate squad coordination while respecting deep work."
    },
    {
      id: 2,
      question: "How many days in advance should standard annual vacation leave be requested?",
      options: [
        "At least 5 business days in advance via HR Portal",
        "No notice is required, just don't log in",
        "3 months in advance minimum",
        "24 hours prior"
      ],
      correct: 0,
      explanation: "Standard annual vacation requests should be submitted at least 5 business days in advance for smooth squad coverage."
    },
    {
      id: 3,
      question: "What is the company's policy regarding workplace harassment or discrimination?",
      options: [
        "Permitted during non-working hours",
        "Strict zero-tolerance policy with immediate investigation and action",
        "Handled only if reported multiple times",
        "Advisory guidelines with no formal consequences"
      ],
      correct: 1,
      explanation: "We maintain an absolute zero-tolerance policy towards harassment, discrimination, and retaliation."
    }
  ],
  3: [
    {
      id: 1,
      question: "What is the mandatory password requirement for corporate accounts?",
      options: [
        "Any 6 digit number",
        "16+ character passphrases/passkeys stored in 1Password with MFA mandatory",
        "The word 'Password123' changed once a year",
        "Single-factor password without MFA"
      ],
      correct: 1,
      explanation: "We mandate 16+ character unique passphrases or passkeys managed via 1Password, enforced with hardware/app-based MFA."
    },
    {
      id: 2,
      question: "You receive an email claiming to be IT demanding you click a link to avoid account suspension. What should you do?",
      options: [
        "Immediately click and enter your password",
        "Forward the email to all teammates",
        "Inspect sender headers, do not click, and report via /security-alert",
        "Reply asking if the email is legitimate"
      ],
      correct: 2,
      explanation: "Never click suspicious urgency links. Inspect sender domains and report immediately to Security via `/security-alert` or the incident hotline."
    },
    {
      id: 3,
      question: "What is MFA fatigue attack and how should you respond?",
      options: [
        "A computer virus; restart your laptop",
        "An attacker flooding your phone with MFA prompts; deny prompts and alert Security immediately",
        "A battery exhaustion bug; plug in the charger",
        "An authorized IT test; click approve to clear it"
      ],
      correct: 1,
      explanation: "MFA fatigue happens when an attacker spams approval requests hoping you approve out of frustration. Always reject unexpected pushes and report immediately."
    }
  ],
  4: [
    {
      id: 1,
      question: "What is sound null safety in Dart?",
      options: [
        "Dart converts null values to zeros automatically",
        "A type system guarantee that variables cannot be null unless explicitly declared nullable with '?'",
        "Dart does not support null values at all",
        "A runtime audio alert whenever a null exception occurs"
      ],
      correct: 1,
      explanation: "Sound null safety ensures at compile-time that non-nullable types can never contain null, eliminating null-pointer crashes."
    },
    {
      id: 2,
      question: "What does the following Dart code output?\nvoid main() { int sum = 0; for (int i = 1; i <= 3; i++) { sum += i; } print(sum); }",
      options: [
        "3",
        "6",
        "5",
        "9"
      ],
      correct: 1,
      explanation: "The loop adds 1 + 2 + 3 = 6."
    },
    {
      id: 3,
      question: "Which keyword is used in Dart to declare a variable whose value cannot be reassigned after runtime initialization?",
      options: [
        "static",
        "final",
        "volatile",
        "dynamic"
      ],
      correct: 1,
      explanation: "'final' specifies that a variable can be assigned once and cannot be reassigned thereafter."
    }
  ],
  5: [
    {
      id: 1,
      question: "Which of the following is classified as Sensitive / Restricted PII?",
      options: [
        "The company's public Twitter handle",
        "Social Security Number / Tax Identification and payment credentials",
        "The corporate address listed on the website",
        "Open source library documentation"
      ],
      correct: 1,
      explanation: "National identity numbers, financial information, biometric data, and health records are restricted, high-risk PII."
    },
    {
      id: 2,
      question: "What does the 'Principle of Least Privilege' mean?",
      options: [
        "Everyone gets full root access to save time",
        "Employees only receive access to the specific data and systems strictly required to perform their role",
        "Only executives can access company email",
        "Junior developers cannot read documentation"
      ],
      correct: 1,
      explanation: "Least privilege mandates giving users only the minimal necessary permissions needed for legitimate work."
    },
    {
      id: 3,
      question: "Under GDPR and modern privacy standards, what does 'Data Minimization' require?",
      options: [
        "Storing files in compressed .zip format only",
        "Collecting only adequate, relevant, and strictly necessary data for specified purposes",
        "Deleting all corporate databases every 30 days",
        "Selling data in smaller batches"
      ],
      correct: 1,
      explanation: "Data minimization mandates limiting personal data collection to what is directly necessary for the intended purpose."
    }
  ]
};

// ==========================================
// REST API Routes matching FastAPI
// ==========================================

app.get('/api-status', (_req, res) => {
  res.json({ status: "ok", app: "OnboardAI Full-Stack Server", version: "1.0.0" });
});

app.get('/health', (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString(), database: "connected" });
});

app.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, detail: "Email and password are required." });
  }
  const store = loadStore();
  const user = store.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, detail: "Invalid email or password. Please verify credentials." });
  }
  return res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    message: "Login successful. Welcome back!"
  });
});

app.get('/topics', (_req, res) => {
  const topics = TOPICS.map(t => ({ id: t.id, title: t.title, description: t.description }));
  res.json({ success: true, topics });
});

app.get('/learn/:topic_id', (req: Request, res: Response) => {
  const topicId = parseInt(req.params.topic_id);
  const topic = TOPICS.find(t => t.id === topicId);
  if (!topic) {
    return res.status(404).json({ success: false, detail: `Topic with ID ${topicId} not found.` });
  }
  const quiz = QUIZ_BANK[topicId] || [];
  return res.json({
    success: true,
    topic: {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      content: topic.content,
      total_quiz_questions: quiz.length,
      quiz
    }
  });
});

app.post('/quiz/submit', (req: Request, res: Response) => {
  const { user_id, topic_id, score } = req.body;
  const store = loadStore();
  const user = store.users.find(u => u.id === Number(user_id));
  if (!user) return res.status(404).json({ detail: "User not found." });

  let record = store.progress.find(p => p.user_id === Number(user_id) && p.topic_id === Number(topic_id));
  if (record) {
    record.attempts += 1;
    record.score = Math.max(record.score, Number(score));
  } else {
    record = {
      user_id: Number(user_id),
      topic_id: Number(topic_id),
      score: Number(score),
      attempts: 1
    };
    store.progress.push(record);
  }
  saveStore(store);

  const passed = score >= 70;
  return res.json({
    success: true,
    score: Number(score),
    passed,
    message: passed ? "Congratulations! You passed the assessment." : "Score recorded. You can review the material and retake the quiz to improve your score."
  });
});

app.get('/progress/:user_id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.user_id);
  const store = loadStore();
  const user = store.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ detail: "User not found." });

  const totalTopics = TOPICS.length;
  let completedCount = 0;
  let totalScore = 0;

  const topicBreakdown = TOPICS.map(t => {
    const p = store.progress.find(pr => pr.user_id === userId && pr.topic_id === t.id);
    const score = p ? p.score : 0;
    const attempts = p ? p.attempts : 0;
    const isCompleted = score >= 70;

    if (isCompleted) completedCount++;
    totalScore += score;

    return {
      topic_id: t.id,
      title: t.title,
      score,
      attempts,
      status: isCompleted ? "Completed" : (attempts > 0 ? "In Progress" : "Pending")
    };
  });

  const pendingCount = totalTopics - completedCount;
  const overallPercentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
  const avgScore = totalTopics > 0 ? Math.round(totalScore / totalTopics) : 0;

  const userCodings = store.coding_tests.filter(c => c.user_id === userId);
  const lastCoding = userCodings[userCodings.length - 1];
  const codingStatus = lastCoding ? (lastCoding.passed ? "Passed" : "Failed") : "Not Attempted";

  const recentActivity: any[] = [];
  if (lastCoding) {
    recentActivity.push({
      type: "coding",
      title: "Dart Coding Assessment",
      detail: `Status: ${codingStatus}`,
      timestamp: lastCoding.created_at
    });
  }

  topicBreakdown.forEach(item => {
    if (item.attempts > 0) {
      recentActivity.push({
        type: "quiz",
        title: `Quiz: ${item.title}`,
        detail: `Score: ${item.score}% (${item.attempts} attempt${item.attempts > 1 ? 's' : ''})`,
        timestamp: item.score >= 70 ? "Completed" : "Needs Review"
      });
    }
  });

  return res.json({
    success: true,
    user_id: userId,
    user_name: user.name,
    overall_percentage: overallPercentage,
    completed_courses: completedCount,
    pending_courses: pendingCount,
    total_courses: totalTopics,
    average_score: avgScore,
    coding_test_status: codingStatus,
    recent_activity: recentActivity.slice(0, 6),
    topics: topicBreakdown
  });
});

app.post('/coding/submit', (req: Request, res: Response) => {
  const { user_id, language, passed } = req.body;
  const store = loadStore();
  const user = store.users.find(u => u.id === Number(user_id));
  if (!user) return res.status(404).json({ detail: "User not found." });

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const record: CodingRecord = {
    id: store.coding_tests.length + 1,
    user_id: Number(user_id),
    language: language || "Dart",
    passed: Boolean(passed),
    created_at: timestamp
  };
  store.coding_tests.push(record);
  saveStore(store);

  return res.json({
    success: true,
    passed: Boolean(passed),
    language: record.language,
    submitted_at: timestamp,
    message: passed ? "Dart coding test submitted successfully! All test cases passed." : "Dart test submitted. Some test cases failed. Please review your logic and retry."
  });
});

app.get('/coding/history/:user_id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.user_id);
  const store = loadStore();
  const history = store.coding_tests
    .filter(c => c.user_id === userId)
    .sort((a, b) => b.id - a.id);

  return res.json({ success: true, history });
});

app.post('/coach', (req: Request, res: Response) => {
  const question = (req.body.question || "").trim();
  if (!question) return res.status(400).json({ detail: "Question cannot be empty." });

  const q = question.toLowerCase();
  let answer = "";

  if (q.includes("dart")) {
    answer = "Dart is an open-source, client-optimized, object-oriented programming language developed by Google. It features sound null safety, strong typing with type inference, and Ahead-of-Time (AOT) as well as Just-In-Time (JIT) compilation. Dart powers Flutter, enabling high-performance mobile, web, and desktop applications from a single codebase. Key concepts to master in your onboarding include variables (final/const), control structures, collections (List, Map), and classes.";
  } else if (q.includes("phish") || q.includes("social engineering")) {
    answer = "Phishing is a deceptive attack where cyber adversaries pose as legitimate entities (like IT Support or executives) to trick employees into revealing credentials or clicking malicious links. Key defense protocols: 1) Verify sender email domains carefully, 2) Never approve unexpected MFA push notifications (MFA fatigue), 3) Hover over URLs to inspect true targets, and 4) Immediately report suspected phishing to security-response@company.internal or via `/security-alert` in Slack.";
  } else if (q.includes("hr") || q.includes("policy") || q.includes("leave") || q.includes("attendance") || q.includes("vacation")) {
    answer = "Our HR policy provides: 1) Standard full-time workweek of 40 hours with core sync hours between 10:00 AM and 3:00 PM local time. 2) 20 days Annual Vacation, 10 days Sick/Wellness leave, and 12 public holidays. 3) Requests should be submitted at least 5 business days in advance via the HR Portal. 4) Strict zero-tolerance for harassment, bias, or discrimination. For confidential assistance, reach out to hr-support@company.internal.";
  } else if (q.includes("privacy") || q.includes("gdpr") || q.includes("pii") || q.includes("data")) {
    answer = "Data Privacy ensures customer and corporate data is protected under international standards such as GDPR and CCPA. Core principles: 1) Purpose Limitation & Data Minimization (only collect what is necessary), 2) Least Privilege Access (only access records required for your role), 3) Never export customer PII to personal computers or public AI tools, and 4) Promptly report suspected disclosures to the Data Protection Officer (dpo@company.internal).";
  } else if (q.includes("culture") || q.includes("value") || q.includes("mission") || q.includes("vision") || q.includes("company")) {
    answer = "Our company culture is anchored on four pillars: Extreme Ownership (delivering with accountability), Radical Candor (proactive and respectful feedback), Customer Obsession (empathetic problem-solving), and Continuous Learning. We operate in flat cross-functional squads with asynchronous-first collaboration, empowering you to do deep, meaningful work while maintaining balance.";
  } else {
    answer = `Regarding your query on '${question}': As part of your onboarding at OnboardAI, remember to review the 5 core modules: Company Introduction, HR Policies, Cybersecurity, Dart Programming, and Data Privacy. If you need specific policy details or technical clarification, feel free to ask about any module or reach out to your designated onboarding buddy!`;
  }

  return res.json({
    success: true,
    question,
    answer
  });
});

app.post('/documents/upload', upload.single('file'), (req: Request, res: Response) => {
  const userId = parseInt(req.body.user_id);
  const file = req.file;

  if (!file) {
    return res.status(400).json({ detail: "No PDF file provided or invalid file." });
  }

  const store = loadStore();
  const user = store.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ detail: "User not found." });
  }

  const uploadedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const docRecord: DocRecord = {
    id: store.documents.length + 1,
    user_id: userId,
    filename: file.originalname,
    uploaded_at: uploadedAt
  };
  store.documents.push(docRecord);
  saveStore(store);

  return res.json({
    success: true,
    document: {
      id: docRecord.id,
      user_id: userId,
      filename: file.originalname,
      uploaded_at: uploadedAt,
      size_bytes: file.size
    },
    message: `Document '${file.originalname}' uploaded successfully.`
  });
});

app.get('/documents/:user_id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.user_id);
  const store = loadStore();
  const docs = store.documents
    .filter(d => d.user_id === userId)
    .sort((a, b) => b.id - a.id);

  return res.json({ success: true, documents: docs });
});

// Start Vite middlewares
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OnboardAI Full-Stack Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
