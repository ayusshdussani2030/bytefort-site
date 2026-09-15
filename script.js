/* ============================================================
   bytefort.xyz — Services Dashboard
   ============================================================ */

// ── Service Data ──────────────────────────────────────────
const SERVICES = [
  { name: 'Authentik', url: 'https://auth.bytefort.xyz', cat: 'infrastructure', desc: 'Identity and access management. Single sign-on for all your services.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
  { name: 'Home Assistant', url: 'https://homeassistant.bytefort.xyz', cat: 'infrastructure', desc: 'Open-source home automation platform. Control and automate your smart home.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { name: 'Jellyfin', url: 'https://jellyfin.bytefort.xyz', cat: 'media', desc: 'Open-source media streaming server. Movies, TV, music — streamed privately.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 19,12 5,21"/></svg>' },
  { name: 'Netbird', url: 'https://netbird.bytefort.xyz', cat: 'infrastructure', desc: 'Self-hosted VPN and remote access. Secure mesh networking for all devices.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>' },
  { name: 'Nginx Proxy Manager', url: 'https://npm.bytefort.xyz', cat: 'network', desc: 'Reverse proxy and SSL management. Routes all bytefort subdomains with HTTPS.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h10"/></svg>' },
  { name: 'Ripper', url: 'https://ripper.bytefort.xyz', cat: 'media', desc: 'Media ripping and conversion. Transcode and organize your media library.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>' },
  { name: 'Jellyseerr', url: 'https://seerr.bytefort.xyz', cat: 'media', desc: 'Media request and discovery. Request, track, and auto-download content.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="14.5" r="0.5" fill="currentColor"/></svg>' },
  { name: 'Speed Test', url: 'https://speedtest.bytefort.xyz', cat: 'network', desc: 'Self-hosted network speed test. Measure upload, download, and latency.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1118 0"/><path d="M12 12l-3.5-5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>' },
  { name: 'Vaultwarden', url: 'https://vault.bytefort.xyz', cat: 'infrastructure', desc: 'Self-hosted password vault. Secure credential management for your family.', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' }
];

// ── 0c. Uptime Counter ──────────────────────────────────
(function () {
  const el = document.getElementById('uptimeDays');
  if (!el) return;
  const since = new Date('2024-03-01');
  const days = Math.floor((Date.now() - since) / 86400000);
  el.textContent = days;
})();

// ── Typing Animation ────────────────────────────────────
(function () {
  const el = document.getElementById('typedText');
  if (!el) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phrases = [
    '9 services. Zero cloud. Real hardware.',
    'Self-hosted. Always on.',
    'Built on bare metal. Managed from anywhere.',
    'Your infrastructure, your rules.'
  ];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let tick;

  function type() {
    const current = phrases[phraseIndex];
    if (reducedMotion) {
      el.textContent = current;
      return;
    }
    if (!isDeleting) {
      el.textContent = current.substring(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) {
        tick = setTimeout(function () { isDeleting = true; type(); }, 2000);
        return;
      }
    } else {
      el.textContent = current.substring(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }
    tick = setTimeout(type, isDeleting ? 40 : 70);
  }

  setTimeout(type, 1000);
})();

// ── Render Services ─────────────────────────────────────
(function () {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  function renderCards() {
    SERVICES.forEach(function (svc, i) {
      const card = document.createElement('a');
      card.className = 'svc-card reveal-up';
      card.href = svc.url;
      card.dataset.category = svc.cat;
      card.dataset.index = i;
      card.dataset.name = svc.name;
      
      card.innerHTML =
        '<div class="svc-card-top">' +
          '<div class="svc-icon" data-cat="' + svc.cat + '">' + svc.icon + '</div>' +
          '<span class="svc-badge mono" data-cat="' + svc.cat + '">' + svc.cat + '</span>' +
        '</div>' +
        '<h3 class="svc-name">' + svc.name + '</h3>' +
        '<p class="svc-desc">' + svc.desc + '</p>' +
        '<div class="svc-footer">' +
          '<span class="svc-url mono">' + getShortUrl(svc.url) + '</span>' +
          '<span class="svc-status"><span class="svc-dot"></span><span>checking</span></span>' +
        '</div>';
      
      grid.appendChild(card);
    });
    
    document.getElementById('svcCount').textContent = SERVICES.length;
    
    // Stagger reveal
    const cards = grid.querySelectorAll('.svc-card');
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          const delay = (e.target.dataset.index % 6) * 60;
          setTimeout(function () { e.target.classList.add('visible'); }, delay);
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    
    cards.forEach(function (c) { observer.observe(c); });
  }

  function getShortUrl(url) {
    return url.replace(/^https?:\/\//, '').split('.')[0] + '.bytefort.xyz';
  }

  function applyFilter(filter) {
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    grid.querySelectorAll('.svc-card').forEach(function (card) {
      card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter);
    });
  }

  renderCards();
  applyFilter('all');

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyFilter(btn.dataset.filter);
    });
  });
})();

