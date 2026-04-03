

```javascript
/* ================================================================
   LOTRI PARADIS — app.js
   Firebase Auth + Firestore + Lottery Game Logic
   Language: Haitian Creole
   ================================================================ */

// ── Firebase Configuration ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDtFQcoxDMxJ3rWECS2BmugAXPENO_38xI",
  authDomain: "paradis-projet.firebaseapp.com",
  projectId: "paradis-projet",
  storageBucket: "paradis-projet.appspot.com",
  messagingSenderId: "105286383959",
  appId: "1:105286383959:web:7f35bac95bda78bb5ca612"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Game Constants ─────────────────────────────────────────────
const STARTING_COINS  = 1000;
const PLAY_COST       = 50;
const TOTAL_NUMBERS   = 49;
const PICK_COUNT      = 6;
const MAX_HISTORY     = 5;

const REWARDS = {
  3: 100,
  4: 300,
  5: 700,
  6: 1500
};

// ── State ──────────────────────────────────────────────────────
let currentUser  = null;
let userCoins    = 0;
let selectedNums = [];
let gameHistory  = [];
let isPlaying    = false;

// ─────────────────────────────────────────────────────────────
// AUTH STATE LISTENER
// ─────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  hideElement('loadingScreen');

  if (user) {
    currentUser = user;
    await loadUserData(user.uid);
    showGameScreen();
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

// ─────────────────────────────────────────────────────────────
// SCREEN MANAGEMENT
// ─────────────────────────────────────────────────────────────
function showAuthScreen() {
  hideElement('gameScreen');
  showElement('authScreen');
}

function showGameScreen() {
  hideElement('authScreen');
  showElement('gameScreen');
  buildNumberGrid();
  renderBalance();
  renderHistory();
  renderSelectedNumbers();
}

// ─────────────────────────────────────────────────────────────
// AUTH FUNCTIONS
// ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  if (tab === 'login') {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
    showElement('loginForm');
    hideElement('signupForm');
    hideElement('loginError');
  } else {
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
    showElement('signupForm');
    hideElement('loginForm');
    hideElement('signupError');
  }
}

async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showError('loginError', '⚠️ Tanpri ranpli tout chan yo.');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showError('loginError', getCreoleError(err.code));
  }
}

async function signup() {
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!name || !email || !password) {
    showError('signupError', '⚠️ Tanpri ranpli tout chan yo.');
    return;
  }
  if (password.length < 6) {
    showError('signupError', '⚠️ Modpas la dwe gen omwen 6 karaktè.');
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await createUserProfile(cred.user.uid, name);
  } catch (err) {
    showError('signupError', getCreoleError(err.code));
  }
}

async function logout() {
  try {
    await auth.signOut();
    selectedNums = [];
    gameHistory  = [];
    userCoins    = 0;
    currentUser  = null;
    hideElement('resultCard');
    showToast('👋 Ou dekonekte. Arevwa!');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// FIRESTORE — User Data
// ─────────────────────────────────────────────────────────────
async function createUserProfile(uid, name) {
  await db.collection('users').doc(uid).set({
    name:      name,
    coins:     STARTING_COINS,
    history:   [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function loadUserData(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const data  = doc.data();
      userCoins   = data.coins   || STARTING_COINS;
      gameHistory = data.history || [];
      const name  = data.name || currentUser.email.split('@')[0];
      document.getElementById('userName').textContent = name;
    } else {
      const name = currentUser.email.split('@')[0];
      await createUserProfile(uid, name);
      userCoins   = STARTING_COINS;
      gameHistory = [];
      document.getElementById('userName').textContent = name;
    }
  } catch (err) {
    console.error('loadUserData error:', err);
    userCoins   = STARTING_COINS;
    gameHistory = [];
  }
}

async function saveUserData() {
  if (!currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).update({
      coins:   userCoins,
      history: gameHistory
    });
  } catch (err) {
    console.error('saveUserData error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// GAME — Number Grid
// ─────────────────────────────────────────────────────────────
function buildNumberGrid() {
  const grid = document.getElementById('numberGrid');
  grid.innerHTML = '';

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    const btn = document.createElement('button');
    btn.className   = 'num-btn';
    btn.textContent = i;
    btn.dataset.num = i;
    btn.onclick     = () => toggleNumber(i, btn);
    grid.appendChild(btn);
  }
}

function toggleNumber(num, btn) {
  if (selectedNums.includes(num)) {
    selectedNums = selectedNums.filter(n => n !== num);
    btn.classList.remove('selected');
  } else {
    if (selectedNums.length >= PICK_COUNT) {
      showToast(`⚠️ Ou deja chwazi ${PICK_COUNT} nimewo!`);
      return;
    }
    selectedNums.push(num);
    btn.classList.add('selected');
  }
  renderSelectedNumbers();
}

function autoSelect() {
  clearSelection();
  const pool = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
  shuffle(pool);
  selectedNums = pool.slice(0, PICK_COUNT).sort((a, b) => a - b);

  selectedNums.forEach(num => {
    const btn = document.querySelector(`[data-num="${num}"]`);
    if (btn) btn.classList.add('selected');
  });
  renderSelectedNumbers();
  showToast('🎲 Nimewo chwazi otomatikman!');
}

function clearSelection() {
  selectedNums = [];
  document.querySelectorAll('.num-btn.selected').forEach(b => b.classList.remove('selected'));
  renderSelectedNumbers();
  hideElement('resultCard');
}

function renderSelectedNumbers() {
  const container = document.getElementById('selectedNumbers');
  if (selectedNums.length === 0) {
    container.innerHTML = '<span class="empty-pick">— — — — — —</span>';
  } else {
    container.innerHTML = selectedNums
      .slice()
      .sort((a, b) => a - b)
      .map(n => `<div class="pick-bubble">${n}</div>`)
      .join('');
  }
}

// ─────────────────────────────────────────────────────────────
// GAME — Core Lottery Logic
// ─────────────────────────────────────────────────────────────
async function playLottery() {
  if (isPlaying) return;
  if (selectedNums.length < PICK_COUNT) {
    showToast(`⚠️ Chwazi ${PICK_COUNT} nimewo anvan!`);
    return;
  }
  if (userCoins < PLAY_COST) {
    showToast('❌ Pa ase kob! Ou bezwen 50 kob.');
    return;
  }

  isPlaying = true;
  document.getElementById('playBtn').disabled = true;

  userCoins -= PLAY_COST;
  renderBalance();

  const pool    = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
  shuffle(pool);
  const drawn    = pool.slice(0, PICK_COUNT).sort((a, b) => a - b);
  const userPick = [...selectedNums].sort((a, b) => a - b);

  const matches     = userPick.filter(n => drawn.includes(n));
  const matchCount  = matches.length;
  const reward      = REWARDS[matchCount] || 0;

  userCoins += reward;
  renderBalance(reward > 0);

  await showResult(drawn, userPick, matches, matchCount, reward);

  const record = {
    date:    new Date().toLocaleDateString('fr-HT'),
    drawn:   drawn,
    picked:  userPick,
    matches: matchCount,
    reward:  reward,
    cost:    PLAY_COST,
    net:     reward - PLAY_COST
  };
  gameHistory.unshift(record);
  if (gameHistory.length > MAX_HISTORY) gameHistory = gameHistory.slice(0, MAX_HISTORY);
  renderHistory();

  await saveUserData();

  isPlaying = false;
  document.getElementById('playBtn').disabled = false;
}

async function showResult(drawn, userPick, matches, matchCount, reward) {
  const card = document.getElementById('resultCard');
  showElement('resultCard');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const titleEl = document.getElementById('resultTitle');
  if (reward > 0) {
    titleEl.textContent = '🎉 Ou Genyen!';
    titleEl.className   = 'result-title result-win';
    launchConfetti();
  } else {
    titleEl.textContent = '😢 Ou Pèdi';
    titleEl.className   = 'result-title result-lose';
  }

  // Balles tirées avec animation
  const drawnContainer = document.getElementById('drawNumbers');
  drawnContainer.innerHTML = '';
  for (let i = 0; i < drawn.length; i++) {
    await delay(120 * i);
    const ball = document.createElement('div');
    ball.className   = `draw-ball ${matches.includes(drawn[i]) ? 'ball-match' : 'ball-normal'}`;
    ball.textContent = drawn[i];
    drawnContainer.appendChild(ball);
  }

  // Balles utilisateur
  const userContainer = document.getElementById('userNumbers');
  userContainer.innerHTML = userPick.map(n => `
    <div class="draw-ball ${matches.includes(n) ? 'ball-user-match' : 'ball-normal'}">${n}</div>
  `).join('');

  // Correspondances
  document.getElementById('matchInfo').textContent =
    `✅ ${matchCount} korespondans sou ${PICK_COUNT}`;

  // Récompense
  const rewardEl = document.getElementById('rewardInfo');
  if (reward > 0) {
    rewardEl.textContent    = `+${reward} 🪙 kob!`;
    rewardEl.style.color    = 'var(--accent-green)';
    rewardEl.style.display  = 'block';
  } else {
    rewardEl.textContent    = `-${PLAY_COST} 🪙 kob`;
    rewardEl.style.color    = 'var(--accent-red)';
    rewardEl.style.display  = 'block';
  }
}

// ─────────────────────────────────────────────────────────────
// UI — Balance & History
// ─────────────────────────────────────────────────────────────
function renderBalance(animate = false) {
  const el = document.getElementById('coinBalance');
  el.textContent = userCoins.toLocaleString();
  if (animate) {
    el.classList.remove('coin-bounce');
    void el.offsetWidth;
    el.classList.add('coin-bounce');
    setTimeout(() => el.classList.remove('coin-bounce'), 400);
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!gameHistory || gameHistory.length === 0) {
    list.innerHTML = '<p class="history-empty">Pa gen istwa ankò. Jwe premye jwèt ou!</p>';
    return;
  }

  list.innerHTML = gameHistory.map(g => `
    <div class="history-item">
      <div class="history-left">
        <span class="history-date">📅 ${g.date}</span>
        <span class="history-nums">🎱 ${g.picked.join(' · ')}</span>
        <span class="history-nums" style="color:var(--text-muted);font-weight:400">
          Tiraj: ${g.drawn.join(' · ')}
        </span>
      </div>
      <div class="history-right">
        <span class="history-result ${g.reward > 0 ? 'history-win' : 'history-lose'}">
          ${g.reward > 0 ? '🏆 ' + g.matches + ' match' : '😢 ' + g.matches + ' match'}
        </span>
        <span class="history-coins ${g.net >= 0 ? 'coins-gained' : 'coins-lost'}">
          ${g.net >= 0 ? '+' : ''}${g.net} 🪙
        </span>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
