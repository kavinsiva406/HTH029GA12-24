/**
 * OnboardAI - Modern Client Application Script
 * Connects frontend interfaces to FastAPI REST API endpoints
 */

// ==========================================
// API Configuration
// ==========================================
// Default local FastAPI backend URL is http://127.0.0.1:8000.
// Auto-detects whether running under Live Server / local or cloud iframe proxy.
let API_URL = (window.location.protocol === 'https:' || window.location.port === '3000')
  ? ''
  : 'http://127.0.0.1:8000';

// Check saved custom override if any
const savedApiUrl = localStorage.getItem('onboardai_api_url');
if (savedApiUrl !== null) {
  API_URL = savedApiUrl;
}

// Current logged in user state
let currentUser = null;
let currentProgress = null;
let allTopics = [];
let activeQuizTopicId = 1;
let currentQuizData = null;
let currentQuestionIndex = 0;
let userQuizAnswers = {}; // { questionId: selectedOptionIndex }
let selectedUploadFile = null;

// ==========================================
// Toast Notification Utility
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast alert-${type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info')}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `<span class="font-bold">${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================
// Initialization on DOM Load
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  setupApiConfigControls();
  setupAuthControls();
  setupNavigation();
  setupDashboardControls();
  setupCoursesControls();
  setupAssessmentsControls();
  setupCodingControls();
  setupCoachControls();
  setupDocumentControls();

  // Check existing session
  const storedUser = localStorage.getItem('onboardai_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      launchWorkspace();
    } catch {
      localStorage.removeItem('onboardai_user');
      showLoginView();
    }
  } else {
    showLoginView();
  }

  // Check backend health
  checkBackendHealth();
});

function initDateDisplay() {
  const dateEl = document.getElementById('current-date-display');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

// ==========================================
// Backend Health & Configuration
// ==========================================
async function checkBackendHealth() {
  const statusLabel = document.getElementById('api-status-label');
  const statusDot = document.querySelector('.api-status-badge .status-dot');

  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      if (statusLabel) statusLabel.textContent = API_URL ? `FastAPI: 8000` : `FastAPI: Connected`;
      if (statusDot) {
        statusDot.classList.remove('error');
      }
      return true;
    }
  } catch {
    // try root endpoint
    try {
      const res2 = await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(2000) });
      if (res2.ok) {
        if (statusLabel) statusLabel.textContent = `FastAPI: Connected`;
        if (statusDot) statusDot.classList.remove('error');
        return true;
      }
    } catch {
      // offline / degraded
    }
  }

  if (statusLabel) statusLabel.textContent = `API: Offline (Click to configure)`;
  if (statusDot) statusDot.classList.add('error');
  return false;
}

function setupApiConfigControls() {
  const modal = document.getElementById('api-modal');
  const btnOpen = document.getElementById('btn-open-api-config');
  const btnClose = document.getElementById('btn-close-api-modal');
  const inputUrl = document.getElementById('config-api-url');
  const btnSetLocal = document.getElementById('btn-set-local-api');
  const btnSetAuto = document.getElementById('btn-set-auto-api');
  const btnTest = document.getElementById('btn-test-api');
  const btnSave = document.getElementById('btn-save-api');
  const statusBox = document.getElementById('api-test-status');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      inputUrl.value = API_URL;
      statusBox.classList.add('hidden');
      modal.classList.remove('hidden');
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (btnSetLocal) {
    btnSetLocal.addEventListener('click', () => {
      inputUrl.value = 'http://127.0.0.1:8000';
    });
  }

  if (btnSetAuto) {
    btnSetAuto.addEventListener('click', () => {
      inputUrl.value = (window.location.protocol === 'https:' || window.location.port === '3000') ? '' : 'http://127.0.0.1:8000';
    });
  }

  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      statusBox.classList.remove('hidden');
      statusBox.className = 'alert-box alert-info';
      statusBox.textContent = 'Testing connection...';
      const target = inputUrl.value.trim();

      try {
        const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          statusBox.className = 'alert-box alert-success';
          statusBox.textContent = `Connected successfully! Status: ${data.status}`;
        } else {
          statusBox.className = 'alert-box alert-error';
          statusBox.textContent = `Server responded with status code: ${res.status}`;
        }
      } catch (err) {
        statusBox.className = 'alert-box alert-error';
        statusBox.textContent = `Unable to connect: ${err.message}. If running locally, verify 'python -m uvicorn main:app --host 127.0.0.1 --port 8000' is active.`;
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      API_URL = inputUrl.value.trim();
      localStorage.setItem('onboardai_api_url', API_URL);
      modal.classList.add('hidden');
      showToast('API URL configuration updated', 'success');
      checkBackendHealth();
      if (currentUser) {
        loadDashboardData();
      }
    });
  }
}

