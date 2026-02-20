// Supabase Auth Module for Bloom AI
const SUPABASE_URL = 'https://naklheyglbevqslblunj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SYFyVaZbF3m5dKtOWPQkww_5UC77eGs';

let supabase;

// Initialize Supabase client
function initSupabase() {
    if (typeof window.supabaseClient !== 'undefined') {
        supabase = window.supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error('Supabase JS library not loaded');
    }
    return supabase;
}

// ==================== Auth Methods ====================

// Email + Password Sign Up
async function signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

// Email + Password Sign In
async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

// Magic Link
async function signInWithMagicLink(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
}

// Google OAuth
async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
}

// GitHub OAuth
async function signInWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
}

// Sign Out
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// Get current user
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// ==================== Data Persistence ====================

// Save learning session
async function saveSession(sessionData) {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('learning_sessions')
        .upsert({
            id: sessionData.id || undefined,
            user_id: user.id,
            topic: sessionData.topic,
            current_doc: sessionData.currentDoc,
            mastery: sessionData.mastery,
            is_using_ai: sessionData.isUsingAI,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

    if (error) { console.error('Save session error:', error); return null; }
    return data;
}

// Save learning answer
async function saveAnswer(sessionId, answerData) {
    const { data, error } = await supabase
        .from('learning_answers')
        .insert({
            session_id: sessionId,
            doc_number: answerData.docNumber,
            questions: answerData.questions,
            answer: answerData.answer,
            ai_response: answerData.aiResponse
        })
        .select()
        .single();

    if (error) { console.error('Save answer error:', error); return null; }
    return data;
}

// Load user's learning sessions
async function loadSessions() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) { console.error('Load sessions error:', error); return []; }
    return data || [];
}

// Load answers for a session
async function loadAnswers(sessionId) {
    const { data, error } = await supabase
        .from('learning_answers')
        .select('*')
        .eq('session_id', sessionId)
        .order('doc_number', { ascending: true });

    if (error) { console.error('Load answers error:', error); return []; }
    return data || [];
}

// ==================== Auth UI ====================

function showAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab('login');
}

function hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
    document.body.style.overflow = '';
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

function showAuthMessage(msg, isError = false) {
    const el = document.getElementById('auth-message');
    el.textContent = msg;
    el.className = 'auth-message ' + (isError ? 'error' : 'success');
    el.style.display = 'block';
    if (!isError) setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function updateUserUI(user) {
    const loginBtn = document.getElementById('nav-auth-btn');
    const userMenu = document.getElementById('nav-user-menu');
    const userEmail = document.getElementById('nav-user-email');

    if (user) {
        loginBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        userEmail.textContent = user.email;
    } else {
        loginBtn.style.display = '';
        userMenu.style.display = 'none';
        userEmail.textContent = '';
    }
}

// ==================== Init ====================

function initAuth() {
    initSupabase();
    if (!supabase) return;

    // Auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user || null;
        updateUserUI(user);

        if (event === 'SIGNED_IN') {
            hideAuthModal();
            if (window._pendingLearningStart) {
                window._pendingLearningStart = false;
                if (typeof startLearning === 'function') startLearning();
            }
        }
        if (event === 'SIGNED_OUT') {
            updateUserUI(null);
        }
    });

    // Check initial session
    getCurrentUser().then(user => updateUserUI(user));

    // Nav login button
    const navAuthBtn = document.getElementById('nav-auth-btn');
    if (navAuthBtn) navAuthBtn.addEventListener('click', showAuthModal);

    // Nav logout button
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        await signOut();
        window.location.reload();
    });

    // Close modal
    document.getElementById('auth-modal-close')?.addEventListener('click', hideAuthModal);
    document.getElementById('auth-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal') hideAuthModal();
    });

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // Login form
    document.getElementById('login-submit')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) return showAuthMessage('请输入邮箱和密码', true);
        try {
            await signInWithEmail(email, password);
            showAuthMessage('登录成功！');
        } catch (e) { showAuthMessage(e.message, true); }
    });

    // Register form
    document.getElementById('register-submit')?.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        if (!email || !password) return showAuthMessage('请输入邮箱和密码', true);
        if (password !== confirm) return showAuthMessage('两次密码不一致', true);
        if (password.length < 6) return showAuthMessage('密码至少6位', true);
        try {
            await signUpWithEmail(email, password);
            showAuthMessage('注册成功！请检查邮箱确认链接。');
        } catch (e) { showAuthMessage(e.message, true); }
    });

    // Magic Link form
    document.getElementById('magiclink-submit')?.addEventListener('click', async () => {
        const email = document.getElementById('magiclink-email').value;
        if (!email) return showAuthMessage('请输入邮箱', true);
        try {
            await signInWithMagicLink(email);
            showAuthMessage('Magic Link 已发送到你的邮箱，请查收！');
        } catch (e) { showAuthMessage(e.message, true); }
    });

    // OAuth buttons
    document.getElementById('google-login-btn')?.addEventListener('click', signInWithGoogle);
    document.getElementById('github-login-btn')?.addEventListener('click', signInWithGitHub);
}

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', initAuth);
