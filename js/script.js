// Initialize Firebase (Safely)
let database;
let roomId = null;
let isHost = true;
let isViewer = false;
let isConnected = false;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebaseConfig && firebaseConfig.apiKey) {
            firebase.initializeApp(firebaseConfig);
            database = firebase.database();
            console.log("Firebase initialized successfully");
        } else {
            console.log('Firebase config missing or incomplete. Using Local Mode.');
            disableHostingUI();
        }
    } catch (e) {
        console.error('Firebase initialization failed:', e);
        console.log('Using Local Mode.');
        disableHostingUI();
    }
}

function disableHostingUI() {
    // Hide or disable elements related to hosting/rooms
    const roomSection = document.getElementById('roomIdSection');
    const liveSection = document.getElementById('liveSection');

    if (roomSection) {
        roomSection.innerHTML = `
            <div style="text-align: center; color: #666; font-style: italic;">
                Multiplayer mode is currently disabled.<br>
                <small>Configure js/config.js to enable Rooms.</small>
            </div>
        `;
    }

    if (liveSection) {
        liveSection.style.display = 'none';
    }
}

let names = [];
let isSpinning = false;
let totalSpins = 0;
let canvas, ctx;
let currentRotation = 0;
let colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5',
    '#85C1E9', '#F39C12', '#E74C3C', '#3498DB', '#2ECC71'
];

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createNewRoom() {
    if (!database) return; // Guard clause for local mode

    roomId = generateRoomId();
    isHost = true;
    isViewer = false;
    document.getElementById('roomIdText').textContent = roomId;
    document.getElementById('joinRoomSection').style.display = 'none';
    document.getElementById('liveSection').style.display = 'flex';
    document.getElementById('liveSection').classList.remove('viewer');
    document.getElementById('liveStatusText').textContent = 'Hosting';

    // Initialize room with createdAt timestamp for security
    const roomRef = database.ref(`rooms/${roomId}`);
    roomRef.set({
        names: [],
        totalSpins: 0,
        currentRotation: 0,
        viewers: 0,
        createdAt: Date.now(),
        lastUpdate: Date.now()
    }).then(() => {
        connectToRoom();
    }).catch(err => console.error("Firebase Error:", err));
}

function showJoinSection() {
    if (!database) return;
    document.getElementById('joinRoomSection').style.display = 'block';
}

function joinRoom() {
    if (!database) return;

    const input = document.getElementById('joinRoomInput');
    const id = input.value.trim().toUpperCase();
    if (id.length === 6) {
        roomId = id;
        isHost = false;
        isViewer = true;
        document.getElementById('roomIdText').textContent = roomId;
        document.getElementById('joinRoomSection').style.display = 'none';
        document.getElementById('liveSection').style.display = 'flex';
        document.getElementById('liveSection').classList.add('viewer');
        document.getElementById('liveStatusText').textContent = 'Watching';
        document.querySelector('.controls-section').classList.add('viewer-mode');

        connectToRoom();
    } else {
        alert('Please enter a valid 6-character Room ID');
    }
}

function copyRoomId() {
    const roomIdText = document.getElementById('roomIdText').textContent;
    navigator.clipboard.writeText(roomIdText).then(() => {
        // Since we don't pass event in HTML anymore cleanly, we'll find the button differently or rely on existing logic
        // But for safety, let's just alert or console log if button ref is tricky without the event object
        // The original code used `event.target`, which is deprecated/risky in strict mode but works in browsers.
        // We'll trust the browser global `event` or just skip the UI update for simplicity if it fails.
        alert("Room ID copied!");
    });
}