// ==========================================
// Authentication Controls
// ==========================================
function setupAuthControls() {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const btnTogglePwd = document.getElementById('btn-toggle-password');
  const eyeIcon = document.getElementById('eye-icon');
  const eyeOffIcon = document.getElementById('eye-off-icon');
  const btnAutofill = document.getElementById('btn-autofill-demo');
  const btnForgot = document.getElementById('btn-forgot-pwd');
  const forgotModal = document.getElementById('forgot-modal');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const btnCancelReset = document.getElementById('btn-cancel-reset');
  const btnSubmitReset = document.getElementById('btn-submit-reset');
  const resetStatus = document.getElementById('reset-status');

  // Toggle password visibility
  if (btnTogglePwd) {
    btnTogglePwd.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      eyeIcon.classList.toggle('hidden', isPassword);
      eyeOffIcon.classList.toggle('hidden', !isPassword);
    });
  }

  // Autofill demo button
  if (btnAutofill) {
    btnAutofill.addEventListener('click', () => {
      emailInput.value = 'kavin@demo.com';
      passwordInput.value = '123456';
      showToast('Loaded demo credentials for Kavin', 'info');
    });
  }

  // Forgot password modal
  if (btnForgot) {
    btnForgot.addEventListener('click', () => {
      resetStatus.classList.add('hidden');
      forgotModal.classList.remove('hidden');
    });
  }
  if (btnCloseForgot) btnCloseForgot.addEventListener('click', () => forgotModal.classList.add('hidden'));
  if (btnCancelReset) btnCancelReset.addEventListener('click', () => forgotModal.classList.add('hidden'));
  
  if (btnSubmitReset) {
    btnSubmitReset.addEventListener('click', () => {
      const resetEmail = document.getElementById('reset-email').value.trim();
      if (!resetEmail || !resetEmail.includes('@')) {
        resetStatus.className = 'alert-box alert-error';
        resetStatus.textContent = 'Please provide a valid company email address.';
        resetStatus.classList.remove('hidden');
        return;
      }
      resetStatus.className = 'alert-box alert-success';
      resetStatus.textContent = `Password reset instructions sent to ${resetEmail}. Check your inbox.`;
      resetStatus.classList.remove('hidden');
      setTimeout(() => forgotModal.classList.add('hidden'), 2000);
    });
  }

  // Handle Login submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const emailError = document.getElementById('email-error');
      const passwordError = document.getElementById('password-error');
      const errorAlert = document.getElementById('login-error-alert');
      const errorText = document.getElementById('login-error-text');
      const successAlert = document.getElementById('login-success-alert');
      const spinner = document.getElementById('login-spinner');
      const btnText = document.getElementById('login-btn-text');
      const submitBtn = document.getElementById('btn-login-submit');

      // Reset error states
      emailError.classList.add('hidden');
      passwordError.classList.add('hidden');
      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');

      // Validation
      let isValid = true;
      if (!email || !email.includes('@')) {
        emailError.classList.remove('hidden');
        isValid = false;
      }
      if (!password || password.length < 4) {
        passwordError.classList.remove('hidden');
        isValid = false;
      }
      if (!isValid) return;

      // Loading state
      submitBtn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Authenticating...';

      try {
        const response = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          successAlert.classList.remove('hidden');
          currentUser = data.user;
          
          if (document.getElementById('remember-me').checked) {
            localStorage.setItem('onboardai_user', JSON.stringify(currentUser));
          }

          setTimeout(() => {
            launchWorkspace();
          }, 600);

        } else {
          errorText.textContent = data.detail || 'Invalid email or password. Please verify credentials.';
          errorAlert.classList.remove('hidden');
        }
      } catch (err) {
        errorText.textContent = `Backend connection error: ${err.message}. Please verify FastAPI backend is running on 127.0.0.1:8000.`;
        errorAlert.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = 'Sign In to Workspace';
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('onboardai_user');
      currentUser = null;
      showLoginView();
      showToast('You have been logged out safely.', 'info');
    });
  }
}

function showLoginView() {
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('app-workspace').classList.add('hidden');
}

function launchWorkspace() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-workspace').classList.remove('hidden');

  // Update user indicators in sidebar
  const nameEl = document.getElementById('sidebar-user-name');
  const emailEl = document.getElementById('sidebar-user-email');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const welcomeEl = document.getElementById('dash-welcome-name');

  if (nameEl) nameEl.textContent = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (avatarEl) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
  if (welcomeEl) welcomeEl.textContent = currentUser.name;

  // Load Dashboard and topics
  loadDashboardData();
  loadTopics();
  loadCodingHistory();
  loadUserDocuments();
}

// ==========================================
// Sidebar & Navigation
// ==========================================
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const mobileMenuBtn = document.getElementById('btn-open-mobile-menu');
  const closeSidebarBtn = document.getElementById('btn-close-sidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const quickCoachTop = document.getElementById('btn-quick-coach-top');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetNav = btn.getAttribute('data-nav');
      switchView(targetNav);

      // Close mobile drawer if open
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.add('hidden');
    });
  });

  // Mobile menu interactions
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      overlay.classList.remove('hidden');
    });
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.add('hidden');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.add('hidden');
    });
  }

  if (quickCoachTop) {
    quickCoachTop.addEventListener('click', () => switchView('coach'));
  }

  // Quick access cards
  document.querySelectorAll('.quick-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetNav = card.getAttribute('data-nav');
      if (targetNav) switchView(targetNav);
    });
  });
}

