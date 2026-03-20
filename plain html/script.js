/* ── Stars ── */
for (let i = 0; i < 60; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  s.style.cssText = `
    top: ${Math.random() * 100}%;
    left: ${Math.random() * 100}%;
    animation-delay: ${Math.random() * 4}s;
    animation-duration: ${2 + Math.random() * 3}s;
    opacity: ${0.1 + Math.random() * 0.3};
  `;
  document.body.appendChild(s);
}

/* ── Floating hearts ── */
const heartsContainer = document.getElementById('hearts');
const emojis = ['❤️', '💕', '🌹', '💖', '✨', '💝', '🌸'];

for (let i = 0; i < 18; i++) {
  const h = document.createElement('div');
  h.className = 'heart';
  h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  h.style.cssText = `
    left: ${Math.random() * 100}%;
    bottom: -30px;
    animation-delay: ${Math.random() * 6}s;
    animation-duration: ${5 + Math.random() * 5}s;
    font-size: ${10 + Math.random() * 16}px;
  `;
  heartsContainer.appendChild(h);
}

/* ── Open envelope ── */
let opened = false;

function openEnvelope() {
  if (opened) return;
  opened = true;

  const envelope = document.getElementById('envelope');

  // Hide hint
  const hint = document.getElementById('hint') || document.querySelector('.hint');
  if (hint) hint.style.display = 'none';

  // Open flap
  document.getElementById('seal').classList.add('hide');
  document.getElementById('flap').classList.add('open');

  // Reveal letter and drop envelope away.
  setTimeout(() => {
    envelope.removeAttribute('onclick');
    envelope.classList.add('opened');
    document.getElementById('letterWrap').classList.add('slide-up');

    setTimeout(() => {
      envelope.classList.add('drop-away');
    }, 180);
  }, 500);
}

/* ── Yes button ── */
function sayYes(e) {
  e.stopPropagation();
  launchConfetti();
  document.getElementById('response').classList.add('show');
}

/* ── No button runs away ── */
function runAway(btn) {
  const maxX = window.innerWidth - 120;
  const maxY = window.innerHeight - 60;
  btn.style.position = 'fixed';
  btn.style.left = Math.random() * maxX + 'px';
  btn.style.top  = Math.random() * maxY + 'px';
  btn.style.zIndex = 50;
}

/* ── Confetti ── */
function launchConfetti() {
  const wrap = document.getElementById('confettiWrap');
  const colors = ['#e8396a', '#d4a853', '#f7c5d0', '#fff', '#8b1a3a'];

  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const rotation = (Math.random() > 0.5 ? '' : '-') + (200 + Math.random() * 300);

    c.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      left: ${Math.random() * 100}%;
      top: -20px;
      animation: fall ${1.5 + Math.random() * 2}s ease-in ${Math.random()}s forwards;
    `;
    wrap.appendChild(c);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fall {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}