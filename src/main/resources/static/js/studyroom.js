// =============================================================================
// studyroom.js — Gộp toàn bộ logic từ speaking-room.js + studyroom
// =============================================================================

// ---------- STATE ----------
let stompClient   = null;
let activeRoomId  = null;
let micStates     = {};        // userId -> boolean
let lastParticipants = [];

// ---------- UTILS ----------
function getUserId() {
    return window.KLEARN_USER_ID || null;
}

function _toast(msg, type = 'info') {
    // app.js của layout đã định nghĩa showToast globally
    if (typeof showToast === 'function') {
        _toast(msg, type);
    } else {
        console.warn('[studyroom]', msg);
    }
}

// =============================================================================
// MODAL TẠO PHÒNG
// =============================================================================

function openCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'flex';
}

function closeCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'none';
    document.getElementById('roomName').value = '';
    document.getElementById('roomDesc').value = '';
}

async function createRoom(event) {
    event.preventDefault();

    const name = document.getElementById('roomName').value.trim();
    const desc = document.getElementById('roomDesc').value.trim();
    const mode = document.querySelector('input[name="roomMode"]:checked')?.value || 'chat';

    if (!name) {
        _toast('Vui lòng nhập tên phòng', 'error');
        return;
    }

    try {
        const res = await fetch('/api/speaking-rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, maxParticipants: 10, description: desc })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            _toast(err.message || 'Tạo phòng thất bại', 'error');
            return;
        }

        const payload = await res.json();
        const room    = payload?.data;

        closeCreateRoomModal();
        await fetchAndRenderRooms();

        // Vào ngay phòng vừa tạo
        if (room?.roomId) {
            await _enterRoom(room, mode);
        }
    } catch (e) {
        console.error(e);
        _toast('Lỗi kết nối máy chủ', 'error');
    }
}

// =============================================================================
// THAM GIA PHÒNG QUA MÃ
// =============================================================================
async function joinRoomByCode() {
    const code = document.getElementById('joinRoomCode').value.trim();
    if (!code) {
        _toast('Vui lòng nhập mã phòng', 'error');
        return;
    }

    const roomId = Number(code);
    if (isNaN(roomId)) {
        _toast('Mã phòng không hợp lệ', 'error');
        return;
    }

    await joinRoom(roomId);
}