// CONFETTI
// ─────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#FFD700','#FF4D6D','#1A6FFF','#00C9A7','#FF9F43','#A29BFE'];

function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const piece     = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:                ${Math.random() * 100}vw;
      top:                 ${-10 + Math.random() * 20}px;
      background:          ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
      width:               ${6 + Math.random() * 8}px;
      height:              ${6 + Math.random() * 8}px;
      border-radius:       ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration:  ${1.5 + Math.random() * 2}s;
      animation-delay:     ${Math.random() * 0.8}s;
    `;
    container.appendChild(piece);
  }
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  showElement('toast');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideElement('toast'), 2800);
}

// ─────────────────────────────────────────────────────────────
// ERROR MESSAGES
// ─────────────────────────────────────────────────────────────
function getCreoleError(code) {
  const map = {
    'auth/invalid-email':          '⚠️ Imel sa a pa valid.',
    'auth/user-not-found':         '⚠️ Pa gen kont avèk imel sa a.',
    'auth/wrong-password':         '⚠️ Modpas ou pa kòrèk.',
    'auth/email-already-in-use':   '⚠️ Imel sa a deja itilize.',
    'auth/weak-password':          '⚠️ Modpas la twò fèb. (min 6 karaktè)',
    'auth/too-many-requests':      '⚠️ Twòp eseye. Eseye ankò pita.',
    'auth/network-request-failed': '⚠️ Pa gen koneksyon entènèt.',
    'auth/invalid-credential':     '⚠️ Imel oswa modpas pa kòrèk.',
  };
  return map[code] || '⚠️ Yon erè te rive. Eseye ankò.';
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}
```

Kopye tout sa a, kole nan `app.js` ou nan Acode. ✅