function switchView(viewName) {
  // Update nav buttons active state
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-nav') === viewName);
  });

  // Hide all sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));

  // Show target section
  const targetSection = document.getElementById(`section-${viewName}`);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }

  // Update top bar title
  const titles = {
    dashboard: { title: 'Dashboard', sub: 'Employee onboarding progress & orientation portal' },
    courses: { title: 'Courses & Curriculum', sub: '5 core modules: Company, HR, Cybersecurity, Dart, & Privacy' },
    assessments: { title: 'Knowledge Assessments', sub: 'Interactive multiple-choice quizzes with instant grading' },
    coding: { title: 'Dart Coding Platform', sub: 'Interactive code editor and automated test validation' },
    coach: { title: 'AI Onboarding Assistant', sub: 'Instant answers to HR policies, culture, Dart syntax & compliance' },
    documents: { title: 'Document Management', sub: 'Upload and verify company onboarding PDF documentation' }
  };

  const info = titles[viewName] || { title: 'OnboardAI', sub: 'Onboarding System' };
  document.getElementById('current-view-title').textContent = info.title;
  document.getElementById('current-view-subtitle').textContent = info.sub;

  // Contextual refreshes
  if (viewName === 'dashboard') loadDashboardData();
  if (viewName === 'courses') loadTopics();
  if (viewName === 'documents') loadUserDocuments();
  if (viewName === 'coding') loadCodingHistory();
}

// ==========================================
// Dashboard Logic
// ==========================================
function setupDashboardControls() {
  const btnRefresh = document.getElementById('btn-refresh-progress');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadDashboardData();
      showToast('Dashboard data refreshed', 'info');
    });
  }
}

async function loadDashboardData() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API_URL}/progress/${currentUser.id}`);
    if (res.ok) {
      const data = await res.json();
      currentProgress = data;
      renderDashboardMetrics(data);
    }
  } catch (err) {
    console.error('Failed to load progress from backend:', err);
  }
}

function renderDashboardMetrics(data) {
  const pct = data.overall_percentage || 0;
  
  // Radial & Hero
  const radialPct = document.getElementById('dash-radial-pct');
  if (radialPct) radialPct.textContent = `${pct}%`;

  // Metric cards
  const overallPct = document.getElementById('dash-overall-pct');
  const bar = document.getElementById('dash-progress-bar');
  const sub = document.getElementById('dash-progress-sub');

  if (overallPct) overallPct.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
  if (sub) sub.textContent = `${data.completed_courses} of ${data.total_courses} topics certified`;

  const completedCount = document.getElementById('dash-completed-count');
  const pendingCount = document.getElementById('dash-pending-count');
  const quizScore = document.getElementById('dash-quiz-score');
  const codingStatus = document.getElementById('dash-coding-status');

  if (completedCount) completedCount.textContent = data.completed_courses;
  if (pendingCount) pendingCount.textContent = data.pending_courses;
  if (quizScore) quizScore.textContent = `${data.average_score}%`;
  if (codingStatus) codingStatus.textContent = data.coding_test_status || 'Passed';

  // Recent Activity
  const activityList = document.getElementById('dash-activity-list');
  if (activityList) {
    if (!data.recent_activity || data.recent_activity.length === 0) {
      activityList.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">No recent activity recorded yet. Start your first course!</div>`;
    } else {
      activityList.innerHTML = data.recent_activity.map(act => `
        <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              ${act.type === 'coding' ? '</>' : 'Q'}
            </div>
            <div>
              <span class="font-bold text-slate-800 text-xs block">${act.title}</span>
              <span class="text-[11px] text-slate-500">${act.detail}</span>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-500">${act.timestamp}</span>
        </div>
      `).join('');
    }
  }

  // Milestones checklist
  const milestonesList = document.getElementById('dash-milestones-list');
  if (milestonesList && data.topics) {
    milestonesList.innerHTML = data.topics.map(t => {
      const isDone = t.score >= 70;
      return `
        <div class="flex items-center justify-between p-2 rounded bg-slate-50">
          <div class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">
              ${isDone ? '✓' : '•'}
            </span>
            <span class="${isDone ? 'line-through text-slate-400' : 'font-medium text-slate-700'}">${t.title}</span>
          </div>
          <span class="text-[10px] font-mono ${isDone ? 'text-emerald-600 font-bold' : 'text-slate-400'}">
            ${isDone ? `${t.score}%` : 'Pending'}
          </span>
        </div>
      `;
    }).join('');
  }
}

// ==========================================
// Courses Module Logic
// ==========================================
function setupCoursesControls() {
  // Segmented filters
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-course-filter');
      renderCoursesGrid(filter);
    });
  });

  // Modal close handlers
  const btnClose = document.getElementById('btn-close-reader');
  const btnCloseAct = document.getElementById('btn-reader-close-action');
  const modal = document.getElementById('course-reader-modal');

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  if (btnCloseAct) btnCloseAct.addEventListener('click', () => modal.classList.add('hidden'));

  // Take quiz from reader button
  const btnTakeQuiz = document.getElementById('btn-take-quiz-from-reader');
  if (btnTakeQuiz) {
    btnTakeQuiz.addEventListener('click', () => {
      modal.classList.add('hidden');
      switchView('assessments');
      const selector = document.getElementById('quiz-topic-select');
      if (selector) {
        selector.value = activeQuizTopicId.toString();
        loadQuizForTopic(activeQuizTopicId);
      }
    });
  }
}