// =============================================================================
// DANH SÁCH PHÒNG
// =============================================================================
async function fetchAndRenderRooms() {
    try {
        const res = await fetch('/api/speaking-rooms');
        if (!res.ok) throw new Error('Failed');

        const payload = await res.json();
        const rooms   = payload?.data ?? [];

        const grid  = document.getElementById('roomGrid');
        const empty = document.getElementById('roomEmpty');

        if (rooms.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        grid.innerHTML = rooms.map(r => `
            <div class="room-card">
                <div class="room-card-header">
                    <span class="room-card-name">${escHtml(r.name || 'Phòng #' + r.roomId)}</span>
                    <span class="room-card-code">${r.roomId}</span>
                </div>
                <div class="room-card-desc">Tối đa ${r.maxParticipants ?? 10} người</div>
                <div class="room-card-footer">
                    <button class="btn btn-primary" type="button"
                            onclick="joinFromList(${r.roomId})">Tham gia</button>
                </div>
            </div>
        `).join('');
    } catch {
        const grid = document.getElementById('roomGrid');
        if (grid) grid.textContent = 'Không thể tải danh sách phòng.';
    }
}

async function joinFromList(roomId) {
    // Lấy thông tin phòng từ danh sách hiện có để render sidebar
    try {
        const res     = await fetch('/api/speaking-rooms');
        const payload = await res.json();
        const room    = (payload?.data ?? []).find(r => r.roomId === roomId);
        await joinRoom(roomId, room);
    } catch {
        await joinRoom(roomId, null);
    }
}

// =============================================================================
// JOIN / LEAVE PHÒNG (WebSocket + REST)
// =============================================================================
async function joinRoom(roomId, roomData = null) {
    activeRoomId     = roomId;
    micStates        = {};
    lastParticipants = [];

    await ensureStompConnection();
    subscribeRoomTopics(roomId);

    try {
        const res = await fetch(`/api/speaking-rooms/${roomId}/join`, { method: 'POST' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            _toast('Không thể tham gia phòng: ' + text, 'error');
            _resetRoomState();
            return;
        }
    } catch {
        _toast('Lỗi kết nối máy chủ', 'error');
        _resetRoomState();
        return;
    }

    _showRoomView(roomData || { roomId, name: 'Phòng #' + roomId });
    setMicButtonLabel(false);
}

async function leaveRoom() {
    if (!activeRoomId) return;

    await fetch(`/api/speaking-rooms/${activeRoomId}/leave`, { method: 'POST' }).catch(() => {});
    _resetRoomState();

    document.getElementById('roomView').style.display     = 'none';
    document.getElementById('roomListView').style.display = 'block';

    await fetchAndRenderRooms();
}

// Alias giữ tương thích nếu speaking-room.html còn được dùng tạm thời
function leaveCurrentRoom() { leaveRoom(); }

function _resetRoomState() {
    activeRoomId     = null;
    micStates        = {};
    lastParticipants = [];
}

// =============================================================================
// HIỂN THỊ GIAO DIỆN TRONG PHÒNG
// =============================================================================
function _showRoomView(room) {
    document.getElementById('roomListView').style.display = 'none';
    document.getElementById('roomView').style.display     = 'block';

    const name = room.name || ('Phòng #' + room.roomId);
    document.getElementById('roomViewName').textContent   = name;
    document.getElementById('roomViewCode').textContent   = room.roomId;
    document.getElementById('roomCodeCopy').textContent   = room.roomId + ' 📋';
    document.getElementById('roomDescText').textContent   = room.description || '';
    document.getElementById('roomOwnerName').textContent  =
        room.createdBy?.name || room.createdByName || '—';
    document.getElementById('roomModeName').textContent   =
        modeLabel(room.mode || room.roomMode);
}

// Gọi từ createRoom — truyền thêm mode
async function _enterRoom(room, mode) {
    room.mode = mode;
    await joinRoom(room.roomId, room);
}

function modeLabel(mode) {
    return { chat: 'Trò chuyện', flashcards: 'Flashcards', quiz: 'Quiz' }[mode] || 'Chat';
}

function copyRoomCode() {
    const code = document.getElementById('roomViewCode')?.textContent?.trim();
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => _toast('Đã sao chép mã phòng!', 'success'));
}

// =============================================================================
// TABS TRONG PHÒNG
// =============================================================================
function switchRoomTab(tab) {
    document.querySelectorAll('.room-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.roomTab === tab);
    });
    document.getElementById('roomChatTab').style.display        = tab === 'chat'       ? '' : 'none';
    document.getElementById('roomFlashcardsTab').style.display  = tab === 'flashcards' ? '' : 'none';
    document.getElementById('roomQuizTab').style.display        = tab === 'quiz'       ? '' : 'none';
}

// =============================================================================
// CHAT
// =============================================================================
function sendMessage() {
    const input = document.getElementById('chatInput');
    const text  = input?.value?.trim();
    if (!text || !stompClient?.connected || !activeRoomId) return;

    stompClient.send(
        `/app/speaking-room/${activeRoomId}/chat`,
        {},
        JSON.stringify({ userId: getUserId(), message: text })
    );
    input.value = '';
}

