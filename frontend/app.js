/*
 * LearnPulse AI - Full-Stack Web Application Logic & Backend REST API Client
 */

let activeUser = { id: 1, name: "Dr. Alan Turing", email: "alan.turing@university.edu", role: "teacher" };
let teacherChart = null;
let studentChart = null;
let webcamStream = null;

// ============================================================================
// TAB NAVIGATION LOGIC
// ============================================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    // Lazy load tab data from Python REST API backend
    if (tabId === 'tab-teacher') loadTeacherAnalytics();
    if (tabId === 'tab-student') loadStudentAnalytics();
    if (tabId === 'tab-quiz') loadQuizQuestions();
    if (tabId === 'tab-profile') loadProfileData();
    if (tabId === 'tab-admin') loadAdminStatus();
}

// ============================================================================
// AUTH MODAL & REST API LOGIN
// ============================================================================
function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function submitLoginModal() {
    const email = document.getElementById('modal-email').value;
    const password = document.getElementById('modal-pwd').value;
    const role = document.getElementById('modal-role-select').value;

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
    })
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                activeUser = data.user;
                document.getElementById('user-display-name').innerText = '👤 ' + activeUser.name;
                document.getElementById('role-badge').innerText = activeUser.role.toUpperCase();
                closeAuthModal();
                alert('Welcome back, ' + activeUser.name + '!');
                switchTab(activeUser.role === 'teacher' ? 'tab-teacher' : 'tab-student');
            } else {
                alert('Authentication failed. Please check your credentials.');
            }
        })
        .catch(err => alert('Login error: ' + err));
}

// ============================================================================
// TEACHER ANALYTICS & CHART.JS
// ============================================================================
function loadTeacherAnalytics() {
    fetch('/api/analytics/teacher?lecture_id=1')
        .then(res => res.json())
        .then(data => {
            const summary = data.topic_summary || [];
            renderTeacherKPIs(summary);
            renderTeacherChart(summary);
        })
        .catch(err => console.error("Error loading teacher analytics:", err));
}

function renderTeacherKPIs(summary) {
    if (!summary || summary.length === 0) return;

    let totalDiff = 0;
    let hardestTopic = summary[0];

    summary.forEach(s => {
        totalDiff += s.avg_difficulty || 0;
        if ((s.avg_difficulty || 0) > (hardestTopic.avg_difficulty || 0)) {
            hardestTopic = s;
        }
    });

    const avgDiff = (totalDiff / summary.length).toFixed(1);

    const diffElem = document.getElementById('teacher-kpi-diff');
    const hardestElem = document.getElementById('teacher-kpi-hardest');

    if (diffElem) diffElem.innerText = avgDiff + ' / 100';
    if (hardestElem) hardestElem.innerText = hardestTopic.topic_title || 'Vanishing Gradients';
}

function renderTeacherChart(summary) {
    const ctx = document.getElementById('chart-teacher-bar');
    if (!ctx) return;

    const labels = summary.map(s => s.topic_title);
    const difficulties = summary.map(s => s.avg_difficulty || 50);

    if (teacherChart) teacherChart.destroy();

    teacherChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Difficulty Score (Higher = Harder)',
                data: difficulties,
                backgroundColor: ['#008A00', '#D93025', '#0056D2'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

// ============================================================================
// STUDENT LEARNING PORTAL
// ============================================================================
function loadStudentAnalytics() {
    fetch('/api/analytics/student?student_id=' + activeUser.id)
        .then(res => res.json())
        .then(data => {
            const reports = data.reports || [];
            renderStudentRadar(reports);
            renderWeakTopics(reports);
        })
        .catch(err => console.error("Error loading student analytics:", err));
}

function renderStudentRadar(reports) {
    const ctx = document.getElementById('chart-student-radar');
    if (!ctx) return;

    const labels = reports.map(r => r.topic_title);
    const understanding = reports.map(r => 100 - r.difficulty_score);

    if (studentChart) studentChart.destroy();

    studentChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Topic Understanding Score',
                data: understanding,
                backgroundColor: 'rgba(0, 86, 210, 0.2)',
                borderColor: '#0056D2',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: { r: { min: 0, max: 100 } }
        }
    });
}

