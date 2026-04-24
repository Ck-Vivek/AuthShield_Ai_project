import { getDashboard, getTools, getGraph, getAlerts, simulateBreach, resolveAlert as resolveAlertApi } from './src/services/api.js';

let dashboardData = null;
let toolsData = [];
let graphData = null;
let alertsData = [];
let isLoggedIn = false;
let currentUser = null;
let pinnedNode = null;
let isTooltipPinned = false;
let tooltipNode = null;
let toolsSearchQuery = '';
let toolsCategoryFilter = 'all';
let toolsRiskFilter = 'all';
let toolsSort = 'risk_desc';
const revokedToolIds = new Set();

const ATTACK_VECTOR_INFO = {
  token_hijack: {
    label: 'Fake OAuth Login Redirect',
    shortMeaning: 'A user is tricked into logging in through a fake OAuth screen and the token is stolen.',
    clue: 'You may notice unusual redirect URLs or login prompts outside your normal auth flow.',
    timeMultiplier: 0.85,
    radiusMultiplier: 1.1,
  },
  scope_elevation: {
    label: 'Permission Scope Escalation',
    shortMeaning: 'An app asks for much higher permissions than expected, then uses that power to spread.',
    clue: 'You may see sudden requests for admin or write-all scopes from a previously low-risk app.',
    timeMultiplier: 1.0,
    radiusMultiplier: 1.2,
  },
  refresh_token_reuse: {
    label: 'Stolen Refresh Token Reuse',
    shortMeaning: 'A stolen long-lived token keeps granting access even after sessions appear to end.',
    clue: 'Users appear logged out, but attacker activity keeps returning repeatedly in logs.',
    timeMultiplier: 1.1,
    radiusMultiplier: 1.0,
  },
  supply_chain: {
    label: 'Compromised Plugin or Dependency Update',
    shortMeaning: 'A malicious update in one plugin/dependency can spread to many connected tools quickly.',
    clue: 'Incident started right after integration/plugin updates across multiple teams.',
    timeMultiplier: 1.25,
    radiusMultiplier: 1.35,
  },
};

function updateAttackVectorHelper() {
  const select = document.getElementById('attack-vector');
  const box = document.getElementById('vector-context');
  if (!select || !box) return;
  const key = select.value;
  if (!key || !ATTACK_VECTOR_INFO[key]) {
    box.textContent = 'Pick an entry clue to see how the attacker likely got in.';
    return;
  }
  const v = ATTACK_VECTOR_INFO[key];
  box.textContent = `${v.label}: ${v.shortMeaning} Clue: ${v.clue}`;
}

// ── Login Functions ────────────────────────────────────────────────
function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  if (!email || !password) {
    showToast('Please fill in all fields', 'warning');
    return;
  }
  
  // Dummy login - just check if fields are not empty
  isLoggedIn = true;
  currentUser = {
    email: email,
    name: email.split('@')[0],
    initials: email.split('@')[0].substring(0, 2).toUpperCase(),
    loginTime: new Date().toLocaleString()
  };
  sessionStorage.setItem('authshield_user', JSON.stringify(currentUser));
  
  showToast(`✓ Welcome, ${currentUser.name}!`, 'success');
  
  // Hide login, show main app
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('main-nav').style.display = 'flex';
  document.querySelectorAll('.page:not(#page-login)').forEach(p => p.style.display = '');
  
  // Update avatar
  updateUserAvatar();
  
  showPage('dashboard');
  initializeApp();
}

function handleGoogleLogin() {
  // Dummy Google login - just shows a message
  showToast('🔗 Google login integration not connected (Demo Mode)', 'info');
  
  // For demo, we can auto-login with a test account
  setTimeout(() => {
    const email = 'demo@company.com';
    isLoggedIn = true;
    currentUser = {
      email: email,
      name: 'Demo User',
      initials: 'DE',
      loginTime: new Date().toLocaleString()
    };
    sessionStorage.setItem('authshield_user', JSON.stringify(currentUser));
    
    showToast(`✓ Demo login successful as ${email}`, 'success');
    
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('main-nav').style.display = 'flex';
    document.querySelectorAll('.page:not(#page-login)').forEach(p => p.style.display = '');
    
    // Update avatar
    updateUserAvatar();
    
    showPage('dashboard');
    initializeApp();
  }, 500);
}

function updateUserAvatar() {
  if (!currentUser) return;
  const avatar = document.querySelector('.nav-avatar');
  if (avatar) {
    avatar.textContent = currentUser.initials;
    avatar.title = currentUser.email;
  }
}

function handleLogout() {
  if (window.confirm('Are you sure you want to logout?')) {
    isLoggedIn = false;
    currentUser = null;
    sessionStorage.removeItem('authshield_user');
    
    // Reset app state
    dashboardData = null;
    toolsData = [];
    graphData = null;
    alertsData = [];
    
    // Show login page
    document.getElementById('page-login').style.display = 'flex';
    document.getElementById('main-nav').style.display = 'none';
    document.querySelectorAll('.page:not(#page-login)').forEach(p => p.style.display = 'none');
    
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    showToast('✓ Logged out successfully', 'success');
  }
}