// ── Health Check ──────────────────────────────────────────
(function () {
  const API_URL = 'https://api.bytefort.xyz/metrics';
  const navStatus = document.getElementById('navStatus');
  const navDot = document.getElementById('navDot');
  const navText = document.getElementById('navText');
  const footDot = document.getElementById('footDot');
  const footStatus = document.getElementById('footStatus');
  const offlineBanner = document.getElementById('offlineBanner');
  const offlineMsg = document.getElementById('offlineMsg');
  const checkBtn = document.getElementById('checkBtn');
  const uptimePct = document.getElementById('uptimePct');
  const uptimeSuf = document.getElementById('uptimeSuf');
  
  let isOnline = false;
  let lastStatus = 'checking';
  
  function updateUI(online, status, pct, services) {
    isOnline = online;
    lastStatus = status;
    
    // Nav
    if (navStatus) {
      navStatus.classList.toggle('offline', !online);
      navStatus.classList.toggle('degraded', online && status === 'degraded');
      navDot.classList.toggle('offline', !online);
      navText.textContent = online ? (status === 'degraded' ? 'DEGRADED' : 'ONLINE') : 'OFFLINE';
      navText.classList.toggle('offline', !online);
      navText.classList.toggle('degraded', online && status === 'degraded');
    }
    
    // Footer
    if (footDot) footDot.classList.toggle('offline', !online);
    if (footStatus) footStatus.textContent = online ? 'All systems operational' : 'Connection lost';
    
    // Offline banner
    if (offlineBanner) {
      offlineBanner.classList.toggle('show', !online);
      if (!online) {
        offlineMsg.textContent = 'Connection lost — showing last known status';
      }
    }
    
    // Uptime percentage
    if (uptimePct) {
      if (pct !== undefined) {
        uptimePct.textContent = pct;
        if (uptimeSuf) uptimeSuf.hidden = false;
      } else if (!online) {
        uptimePct.textContent = 'N/A';
        if (uptimeSuf) uptimeSuf.hidden = true;
      }
    }
    
    // Service cards
    document.querySelectorAll('.svc-card').forEach(function (card) {
      const statusEl = card.querySelector('.svc-status span:last-child');
      const dot = card.querySelector('.svc-dot');
      const name = card.dataset.name;
      const svc = services ? services.find(function (s) { return s.name === name; }) : null;
      const up = svc ? svc.healthy : online;

      card.classList.toggle('offline', !up);
      dot.classList.toggle('offline', !up);
      statusEl.textContent = up ? 'active' : 'offline';
    });
  }
  
  async function checkHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 3000);
      
      const res = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      
      const data = await res.json();
      
      // Validate response shape
      if (!Array.isArray(data.services)) {
        throw new Error('Unexpected response shape');
      }
      
      // Check if any services are down
      let onlineCount = 0;
      let degraded = false;
      
      data.services.forEach(function (s) {
        if (s.healthy) onlineCount++;
        else if (s.degraded) degraded = true;
      });
      
      const total = data.services.length;
      const pct = total > 0 ? Math.round((onlineCount / total) * 100) : 0;
      
      if (total > 0 && onlineCount === total) {
        updateUI(true, 'healthy', pct, data.services);
      } else if (total > 0 && (degraded || onlineCount > total / 2)) {
        updateUI(true, 'degraded', pct, data.services);
      } else {
        updateUI(false, 'offline', pct, data.services);
      }
    } catch (err) {
      console.warn('Health check failed:', err.message);
      updateUI(false, 'offline');
    }
  }
  
  // Initial check
  checkHealth();
  
  // Periodic check
  setInterval(checkHealth, 30000);
  
  // Manual refresh
  if (checkBtn) {
    checkBtn.addEventListener('click', function () {
      checkBtn.textContent = 'CHECKING...';
      checkBtn.disabled = true;
      checkHealth().then(function () {
        checkBtn.textContent = 'REFRESH STATUS';
        checkBtn.disabled = false;
      });
    });
  }
})();