function connectToRoom() {
    if (!database || !roomId) return;

    const roomRef = database.ref(`rooms/${roomId}`);

    // Listen for changes
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Sync names
            if (data.names && Array.isArray(data.names)) {
                names = data.names;
                updateNamesList();
                updateStats();
                drawWheel();
            }

            // Sync total spins
            if (data.totalSpins !== undefined) {
                totalSpins = data.totalSpins;
                document.getElementById('totalSpins').textContent = totalSpins;
            }

            // Sync current rotation
            if (data.currentRotation !== undefined) {
                currentRotation = data.currentRotation;
                drawWheel();
            }

            // Sync winner
            if (data.winner) {
                document.getElementById('winnerDisplay').textContent = `Winner: ${data.winner}! 🎉`;
            }

            // Update viewer count
            if (data.viewers !== undefined) {
                document.getElementById('viewerCount').textContent = `${data.viewers} viewer${data.viewers !== 1 ? 's' : ''}`;
            }
        }
    });

    // Listen for spin events
    roomRef.child('spinEvent').on('value', (snapshot) => {
        const spinData = snapshot.val();
        if (spinData && !isHost) {
            // Viewer receives spin command
            triggerSpinFromRemote(spinData);
        }
    });

    isConnected = true;

    // Update viewer count
    if (isHost) {
        updateViewerCount();
    } else {
        incrementViewerCount();
    }
}

function updateViewerCount() {
    if (!database || !roomId || !isHost) return;
    const roomRef = database.ref(`rooms/${roomId}`);
    roomRef.child('viewers').once('value', (snapshot) => {
        const count = snapshot.val() || 0;
        roomRef.update({ viewers: count });
    });
}

function incrementViewerCount() {
    if (!database || !roomId || isHost) return;
    const roomRef = database.ref(`rooms/${roomId}`);
    roomRef.child('viewers').transaction((current) => {
        return (current || 0) + 1;
    });
}

function syncToFirebase() {
    if (!database || !roomId || !isHost || !isConnected) return;

    const roomRef = database.ref(`rooms/${roomId}`);
    const updateData = {
        names: names,
        totalSpins: totalSpins,
        currentRotation: currentRotation,
        lastUpdate: Date.now()
    };

    // Only update if names array is reasonable size (security)
    if (names.length <= 100) {
        roomRef.update(updateData).catch((error) => {
            console.error('Firebase sync error:', error);
        });
    }
}

function broadcastSpin(spinData) {
    if (!database || !roomId || !isHost) return;
    const roomRef = database.ref(`rooms/${roomId}`);
    roomRef.child('spinEvent').set(spinData);
    // Clear after a delay
    setTimeout(() => {
        roomRef.child('spinEvent').remove();
    }, 100);
}

function triggerSpinFromRemote(spinData) {
    if (isSpinning) return;

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('spinBtn').textContent = 'Spinning...';
    document.getElementById('winnerDisplay').textContent = 'Spinning...';

    const { intensity, duration, spins, randomAngle, startRotation } = spinData;
    const totalRotation = spins * Math.PI * 2 + randomAngle;
    const startTime = Date.now();
    currentRotation = startRotation;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentRotation = startRotation + totalRotation * easeOut;

        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Calculate winner
            let winnerIndex = Math.floor(-currentRotation / ((Math.PI * 2) / names.length));
            winnerIndex = ((winnerIndex % names.length) + names.length) % names.length;

            const winner = names[winnerIndex];
            document.getElementById('winnerDisplay').textContent = `Winner: ${winner}! 🎉`;

            isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('spinBtn').textContent = 'Spin Wheel';
        }
    }

    animate();
}

function init() {
    initFirebase();

    canvas = document.getElementById('wheelCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    drawWheel();

    // Auto-create room on load ONLY if database is active
    if (database) {
        createNewRoom();
    }
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.offsetWidth, 500);
    // Handle DPI for sharper text
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    drawWheel();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        addName();
    }
}

function addName() {
    if (isViewer) return;

    const input = document.getElementById('nameInput');
    const name = input.value.trim();

    if (name === '') {
        return;
    }

    names.push(name);
    input.value = '';
    updateNamesList();
    updateStats();
    drawWheel();
    syncToFirebase();
    startIdleSpin();
}

function removeName(index) {
    if (isViewer) return;

    names.splice(index, 1);
    updateNamesList();
    updateStats();
    updateNamesList();
    updateStats();
    drawWheel();
    syncToFirebase();
    startIdleSpin();
}