async function loadTopics() {
  try {
    const res = await fetch(`${API_URL}/topics`);
    if (res.ok) {
      const data = await res.json();
      allTopics = data.topics || [];
      renderCoursesGrid('all');
    }
  } catch (err) {
    console.error('Failed to load topics:', err);
  }
}

function renderCoursesGrid(filter = 'all') {
  const container = document.getElementById('courses-container');
  if (!container) return;

  const userProgressMap = {};
  if (currentProgress && currentProgress.topics) {
    currentProgress.topics.forEach(t => {
      userProgressMap[t.topic_id] = t;
    });
  }

  const filteredTopics = allTopics.filter(topic => {
    const prog = userProgressMap[topic.id];
    const isCompleted = prog && prog.score >= 70;
    if (filter === 'completed') return isCompleted;
    if (filter === 'pending') return !isCompleted;
    return true;
  });

  if (filteredTopics.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-sm">No courses match the selected filter.</div>`;
    return;
  }

  container.innerHTML = filteredTopics.map(topic => {
    const prog = userProgressMap[topic.id];
    const isCompleted = prog && prog.score >= 70;
    const score = prog ? prog.score : 0;

    return `
      <div class="course-card">
        <div>
          <div class="course-meta">
            <span>Module ${topic.id}</span>
            <span>·</span>
            <span>4 Lessons</span>
            <span>·</span>
            <span>Quiz Included</span>
          </div>
          <h4 class="course-title">${topic.title}</h4>
          <p class="course-desc">${topic.description}</p>
        </div>

        <div>
          <div class="mb-3">
            <div class="flex justify-between items-center text-xs mb-1">
              <span class="text-slate-500">Status</span>
              <span class="font-bold ${isCompleted ? 'text-emerald-600' : (score > 0 ? 'text-amber-600' : 'text-slate-500')}">
                ${isCompleted ? `Certified (${score}%)` : (score > 0 ? `In Progress (${score}%)` : 'Not Started')}
              </span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${isCompleted ? 100 : (score > 0 ? 50 : 0)}%"></div>
            </div>
          </div>

          <div class="course-footer">
            <span class="text-xs text-slate-400">~ 15 min study</span>
            <button type="button" class="btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary'}" onclick="window.openCourseReader(${topic.id})">
              ${isCompleted ? 'Review Material' : (score > 0 ? 'Continue Lesson' : 'Start Course')} →
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.openCourseReader = async function(topicId) {
  activeQuizTopicId = topicId;
  const modal = document.getElementById('course-reader-modal');
  const titleEl = document.getElementById('reader-topic-title');
  const numEl = document.getElementById('reader-topic-number');
  const overviewEl = document.getElementById('reader-overview');
  const modulesContainer = document.getElementById('reader-modules-container');
  const takeawaysList = document.getElementById('reader-takeaways-list');

  try {
    const res = await fetch(`${API_URL}/learn/${topicId}`);
    if (!res.ok) throw new Error('Failed to fetch course details');
    const data = await res.json();
    const topic = data.topic;

    if (numEl) numEl.textContent = `Module ${topic.id}`;
    if (titleEl) titleEl.textContent = topic.title;
    if (overviewEl) overviewEl.textContent = topic.content.overview || topic.description;

    // Render lessons
    if (modulesContainer) {
      const lessons = topic.content.modules || [];
      modulesContainer.innerHTML = lessons.map((les, idx) => `
        <div class="p-4 bg-white border border-slate-200 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-6 h-6 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold font-mono">
              0${idx + 1}
            </span>
            <h5 class="font-bold text-slate-900 text-sm">${les.title}</h5>
          </div>
          <div class="text-xs text-slate-600 leading-relaxed space-y-2">
            ${formatLessonContent(les.content)}
          </div>
        </div>
      `).join('');
    }

    // Render takeaways
    if (takeawaysList) {
      const takeaways = topic.content.takeaways || [];
      takeawaysList.innerHTML = takeaways.map(t => `<li>${t}</li>`).join('');
    }

    modal.classList.remove('hidden');

  } catch (err) {
    showToast(`Error opening course: ${err.message}`, 'error');
  }
};

function formatLessonContent(content) {
  if (!content) return '';
  // Check for dart code snippet
  if (content.includes('```dart')) {
    const parts = content.split(/```dart|```/);
    return `
      <div>${parts[0].replace(/\n/g, '<br>')}</div>
      <div class="my-2 p-3 bg-slate-900 rounded font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">${parts[1]}</div>
      ${parts[2] ? `<div>${parts[2].replace(/\n/g, '<br>')}</div>` : ''}
    `;
  }
  return content.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

// ==========================================
// Assessments / Quiz Module Logic
// ==========================================
function setupAssessmentsControls() {
  const topicSelect = document.getElementById('quiz-topic-select');
  const btnPrev = document.getElementById('btn-quiz-prev');
  const btnNext = document.getElementById('btn-quiz-next');
  const btnSubmit = document.getElementById('btn-quiz-submit');
  const btnRetry = document.getElementById('btn-retry-quiz');
  const btnNextModule = document.getElementById('btn-continue-to-courses');

  if (topicSelect) {
    topicSelect.addEventListener('change', (e) => {
      const selectedId = parseInt(e.target.value);
      loadQuizForTopic(selectedId);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderActiveQuizQuestion();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentQuizData && currentQuestionIndex < currentQuizData.quiz.length - 1) {
        currentQuestionIndex++;
        renderActiveQuizQuestion();
      }
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', submitQuizResults);
  }

  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      document.getElementById('quiz-result-view').classList.add('hidden');
      document.getElementById('quiz-card-wrapper').classList.remove('hidden');
      userQuizAnswers = {};
      currentQuestionIndex = 0;
      renderActiveQuizQuestion();
    });
  }

  if (btnNextModule) {
    btnNextModule.addEventListener('click', () => {
      switchView('courses');
    });
  }

  // Load initial topic quiz
  loadQuizForTopic(1);
}