// ── Historical Uptime ─────────────────────────────────────
(function () {
  const UPTIME_API = 'https://api.bytefort.xyz/uptime';
  
  function applyUptimeData(data) {
    if (!data || !Array.isArray(data.services)) return;
    
    // Update hero with historical overall uptime
    const uptimePctEl = document.getElementById('uptimePct');
    if (uptimePctEl && data.overallUptime !== undefined) {
      uptimePctEl.textContent = data.overallUptime;
    }
    
    // Update service cards with progress bars and footer status
    document.querySelectorAll('.svc-card').forEach(function (card) {
      const name = card.dataset.name;
      if (!name) return;
      
      const svc = data.services.find(function (s) { return s.name === name; });
      if (!svc) return;
      
      // Set CSS custom property for progress bar width
      card.style.setProperty('--uptime-pct', svc.uptimePct + '%');
      
      // Update footer status and dot in sync with health check
      const statusEl = card.querySelector('.svc-status span:last-child');
      const dot = card.querySelector('.svc-dot');
      
      if (svc.lastStatus === 'online' && !svc.downtimeStart) {
        if (statusEl) statusEl.textContent = 'active';
        if (dot) dot.classList.remove('offline');
        card.classList.remove('offline');
      } else {
        if (svc.downtimeStart) {
          if (statusEl) statusEl.textContent = 'outage';
        } else {
          if (statusEl) statusEl.textContent = 'offline';
        }
        if (dot) dot.classList.add('offline');
        card.classList.add('offline');
      }
    });
  }
  
  async function fetchUptimeData() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 5000);
      
      const res = await fetch(UPTIME_API, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      
      const data = await res.json();
      applyUptimeData(data);
    } catch (err) {
      console.warn('Uptime fetch failed:', err.message);
    }
  }
  
  // Fetch historical uptime data
  fetchUptimeData();
  
  // Refresh every 2 minutes
  setInterval(fetchUptimeData, 120000);
})();

// ── Scroll Progress ───────────────────────────────────────
(function () {
  const bar = document.getElementById('progressBar');
  if (!bar) return;
  let frame = 0;

  function update() {
    frame = 0;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = progress + '%';
  }

  window.addEventListener('scroll', function () {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  update();
})();

// ── Mouse Glow ────────────────────────────────────────────
(function () {
  const glow = document.getElementById('mouseGlow');
  if (!glow || window.matchMedia('(hover: none)').matches) return;
  
  document.addEventListener('mousemove', function (e) {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  }, { passive: true });
})();

// ── Navbar Scroll ─────────────────────────────────────────
(function () {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }
  
  if (hamburger && menu) {
    const links = menu.querySelectorAll('.mobile-link');

    function closeMenu(restoreFocus) {
      hamburger.classList.remove('open');
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (restoreFocus) hamburger.focus();
    }

    hamburger.addEventListener('click', function () {
      const open = hamburger.classList.toggle('open');
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      hamburger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open && links.length) links[0].focus();
    });
    
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu(true);
      });
    });
    
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        closeMenu(true);
      } else if (e.key === 'Tab' && menu.classList.contains('open') && links.length) {
        const first = links[0];
        const last = links[links.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 769px)').matches && menu.classList.contains('open')) {
        closeMenu(false);
      }
    }, { passive: true });
  }
})();