function showUserProfile() {
  if (!currentUser) return;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    width: 320px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    z-index: 5000;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  `;
  
  modal.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:10px;background:linear-gradient(135deg,var(--cyan),var(--purple));display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;">
        ${currentUser.initials}
      </div>
      <div style="font-weight:600;font-size:14px;color:var(--text);">${currentUser.name}</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-top:4px;">${currentUser.email}</div>
    </div>
    
    <div style="border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:16px 0;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;">Login Time</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--text);">${currentUser.loginTime}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;">Status</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--green);">● ACTIVE</span>
      </div>
    </div>
    
    <button onclick="handleLogout()" style="width:100%;padding:10px;background:rgba(255,45,85,0.1);border:1px solid rgba(255,45,85,0.25);color:var(--red);border-radius:8px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;">
      🚪 Logout
    </button>
  `;
  
  // Remove any existing profile modal
  const existing = document.getElementById('user-profile-modal');
  if (existing) existing.remove();
  
  modal.id = 'user-profile-modal';
  document.body.appendChild(modal);
  
  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closeUserProfile);
  }, 100);
}

function closeUserProfile() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.remove();
  document.removeEventListener('click', closeUserProfile);
}

// Page routing
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (document.getElementById('nav-' + id)) {
    document.getElementById('nav-' + id).classList.add('active');
  }
  if (id === 'graph') setTimeout(initGraph, 100);
  if (id === 'simulate') setTimeout(initSimGraph, 100);
}

// Graph filter state
const activeRiskLevels = new Set(['critical', 'high', 'medium', 'safe', 'low']);
const activeToolTypes = new Set(['ai / llm', 'productivity', 'dev tools', 'automation', 'developer', 'design', 'platform', 'communications', 'development']);
const activePerms = new Set();

function toggleChip(el) {
  el.classList.toggle('active');
  const label = el.textContent.trim().toLowerCase().replace(/\s*[●·]\s*/, '');
  const group = el.closest('.filter-group');
  const groupLabel = group ? group.querySelector('.filter-group-label').textContent.toLowerCase() : '';
  if (groupLabel.includes('risk')) {
    if (el.classList.contains('active')) activeRiskLevels.add(label); else activeRiskLevels.delete(label);
  } else if (groupLabel.includes('tool')) {
    if (el.classList.contains('active')) activeToolTypes.add(label); else activeToolTypes.delete(label);
  } else {
    if (el.classList.contains('active')) activePerms.add(label); else activePerms.delete(label);
  }
  applyGraphFilters();
}

function applyGraphFilters() {
  // Re-init graph with filtered nodes visible
  const canvas = document.getElementById('graph-canvas');
  if (!canvas || !canvas._init) return;
  // Rebuild visible set
  canvas._visibleNodes = graphNodes.filter(n => {
    const riskMap = { '#ff2d55': 'critical', '#ffaa00': 'high', '#00c8f0': 'medium', '#00d4ff': 'medium', '#00f090': 'safe' };
    const nr = (riskMap[n.color] || 'safe');
    return activeRiskLevels.has(nr) || activeRiskLevels.has('safe');
  });
}

// Mini graph canvas
(function () {
  const canvas = document.getElementById('mini-graph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 400, H = 180;
  canvas.width = W; canvas.height = H;
  const nodes = [
    { x: W * 0.5, y: H * 0.45, r: 20, color: '#00c8f0', label: 'Org Hub' },
    { x: W * 0.15, y: H * 0.25, r: 15, color: '#ff2d55', label: 'Zapier' },
    { x: W * 0.82, y: H * 0.2, r: 15, color: '#ff2d55', label: 'Copilot' },
    { x: W * 0.25, y: H * 0.72, r: 13, color: '#ffaa00', label: 'Notion' },
    { x: W * 0.72, y: H * 0.7, r: 13, color: '#ffaa00', label: 'Linear' },
    { x: W * 0.5, y: H * 0.88, r: 12, color: '#00f090', label: 'Slack' },
    { x: W * 0.92, y: H * 0.55, r: 12, color: '#00f090', label: 'Figma' },
    { x: W * 0.07, y: H * 0.6, r: 12, color: '#ffaa00', label: 'Drive' },
  ];
  const edges = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 3], [2, 6], [3, 5]];
  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    edges.forEach(([a, b]) => {
      const n1 = nodes[a], n2 = nodes[b];
      ctx.beginPath();
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -t * 0.5;
      ctx.strokeStyle = 'rgba(0,200,240,0.15)';
      ctx.lineWidth = 1;
      ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    nodes.forEach(n => {
      // Outer glow
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
      ctx.fillStyle = n.color + '18'; ctx.fill();
      // Main circle
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color + '40'; ctx.fill();
      ctx.strokeStyle = n.color; ctx.lineWidth = 1.8; ctx.stroke();
      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.max(9, n.r * 0.6)}px "Syne",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, n.y);
    });
    t++; requestAnimationFrame(draw);
  }
  draw();
})();