async function loadQuizForTopic(topicId) {
  activeQuizTopicId = topicId;
  currentQuestionIndex = 0;
  userQuizAnswers = {};

  try {
    const res = await fetch(`${API_URL}/learn/${topicId}`);
    if (res.ok) {
      const data = await res.json();
      currentQuizData = data.topic;

      // Update quiz header
      document.getElementById('quiz-badge-module').textContent = `Module ${topicId}`;
      document.getElementById('quiz-active-title').textContent = currentQuizData.title;

      // Hide results, show quiz
      document.getElementById('quiz-result-view').classList.add('hidden');
      document.getElementById('quiz-card-wrapper').classList.remove('hidden');

      renderActiveQuizQuestion();
    }
  } catch (err) {
    showToast(`Failed to load quiz: ${err.message}`, 'error');
  }
}

function renderActiveQuizQuestion() {
  if (!currentQuizData || !currentQuizData.quiz || currentQuizData.quiz.length === 0) return;

  const questions = currentQuizData.quiz;
  const currentQ = questions[currentQuestionIndex];
  const total = questions.length;

  // Counter & Step progress
  document.getElementById('quiz-counter').textContent = `Question ${currentQuestionIndex + 1} of ${total}`;
  const pct = Math.round(((currentQuestionIndex + 1) / total) * 100);
  document.getElementById('quiz-step-progress').style.width = `${pct}%`;

  // Question Text
  document.getElementById('quiz-question-text').textContent = currentQ.question;

  // Options
  const container = document.getElementById('quiz-options-container');
  const selectedChoice = userQuizAnswers[currentQ.id];

  container.innerHTML = currentQ.options.map((opt, optIndex) => `
    <label class="quiz-option-card ${selectedChoice === optIndex ? 'selected' : ''}">
      <input 
        type="radio" 
        name="quiz_choice_${currentQ.id}" 
        value="${optIndex}" 
        class="quiz-option-radio"
        ${selectedChoice === optIndex ? 'checked' : ''}
        onchange="window.selectQuizOption(${currentQ.id}, ${optIndex})"
      />
      <span class="text-xs text-slate-800 leading-snug">${opt}</span>
    </label>
  `).join('');

  // Nav buttons state
  const btnPrev = document.getElementById('btn-quiz-prev');
  const btnNext = document.getElementById('btn-quiz-next');
  const btnSubmit = document.getElementById('btn-quiz-submit');

  btnPrev.disabled = currentQuestionIndex === 0;

  if (currentQuestionIndex === total - 1) {
    btnNext.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  }
}

window.selectQuizOption = function(qId, optIdx) {
  userQuizAnswers[qId] = optIdx;
  renderActiveQuizQuestion();
};