function updateNamesList() {
    const list = document.getElementById('namesList');

    if (names.length === 0) {
        list.innerHTML = '<div class="empty-state">No names added yet. Add names to get started!</div>';
        return;
    }

    list.innerHTML = names.map((name, index) => `
        <div class="name-item">
            <span class="name-text">${name}</span>
            <button class="btn-remove" onclick="removeName(${index})">Remove</button>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalNames').textContent = names.length;
}

function shuffleNames() {
    if (isViewer || names.length === 0) return;

    for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
    }

    updateNamesList();
    updateNamesList();
    drawWheel();
    syncToFirebase();
    startIdleSpin();
}

function clearAll() {
    if (isViewer) return;

    if (confirm('Are you sure you want to clear all names?')) {
        names = [];
        totalSpins = 0;
        currentRotation = 0;
        updateNamesList();
        updateStats();
        updateNamesList();
        updateStats();
        drawWheel();
        stopIdleSpin(); // Stop if cleared
        document.getElementById('winnerDisplay').textContent = 'Add names and spin the wheel!';

        // Update Firebase with cleared state
        if (database && roomId && isConnected) {
            const roomRef = database.ref(`rooms/${roomId}`);
            roomRef.update({
                names: [],
                totalSpins: 0,
                currentRotation: 0,
                winner: null,
                lastUpdate: Date.now()
            }).catch((error) => {
                console.error('Firebase clear error:', error);
            });
        }
    }
}

function drawWheel() {
    // We used scale() in resizeCanvas, so we work with logical coords (size)
    // but need to be careful with clearing
    // canvas.width/height are physical pixels

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    if (names.length === 0) {
        ctx.fillStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, width / 2 - 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#999';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Add names to start', width / 2, height / 2);
        return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const anglePerItem = (Math.PI * 2) / names.length;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentRotation);

    names.forEach((name, index) => {
        const startAngle = index * anglePerItem - Math.PI / 2;
        const endAngle = (index + 1) * anglePerItem - Math.PI / 2;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        const midAngle = (startAngle + endAngle) / 2;
        ctx.rotate(midAngle);

        // Adjust alignment for better readability
        // If we just draw normally, text goes left->right away from center
        // To fix "sticking out", we align right at the edge (so it grows inwards)
        // To fix "upside down", we check the angle

        let textRadius = radius - 20; // Padding from edge
        let textAlign = 'right';
        let rotationAdjustment = 0;

        // Calculate true angle including wheel rotation, normalized to 0-2PI
        // Wheel rotates clockwise (positive), but we want to check visual position
        let visualAngle = (midAngle + currentRotation) % (Math.PI * 2);
        if (visualAngle < 0) visualAngle += Math.PI * 2;

        // If text is on the left side (90 to 270 degrees), flip it 180 and align LEFT at same radius?
        // Actually, if we flip 180, 'right' alignment at positive X becomes 'left' alignment at negative X
        // But we are in a rotated context.
        // Let's just rotate 180 if needed.

        if (visualAngle > Math.PI / 2 && visualAngle < 3 * Math.PI / 2) {
            ctx.rotate(Math.PI);
            ctx.textAlign = 'left';
            textRadius = -textRadius;
            // Logic: rotated 180, so positive x is now "left" visually?
            // No, rotated 180: x axis points LEFT. y axis points UP.
            // If we want text at the edge, that is now negative x.
            // And if we aligned right, we now specified the START of the text at edge?
            // Let's visualize: 
            // Standard: -> Text ends at edge.
            // Flipped: <- Text starts at edge? No, we still want it to read 'Name'.
            // Simplest: Always draw "from center out" or "from edge in" consistently.
            // The user likely wants "base of text towards center" vs "base of text away".
            // Let's stick to: Text always upright.

            // If flipped:
            textAlign = 'left';
            textRadius = -(radius - 20);
        } else {
            ctx.textAlign = 'right';
            textRadius = radius - 20;
        }

        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.min(18, radius / 8)}px Arial`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;

        const maxWidth = radius * 0.7; // Ensure it doesn't hit center
        let displayName = name;

        // Truncate long names
        const metrics = ctx.measureText(name);
        if (metrics.width > maxWidth) {
            displayName = name.substring(0, Math.floor(name.length * (maxWidth / metrics.width))) + '...';
        }

        ctx.fillText(displayName, textRadius, 0);
        ctx.restore();
    });

    ctx.restore();
}