// Full graph
const graphNodes = [
  { id: 0, x: 0, y: 0, r: 28, color: '#00c8f0', label: 'Org Hub', risk: '—', perms: ['admin:read'], type: 'core' },
  { id: 1, x: 0, y: 0, r: 22, color: '#ff2d55', label: 'Zapier', risk: '94 CRITICAL', perms: ['admin:all', 'write:org', 'read:users'], type: 'automation' },
  { id: 2, x: 0, y: 0, r: 22, color: '#ff2d55', label: 'Copilot', risk: '88 CRITICAL', perms: ['repo:all', 'secrets:read'], type: 'dev' },
  { id: 3, x: 0, y: 0, r: 20, color: '#ff2d55', label: 'Cursor AI', risk: '82 CRITICAL', perms: ['fs:read', 'env:access'], type: 'dev' },
  { id: 4, x: 0, y: 0, r: 18, color: '#ffaa00', label: 'Notion', risk: '72 HIGH', perms: ['workspace:read', 'pages:edit'], type: 'productivity' },
  { id: 5, x: 0, y: 0, r: 18, color: '#ffaa00', label: 'Linear', risk: '61 HIGH', perms: ['issues:write', 'teams:read'], type: 'productivity' },
  { id: 6, x: 0, y: 0, r: 17, color: '#ffaa00', label: 'Jira', risk: '58 HIGH', perms: ['projects:write'], type: 'dev' },
  { id: 7, x: 0, y: 0, r: 16, color: '#ffaa00', label: 'Asana', risk: '54 HIGH', perms: ['tasks:all'], type: 'productivity' },
  { id: 8, x: 0, y: 0, r: 16, color: '#00c8f0', label: 'Vercel', risk: '42 MED', perms: ['deploy:write'], type: 'dev' },
  { id: 9, x: 0, y: 0, r: 16, color: '#00c8f0', label: 'Figma', risk: '35 MED', perms: ['files:read', 'comments:write'], type: 'design' },
  { id: 10, x: 0, y: 0, r: 16, color: '#00f090', label: 'Slack', risk: '38 LOW', perms: ['channels:read', 'messages:write'], type: 'comm' },
  { id: 11, x: 0, y: 0, r: 14, color: '#00f090', label: 'Google Drive', risk: '28 LOW', perms: ['files:read'], type: 'productivity' },
  { id: 12, x: 0, y: 0, r: 14, color: '#00f090', label: 'Loom', risk: '22 LOW', perms: ['videos:read'], type: 'productivity' },
];
const graphEdges = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [1, 4], [1, 5], [1, 10], [2, 8], [2, 3], [4, 11], [5, 6], [6, 8], [9, 11]];

function initGraph() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas || canvas._init) return;
  canvas._init = true;
  const wrap = document.getElementById('graph-canvas-wrap');
  const W = wrap.offsetWidth || 700, H = 580;
  canvas.width = W; canvas.height = H;
  // Arrange in circle
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.35;
  graphNodes[0].x = cx; graphNodes[0].y = cy;
  for (let i = 1; i < graphNodes.length; i++) {
    const a = (i - 1) / (graphNodes.length - 1) * Math.PI * 2;
    graphNodes[i].x = cx + R * Math.cos(a);
    graphNodes[i].y = cy + R * Math.sin(a);
  }
  const ctx = canvas.getContext('2d');
  const tt = document.getElementById('node-tooltip');
  let t = 0;
  let hoveredNode = null;

  function getNodeFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx2 = mx * scaleX;
    const cy2 = my * scaleY;
    let found = null;
    graphNodes.forEach(n => {
      if (Math.hypot(n.x - cx2, n.y - cy2) < n.r + 6) found = n;
    });
    return found;
  }

  function setTooltipPositionFromPointer(e) {
    const wrapRect = wrap.getBoundingClientRect();
    const left = Math.min(e.clientX - wrapRect.left + 12, W - 240);
    const top = Math.min(e.clientY - wrapRect.top - 20, H - 200);
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
  }

  function setTooltipPositionForNode(node) {
    const left = Math.max(8, Math.min(node.x + 16, W - 240));
    const top = Math.max(8, Math.min(node.y - 20, H - 200));
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
  }

  function updateTooltip(node) {
    tooltipNode = node;
    document.getElementById('tt-name').textContent = node.label;
    document.getElementById('tt-risk').innerHTML = `<span style="font-family:var(--mono);font-size:12px;color:${node.color}">Risk Score: ${node.risk}</span>`;
    document.getElementById('tt-perms').innerHTML = node.perms.map(p => `<span class="perm-tag">${p}</span>`).join('');
    tt.classList.add('visible');
  }

  function hideTooltip() {
    tt.classList.remove('visible');
    tooltipNode = null;
  }

  function unpinTooltip() {
    pinnedNode = null;
    isTooltipPinned = false;
    hideTooltip();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    graphEdges.forEach(([a, b]) => {
      const n1 = graphNodes[a], n2 = graphNodes[b];
      ctx.beginPath();
      ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 0.4;
      const isAlert = (n1.color === '#ff2d55' || n2.color === '#ff2d55');
      ctx.strokeStyle = isAlert ? 'rgba(255,45,85,0.2)' : 'rgba(0,200,240,0.1)';
      ctx.lineWidth = 1;
      ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    graphNodes.forEach(n => {
      const glow = hoveredNode === n || pinnedNode === n;
      // Outer pulse ring
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 8, 0, Math.PI * 2);
      ctx.fillStyle = n.color + (glow ? '22' : '0d'); ctx.fill();
      // Inner fill
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color + (glow ? '55' : '35'); ctx.fill();
      ctx.strokeStyle = n.color + (glow ? 'ff' : 'cc');
      ctx.lineWidth = glow ? 2.5 : 1.8;
      if (glow) { ctx.shadowBlur = 20; ctx.shadowColor = n.color; }
      ctx.stroke(); ctx.shadowBlur = 0;
      // Label — white, bold, scaled to node size
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(10, Math.min(n.r * 0.7, 14))}px "Syne",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, n.y);
    });
    t++; requestAnimationFrame(draw);
  }
  draw();
  canvas.addEventListener('mousemove', e => {
    if (isTooltipPinned) return;
    const found = getNodeFromEvent(e);
    hoveredNode = found;
    if (found) {
      updateTooltip(found);
      setTooltipPositionFromPointer(e);
    } else {
      hideTooltip();
    }
  });

  canvas.addEventListener('click', e => {
    const found = getNodeFromEvent(e);
    if (found) {
      pinnedNode = found;
      hoveredNode = found;
      isTooltipPinned = true;
      updateTooltip(found);
      setTooltipPositionForNode(found);
      return;
    }
    if (isTooltipPinned) unpinTooltip();
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredNode = null;
    if (!isTooltipPinned) hideTooltip();
  });

  tt.addEventListener('click', e => {
    e.stopPropagation();
  });

  document.addEventListener('click', e => {
    if (!isTooltipPinned) return;
    if (canvas.contains(e.target) || tt.contains(e.target)) return;
    unpinTooltip();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isTooltipPinned) {
      unpinTooltip();
    }
  });
}