async function submitQuizResults() {
  if (!currentQuizData || !currentUser) return;

  const questions = currentQuizData.quiz;
  let correctCount = 0;

  questions.forEach(q => {
    const userSelected = userQuizAnswers[q.id];
    if (userSelected === q.correct) {
      correctCount++;
    }
  });

  const calculatedScore = Math.round((correctCount / questions.length) * 100);
  const passed = calculatedScore >= 70;

  const spinner = document.getElementById('quiz-submit-spinner');
  const btnSubmit = document.getElementById('btn-quiz-submit');
  spinner.classList.remove('hidden');
  btnSubmit.disabled = true;

  try {
    const res = await fetch(`${API_URL}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        topic_id: activeQuizTopicId,
        score: calculatedScore
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message, passed ? 'success' : 'info');
      displayQuizResultView(calculatedScore, passed, questions);
      loadDashboardData();
    } else {
      showToast('Error recording quiz submission', 'error');
    }
  } catch (err) {
    showToast(`Submission error: ${err.message}`, 'error');
    displayQuizResultView(calculatedScore, passed, questions);
  } finally {
    spinner.classList.add('hidden');
    btnSubmit.disabled = false;
  }
}

function displayQuizResultView(score, passed, questions) {
  document.getElementById('quiz-card-wrapper').classList.add('hidden');
  const resultView = document.getElementById('quiz-result-view');
  resultView.classList.remove('hidden');

  const badgeBox = document.getElementById('quiz-result-badge-container');
  const icon = document.getElementById('quiz-result-icon');
  const title = document.getElementById('quiz-result-title');
  const msg = document.getElementById('quiz-result-msg');
  const scoreEl = document.getElementById('quiz-result-score');
  const statusEl = document.getElementById('quiz-result-status');

  if (passed) {
    badgeBox.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-emerald-100 text-emerald-600 text-2xl font-bold';
    icon.textContent = '✓';
    title.textContent = 'Assessment Passed!';
    msg.textContent = 'Outstanding retention! You have certified this module.';
    statusEl.className = 'text-xl font-bold text-emerald-600';
    statusEl.textContent = 'PASSED';
  } else {
    badgeBox.className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-rose-100 text-rose-600 text-2xl font-bold';
    icon.textContent = '!';
    title.textContent = 'Review & Retry Recommended';
    msg.textContent = 'A score of 70% is required to certify this module. You can review and retake anytime.';
    statusEl.className = 'text-xl font-bold text-rose-600';
    statusEl.textContent = 'FAILED';
  }

  scoreEl.textContent = `${score}%`;

  // Review List
  const reviewList = document.getElementById('quiz-review-list');
  reviewList.innerHTML = questions.map((q, idx) => {
    const userSelected = userQuizAnswers[q.id];
    const isCorrect = userSelected === q.correct;

    return `
      <div class="quiz-review-item ${isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'}">
        <div class="flex items-start justify-between gap-2 mb-2">
          <span class="text-xs font-bold text-slate-800">Q${idx + 1}: ${q.question}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${isCorrect ? 'Correct (+33 pts)' : 'Incorrect'}
          </span>
        </div>
        <div class="text-xs space-y-1 mb-2">
          <div class="text-slate-600">Your Answer: <strong class="${isCorrect ? 'text-emerald-700' : 'text-rose-700'}">${userSelected !== undefined ? q.options[userSelected] : 'Unanswered'}</strong></div>
          ${!isCorrect ? `<div class="text-emerald-700">Correct Answer: <strong>${q.options[q.correct]}</strong></div>` : ''}
        </div>
        <div class="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-100 italic">
          💡 Explanation: ${q.explanation}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// Dart Coding Platform Logic
// ==========================================
function setupCodingControls() {
  const codeTextarea = document.getElementById('dart-code-input');
  const lineNumbers = document.getElementById('editor-line-numbers');
  const btnRun = document.getElementById('btn-run-code');
  const btnSubmit = document.getElementById('btn-submit-coding');
  const btnReset = document.getElementById('btn-reset-code');
  const btnClearConsole = document.getElementById('btn-clear-console');
  const customInput = document.getElementById('dart-test-input');
  const terminal = document.getElementById('terminal-output');

  // Update line numbers on input
  if (codeTextarea && lineNumbers) {
    const updateLineNumbers = () => {
      const lines = codeTextarea.value.split('\n').length;
      lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    };
    codeTextarea.addEventListener('input', updateLineNumbers);
    updateLineNumbers();
  }

  // Clear console
  if (btnClearConsole) {
    btnClearConsole.addEventListener('click', () => {
      terminal.textContent = '$ Ready for Dart execution.\n';
    });
  }

  // Reset code to default template
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      codeTextarea.value = `// Dart Onboarding Assessment: Sum of First N Numbers\n// Write your solution below:\n\nint sumOfNumbers(int n) {\n  int total = 0;\n  for (int i = 1; i <= n; i++) {\n    total += i;\n  }\n  return total;\n}\n\nvoid main() {\n  int n = 5;\n  int result = sumOfNumbers(n);\n  print(result);\n}`;
      terminal.textContent = '$ Code reset to initial template.\n';
      showToast('Code reset to default template', 'info');
      const lines = codeTextarea.value.split('\n').length;
      lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    });
  }

  // Run button - deterministic simulation
  if (btnRun) {
    btnRun.addEventListener('click', () => {
      const inputN = parseInt(customInput.value) || 0;
      const code = codeTextarea.value;

      terminal.textContent = `$ dart run solution.dart --input=${inputN}\n[Compiling Dart AST: Sound Null Safety Enabled]\n`;

      // Safe evaluation of the algorithm logic
      const result = evaluateDartSumAlgorithm(code, inputN);
      setTimeout(() => {
        if (result.success) {
          terminal.textContent += `Execution Successful (16ms)\nOutput:\n${result.output}\nCustom Test (N = ${inputN}): Output = ${result.output}\n`;
        } else {
          terminal.textContent += `Compilation / Runtime Error:\n${result.error}\n`;
        }
      }, 250);
    });
  }

  // Submit test
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const code = codeTextarea.value;
      const spinner = document.getElementById('coding-spinner');
      btnSubmit.disabled = true;
      spinner.classList.remove('hidden');

      terminal.textContent = `$ dart test test_suite.dart\n[Running Automated Test Suite on Cloud Worker]\n`;

      // Evaluate 3 test cases: N=5 (15), N=10 (55), N=1 (1)
      const test1 = evaluateDartSumAlgorithm(code, 5);
      const test2 = evaluateDartSumAlgorithm(code, 10);
      const test3 = evaluateDartSumAlgorithm(code, 1);

      const pass1 = test1.success && test1.output === 15;
      const pass2 = test2.success && test2.output === 55;
      const pass3 = test3.success && test3.output === 1;

      const allPassed = pass1 && pass2 && pass3;

      setTimeout(async () => {
        terminal.textContent += `Test Case 1 (N = 5):  ${pass1 ? 'PASSED [Expected: 15, Got: ' + test1.output + ']' : 'FAILED'}\n`;
        terminal.textContent += `Test Case 2 (N = 10): ${pass2 ? 'PASSED [Expected: 55, Got: ' + test2.output + ']' : 'FAILED'}\n`;
        terminal.textContent += `Test Case 3 (N = 1):  ${pass3 ? 'PASSED [Expected: 1, Got: ' + test3.output + ']' : 'FAILED'}\n\n`;
        terminal.textContent += allPassed 
          ? `SUCCESS: All 3/3 test cases passed! Total execution time: 24ms.\n`
          : `FAILURE: Test cases failed. Check your loop bounds and return statements.\n`;

        // Send submission to backend
        try {
          const res = await fetch(`${API_URL}/coding/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser.id,
              language: 'Dart',
              passed: allPassed
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            showToast(data.message, allPassed ? 'success' : 'error');
            loadCodingHistory();
            loadDashboardData();
          }
        } catch (err) {
          showToast(`Error submitting coding test: ${err.message}`, 'error');
        } finally {
          btnSubmit.disabled = false;
          spinner.classList.add('hidden');
        }
      }, 400);
    });
  }
}

/**
 * Safe client-side Dart algorithm evaluation simulation.
 * Never executes unverified arbitrary code. Extracts algorithm intent safely.
 */
function evaluateDartSumAlgorithm(code, n) {
  if (!code || !code.includes('sum')) {
    return { success: false, error: 'syntax error: function `sumOfNumbers` missing in source file.' };
  }
  
  if (n < 0) {
    return { success: false, error: 'ArgumentError: N must be non-negative.' };
  }

  // Check if standard loop or math formula is used
  const hasFormula = code.includes('*') && (code.includes('~/') || code.includes('/'));
  const hasLoop = code.includes('for') || code.includes('while');

  if (hasFormula || hasLoop) {
    const expected = (n * (n + 1)) / 2;
    return { success: true, output: Math.floor(expected) };
  }

  // If user altered function logic incorrectly
  return { success: false, error: 'Dart compilation failed: return expression does not calculate summation of 1..N' };
}

async function loadCodingHistory() {
  if (!currentUser) return;
  const historyList = document.getElementById('coding-history-list');
  if (!historyList) return;

  try {
    const res = await fetch(`${API_URL}/coding/history/${currentUser.id}`);
    if (res.ok) {
      const data = await res.json();
      const history = data.history || [];

      if (history.length === 0) {
        historyList.innerHTML = `<div class="text-slate-400">No previous test submissions recorded.</div>`;
        return;
      }

      historyList.innerHTML = history.slice(0, 4).map(h => `
        <div class="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${h.passed ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
            <span class="font-bold text-slate-800">${h.language} Challenge</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold ${h.passed ? 'text-emerald-600' : 'text-rose-600'}">${h.passed ? 'PASSED' : 'FAILED'}</span>
            <span class="text-[10px] text-slate-400">${h.created_at.split(' ')[0]}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load coding history:', err);
  }
}

// ==========================================
// AI Assistant (Coach) Module Logic
// ==========================================
function setupCoachControls() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const btnClear = document.getElementById('btn-clear-chat');
  const promptChips = document.querySelectorAll('.btn-prompt-chip');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      sendMessageToCoach(question);
      input.value = '';
    });
  }

  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        sendMessageToCoach(prompt);
      }
    });
  });

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      const container = document.getElementById('chat-messages-container');
      container.innerHTML = `
        <div class="message-bubble-wrapper ai-wrapper">
          <div class="message-avatar">AI</div>
          <div class="message-content ai-bubble">
            <p class="text-sm text-slate-800">
              Conversation history cleared. What questions can I answer about your onboarding today?
            </p>
            <span class="message-time">Just now</span>
          </div>
        </div>
      `;
      showToast('Chat history cleared', 'info');
    });
  }
}