function _appendChatMessage(msg) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // Xoá welcome message nếu còn
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const isOwn   = msg.userId != null && String(msg.userId) === String(getUserId());
    const name    = escHtml(msg.userName || 'Người dùng');
    const text    = escHtml(msg.message  || '');
    const initial = name.charAt(0).toUpperCase();
    const time    = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = 'chat-message' + (isOwn ? ' own' : '');
    div.innerHTML = `
        <div class="chat-avatar">${initial}</div>
        <div class="chat-bubble">
            ${!isOwn ? `<div class="chat-bubble-name">${name}</div>` : ''}
            <div>${text}</div>
            <div class="chat-bubble-time">${time}</div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// =============================================================================
// WEBSOCKET — STOMP
// =============================================================================
function ensureStompConnection() {
    if (stompClient?.connected) return Promise.resolve();

    return new Promise((resolve) => {
        const socket = new SockJS('/ws');
        stompClient  = Stomp.over(socket);
        stompClient.debug = null; // tắt log STOMP spam

        stompClient.connect({}, () => {
            resolve();
        }, (err) => {
            console.error('STOMP connect error:', err);
            _toast('Không kết nối được WebSocket', 'error');
            resolve(); // vẫn resolve để không block UI
        });
    });
}

function subscribeRoomTopics(roomId) {
    if (!stompClient) return;

    // --- Danh sách người tham gia ---
    stompClient.subscribe(`/topic/speaking-room/${roomId}/participants`, (frame) => {
        try {
            const participants = JSON.parse(frame.body);
            lastParticipants   = Array.isArray(participants) ? participants : [];
            renderParticipants(lastParticipants);
        } catch (e) { console.error(e); }
    });

    // --- Trạng thái mic ---
    stompClient.subscribe(`/topic/speaking-room/${roomId}/mic`, (frame) => {
        try {
            const msg = JSON.parse(frame.body);
            if (msg?.userId != null) {
                micStates[msg.userId] = !!msg.micOn;
                renderParticipants(lastParticipants);
            }
        } catch (e) { console.error(e); }
    });

    // --- Chat ---
    stompClient.subscribe(`/topic/speaking-room/${roomId}/chat`, (frame) => {
        try {
            const msg = JSON.parse(frame.body);
            _appendChatMessage(msg);
        } catch (e) { console.error(e); }
    });
}

// =============================================================================
// RENDER PARTICIPANTS → roomMembersList (id của studyroom.html)
// =============================================================================
function renderParticipants(participants) {
    const list = Array.isArray(participants) ? participants : [];

    const countEl = document.getElementById('roomMemberCount');
    if (countEl) countEl.textContent = list.length;

    const container = document.getElementById('roomMembersList');
    if (!container) return;

    container.innerHTML = list.map(p => {
        const uid     = p.userId;
        const isOn    = uid != null && micStates[uid] === true;
        const name    = escHtml(p.userName || ('User #' + uid));
        const initial = name.charAt(0).toUpperCase();
        return `
            <div class="room-member">
                <div class="room-member-avatar">${initial}</div>
                <span class="room-member-name">${name}</span>
                ${isOn
                    ? '<span class="room-member-badge">🎙️ Đang nói</span>'
                    : '<span style="font-size:12px;color:var(--text-muted);">🔇</span>'}
                <div class="room-member-status"></div>
            </div>
        `;
    }).join('');
}

// =============================================================================
// MIC
// =============================================================================
function setMicButtonLabel(micOn) {
    // id="toggleMicBtn" trong studyroom.html
    const btn = document.getElementById('toggleMicBtn');
    if (btn) btn.textContent = '🎤 Mic: ' + (micOn ? 'ON' : 'OFF');
}

function toggleMic() {
    if (!activeRoomId) return;
    const userId = getUserId();
    if (userId == null) return;

    const next = !(micStates[userId] === true);
    micStates[userId] = next;
    setMicButtonLabel(next);

    if (stompClient?.connected) {
        stompClient.send(
            `/app/speaking-room/${activeRoomId}/mic`,
            {},
            JSON.stringify({ userId, micOn: next })
        );
    }
}

// Placeholder — mở rộng sau khi tích hợp WebRTC
function toggleVideo() {
    _toast('Tính năng camera đang được phát triển 🎥', 'info');
}

function deleteRoom() {
    _toast('Tính năng xoá phòng đang được phát triển', 'info');
}

// =============================================================================
// FLASHCARDS / QUIZ (placeholder — giữ function để HTML không bị lỗi)
// =============================================================================
function startCompetitiveFlashcards() { _toast('Flashcards thi đấu đang được phát triển 🃏', 'info'); }
function startCompetitiveQuiz()       { _toast('Quiz thi đấu đang được phát triển 🏆', 'info'); }
function startRoomQuiz()              { _toast('Quiz đang được phát triển 🏆', 'info'); }

// =============================================================================
// HELPER
// =============================================================================
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// =============================================================================
// INIT
// =============================================================================
function initStudyRoom() {
    fetchAndRenderRooms();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudyRoom);
} else {
    initStudyRoom();
}

// Expose toàn bộ ra window để inline onclick gọi được
window.openCreateRoomModal  = openCreateRoomModal;
window.closeCreateRoomModal = closeCreateRoomModal;
window.createRoom           = createRoom;
window.joinRoomByCode       = joinRoomByCode;
window.joinFromList         = joinFromList;
window.leaveRoom            = leaveRoom;
window.toggleMic            = toggleMic;
window.toggleVideo          = toggleVideo;
window.sendMessage          = sendMessage;
window.copyRoomCode         = copyRoomCode;
window.switchRoomTab        = switchRoomTab;
window.deleteRoom           = deleteRoom;
window.startCompetitiveFlashcards = startCompetitiveFlashcards;
window.startCompetitiveQuiz = startCompetitiveQuiz;
window.startRoomQuiz        = startRoomQuiz;