function updateSpinLabel() {
    const slider = document.getElementById('spinIntensity');
    const value = parseInt(slider.value);
    const label = document.getElementById('spinIntensityLabel');
    const valueDisplay = document.getElementById('spinValue');

    valueDisplay.textContent = value;

    // Update label text based on value
    if (value <= 2) {
        label.textContent = 'Quick';
    } else if (value <= 4) {
        label.textContent = 'Medium';
    } else if (value <= 7) {
        label.textContent = 'Long';
    } else {
        label.textContent = 'Epic';
    }
}

function spinWheel() {
    if (isViewer) return;

    if (names.length === 0) {
        alert('Please add at least one name before spinning!');
        return;
    }

    if (isSpinning) {
        return;
    }

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('spinBtn').textContent = 'Spinning...';
    document.getElementById('winnerDisplay').textContent = 'Spinning...';

    // Get spin intensity from slider (1-10)
    const intensity = parseInt(document.getElementById('spinIntensity').value);

    // Calculate duration: 1-2 seconds for intensity 1, up to 8-12 seconds for intensity 10
    const minDuration = 1000 + (intensity - 1) * 700; // 1000ms to 7300ms
    const maxDuration = 2000 + (intensity - 1) * 1000; // 2000ms to 11000ms
    const duration = minDuration + Math.random() * (maxDuration - minDuration);

    // Calculate rotations: 2-4 for intensity 1, up to 8-15 for intensity 10
    const minRotations = 2 + (intensity - 1) * 0.6; // 2 to 7.4
    const maxRotations = 4 + (intensity - 1) * 1.1; // 4 to 13.9
    const spins = minRotations + Math.random() * (maxRotations - minRotations);

    const randomAngle = Math.random() * Math.PI * 2;
    const totalRotation = spins * Math.PI * 2 + randomAngle;
    const startTime = Date.now();
    const startRotation = currentRotation;

    // Broadcast spin to viewers
    if (isConnected) {
        broadcastSpin({
            intensity,
            duration,
            spins,
            randomAngle,
            startRotation,
            timestamp: Date.now()
        });
    }

    stopIdleSpin(); // Stop idle movement before big spin

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentRotation = startRotation + totalRotation * easeOut;

        drawWheel();

        // Sync rotation during spin
        if (isConnected && progress < 1) {
            syncToFirebase();
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Calculate winner
            let winnerIndex = Math.floor(-currentRotation / ((Math.PI * 2) / names.length));
            winnerIndex = ((winnerIndex % names.length) + names.length) % names.length;

            const winner = names[winnerIndex];
            document.getElementById('winnerDisplay').textContent = `Winner: ${winner}! 🎉`;
            totalSpins++;
            document.getElementById('totalSpins').textContent = totalSpins;

            // Sync final state
            if (isConnected) {
                syncToFirebase();
                const roomRef = database.ref(`rooms/${roomId}`);
                roomRef.update({ winner: winner });
            }

            isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('spinBtn').textContent = 'Spin Wheel';

            // Resume idle spin after longer delay (20 seconds) as requested
            setTimeout(startIdleSpin, 20000);
        }
    }

    animate();
}

let idleAnimationId = null;

function startIdleSpin() {
    if (isSpinning || names.length === 0) return;
    if (idleAnimationId) cancelAnimationFrame(idleAnimationId);

    function idleLoop() {
        if (isSpinning || names.length === 0) {
            idleAnimationId = null;
            return;
        }

        currentRotation += 0.002; // Very slow speed
        if (currentRotation >= Math.PI * 2) {
            currentRotation -= Math.PI * 2;
        }

        drawWheel();
        // Sync rotation occasionally during idle if hosting
        if (isConnected && isHost && Math.random() < 0.01) { // Throttle updates
            // Optional: Don't flood valid spin events, but maybe sync state?
            // Actually, continuous syncing might differ from clients. 
            // Best to just let clients idle on their own or sync start pos.
            // For now, simple local idle is fine.
        }

        idleAnimationId = requestAnimationFrame(idleLoop);
    }

    idleLoop();
}

function stopIdleSpin() {
    if (idleAnimationId) {
        cancelAnimationFrame(idleAnimationId);
        idleAnimationId = null;
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    init();
    // Try to start idle spin if names exist
    if (names.length > 0) startIdleSpin();
});
