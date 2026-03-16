/**
 * store.js - In-memory data store for SecureExam
 * Simulates server-side storage using sessionStorage for persistence across pages
 * In production, this would be a backend database
 */

const Store = (() => {

  const KEYS = {
    EXAMS: 'se_exams',
    USERS: 'se_users',
    SESSIONS: 'se_sessions',
    AUDIT_LOG: 'se_audit',
    CURRENT_USER: 'se_current_user'
  };

  /* ---------- GENERIC ---------- */
  function get(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key)) || null;
    } catch { return null; }
  }

  function set(key, val) {
    sessionStorage.setItem(key, JSON.stringify(val));
  }

  /* ---------- USERS ---------- */
  function getUsers() {
    return get(KEYS.USERS) || _defaultUsers();
  }

  function _defaultUsers() {
    const users = [
      { id: 'u1', name: 'Dr. Sharma', email: 'teacher@exam.edu', password: 'teacher123', role: 'teacher' },
      { id: 'u2', name: 'Arjun Mehta', email: 'student1@exam.edu', password: 'student123', role: 'student', studentId: 'CS2021001' },
      { id: 'u3', name: 'Priya Patel', email: 'student2@exam.edu', password: 'student456', role: 'student', studentId: 'CS2021002' },
      { id: 'u4', name: 'Rahul Singh', email: 'student3@exam.edu', password: 'student789', role: 'student', studentId: 'CS2021003' }
    ];
    set(KEYS.USERS, users);
    return users;
  }

  function getUserByEmail(email) {
    return getUsers().find(u => u.email === email);
  }

  function getUserById(id) {
    return getUsers().find(u => u.id === id);
  }

  function addUser(user) {
    const users = getUsers();
    user.id = 'u' + Date.now();
    users.push(user);
    set(KEYS.USERS, users);
    return user;
  }

  /* ---------- AUTH ---------- */
  function login(email, password) {
    const user = getUserByEmail(email);
    if (!user) return { success: false, error: 'User not found' };
    if (user.password !== password) return { success: false, error: 'Incorrect password' };
    const session = { userId: user.id, role: user.role, loginTime: new Date().toISOString() };
    set(KEYS.CURRENT_USER, { ...user, session });
    logAudit('LOGIN', user.id, `User ${user.name} logged in`);
    return { success: true, user };
  }

  function logout() {
    const user = getCurrentUser();
    if (user) logAudit('LOGOUT', user.id, `User ${user.name} logged out`);
    sessionStorage.removeItem(KEYS.CURRENT_USER);
  }

  function getCurrentUser() {
    return get(KEYS.CURRENT_USER);
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function requireRole(role) {
    const user = getCurrentUser();
    if (!user) return false;
    return user.role === role;
  }

  /* ---------- EXAMS ---------- */
  function getExams() {
    return get(KEYS.EXAMS) || [];
  }

  function getExamById(id) {
    return getExams().find(e => e.id === id);
  }

  function getExamsForTeacher(teacherId) {
    return getExams().filter(e => e.createdBy === teacherId);
  }

  function getExamsForStudent(studentId) {
    // Students see exams they are enrolled in
    return getExams().filter(e => e.enrolledStudents && e.enrolledStudents.includes(studentId));
  }

  function saveExam(exam) {
    const exams = getExams();
    const idx = exams.findIndex(e => e.id === exam.id);
    if (idx >= 0) {
      exams[idx] = exam;
    } else {
      exams.push(exam);
    }
    set(KEYS.EXAMS, exams);
    return exam;
  }

  function createExam(data) {
    const exam = {
      id: 'ex_' + Date.now(),
      title: data.title,
      subject: data.subject,
      duration: data.duration,  // minutes
      scheduledTime: data.scheduledTime,   // ISO string
      decryptWindow: data.decryptWindow || 5, // minutes before exam time to allow decrypt
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      status: 'draft',  // draft | encrypted | scheduled | active | completed
      enrolledStudents: data.enrolledStudents || [],
      encryptedPackage: null,   // filled after encryption
      submissions: []
    };
    return saveExam(exam);
  }

  function updateExamStatus(id, status) {
    const exam = getExamById(id);
    if (!exam) return null;
    exam.status = status;
    return saveExam(exam);
  }

  function attachEncryptedPackage(examId, pkg) {
    const exam = getExamById(examId);
    if (!exam) return null;
    exam.encryptedPackage = pkg;
    exam.status = 'encrypted';
    return saveExam(exam);
  }

  function addSubmission(examId, submission) {
    const exam = getExamById(examId);
    if (!exam) return null;
    exam.submissions = exam.submissions || [];
    const existing = exam.submissions.findIndex(s => s.studentId === submission.studentId);
    if (existing >= 0) {
      exam.submissions[existing] = submission;
    } else {
      exam.submissions.push(submission);
    }
    return saveExam(exam);
  }

  function getSubmission(examId, studentId) {
    const exam = getExamById(examId);
    if (!exam) return null;
    return (exam.submissions || []).find(s => s.studentId === studentId);
  }

  /* ---------- TIME CHECK ---------- */
  function isExamUnlocked(exam) {
    if (!exam.scheduledTime || !exam.encryptedPackage) return false;
    const now = Date.now();
    const examTime = new Date(exam.scheduledTime).getTime();
    const windowMs = (exam.decryptWindow || 5) * 60 * 1000;
    return now >= (examTime - windowMs);
  }

  function getExamPhase(exam) {
    if (!exam.scheduledTime) return 'unscheduled';
    const now = Date.now();
    const start = new Date(exam.scheduledTime).getTime();
    const durationMs = (exam.duration || 60) * 60 * 1000;
    const end = start + durationMs;
    const windowMs = (exam.decryptWindow || 5) * 60 * 1000;

    if (now < start - windowMs) return 'upcoming';
    if (now < start) return 'unlocking_soon';
    if (now < end) return 'active';
    return 'ended';
  }

  /* ---------- AUDIT LOG ---------- */
  function logAudit(action, userId, message, meta = {}) {
    const logs = get(KEYS.AUDIT_LOG) || [];
    logs.unshift({
      id: 'log_' + Date.now(),
      action,
      userId,
      message,
      meta,
      timestamp: new Date().toISOString()
    });
    // Keep last 200 entries
    set(KEYS.AUDIT_LOG, logs.slice(0, 200));
  }

  function getAuditLog(limit = 50) {
    return (get(KEYS.AUDIT_LOG) || []).slice(0, limit);
  }

  /* ---------- SEED DEMO DATA ---------- */
  function seedDemoData() {
    if (getExams().length > 0) return; // already seeded

    const teacher = getUserByEmail('teacher@exam.edu');
    const student1 = getUserByEmail('student1@exam.edu');
    const student2 = getUserByEmail('student2@exam.edu');
    const student3 = getUserByEmail('student3@exam.edu');

    const now = new Date();
    const in1hr = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const in3hr = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    createExam({
      title: 'Data Structures & Algorithms - Mid Sem',
      subject: 'CS301',
      duration: 120,
      scheduledTime: in1hr,
      decryptWindow: 10,
      createdBy: teacher.id,
      enrolledStudents: [student1.id, student2.id, student3.id]
    });

    createExam({
      title: 'Computer Networks - Unit Test 1',
      subject: 'CS302',
      duration: 60,
      scheduledTime: in3hr,
      decryptWindow: 5,
      createdBy: teacher.id,
      enrolledStudents: [student1.id, student2.id]
    });

    createExam({
      title: 'Operating Systems - Final Exam',
      subject: 'CS303',
      duration: 180,
      scheduledTime: yesterday,
      decryptWindow: 5,
      createdBy: teacher.id,
      enrolledStudents: [student1.id, student2.id, student3.id]
    });
  }

  return {
    getUsers, getUserByEmail, getUserById, addUser,
    login, logout, getCurrentUser, isLoggedIn, requireRole,
    getExams, getExamById, getExamsForTeacher, getExamsForStudent,
    saveExam, createExam, updateExamStatus, attachEncryptedPackage,
    addSubmission, getSubmission,
    isExamUnlocked, getExamPhase,
    logAudit, getAuditLog,
    seedDemoData
  };
})();

window.Store = Store;
