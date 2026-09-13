const ERROR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Lost in Space</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0a0a1a;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Courier New', monospace;
            overflow: hidden;
            position: relative;
            cursor: crosshair;
        }

        canvas#stars {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
        }

        canvas#particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9;
            pointer-events: none;
        }

        .container {
            position: relative;
            z-index: 1;
            text-align: center;
            padding: 2rem;
            perspective: 1000px;
        }

        .content-wrapper {
            animation: content-float 6s ease-in-out infinite;
            transition: transform 0.3s ease;
        }

        @keyframes content-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        .error-code {
            font-size: clamp(100px, 20vw, 250px);
            font-weight: 900;
            position: relative;
            color: transparent;
            -webkit-text-stroke: 3px #00d4ff;
            text-shadow: none;
            letter-spacing: -5px;
            animation: float 3s ease-in-out infinite;
            user-select: none;
        }

        .error-code::before,
        .error-code::after {
            content: '404';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .error-code::before {
            color: #ff006e;
            animation: glitch-1 0.3s infinite linear alternate-reverse;
            clip-path: inset(0 0 60% 0);
            opacity: 0.8;
        }

        .error-code::after {
            color: #00ff88;
            animation: glitch-2 0.3s infinite linear alternate-reverse;
            clip-path: inset(60% 0 0 0);
            opacity: 0.8;
        }

        @keyframes glitch-1 {
            0% { transform: translate(0); }
            20% { transform: translate(-8px, 8px); }
            40% { transform: translate(-8px, -8px); }
            60% { transform: translate(8px, 8px); }
            80% { transform: translate(8px, -8px); }
            100% { transform: translate(0); }
        }

        @keyframes glitch-2 {
            0% { transform: translate(0); }
            20% { transform: translate(8px, -8px); }
            40% { transform: translate(8px, 8px); }
            60% { transform: translate(-8px, -8px); }
            80% { transform: translate(-8px, 8px); }
            100% { transform: translate(0); }
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }

        .astronaut {
            width: 150px;
            height: 150px;
            margin: 2rem auto;
            position: relative;
            animation: float-astronaut 4s ease-in-out infinite;
        }

        @keyframes float-astronaut {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-15px) rotate(5deg); }
            50% { transform: translateY(0) rotate(0deg); }
            75% { transform: translateY(-15px) rotate(-5deg); }
        }

        .astronaut svg {
            width: 100%;
            height: 100%;
            filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
        }

        .message {
            margin: 2rem 0;
        }

        .message h2 {
            color: #e0e0ff;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            letter-spacing: 3px;
            text-transform: uppercase;
        }

        .message p {
            color: #7a7a9e;
            font-size: 1.1rem;
            max-width: 500px;
            margin: 0 auto;
            line-height: 1.6;
        }

        .btn-home {
            display: inline-block;
            margin-top: 2.5rem;
            padding: 1rem 2.5rem;
            color: #00d4ff;
            text-decoration: none;
            border: 2px solid #00d4ff;
            border-radius: 50px;
            font-size: 1rem;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            text-transform: uppercase;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
        }

        .btn-home::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.3), transparent);
            transition: left 0.5s ease;
        }

        .btn-home:hover::before {
            left: 100%;
        }

        .btn-home:hover {
            background: rgba(0, 212, 255, 0.15);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.4);
            transform: translateY(-2px);
        }

        .btn-secondary {
            display: inline-block;
            margin-top: 2.5rem;
            margin-left: 1rem;
            padding: 1rem 2.5rem;
            color: #ff006e;
            text-decoration: none;
            border: 2px solid #ff006e;
            border-radius: 50px;
            font-size: 1rem;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            text-transform: uppercase;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            background: transparent;
        }

        .btn-secondary::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 0, 110, 0.3), transparent);
            transition: left 0.5s ease;
        }

        .btn-secondary:hover::before {
            left: 100%;
        }

        .btn-secondary:hover {
            background: rgba(255, 0, 110, 0.15);
            box-shadow: 0 0 30px rgba(255, 0, 110, 0.4);
            transform: translateY(-2px);
        }

        .scanline {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.03) 0px,
                rgba(0, 0, 0, 0.03) 1px,
                transparent 1px,
                transparent 2px
            );
            pointer-events: none;
            z-index: 10;
        }

        .orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.3;
            animation: orb-move 8s ease-in-out infinite;
        }

        .orb-1 {
            width: 300px;
            height: 300px;
            background: #ff006e;
            top: 10%;
            left: 10%;
            animation-delay: 0s;
        }

        .orb-2 {
            width: 400px;
            height: 400px;
            background: #00d4ff;
            bottom: 10%;
            right: 10%;
            animation-delay: -3s;
        }

        .orb-3 {
            width: 250px;
            height: 250px;
            background: #00ff88;
            top: 50%;
            left: 50%;
            animation-delay: -5s;
        }

        @keyframes orb-move {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(50px, -50px); }
            50% { transform: translate(-30px, 30px); }
            75% { transform: translate(30px, 50px); }
        }

        .terminal-text {
            color: #00ff88;
            font-size: 0.9rem;
            margin-top: 1.5rem;
            opacity: 0.7;
        }

        .terminal-text::before {
            content: '> ';
        }

        .cursor {
            display: inline-block;
            width: 8px;
            height: 1.2em;
            background: #00ff88;
            animation: blink 1s step-end infinite;
            vertical-align: text-bottom;
            margin-left: 2px;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }

        .coords {
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: #00d4ff;
            font-size: 0.75rem;
            opacity: 0.5;
            z-index: 11;
            pointer-events: none;
        }

        .timestamp {
            position: fixed;
            top: 20px;
            right: 20px;
            color: #00ff88;
            font-size: 0.75rem;
            opacity: 0.5;
            z-index: 11;
            pointer-events: none;
        }

        .hud-line {
            position: fixed;
            background: rgba(0, 212, 255, 0.15);
            z-index: 5;
            pointer-events: none;
        }

        .hud-line-left {
            left: 30px;
            top: 0;
            width: 1px;
            height: 100%;
            animation: hud-pulse 3s ease-in-out infinite;
        }

        .hud-line-right {
            right: 30px;
            top: 0;
            width: 1px;
            height: 100%;
            animation: hud-pulse 3s ease-in-out infinite 1.5s;
        }

        @keyframes hud-pulse {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.3; }
        }

        .signal-wave {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 50%;
            animation: signal-expand 3s ease-out infinite;
            pointer-events: none;
        }

        .signal-wave:nth-child(2) { animation-delay: 1s; }
        .signal-wave:nth-child(3) { animation-delay: 2s; }

        @keyframes signal-expand {
            0% {
                width: 50px;
                height: 50px;
                opacity: 0.8;
            }
            100% {
                width: 600px;
                height: 600px;
                opacity: 0;
            }
        }

        .data-stream {
            position: fixed;
            top: 0;
            right: 50px;
            width: 60px;
            height: 100%;
            z-index: 6;
            pointer-events: none;
            opacity: 0.3;
            overflow: hidden;
        }

        .data-column {
            position: absolute;
            width: 8px;
            font-size: 10px;
            line-height: 1.2;
            color: #00ff88;
            animation: data-flow linear infinite;
            opacity: 0;
        }

        @keyframes data-flow {
            0% { transform: translateY(-100%); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(100vh); opacity: 0; }
        }

        .warning-badge {
            display: inline-block;
            padding: 0.3rem 0.8rem;
            border: 1px solid #ff006e;
            color: #ff006e;
            font-size: 0.7rem;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 1.5rem;
            animation: warning-blink 2s ease-in-out infinite;
        }

        @keyframes warning-blink {
            0%, 100% { opacity: 1; border-color: #ff006e; }
            50% { opacity: 0.5; border-color: #ff006e55; }
        }

        .progress-bar {
            width: 300px;
            height: 3px;
            background: rgba(0, 212, 255, 0.1);
            margin: 2rem auto;
            border-radius: 2px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #00d4ff, #00ff88);
            border-radius: 2px;
            animation: progress-move 4s ease-in-out infinite;
        }

        @keyframes progress-move {
            0% { width: 0%; }
            50% { width: 100%; }
            100% { width: 0%; }
        }

        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 26, 0.9);
            z-index: 100;
            display: none;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
        }

        .modal-overlay.active {
            display: flex;
            animation: fade-in 0.3s ease;
        }

        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .modal {
            background: #12122a;
            border: 1px solid #00d4ff;
            border-radius: 10px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            position: relative;
            box-shadow: 0 0 50px rgba(0, 212, 255, 0.2);
            animation: modal-slide 0.3s ease;
        }

        @keyframes modal-slide {
            from { transform: scale(0.9) translateY(20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .modal h3 {
            color: #00d4ff;
            margin-bottom: 1rem;
            letter-spacing: 2px;
        }

        .modal p {
            color: #7a7a9e;
            font-size: 0.9rem;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }

        .modal-close {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: none;
            border: none;
            color: #ff006e;
            font-size: 1.5rem;
            cursor: pointer;
            font-family: 'Courier New', monospace;
        }

        .modal-close:hover {
            color: #ff006e;
            text-shadow: 0 0 10px rgba(255, 0, 110, 0.5);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-top: 1rem;
        }

        .stat-card {
            background: rgba(0, 212, 255, 0.05);
            border: 1px solid rgba(0, 212, 255, 0.2);
            padding: 1rem;
            border-radius: 5px;
        }

        .stat-card .label {
            font-size: 0.65rem;
            color: #5a5a7e;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }

        .stat-card .value {
            font-size: 1.1rem;
            color: #00d4ff;
        }
    </style>
</head>
<body>
    <canvas id="stars"></canvas>
    <canvas id="particles"></canvas>
    
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    
    <div class="hud-line hud-line-left"></div>
    <div class="hud-line hud-line-right"></div>
    
    <div class="data-stream" id="dataStream"></div>
    
    <div class="coords" id="coords">LAT: 00.0000 | LON: 00.0000</div>
    <div class="timestamp" id="timestamp">0000-00-00 00:00:00 UTC</div>
    
    <div class="container">
        <div class="content-wrapper" id="contentWrapper">
            <div class="warning-badge">⚠ Navigation Failure</div>
            
            <div class="error-code">404</div>
            
            <div class="astronaut">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="suitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#e0e0ff;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#a0a0cc;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <rect x="45" y="65" width="110" height="80" rx="15" fill="#8888aa" />
                    <rect x="55" y="70" width="90" height="75" rx="20" fill="url(#suitGrad)" />
                    <circle cx="100" cy="55" r="40" fill="url(#suitGrad)" />
                    <ellipse cx="100" cy="55" rx="28" ry="26" fill="#0a0a2e" />
                    <defs>
                        <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.8" />
                            <stop offset="100%" style="stop-color:#ff006e;stop-opacity:0.4" />
                        </linearGradient>
                    </defs>
                    <ellipse cx="100" cy="50" rx="22" ry="16" fill="url(#visorGrad)" opacity="0.5"/>
                    <ellipse cx="110" cy="47" rx="8" ry="5" fill="rgba(255,255,255,0.3)" transform="rotate(-20 110 47)"/>
                    <path d="M 45 105 Q 20 120 25 150 Q 30 180 15 195" fill="none" stroke="#6666aa" stroke-width="2" stroke-dasharray="5,5"/>
                    <path d="M 55 90 Q 30 100 25 130" fill="none" stroke="url(#suitGrad)" stroke-width="20" stroke-linecap="round"/>
                    <path d="M 145 90 Q 170 80 175 55" fill="none" stroke="url(#suitGrad)" stroke-width="20" stroke-linecap="round"/>
                    <path d="M 75 140 Q 65 165 60 185" fill="none" stroke="url(#suitGrad)" stroke-width="22" stroke-linecap="round"/>
                    <path d="M 125 140 Q 135 160 145 180" fill="none" stroke="url(#suitGrad)" stroke-width="22" stroke-linecap="round"/>
                    <line x1="100" y1="15" x2="100" y2="0" stroke="#a0a0cc" stroke-width="2"/>
                    <circle cx="100" cy="0" r="3" fill="#00d4ff">
                        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                
                <div class="signal-wave"></div>
                <div class="signal-wave"></div>
                <div class="signal-wave"></div>
            </div>
            
            <div class="message">
                <h2>Houston, We Have a Problem</h2>
                <p>This page seems to have drifted off into deep space. It may have been removed, renamed, or never existed at all.</p>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            
            <div>
                <a href="/" class="btn-home">Return Home</a>
                <button class="btn-secondary" onclick="showModal()">Report Incident</button>
            </div>
            
            <div class="terminal-text">
                scanning sector <span id="sector">UNKNOWN</span><span class="cursor"></span>
            </div>
        </div>
    </div>
    
    <div class="scanline"></div>
    
    <div class="modal-overlay" id="modal">
        <div class="modal">
            <button class="modal-close" onclick="hideModal()">×</button>
            <h3>Incident Report</h3>
            <p>Coordinate anomaly detected in this sector. The missing page may be located in an alternate dimension or permanently lost to the void.</p>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Status</div>
                    <div class="value" style="color: #ff006e;">MISSING</div>
                </div>
                <div class="stat-card">
                    <div class="label">Signal</div>
                    <div class="value" id="signalStrength">WEAK</div>
                </div>
                <div class="stat-card">
                    <div class="label">Distance</div>
                    <div class="value" id="distance">—</div>
                </div>
                <div class="stat-card">
                    <div class="label">Attempts</div>
                    <div class="value" id="attempts">0</div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Stars background
        const starsCanvas = document.getElementById('stars');
        const starsCtx = starsCanvas.getContext('2d');
        
        let width, height;
        let stars = [];
        let shootingStars = [];
        
        function resizeStars() {
            width = window.innerWidth;
            height = window.innerHeight;
            starsCanvas.width = width;
            starsCanvas.height = height;
        }
        
        function initStars() {
            stars = [];
            const count = Math.floor((width * height) / 4000);
            for (let i = 0; i < count; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 1.5 + 0.2,
                    opacity: Math.random(),
                    speed: Math.random() * 0.02 + 0.005,
                    direction: Math.random() > 0.5 ? 1 : -1
                });
            }
        }
        
        function initShootingStars() {
            if (Math.random() > 0.985) {
                shootingStars.push({
                    x: Math.random() * width,
                    y: 0,
                    length: Math.random() * 80 + 40,
                    speed: Math.random() * 6 + 4,
                    angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
                    opacity: 1,
                    decay: Math.random() * 0.015 + 0.01
                });
            }
        }
        
        function animateStars() {
            starsCtx.fillStyle = '#0a0a1a';
            starsCtx.fillRect(0, 0, width, height);
            
            stars.forEach(star => {
                star.opacity += star.speed * star.direction;
                if (star.opacity >= 1) { star.opacity = 1; star.direction = -1; }
                if (star.opacity <= 0.1) { star.opacity = 0.1; star.direction = 1; }
                starsCtx.beginPath();
                starsCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                starsCtx.fillStyle = \`rgba(200, 220, 255, \${star.opacity})\`;
                starsCtx.fill();
            });
            
            initShootingStars();
            
            shootingStars.forEach((star, index) => {
                const tailX = star.x - Math.cos(star.angle) * star.length;
                const tailY = star.y - Math.sin(star.angle) * star.length;
                const gradient = starsCtx.createLinearGradient(tailX, tailY, star.x, star.y);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                gradient.addColorStop(1, \`rgba(255, 255, 255, \${star.opacity})\`);
                starsCtx.beginPath();
                starsCtx.moveTo(tailX, tailY);
                starsCtx.lineTo(star.x, star.y);
                starsCtx.strokeStyle = gradient;
                starsCtx.lineWidth = 1.5;
                starsCtx.stroke();
                star.x += Math.cos(star.angle) * star.speed;
                star.y += Math.sin(star.angle) * star.speed;
                star.opacity -= star.decay;
                if (star.opacity <= 0 || star.x > width || star.y > height) {
                    shootingStars.splice(index, 1);
                }
            });
            
            requestAnimationFrame(animateStars);
        }
        
        // Particle trail following cursor
        const pCanvas = document.getElementById('particles');
        const pCtx = pCanvas.getContext('2d');
        let particles = [];
        let mouseX = 0, mouseY = 0;
        
        function resizeParticles() {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
        }
        
        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.size = Math.random() * 3 + 1;
                this.speedX = (Math.random() - 0.5) * 2;
                this.speedY = (Math.random() - 0.5) * 2;
                this.life = 1;
                this.decay = Math.random() * 0.02 + 0.01;
                this.color = Math.random() > 0.5 ? '0, 212, 255' : '0, 255, 136';
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life -= this.decay;
            }
            draw() {
                pCtx.beginPath();
                pCtx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
                pCtx.fillStyle = \`rgba(\${this.color}, \${this.life})\`;
                pCtx.fill();
            }
        }
        
        document.addEventListener('mousemove', (e) => {
            mouseX = e.pageX;
            mouseY = e.pageY;
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(e.pageX, e.pageY));
            }
            // Update coords display
            const lat = (Math.random() * 180 - 90).toFixed(4);
            const lon = (Math.random() * 360 - 180).toFixed(4);
            document.getElementById('coords').textContent = \`LAT: \${lat} | LON: \${lon}\`;
        });
        
        function animateParticles() {
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            });
            requestAnimationFrame(animateParticles);
        }
        
        // Parallax effect
        document.addEventListener('mousemove', (e) => {
            const wrapper = document.getElementById('contentWrapper');
            const x = (e.clientX - window.innerWidth / 2) / 50;
            const y = (e.clientY - window.innerHeight / 2) / 50;
            wrapper.style.transform = \`rotateY(\${x}deg) rotateX(\${-y}deg)\`;
        });
        
        // Data stream effect
        function initDataStream() {
            const stream = document.getElementById('dataStream');
            for (let i = 0; i < 5; i++) {
                const col = document.createElement('div');
                col.className = 'data-column';
                col.style.left = (i * 15) + 'px';
                col.style.animationDuration = (Math.random() * 5 + 5) + 's';
                col.style.animationDelay = (Math.random() * 5) + 's';
                let text = '';
                for (let j = 0; j < 50; j++) {
                    text += Math.random() > 0.5 ? '1' : '0' + '\\n';
                }
                col.textContent = text;
                stream.appendChild(col);
            }
        }
        
        // Timestamp
        function updateTimestamp() {
            const now = new Date();
            const iso = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            document.getElementById('timestamp').textContent = iso;
        }
        
        // Modal
        let attemptCount = 0;
        function showModal() {
            attemptCount++;
            document.getElementById('attempts').textContent = attemptCount;
            document.getElementById('signalStrength').textContent = ['STRONG', 'MODERATE', 'WEAK', 'NONE'][Math.floor(Math.random() * 4)];
            document.getElementById('distance').textContent = (Math.random() * 1000).toFixed(1) + ' LY';
            document.getElementById('modal').classList.add('active');
        }
        
        function hideModal() {
            document.getElementById('modal').classList.remove('active');
        }
        
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal')) hideModal();
        });
        
        // Sector scanner
        const sectors = ['ALPHA-CENTAURI', 'ORION-BELT', 'KEPLER-442', 'TRAPPIST-1', 'ANDROMEDA', 'PERSEUS-ARM', 'VEGA-SECTOR', 'CYGNUS-X', 'LYRAE-DISTRICT'];
        setInterval(() => {
            document.getElementById('sector').textContent = sectors[Math.floor(Math.random() * sectors.length)];
        }, 2500);
        
        // Init everything
        window.addEventListener('resize', () => {
            resizeStars();
            initStars();
            resizeParticles();
        });
        
        resizeStars();
        resizeParticles();
        initStars();
        initDataStream();
        animateStars();
        animateParticles();
        updateTimestamp();
        setInterval(updateTimestamp, 1000);
    </script>
</body>
</html>
`;

export default {
  async fetch(request) {
    return new Response(ERROR_HTML, {
      status: 404,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });
  }
};