// Sim graph
const simNodes = [
  { id: 0, x: 0, y: 0, r: 24, color: '#00c8f0', label: 'Org Hub', base: '#00c8f0' },
  { id: 1, x: 0, y: 0, r: 20, color: '#ff2d55', label: 'Zapier', base: '#ff2d55' },
  { id: 2, x: 0, y: 0, r: 20, color: '#ff2d55', label: 'Copilot', base: '#ff2d55' },
  { id: 3, x: 0, y: 0, r: 18, color: '#ffaa00', label: 'Notion', base: '#ffaa00' },
  { id: 4, x: 0, y: 0, r: 18, color: '#ffaa00', label: 'Linear', base: '#ffaa00' },
  { id: 5, x: 0, y: 0, r: 16, color: '#00f090', label: 'Slack', base: '#00f090' },
  { id: 6, x: 0, y: 0, r: 16, color: '#00f090', label: 'Figma', base: '#00f090' },
  { id: 7, x: 0, y: 0, r: 16, color: '#00f090', label: 'Drive', base: '#00f090' },
  { id: 8, x: 0, y: 0, r: 16, color: '#ffaa00', label: 'Jira', base: '#ffaa00' },
  { id: 9, x: 0, y: 0, r: 15, color: '#00c8f0', label: 'Vercel', base: '#00c8f0' },
];
const simEdges = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [1, 3], [1, 5], [2, 9], [3, 7], [4, 8]];
let simAnimFrame, compromisedNodes = new Set(), simT = 0;