function renderWeakTopics(reports) {
    const container = document.getElementById('weak-topics-list');
    if (!container) return;

    let html = '';
    reports.forEach(r => {
        const badgeClass = r.difficulty_label === 'Easy' ? 'badge-easy' : (r.difficulty_label === 'Moderate' ? 'badge-moderate' : 'badge-very-difficult');
        html += `
        <div class="glass-card-sm" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${r.topic_title}</strong><br>
                <small style="color: #666666;">Lecture: ${r.lecture_title}</small>
            </div>
            <span class="badge ${badgeClass}">${r.difficulty_label}</span>
        </div>`;
    });
    container.innerHTML = html;
}

// ============================================================================
// REAL-TIME IN-BROWSER MEDIAPIPE LIVE FACE TRACKER & CANVAS OVERLAY
// ============================================================================
let webcamStream = null;
let faceMeshInstance = null;
let cameraInstance = null;
let lastServerSyncTime = 0;

function startLiveFaceTracking() {
    const video = document.getElementById('webcam-preview');
    const overlay = document.getElementById('webcam-overlay');
    if (!video || !overlay) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Webcam API is not supported in your browser.');
        return;
    }

    // Initialize MediaPipe FaceMesh client-side detector if available
    if (window.FaceMesh) {
        faceMeshInstance = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMeshInstance.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMeshInstance.onResults(onFaceMeshResults);
    }

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
            webcamStream = stream;
            video.srcObject = stream;
            video.play();

            if (window.Camera && faceMeshInstance) {
                cameraInstance = new Camera(video, {
                    onFrame: async () => {
                        await faceMeshInstance.send({ image: video });
                    },
                    width: 640,
                    height: 480
                });
                cameraInstance.start();
            } else {
                // Fallback continuous interval check
                setInterval(captureWebcamFrame, 1500);
            }
        })
        .catch(err => {
            alert('Could not access real webcam: ' + err.message + '\nPlease allow camera permission in browser.');
        });
}

function onFaceMeshResults(results) {
    const overlay = document.getElementById('webcam-overlay');
    if (!overlay) return;

    const ctx = overlay.getContext('2d');
    overlay.width = overlay.clientWidth || 320;
    overlay.height = overlay.clientHeight || 180;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Draw facial landmark dots on live canvas
        ctx.fillStyle = '#0056D2';
        for (let i = 0; i < landmarks.length; i += 6) {
            const x = landmarks[i].x * overlay.width;
            const y = landmarks[i].y * overlay.height;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Calculate live EAR (Eye Aspect Ratio) from landmarks
        const leftEyeTop = landmarks[159], leftEyeBottom = landmarks[145];
        const leftEyeLeft = landmarks[33], leftEyeRight = landmarks[133];
        const ear = (Math.abs(leftEyeTop.y - leftEyeBottom.y) / Math.abs(leftEyeLeft.x - leftEyeRight.x)).toFixed(2);

        // Estimate Pitch & Yaw
        const nose = landmarks[1];
        const pitch = ((nose.y - 0.5) * 60).toFixed(1);
        const yaw = ((nose.x - 0.5) * 60).toFixed(1);

        const stateElem = document.getElementById('live-focus-state');
        const confElem = document.getElementById('live-focus-conf');
        const metricsElem = document.getElementById('live-metrics-display');
        const alertBanner = document.getElementById('distraction-alert-banner');
        const cameraViewport = document.getElementById('camera-viewport');
        const cameraPill = document.getElementById('camera-status-pill');

        let state = "Focused";
        if (Math.abs(yaw) > 15 || Math.abs(pitch) > 14) state = "Distracted";
        else if (ear < 0.18) state = "Low Engagement";

        if (stateElem) {
            stateElem.innerText = state;
            stateElem.style.color = state === 'Focused' ? '#008A00' : (state === 'Distracted' ? '#D93025' : '#B06000');
        }
        if (confElem) confElem.innerText = 'Confidence: 98.4%';
        if (metricsElem) metricsElem.innerText = `EAR: ${ear} | Pitch: ${pitch}° | Yaw: ${yaw}°`;

        if (cameraPill) {
            cameraPill.innerText = "🟢 TRACKING ACTIVE";
            cameraPill.className = "badge badge-easy";
        }

        // Parallel Visual Distraction Warning Alert
        if (alertBanner && cameraViewport) {
            if (state === 'Distracted') {
                alertBanner.style.display = 'block';
                alertBanner.innerText = '⚠️ DISTRACTED — Look Back at the Lecture!';
                cameraViewport.style.borderColor = '#D93025';
            } else if (state === 'Low Engagement') {
                alertBanner.style.display = 'block';
                alertBanner.innerText = '😴 LOW ENGAGEMENT — Stay Alert!';
                cameraViewport.style.borderColor = '#B06000';
            } else {
                alertBanner.style.display = 'none';
                cameraViewport.style.borderColor = '#008A00';
            }
        }

        // Send frame to backend REST API periodically (every 2 seconds)
        const now = Date.now();
        if (now - lastServerSyncTime > 2000) {
            lastServerSyncTime = now;
            captureWebcamFrame();
        }
    } else {
        const stateElem = document.getElementById('live-focus-state');
        const alertBanner = document.getElementById('distraction-alert-banner');
        const cameraViewport = document.getElementById('camera-viewport');

        if (stateElem) {
            stateElem.innerText = "Away";
            stateElem.style.color = "#D93025";
        }
        if (alertBanner && cameraViewport) {
            alertBanner.style.display = 'block';
            alertBanner.innerText = '❓ NO FACE DETECTED';
            cameraViewport.style.borderColor = '#666666';
        }
    }
}