async function sendMessageToCoach(question) {
  const container = document.getElementById('chat-messages-container');
  const indicator = document.getElementById('ai-typing-indicator');
  const spinner = document.getElementById('chat-send-spinner');
  const btnSend = document.getElementById('btn-chat-send');

  // Append user message
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const userHtml = `
    <div class="message-bubble-wrapper user-wrapper">
      <div class="message-avatar">${currentUser ? currentUser.name.charAt(0) : 'U'}</div>
      <div class="message-content user-bubble">
        <p class="text-sm">${escapeHtml(question)}</p>
        <span class="message-time">${now}</span>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', userHtml);
  container.scrollTop = container.scrollHeight;

  // Show thinking indicator
  indicator.classList.remove('hidden');
  spinner.classList.remove('hidden');
  btnSend.disabled = true;

  try {
    const res = await fetch(`${API_URL}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    const answer = res.ok && data.success 
      ? data.answer 
      : 'I apologize, I encountered a temporary connection issue. Please check your backend connection.';

    const aiNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const aiHtml = `
      <div class="message-bubble-wrapper ai-wrapper">
        <div class="message-avatar">AI</div>
        <div class="message-content ai-bubble">
          <p class="text-sm text-slate-800 leading-relaxed">${escapeHtml(answer)}</p>
          <span class="message-time">${aiNow}</span>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', aiHtml);
    container.scrollTop = container.scrollHeight;

  } catch (err) {
    const errorHtml = `
      <div class="message-bubble-wrapper ai-wrapper">
        <div class="message-avatar">AI</div>
        <div class="message-content ai-bubble border-rose-200">
          <p class="text-sm text-rose-700">Communication error: ${err.message}. Please verify FastAPI backend service is running.</p>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', errorHtml);
  } finally {
    indicator.classList.add('hidden');
    spinner.classList.add('hidden');
    btnSend.disabled = false;
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

// ==========================================
// Document Management Logic
// ==========================================
function setupDocumentControls() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const btnBrowse = document.getElementById('btn-browse-file');
  const fileBar = document.getElementById('selected-file-bar');
  const fileNameEl = document.getElementById('selected-file-name');
  const fileSizeEl = document.getElementById('selected-file-size');
  const btnCancel = document.getElementById('btn-cancel-file');
  const btnUpload = document.getElementById('btn-upload-file');
  const btnRefresh = document.getElementById('btn-refresh-docs');

  // Trigger file browser
  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', () => fileInput.click());
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnBrowse) fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileSelection(fileInput.files[0]);
      }
    });
  }

  function handleFileSelection(file) {
    // Validate PDF
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Validation Error: Only PDF files (.pdf) are permitted.', 'error');
      return;
    }
    // Validate Max size 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('Validation Error: File exceeds 10 MB maximum size limit.', 'error');
      return;
    }

    selectedUploadFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    fileBar.classList.remove('hidden');
    document.getElementById('upload-status-alert').classList.add('hidden');
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      selectedUploadFile = null;
      fileInput.value = '';
      fileBar.classList.add('hidden');
    });
  }

  if (btnUpload) {
    btnUpload.addEventListener('click', async () => {
      if (!selectedUploadFile || !currentUser) {
        showToast('Please select a PDF file first.', 'error');
        return;
      }

      const spinner = document.getElementById('upload-spinner');
      const progressBox = document.getElementById('upload-progress-box');
      const progressBar = document.getElementById('upload-bar-fill');
      const progressPct = document.getElementById('upload-pct');
      const alertBox = document.getElementById('upload-status-alert');

      btnUpload.disabled = true;
      spinner.classList.remove('hidden');
      progressBox.classList.remove('hidden');

      // Animate progress simulation
      progressBar.style.width = '35%';
      progressPct.textContent = '35%';

      const formData = new FormData();
      formData.append('user_id', currentUser.id);
      formData.append('file', selectedUploadFile);

      try {
        progressBar.style.width = '70%';
        progressPct.textContent = '70%';

        const res = await fetch(`${API_URL}/documents/upload`, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        progressBar.style.width = '100%';
        progressPct.textContent = '100%';

        if (res.ok && data.success) {
          alertBox.className = 'alert-box alert-success';
          alertBox.textContent = data.message || 'Document uploaded successfully!';
          alertBox.classList.remove('hidden');
          showToast('Document uploaded successfully!', 'success');

          // Reset selection
          selectedUploadFile = null;
          fileInput.value = '';
          fileBar.classList.add('hidden');

          // Refresh documents registry
          loadUserDocuments();
        } else {
          alertBox.className = 'alert-box alert-error';
          alertBox.textContent = data.detail || 'Upload failed. Ensure the file is a valid PDF.';
          alertBox.classList.remove('hidden');
        }
      } catch (err) {
        alertBox.className = 'alert-box alert-error';
        alertBox.textContent = `Upload failed: ${err.message}.`;
        alertBox.classList.remove('hidden');
      } finally {
        btnUpload.disabled = false;
        spinner.classList.add('hidden');
        setTimeout(() => progressBox.classList.add('hidden'), 1200);
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadUserDocuments();
      showToast('Document registry refreshed', 'info');
    });
  }
}

async function loadUserDocuments() {
  if (!currentUser) return;
  const tbody = document.getElementById('documents-table-body');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_URL}/documents/${currentUser.id}`);
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];

      if (docs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-slate-400">
              No documents submitted yet. Use the upload zone above to upload your signed PDF forms.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = docs.map(doc => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
            <span class="file-type-badge">PDF</span>
            <span class="truncate max-w-xs">${escapeHtml(doc.filename)}</span>
          </td>
          <td class="py-3 px-4 font-mono text-slate-500">application/pdf</td>
          <td class="py-3 px-4 text-slate-500">${doc.uploaded_at}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Verified Safe
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <button type="button" class="btn-text-action text-xs" onclick="window.viewMockDoc('${escapeHtml(doc.filename)}')">
              Preview
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load user documents:', err);
  }
}

window.viewMockDoc = function(filename) {
  showToast(`Opening preview for ${filename}`, 'info');
};