function initSimGraph() {
  const canvas = document.getElementById('sim-canvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const W = wrap.offsetWidth || 600, H = 500;
  canvas.width = W; canvas.height = H;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.35;
  simNodes[0].x = cx; simNodes[0].y = cy;
  for (let i = 1; i < simNodes.length; i++) {
    const a = (i - 1) / (simNodes.length - 1) * Math.PI * 2;
    simNodes[i].x = cx + R * Math.cos(a); simNodes[i].y = cy + R * Math.sin(a);
  }
  simNodes.forEach(n => n.color = n.base);
  compromisedNodes.clear();
  
  // Start the continuous render loop
  if (simAnimFrame) cancelAnimationFrame(simAnimFrame);
  let t = 0;
  function renderLoop() {
    drawSimGraph(canvas, t);
    t++;
    simAnimFrame = requestAnimationFrame(renderLoop);
  }
  simAnimFrame = requestAnimationFrame(renderLoop);
}

function drawSimGraph(canvas, t) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  simEdges.forEach(([a, b]) => {
    const n1 = simNodes[a], n2 = simNodes[b];
    const bothComp = compromisedNodes.has(a) && compromisedNodes.has(b);
    ctx.beginPath(); ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 0.3;
    ctx.strokeStyle = bothComp ? 'rgba(255,45,85,0.4)' : 'rgba(0,200,240,0.12)';
    ctx.lineWidth = bothComp ? 1.5 : 1;
    ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
  });
  ctx.setLineDash([]);
  simNodes.forEach((n, i) => {
    const comp = compromisedNodes.has(i);
    const pulse = comp ? (0.85 + 0.15 * Math.sin(t * 0.1 + i)) : 1;
    const col = comp ? '#ff2d55' : n.base;
    const r = n.r * pulse;
    // Outer glow ring
    ctx.beginPath(); ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = col + (comp ? '30' : '0d'); ctx.fill();
    // Main fill
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col + (comp ? '55' : '40'); ctx.fill();
    ctx.strokeStyle = col + (comp ? 'ff' : 'cc');
    ctx.lineWidth = comp ? 2.5 : 1.8;
    if (comp) { ctx.shadowBlur = 24; ctx.shadowColor = '#ff2d55'; }
    ctx.stroke(); ctx.shadowBlur = 0;
    // White bold label scaled to node size
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(10, Math.min(r * 0.65, 14))}px "Syne",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x, n.y);
  });
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast-msg');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'toast-msg';
  const colors = { info: 'var(--cyan)', success: 'var(--green)', danger: 'var(--red)', warning: 'var(--amber)' };
  t.style.cssText = `position:fixed;bottom:28px;right:28px;z-index:9999;background:var(--bg3);border:1px solid ${colors[type] || colors.info};color:${colors[type] || colors.info};padding:12px 22px;border-radius:10px;font-family:var(--mono);font-size:12px;box-shadow:0 4px 24px rgba(0,0,0,0.4);animation:fadeInUp .3s ease;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function findToolByName(name) {
  const needle = (name || '').toLowerCase();
  return toolsData.find(t => (t.name || '').toLowerCase() === needle) || null;
}

function findToolByGraphNode(node) {
  if (!node) return null;
  const label = (node.label || '').toLowerCase();
  return toolsData.find(t => {
    const n = (t.name || '').toLowerCase();
    return n === label || n.includes(label) || label.includes(n);
  }) || null;
}

function openToolReviewModal(tool) {
  if (!tool) {
    showToast('Tool details not available', 'warning');
    return;
  }
  const existing = document.getElementById('tool-review-modal');
  if (existing) existing.remove();

  const revoked = revokedToolIds.has(tool.tool_id);
  const modal = document.createElement('div');
  modal.id = 'tool-review-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';

  const scopes = (tool.oauth_scopes || []).join(', ') || '—';
  const systems = (tool.connected_systems || []).join(', ') || '—';
  const lastActive = tool.last_active ? new Date(tool.last_active).toLocaleString() : '—';

  modal.innerHTML = `
    <div style="width:560px;max-width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:14px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text);">${tool.name || 'Unknown Tool'}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:3px;">${tool.category || 'Other'} · ${revoked ? 'Revoked' : 'Active'}</div>
        </div>
        <button onclick="closeToolReviewModal()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div class="meta-chip" style="padding:8px 10px;">Risk Score: ${tool.risk_score || 0} (${tool.risk_label || 'Low'})</div>
        <div class="meta-chip" style="padding:8px 10px;">Status: ${revoked ? 'Revoked' : 'Active'}</div>
        <div class="meta-chip" style="padding:8px 10px;grid-column:1 / -1;">Last Active: ${lastActive}</div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:4px;">OAuth Scopes</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5;">${scopes}</div>
      </div>
      <div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:4px;">Connected Systems</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5;">${systems}</div>
      </div>
    </div>
  `;

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

function closeToolReviewModal() {
  const modal = document.getElementById('tool-review-modal');
  if (modal) modal.remove();
}

function confirmRevoke(name) {
  const tool = findToolByName(name);
  if (!tool) {
    showToast('Tool not found', 'warning');
    return;
  }
  if (revokedToolIds.has(tool.tool_id)) {
    showToast(`${tool.name} is already revoked`, 'info');
    return;
  }
  const ok = window.confirm(`Revoke access for "${name}"?\nThis will immediately disconnect all integrations.`);
  if (ok) {
    revokedToolIds.add(tool.tool_id);
    renderTools();
    showToast(`✓ Access revoked for ${name}`, 'danger');
  }
}

function openReview(name) {
  openToolReviewModal(findToolByName(name));
}

function viewGraphNodeDetails() {
  const tool = findToolByGraphNode(tooltipNode || pinnedNode);
  if (tool) {
    openToolReviewModal(tool);
  } else {
    showToast('No detailed tool record for this node yet', 'info');
  }
}

function runToolBreach(toolId) {
  showPage('simulate');
  const select = document.getElementById('breach-tool');
  if (select) select.value = toolId;
  showToast('Tool loaded into breach simulator', 'info');
}

function runBreachFromTooltip() {
  const tool = findToolByGraphNode(tooltipNode || pinnedNode);
  if (tool && tool.tool_id) {
    runToolBreach(tool.tool_id);
  } else {
    showPage('simulate');
    showToast('Node mapped to simulator page', 'info');
  }
}

function runSimulation() {
  const tool = document.getElementById('breach-tool').value;
  const vectorKey = document.getElementById('attack-vector') ? document.getElementById('attack-vector').value : '';
  if (!tool) { showToast('Please select a tool', 'warning'); return; }
  if (!vectorKey || !ATTACK_VECTOR_INFO[vectorKey]) { showToast('Please select an attack vector', 'warning'); return; }
  const vector = ATTACK_VECTOR_INFO[vectorKey];
  const btn = document.querySelector('.sim-ctrl .btn-danger');
  if (btn) { btn.textContent = '⏳ Running…'; btn.disabled = true; }
  simulateBreach(tool).then(result => {
    if (btn) { btn.textContent = '▶ Simulate Breach'; btn.disabled = false; }
    if (!result) return;
    const affSys = result.affected_systems || [];
    const critSys = affSys.filter(s => ['AWS', 'GitHub', 'MongoDB', 'Google Workspace'].includes(s));
    const blastBase = result.blast_radius != null ? result.blast_radius : null;
    const timeBase = result.time_to_compromise_minutes != null ? result.time_to_compromise_minutes : null;
    const adjustedBlast = blastBase != null ? Math.max(1, Math.round(blastBase * vector.radiusMultiplier)) : null;
    const adjustedTime = timeBase != null ? Math.max(1, Math.round(timeBase * vector.timeMultiplier)) : null;
    document.getElementById('blast-radius').textContent = adjustedBlast != null ? `${adjustedBlast} tools (base ${blastBase})` : '—';
    document.getElementById('blast-time').textContent = adjustedTime != null ? `~${adjustedTime} min (base ${timeBase})` : '—';
    document.getElementById('blast-data').textContent = affSys.length ? affSys.join(', ') : '—';
    document.getElementById('blast-systems').textContent = critSys.length ? `${critSys.length} critical` : '0';
    document.getElementById('vector-label').textContent = vector.label;
    document.getElementById('vector-meaning').textContent = vector.shortMeaning;
    const path = result.propagation_path || [];
    document.getElementById('prop-steps').innerHTML = path.map((s, i) => `<div class="prop-step"><div class="prop-step-num">${i + 1}</div><div class="prop-step-text">${s}</div></div>`).join('');
    document.getElementById('rec-actions').innerHTML = (result.recommended_actions || []).map(r => `<div class="rec-item"><span class="rec-icon">›</span><span>${r}</span></div>`).join('');
    document.getElementById('sim-idle').style.display = 'none';
    document.getElementById('sim-output').style.display = 'block';
    // Animate breach and stop
    const canvas = document.getElementById('sim-canvas');
    simNodes.forEach(n => n.color = n.base);
    compromisedNodes.clear();
    // Find the tool in our data by tool_id
    const toolData = toolsData.find(t => t.tool_id === tool);
    let startNodeIdx = 1;
    if (toolData && simNodes.length > 0) {
      // Try to find matching node by name similarity
      const toolName = toolData.name.toLowerCase();
      startNodeIdx = simNodes.findIndex(n => n.label.toLowerCase().includes(toolName.split(/\s+/)[0])) || 1;
    }
    const startNode = startNodeIdx >= 0 ? startNodeIdx : 1;
    const propOrder = [startNode, ...simNodes.map((_, i) => i).filter(i => i !== startNode)];
    let t = 0;
    const maxFrames = propOrder.length * 30 + 60;
    const animateId = Math.random();
    window.simCurrentAnimation = animateId;
    
    function animateSim() {
      if (window.simCurrentAnimation !== animateId) return; // Stop if new animation started
      t++;
      const step = Math.floor(t / 30);
      compromisedNodes.clear();
      for (let i = 0; i <= Math.min(step, propOrder.length - 1); i++) compromisedNodes.add(propOrder[i]);
      if (t < maxFrames) {
        requestAnimationFrame(animateSim);
      } else {
        // Animation done, but keep showing results - DON'T clear the nodes yet
        showToast('✓ Breach simulation complete', 'success');
      }
    }
    animateSim();
  }).catch(err => {
    if (btn) { btn.textContent = '▶ Simulate Breach'; btn.disabled = false; }
    showToast('Error running simulation', 'danger');
    console.error(err);
  });
}

function resetSimulation() {
  simNodes.forEach(n => n.color = n.base);
  compromisedNodes.clear();
  document.getElementById('sim-idle').style.display = 'block';
  document.getElementById('sim-output').style.display = 'none';
  document.getElementById('breach-tool').value = '';
  if (document.getElementById('attack-vector')) document.getElementById('attack-vector').value = '';
  if (document.getElementById('vector-label')) document.getElementById('vector-label').textContent = '—';
  if (document.getElementById('vector-meaning')) document.getElementById('vector-meaning').textContent = '—';
  showToast('Simulation reset', 'info');
}

// Alerts data - will be loaded from API


let currentAlertFilter = 'all';
function filterAlerts(type, el) {
  currentAlertFilter = type;
  const tabs = document.querySelectorAll('#page-alerts .filter-tab');
  tabs.forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAlerts();
}

function resolveAlert(alertId) {
  resolveAlertApi(alertId).then(updatedStats => {
    // Update local alert state
    const a = alertsData.find(x => x.alert_id === alertId);
    if (a) { a.is_resolved = true; }
    showToast(`✓ Alert ${alertId} marked resolved`, 'success');
    renderAlerts();
    // Update dashboard stats with new counts
    if (updatedStats) {
      dashboardData = updatedStats;
      renderDashboard();
    }
  }).catch(err => {
    showToast(`Error resolving alert: ${err.message}`, 'error');
  });
}

function investigateAlert(alertId) {
  const a = alertsData.find(x => x.alert_id === alertId);
  showToast(`🔍 Investigating: ${a ? a.title : 'Alert ' + alertId}`, 'info');
}

function renderAlerts() {
  const list = document.getElementById('alerts-list');
  if (!list) return;
  const filtered = alertsData.filter(a => {
    const sev = (a.severity || '').toLowerCase();
    const resolved = a.is_resolved || false;
    if (currentAlertFilter === 'all') return true;
    if (currentAlertFilter === 'resolved') return resolved;
    return sev === currentAlertFilter && !resolved;
  });
  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);font-family:var(--mono);font-size:12px;">No alerts in this category</div>`;
    return;
  }
  list.innerHTML = filtered.map(a => {
    const sev = (a.severity || 'medium').toLowerCase();
    const resolved = a.is_resolved || false;
    const ts = a.created_at ? new Date(a.created_at).toLocaleString() : '—';
    return `
    <div class="alert-card ${resolved ? 'resolved' : sev}">
      <span class="sev-badge ${resolved ? 'resolved' : sev}">${resolved ? 'RESOLVED' : (a.severity || 'MEDIUM').toUpperCase()}</span>
      <div class="alert-body">
        <div class="alert-tool-name">${a.tool_name || 'Unknown'}</div>
        <div class="alert-type">${a.type || 'ALERT'}</div>
        <div class="alert-title-text" style="font-weight:600;font-size:12px;margin-bottom:4px;color:var(--text)">${a.title || ''}</div>
        <div class="alert-desc">${a.description || ''}</div>
        <div class="alert-footer">
          <span class="alert-ts">${ts}</span>
          <div class="alert-actions">
            <button class="btn btn-ghost" style="font-size:10px;" onclick="investigateAlert('${a.alert_id}')">🔍 Investigate</button>
            ${!resolved ? `<button class="btn btn-primary" style="font-size:10px;" onclick="resolveAlert('${a.alert_id}')">✓ Resolve</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderDashboard() {
  // Re-render dashboard with updated stats
  // This updates the KPI cards with current data
  if (!dashboardData) return;
}

// Tools data - will be loaded from API


function filterTools(q) {
  toolsSearchQuery = (q || '').toLowerCase();
  renderTools();
}

function setToolsCategory(value) {
  toolsCategoryFilter = value || 'all';
  renderTools();
}

function setToolsRisk(value, el) {
  toolsRiskFilter = value || 'all';
  document.querySelectorAll('#page-tools [data-risk]').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTools();
}

function setToolsSort(value) {
  toolsSort = value || 'risk_desc';
  renderTools();
}

const TOOL_ICONS = { AI: '🤖', Developer: '💻', Productivity: '📝', Communications: '💬', Design: '🎨', Platform: '⚡', Development: '🔧' };

function renderTools() {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  if (!toolsData.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);font-family:var(--mono);font-size:12px;">No tools connected</div>`;
    return;
  }
  let rows = [...toolsData];
  rows = rows.filter(t => {
    const name = (t.name || t.tool_name || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const risk = (t.risk_label || 'low').toLowerCase();
    const matchesSearch = !toolsSearchQuery || name.includes(toolsSearchQuery);
    const matchesCategory = toolsCategoryFilter === 'all' || (t.category || '') === toolsCategoryFilter;
    const matchesRisk = toolsRiskFilter === 'all' || risk === toolsRiskFilter;
    return matchesSearch && matchesCategory && matchesRisk;
  });

  if (toolsSort === 'name_asc') {
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (toolsSort === 'recent') {
    rows.sort((a, b) => new Date(b.last_active || 0) - new Date(a.last_active || 0));
  } else {
    rows.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  }

  if (!rows.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);font-family:var(--mono);font-size:12px;">No matching tools for current filters</div>`;
    return;
  }

  grid.innerHTML = rows.map(t => {
    const sev = (t.risk_label || 'medium').toLowerCase();
    const icon = TOOL_ICONS[t.category] || '⚙️';
    const scopes = (t.oauth_scopes || []).join(', ') || '—';
    const systems = (t.connected_systems || []).join(', ') || '—';
    const ts = t.last_active ? new Date(t.last_active).toLocaleDateString() : '—';
    const name = t.name || t.tool_name || 'Unknown';
    const revoked = revokedToolIds.has(t.tool_id);
    const status = revoked ? 'Revoked' : 'Active';
    return `
    <div class="tool-card">
      <div class="tool-card-header">
        <div class="tool-logo" style="background:rgba(255,100,0,0.15)">${icon}</div>
        <div style="flex:1;">
          <div class="tool-info-name">${name}</div>
          <div class="tool-cat">${t.category || 'Other'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
          <span class="risk-badge ${sev}">${t.risk_score || 0}</span>
          <span class="meta-chip" style="font-size:9px;${revoked ? 'color:var(--red);border:1px solid rgba(255,45,85,0.25);' : ''}">${status}</span>
        </div>
      </div>
      <div class="tool-meta">
        <span class="meta-chip">🔑 ${(t.oauth_scopes || []).length} scopes</span>
        <span class="meta-chip">🕐 ${ts}</span>
      </div>
      <div class="tool-scopes" style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:12px;">${scopes}</div>
      <div class="tool-scopes" style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:12px;">Systems: ${systems}</div>
      <div class="tool-footer">
        <button class="btn btn-ghost" onclick="openReview('${name}')">View Details</button>
        <button class="btn btn-primary" onclick="runToolBreach('${t.tool_id}')">Run Breach</button>
        <button class="btn btn-danger" onclick="confirmRevoke('${name}')" ${revoked ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Revoke</button>
      </div>
    </div>`;
  }).join('');
}

// Initialize - Load data from backend
async function initializeApp() {
  try {
    // Load tools
    const tools = await getTools();
    if (Array.isArray(tools)) {
      toolsData = tools;
    }
    renderTools();
    const catSelect = document.getElementById('tools-category-filter');
    if (catSelect) catSelect.value = toolsCategoryFilter;
    const sortSelect = document.getElementById('tools-sort');
    if (sortSelect) sortSelect.value = toolsSort;

    // Load alerts
    const alerts = await getAlerts();
    if (Array.isArray(alerts)) {
      alertsData = alerts;
    }
    renderAlerts();

    // Load graph data
    const graph = await getGraph();
    if (graph) {
      graphData = graph;
      // Update graph nodes with real data if available
      if (graph.nodes && Array.isArray(graph.nodes)) {
        graphNodes.length = 0;
        const RISK_COLORS = {
          "Critical": "#ff2d55",
          "High": "#ffaa00",
          "Medium": "#00d4ff",
          "Low": "#00ff88",
        };
        graph.nodes.forEach((node, i) => {
          graphNodes.push({
            id: node.id,
            x: 0,
            y: 0,
            r: Math.max(8, 20 - i),
            color: RISK_COLORS[node.risk_label] || "#cccccc",
            label: node.name,
            risk: `${node.risk_score} ${node.risk_label}`,
            perms: node.permissions || [],
            type: node.category,
          });
        });
        if (graph.links && Array.isArray(graph.links)) {
          graphEdges.length = 0;
          graph.links.forEach(link => {
            const sourceIdx = graphNodes.findIndex(n => n.id === link.source);
            const targetIdx = graphNodes.findIndex(n => n.id === link.target);
            if (sourceIdx >= 0 && targetIdx >= 0) {
              graphEdges.push([sourceIdx, targetIdx]);
            }
          });
        }
      }
    }

    // Load dashboard
    const dashboard = await getDashboard();
    if (dashboard) {
      dashboardData = dashboard;
    }

    // Populate breach tool dropdown
    const breachToolSelect = document.getElementById('breach-tool');
    if (breachToolSelect && toolsData.length > 0) {
      breachToolSelect.innerHTML = `<option value="">-- Select a tool to compromise --</option>` + toolsData
        .map(t => `<option value="${t.tool_id}">${t.name} (Risk: ${t.risk_score})</option>`)
        .join('');
    }
    updateAttackVectorHelper();
  } catch (err) {
    console.error('Error initializing app:', err);
  }

  // Canvas setup
  setTimeout(() => { const c = document.getElementById('mini-graph'); if (c) { const W = c.parentElement.offsetWidth - 40 || 360; c.width = W; } }, 100);
}

// ── Add Tool Modal ──────────────────────────────────────────────
function openAddToolModal() {
  const m = document.getElementById('add-tool-modal');
  m.style.display = 'flex';
  document.getElementById('at-name').value = '';
  document.getElementById('at-scopes').value = '';
  document.getElementById('at-systems').value = '';
}

function closeAddToolModal() {
  document.getElementById('add-tool-modal').style.display = 'none';
}

function submitAddTool() {
  const name = document.getElementById('at-name').value.trim();
  if (!name) { showToast('Tool name is required', 'warning'); return; }
  const cat = document.getElementById('at-cat').value;
  const scopes = document.getElementById('at-scopes').value.split(',').map(s => s.trim()).filter(Boolean);
  const systems = document.getElementById('at-systems').value.split(',').map(s => s.trim()).filter(Boolean);

  // Compute risk locally (mirrors backend RiskScorer)
  let score = 0;
  scopes.forEach(s => {
    const n = s.toLowerCase();
    if (['admin', 'full_access'].includes(n)) score += 25;
    else if (['write', 'delete'].includes(n)) score += 15;
    else if (['read', 'send'].includes(n)) score += 5;
  });
  const critSys = ['AWS', 'GitHub', 'MongoDB', 'Google Workspace'];
  systems.forEach(s => score += critSys.includes(s) ? 10 : 5);
  score = Math.min(score, 100);
  const label = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : 'Low';

  const newTool = {
    tool_id: name.toLowerCase().replace(/\s+/g, '_'),
    name, category: cat,
    oauth_scopes: scopes,
    connected_systems: systems,
    risk_score: score,
    risk_label: label,
    last_active: new Date().toISOString(),
  };

  toolsData.unshift(newTool);
  renderTools();
  closeAddToolModal();
  showToast(`✓ ${name} connected successfully`, 'success');
}

// Close modal on backdrop click
document.getElementById('add-tool-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('add-tool-modal')) closeAddToolModal();
});

// Expose functions to window so inline onclick handlers work with type="module"
window.showPage = showPage;
window.toggleChip = toggleChip;
window.runSimulation = runSimulation;
window.resetSimulation = resetSimulation;
window.filterAlerts = filterAlerts;
window.filterTools = filterTools;
window.setToolsCategory = setToolsCategory;
window.setToolsRisk = setToolsRisk;
window.setToolsSort = setToolsSort;
window.confirmRevoke = confirmRevoke;
window.openReview = openReview;
window.closeToolReviewModal = closeToolReviewModal;
window.runToolBreach = runToolBreach;
window.viewGraphNodeDetails = viewGraphNodeDetails;
window.runBreachFromTooltip = runBreachFromTooltip;
window.resolveAlert = resolveAlert;
window.investigateAlert = investigateAlert;
window.openAddToolModal = openAddToolModal;
window.closeAddToolModal = closeAddToolModal;
window.submitAddTool = submitAddTool;
window.handleLogin = handleLogin;
window.handleGoogleLogin = handleGoogleLogin;
window.handleLogout = handleLogout;
window.showUserProfile = showUserProfile;
window.updateAttackVectorHelper = updateAttackVectorHelper;

// Start the app - always show login on refresh for explicit re-auth flow
isLoggedIn = false;
currentUser = null;
sessionStorage.removeItem('authshield_user');
document.getElementById('page-login').style.display = 'flex';
document.getElementById('main-nav').style.display = 'none';
document.querySelectorAll('.page:not(#page-login)').forEach(p => p.style.display = 'none');