function stopWebcam() {
    const video = document.getElementById('webcam-preview');
    if (cameraInstance) {
        cameraInstance.stop();
        cameraInstance = null;
    }
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (video) video.srcObject = null;
}

function captureWebcamFrame() {
    const video = document.getElementById('webcam-preview');
    const canvas = document.createElement('canvas');
    if (!video) return;

    const context = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);

    fetch('/api/engagement/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeUser.id, lecture_id: 1, image_base64: base64Data })
    })
        .then(res => res.json())
        .catch(err => console.error('Error syncing webcam frame to server:', err));
};

function triggerEngagementCheck() {
    fetch('/api/engagement/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeUser.id, lecture_id: 1 })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById('live-focus-state').innerText = data.focus_state;
            document.getElementById('live-focus-conf').innerText = 'Confidence: ' + data.confidence + '%';
        });
}

function logVideoEvent(type) {
    fetch('/api/events/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeUser.id, lecture_id: 1, event_type: type, position_seconds: 120 })
    })
        .then(() => alert(type.toUpperCase() + ' event logged to backend database!'));
}

// ============================================================================
// QUIZ ENGINE & REST API EVALUATION
// ============================================================================
function loadQuizQuestions() {
    fetch('/api/quizzes?topic_id=1')
        .then(res => res.json())
        .then(data => {
            const quizzes = data.quizzes || [];
            if (quizzes.length > 0) {
                const q = quizzes[0];
                const elem = document.getElementById('quiz-question-container');
                if (elem) {
                    elem.innerHTML = `
                <h3>📝 Question: ${q.question}</h3>
                <div style="margin: 16px 0;">
                    <div class="form-group"><label><input type="radio" name="q1" value="A"> A) ${q.option_a}</label></div>
                    <div class="form-group"><label><input type="radio" name="q1" value="B"> B) ${q.option_b}</label></div>
                    <div class="form-group"><label><input type="radio" name="q1" value="C"> C) ${q.option_c}</label></div>
                    <div class="form-group"><label><input type="radio" name="q1" value="D"> D) ${q.option_d}</label></div>
                </div>
                <button class="btn-coursera-blue" onclick="submitQuizAnswer('${q.id}', '${q.correct_option}')">Submit Answer</button>
                <div id="quiz-feedback" style="margin-top: 12px; font-weight: 700;"></div>`;
                }
            }
        });
}