// ── Hero Canvas Particles ─────────────────────────────────
(function () {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  let particles = [];
  let mouse = { x: -1000, y: -1000 };
  let w, h, dpr;
  let animId;
  let lastTime = 0;
  let resizing = false;
  
  function resize() {
    const oldW = w;
    const oldH = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth;
    h = canvas.offsetHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeParticles(oldW, oldH);
  }
  
  function resizeParticles(oldW, oldH) {
    const count = Math.min(80, Math.floor((w * h) / 15000));
    if (particles.length === count) {
      if (oldW && oldH) {
        const scaleX = w / oldW;
        const scaleY = h / oldH;
        particles.forEach(function (p) {
          p.x *= scaleX;
          p.y *= scaleY;
        });
      }
      particles.forEach(function (p) {
        if (p.x > w) p.x = Math.random() * w;
        if (p.y > h) p.y = Math.random() * h;
      });
      return;
    }
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5
      });
    }
  }
  
  function draw(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;
    
    ctx.clearRect(0, 0, w, h);
    
    const maxDist = 120;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Mouse repulsion
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100 && dist > 0) {
        p.x += (dx / dist) * 2;
        p.y += (dy / dist) * 2;
      }
      
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      if (p.x > w) { p.x = w; p.vx *= -1; }
      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      if (p.y > h) { p.y = h; p.vy *= -1; }
    }
    
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.15;
          ctx.strokeStyle = 'rgba(103, 232, 249, ' + alpha + ')';
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    
    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = 'rgba(103, 232, 249, 0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    animId = requestAnimationFrame(draw);
  }
  
  canvas.parentElement.addEventListener('mousemove', function (e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  
  canvas.parentElement.addEventListener('mouseleave', function () {
    mouse.x = -1000;
    mouse.y = -1000;
  });
  
  // Only run if hero is in viewport
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !reducedMotion && !resizing) {
        if (!animId) {
          resize();
          lastTime = 0;
          draw(0);
        }
      } else {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      }
    });
  }, { threshold: 0.1 });
  
  observer.observe(canvas.parentElement);
  
  // Throttled resize — no jank during zoom or window resize
  window.addEventListener('resize', function () {
    if (resizing) return;
    resizing = true;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    requestAnimationFrame(function () {
      resize();
      resizing = false;
      if (!reducedMotion && w && h && canvas.parentElement) {
        var r = canvas.parentElement.getBoundingClientRect();
        var inView = r.bottom > 0 && r.top < window.innerHeight;
        if (inView) {
          lastTime = 0;
          draw(0);
        }
      }
    });
  });
})();

// ── Scroll Reveal ───────────────────────────────────────
(function () {
  const reveals = document.querySelectorAll('.reveal-up:not(.svc-card)');
  if (!reveals.length) return;
  
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const delay = Math.min(parseInt(entry.target.dataset.index || 0, 10) % 6, 5) * 80;
        setTimeout(function () {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  
  reveals.forEach(function (el, i) {
    if (!el.dataset.index) el.dataset.index = i;
    observer.observe(el);
  });
})();

// ── Spec Card Mouse Tracking ────────────────────────────
(function () {
  if (window.matchMedia('(hover: none)').matches) return;
  const cards = document.querySelectorAll('.spec-card');
  cards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
    });
  });
})();