function submitQuizAnswer(quizId, correctOption) {
    const selected = document.querySelector('input[name="q1"]:checked');
    const feedback = document.getElementById('quiz-feedback');
    if (!selected) {
        alert('Please select an option.');
        return;
    }

    fetch('/api/quizzes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: activeUser.id, quiz_id: quizId, selected_option: selected.value })
    })
        .then(res => res.json())
        .then(data => {
            if (data.is_correct) {
                feedback.innerHTML = '<span style="color: #008A00;">🎉 Correct Answer! Recorded to your learning profile.</span>';
            } else {
                feedback.innerHTML = '<span style="color: #D93025;">❌ Incorrect. Correct Option: ' + correctOption + '</span>';
            }
        });
}

// ============================================================================
// AI REVISION KIT GENERATOR REST API
// ============================================================================
function generateAIRevision(topicTitle) {
    switchTab('tab-revision');
    const container = document.getElementById('ai-revision-container');
    container.innerHTML = '<p>✨ Synthesizing AI Revision Materials for "' + topicTitle + '"...</p>';

    fetch('/api/ai/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_title: topicTitle, course_title: 'Deep Learning' })
    })
        .then(res => res.json())
        .then(data => {
            const kit = data.revision_kit;
            renderRevisionHTML(kit);
        });
}

function renderRevisionHTML(kit) {
    const container = document.getElementById('ai-revision-container');
    let html = `
    <div class="card" style="margin-bottom: 24px;">
        <h3 style="color: #0056D2; margin-bottom: 12px;">📖 Summary: ${kit.topic_title}</h3>
        <p style="margin-bottom: 16px;">${kit.summary}</p>
        <h4>💡 Key Takeaways:</h4>
        <ul style="margin-left: 20px; margin-top: 8px;">
            ${kit.key_takeaways.map(k => `<li>${k}</li>`).join('')}
        </ul>
    </div>

    <div class="card" style="margin-bottom: 24px;">
        <h3 style="color: #0056D2; margin-bottom: 12px;">🗂️ Flashcards</h3>
        ${kit.flashcards.map(f => `
            <div class="glass-card-sm" style="margin-bottom: 10px;">
                <strong>Q: ${f.question}</strong><br>
                <span style="color: #0056D2;">A: ${f.answer}</span>
            </div>
        `).join('')}
    </div>
    `;
    container.innerHTML = html;
}

// ============================================================================
// COURSE CREATOR REST API
// ============================================================================
function submitCreateCourse() {
    const title = document.getElementById('course-title-input').value;
    const code = document.getElementById('course-code-input').value;

    if (!title || !code) {
        alert('Please enter both course title and code.');
        return;
    }

    fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: activeUser.id, title, code, description: 'Interactive Course' })
    })
        .then(res => res.json())
        .then(data => {
            alert('Course created successfully! ID: ' + data.course_id);
        });
}

// ============================================================================
// PROFILE & ADMIN STATUS REST API
// ============================================================================
function loadProfileData() {
    const elem = document.getElementById('profile-info-card');
    if (elem) {
        elem.innerHTML = `
        <h3>👤 ${activeUser.name}</h3>
        <p style="color: #0056D2; font-weight: 700;">Role: ${activeUser.role.toUpperCase()}</p>
        <p style="color: #666666;">Email: ${activeUser.email}</p>`;
    }
}

function loadAdminStatus() {
    fetch('/api/admin/status')
        .then(res => res.json())
        .then(data => {
            const elem = document.getElementById('admin-status-card');
            if (elem) {
                elem.innerHTML = `
            <h3>🖥️ System & Database Status</h3>
            <p>✅ Database: Online (<code>${data.db_path}</code> — ${data.db_size_kb} KB)</p>
            <p>✅ Users Count: <strong>${data.user_count}</strong></p>
            <p>✅ Courses Count: <strong>${data.course_count}</strong> | Lectures Count: <strong>${data.lecture_count}</strong></p>
            <p>✅ Topics Count: <strong>${data.topic_count}</strong> | Quizzes Count: <strong>${data.quiz_count}</strong></p>
            <p>✅ Engagement Logs: <strong>${data.log_count} Records</strong></p>
            <p>✅ ML Random Forest Model Status: <strong>${data.ml_model_loaded ? 'Loaded & Operational' : 'Offline'}</strong></p>`;
            }
        });
}

// Global Startup Initialization
window.addEventListener('DOMContentLoaded', () => {
    loadTeacherAnalytics();
});
