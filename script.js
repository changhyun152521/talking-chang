// 방명록 데이터 관리
class GuestbookManager {
    constructor() {
        this.guestbooks = [];
        this.searchTerm = '';
        this.db = null;
        this.guestbooksRef = null;
        this.initFirebase();
    }

    async initFirebase() {
        console.log('Firebase Realtime Database 초기화 시작...');
        // Firebase가 로드될 때까지 대기 (최대 10초)
        let attempts = 0;
        const maxAttempts = 100; // 10초 (100 * 100ms)
        
        const checkFirebase = setInterval(() => {
            attempts++;
            
            if (window.firebaseDb && window.firebaseFunctions) {
                clearInterval(checkFirebase);
                console.log('Firebase Realtime Database 연결 성공!');
                this.db = window.firebaseDb;
                const { ref, onValue, orderByChild, rtdbQuery } = window.firebaseFunctions;
                this.guestbooksRef = ref(this.db, 'guestbooks');
                console.log('Realtime Database 참조 설정 완료:', this.guestbooksRef);
                
                // 실시간으로 방명록 불러오기 (날짜순 정렬)
                const q = rtdbQuery(this.guestbooksRef, orderByChild('date'));
                onValue(q, (snapshot) => {
                    const data = snapshot.val();
                    console.log('Firebase 데이터 업데이트:', data);
                    
                    if (data) {
                        // 객체를 배열로 변환하고 날짜순으로 정렬 (최신순)
                        this.guestbooks = Object.keys(data).map(key => ({
                            id: key,
                            ...data[key]
                        })).sort((a, b) => {
                            // 날짜 기준 내림차순 정렬 (최신순)
                            return new Date(b.date) - new Date(a.date);
                        });
                    } else {
                        this.guestbooks = [];
                    }
                    
                    console.log('방명록 개수:', this.guestbooks.length);
                    this.renderGuestbooks();
                }, (error) => {
                    console.error('Firebase 실시간 업데이트 오류:', error);
                    console.error('에러 코드:', error.code);
                    console.error('에러 메시지:', error.message);
                    if (error.code === 'PERMISSION_DENIED') {
                        alert('Firebase 보안 규칙 오류입니다. Realtime Database 보안 규칙을 확인해주세요.');
                    }
                });
                
                this.init();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                console.error('Firebase 초기화 실패: 시간 초과');
                console.error('window.firebaseDb:', window.firebaseDb);
                console.error('window.firebaseFunctions:', window.firebaseFunctions);
                alert('Firebase 연결에 실패했습니다. 페이지를 새로고침해주세요.');
                // 폴백: 기본 초기화
                this.init();
            }
        }, 100);
    }

    init() {
        this.renderGuestbooks();
        this.setupEventListeners();
        
        // 초기 로드 시 이름 필드 업데이트
        setTimeout(() => {
            this.updateAuthorNameField();
        }, 500);
        
        // 시간 표시를 주기적으로 업데이트 (1분마다)
        this.startTimeUpdater();
    }

    // 시간 표시를 주기적으로 업데이트
    startTimeUpdater() {
        // 30초마다 업데이트 (더 자주 업데이트하여 "방금 전", "몇분 전" 등이 실시간으로 반영됨)
        setInterval(() => {
            this.updateTimeDisplays();
        }, 30000); // 30초마다 업데이트
    }

    // 모든 방명록 아이템의 시간 표시 업데이트
    updateTimeDisplays() {
        const dateElements = document.querySelectorAll('.guestbook-date');
        dateElements.forEach(element => {
            const guestbookItem = element.closest('.guestbook-item');
            if (guestbookItem) {
                const guestbookId = guestbookItem.dataset.id;
                const guestbook = this.guestbooks.find(gb => gb.id === guestbookId);
                if (guestbook && guestbook.date) {
                    element.textContent = this.formatDate(guestbook.date);
                }
            }
        });
    }

    // 방명록 추가
    async addGuestbook(authorName, message, userId = null) {
        // Firebase가 준비되지 않았으면 대기
        if (!this.guestbooksRef || !window.firebaseFunctions) {
            console.warn('Firebase가 아직 준비되지 않았습니다.');
            console.warn('this.guestbooksRef:', this.guestbooksRef);
            console.warn('window.firebaseFunctions:', window.firebaseFunctions);
            alert('Firebase 연결 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        try {
            // 작성자가 관리자인지 확인
            let isAdmin = false;
            if (userId && window.firebaseFunctions && window.firebaseDb) {
                try {
                    const { ref, get } = window.firebaseFunctions;
                    const userRef = ref(window.firebaseDb, `users/${userId}`);
                    const snapshot = await get(userRef);
                    const userData = snapshot.val();
                    if (userData && userData.isAdmin === true) {
                        isAdmin = true;
                    }
                } catch (error) {
                    console.warn('관리자 확인 실패:', error);
                }
            }

            console.log('방명록 추가 시도:', { authorName, message, userId, isAdmin });
            const { push, set } = window.firebaseFunctions;
            const newGuestbookRef = push(this.guestbooksRef);
            const newGuestbook = {
                authorName: authorName.trim(),
                message: message.trim(),
                date: new Date().toISOString(),
                userId: userId || null,
                isAdmin: isAdmin
            };
            
            await set(newGuestbookRef, newGuestbook);
            console.log('방명록이 Firebase Realtime Database에 성공적으로 추가되었습니다. ID:', newGuestbookRef.key);
            // onValue가 자동으로 업데이트하므로 별도 렌더링 불필요
        } catch (error) {
            console.error('방명록 추가 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            if (error.code === 'PERMISSION_DENIED') {
                alert('Firebase 보안 규칙 오류입니다.\n\nFirebase 콘솔에서 Realtime Database 보안 규칙을 다음과 같이 설정해주세요:\n\n{\n  "rules": {\n    "guestbooks": {\n      ".read": true,\n      ".write": true\n    }\n  }\n}');
            } else {
                alert('방명록 추가에 실패했습니다: ' + error.message);
            }
        }
    }

    // 방명록 수정
    async updateGuestbook(id, authorName, message) {
        // Firebase가 준비되지 않았으면 대기
        if (!this.guestbooksRef || !window.firebaseFunctions) {
            console.warn('Firebase가 아직 준비되지 않았습니다.');
            alert('Firebase 연결 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        // 권한 확인
        const guestbook = this.guestbooks.find(gb => gb.id === id);
        if (!guestbook) {
            alert('방명록을 찾을 수 없습니다.');
            return;
        }

        if (!this.isOwner(guestbook)) {
            alert('본인이 작성한 글만 수정할 수 있습니다.');
            return;
        }

        try {
            console.log('방명록 수정 시도:', { id, authorName, message });
            const { ref, update } = window.firebaseFunctions;
            const guestbookRef = ref(this.db, `guestbooks/${id}`);
            await update(guestbookRef, {
                authorName: authorName.trim(),
                message: message.trim(),
                date: new Date().toISOString() // 수정 시간으로 업데이트
            });
            console.log('방명록이 Firebase Realtime Database에서 성공적으로 수정되었습니다. ID:', id);
            // onValue가 자동으로 업데이트하므로 별도 렌더링 불필요
        } catch (error) {
            console.error('방명록 수정 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            alert('방명록 수정에 실패했습니다: ' + error.message);
        }
    }

    // 방명록 삭제
    async deleteGuestbook(id) {
        // Firebase가 준비되지 않았으면 대기
        if (!this.guestbooksRef || !window.firebaseFunctions) {
            console.warn('Firebase가 아직 준비되지 않았습니다.');
            alert('Firebase 연결 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        // 권한 확인
        const guestbook = this.guestbooks.find(gb => gb.id === id);
        if (!guestbook) {
            alert('방명록을 찾을 수 없습니다.');
            return;
        }

        if (!this.isOwner(guestbook)) {
            alert('본인이 작성한 글만 삭제할 수 있습니다.');
            return;
        }

        try {
            const { ref, remove } = window.firebaseFunctions;
            const guestbookRef = ref(this.db, `guestbooks/${id}`);
            await remove(guestbookRef);
            // onValue가 자동으로 업데이트하므로 별도 렌더링 불필요
            console.log('방명록이 Firebase Realtime Database에서 성공적으로 삭제되었습니다. ID:', id);
        } catch (error) {
            console.error('방명록 삭제 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            alert('방명록 삭제에 실패했습니다: ' + error.message);
        }
    }

    // 검색 필터링
    filterGuestbooks() {
        if (!this.searchTerm.trim()) {
            return this.guestbooks;
        }
        
        const term = this.searchTerm.toLowerCase();
        return this.guestbooks.filter(gb => 
            gb.authorName.toLowerCase().includes(term) ||
            gb.message.toLowerCase().includes(term)
        );
    }

    // 날짜 포맷팅
    formatDate(dateString) {
        if (!dateString) return '날짜 없음';
        
        const date = new Date(dateString);
        const now = new Date();
        
        // 유효하지 않은 날짜인 경우
        if (isNaN(date.getTime())) {
            return '날짜 없음';
        }
        
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        if (weeks < 4) return `${weeks}주 전`;
        if (months < 12) return `${months}개월 전`;
        if (years >= 1) return `${years}년 전`;
        
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 작성자 이름의 첫 글자 가져오기 (아바타용)
    getInitial(name) {
        return name.charAt(0).toUpperCase();
    }

    // 메시지가 3줄을 넘는지 확인 (대략 150자 또는 줄바꿈 3개 이상)
    truncateMessage(message) {
        if (!message) return '';
        // 줄바꿈 개수 확인
        const lineBreaks = (message.match(/\n/g) || []).length;
        // 3줄 이상이거나 150자 이상이면 잘라서 표시
        if (lineBreaks >= 3 || message.length > 150) {
            // 첫 3줄만 표시
            const lines = message.split('\n');
            if (lines.length > 3) {
                return this.escapeHtml(lines.slice(0, 3).join('\n'));
            } else if (message.length > 150) {
                return this.escapeHtml(message.substring(0, 150));
            }
        }
        return this.escapeHtml(message);
    }

    // 더보기 버튼 표시 여부 확인
    shouldShowMoreButton(message) {
        if (!message) return false;
        const lineBreaks = (message.match(/\n/g) || []).length;
        return lineBreaks >= 3 || message.length > 150;
    }

    // 방명록 렌더링
    async renderGuestbooks() {
        const listContainer = document.getElementById('guestbookList');
        const emptyState = document.getElementById('emptyState');
        const filtered = this.filterGuestbooks();

        listContainer.innerHTML = '';

        if (filtered.length === 0) {
            emptyState.style.display = 'block';
            if (this.searchTerm.trim()) {
                emptyState.textContent = '검색 결과가 없습니다. 🔍';
            } else {
                emptyState.innerHTML = '아직 방명록이 없습니다. 첫 번째 방명록을 남겨보세요! ✨';
            }
        } else {
            emptyState.style.display = 'none';
            
            // 사용자 정보 캐시 (성능 최적화)
            const userCache = new Map();
            
            // 모든 방명록에 대해 사용자 정보 가져오기
            const guestbookPromises = filtered.map(async (guestbook) => {
                let displayName = guestbook.authorName;
                let isAdmin = guestbook.isAdmin || false;
                
                // userId가 있으면 사용자 정보에서 displayName과 isAdmin 가져오기
                if (guestbook.userId && window.firebaseFunctions && window.firebaseDb) {
                    // 캐시 확인
                    const cacheKey = guestbook.userId;
                    if (userCache.has(cacheKey)) {
                        const cachedData = userCache.get(cacheKey);
                        displayName = cachedData.displayName;
                        isAdmin = cachedData.isAdmin || false;
                    } else {
                        try {
                            const { ref, get } = window.firebaseFunctions;
                            const userRef = ref(window.firebaseDb, `users/${guestbook.userId}`);
                            const snapshot = await get(userRef);
                            const userData = snapshot.val();
                            
                            if (userData) {
                                if (userData.displayName) {
                                    displayName = userData.displayName;
                                }
                                if (userData.isAdmin === true) {
                                    isAdmin = true;
                                }
                                userCache.set(cacheKey, { displayName, isAdmin });
                            }
                        } catch (error) {
                            console.warn('사용자 정보 가져오기 실패:', error);
                            // 실패 시 기존 authorName 사용
                        }
                    }
                }
                
                // displayName과 isAdmin으로 업데이트된 guestbook 객체 생성
                return {
                    ...guestbook,
                    authorName: displayName,
                    isAdmin: isAdmin
                };
            });
            
            // 모든 방명록의 사용자 정보를 가져온 후 렌더링
            const guestbooksWithNames = await Promise.all(guestbookPromises);
            
            guestbooksWithNames.forEach(guestbook => {
                const item = this.createGuestbookItem(guestbook);
                listContainer.appendChild(item);
            });
        }
    }

    // 현재 사용자가 방명록 작성자인지 확인
    isOwner(guestbook) {
        const currentUser = window.authManager?.currentUser;
        if (!currentUser) return false;
        
        // userId가 있는 경우 userId로 비교
        if (guestbook.userId) {
            return guestbook.userId === currentUser.uid;
        }
        
        // userId가 없는 경우 (기존 데이터 호환성) false 반환
        return false;
    }

    // 방명록 아이템 생성
    createGuestbookItem(guestbook) {
        const item = document.createElement('div');
        const isAdmin = guestbook.isAdmin === true;
        item.className = 'guestbook-item';
        item.dataset.id = guestbook.id;
        
        const initial = this.getInitial(guestbook.authorName);
        const formattedDate = this.formatDate(guestbook.date);
        const isOwner = this.isOwner(guestbook);
        
        // 본인 글인 경우에만 수정/삭제 버튼 표시
        const actionsHTML = isOwner ? `
            <div class="guestbook-actions">
                <button class="edit-btn" data-id="${guestbook.id}" aria-label="수정">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.333 2.667a2.828 2.828 0 1 1 4 4L6 14.667H2.667V11.333l7.333-7.333z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="delete-btn" data-id="${guestbook.id}" aria-label="삭제">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        ` : '';

        item.innerHTML = `
            <div class="guestbook-header">
                <div class="guestbook-author">
                    <div class="author-avatar">${initial}</div>
                    <div class="author-info">
                        <div class="author-name">
                            ${this.escapeHtml(guestbook.authorName)}
                            ${isAdmin ? '<span class="admin-badge">관리자</span>' : ''}
                        </div>
                        <div class="guestbook-date">${formattedDate}</div>
                    </div>
                </div>
                ${actionsHTML}
            </div>
            <div class="guestbook-content">
                <div class="guestbook-message" data-full-message="${this.escapeHtml(guestbook.message)}">
                    ${this.truncateMessage(guestbook.message)}
                </div>
                ${this.shouldShowMoreButton(guestbook.message) ? '<button class="more-btn">더보기</button>' : ''}
                ${isOwner ? `
                <div class="edit-form" style="display: none;">
                    <input type="text" class="edit-author-name" value="${this.escapeHtml(guestbook.authorName)}" placeholder="이름">
                    <textarea class="edit-message" placeholder="하고 싶은 말">${this.escapeHtml(guestbook.message)}</textarea>
                    <div class="edit-actions">
                        <button class="save-btn">저장</button>
                        <button class="cancel-btn">취소</button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // 더보기 버튼 이벤트 리스너
        const moreBtn = item.querySelector('.more-btn');
        if (moreBtn) {
            const messageDiv = item.querySelector('.guestbook-message');
            moreBtn.addEventListener('click', () => {
                const fullMessage = messageDiv.dataset.fullMessage;
                this.showFullMessageModal(guestbook.authorName, fullMessage, formattedDate);
            });
        }

        // 수정 버튼 이벤트 리스너 (본인 글인 경우에만)
        if (isOwner) {
            const editBtn = item.querySelector('.edit-btn');
            const deleteBtn = item.querySelector('.delete-btn');
            const messageDiv = item.querySelector('.guestbook-message');
            const editForm = item.querySelector('.edit-form');
            const saveBtn = item.querySelector('.save-btn');
            const cancelBtn = item.querySelector('.cancel-btn');
            const editAuthorName = item.querySelector('.edit-author-name');
            const editMessage = item.querySelector('.edit-message');

            editBtn.addEventListener('click', () => {
                // 권한 재확인
                if (!this.isOwner(guestbook)) {
                    alert('본인이 작성한 글만 수정할 수 있습니다.');
                    return;
                }
                messageDiv.style.display = 'none';
                editForm.style.display = 'block';
                editAuthorName.focus();
            });

            cancelBtn.addEventListener('click', () => {
                messageDiv.style.display = 'block';
                editForm.style.display = 'none';
                // 원래 값으로 복원
                editAuthorName.value = guestbook.authorName;
                editMessage.value = guestbook.message;
            });

            saveBtn.addEventListener('click', async () => {
                // 권한 재확인
                if (!this.isOwner(guestbook)) {
                    alert('본인이 작성한 글만 수정할 수 있습니다.');
                    return;
                }
                
                const newAuthorName = editAuthorName.value.trim();
                const newMessage = editMessage.value.trim();

                if (!newAuthorName || !newMessage) {
                    alert('이름과 메시지를 모두 입력해주세요.');
                    return;
                }

                await this.updateGuestbook(guestbook.id, newAuthorName, newMessage);
                messageDiv.style.display = 'block';
                editForm.style.display = 'none';
            });

            // 삭제 버튼 이벤트 리스너
            deleteBtn.addEventListener('click', () => {
                // 권한 재확인
                if (!this.isOwner(guestbook)) {
                    alert('본인이 작성한 글만 삭제할 수 있습니다.');
                    return;
                }
                
                if (confirm('정말 이 방명록을 삭제하시겠습니까?')) {
                    this.deleteGuestbook(guestbook.id);
                }
            });
        }

        return item;
    }

    // XSS 방지를 위한 HTML 이스케이프
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 전체 메시지 모달 표시
    showFullMessageModal(authorName, message, date) {
        // 모달이 이미 있으면 제거
        const existingModal = document.getElementById('messageModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 생성
        const modal = document.createElement('div');
        modal.id = 'messageModal';
        modal.className = 'message-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="message-modal-content">
                <button class="message-modal-close">&times;</button>
                <div class="message-modal-header">
                    <div class="message-modal-author">${this.escapeHtml(authorName)}</div>
                    <div class="message-modal-date">${date}</div>
                </div>
                <div class="message-modal-body">
                    <div class="message-modal-text">${this.escapeHtml(message)}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 닫기 버튼 이벤트
        const closeBtn = modal.querySelector('.message-modal-close');
        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeModal);

        // 배경 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 폼 제출
        const form = document.getElementById('guestbookForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 로그인 상태 확인
            const currentUser = window.authManager?.currentUser;
            if (!currentUser) {
                // 비회원인 경우 메시지 표시
                this.showLoginRequiredMessage();
                return;
            }
            
            const authorName = document.getElementById('authorName').value;
            const message = document.getElementById('message').value;

            if (authorName.trim() && message.trim()) {
                // 사용자 정보와 함께 방명록 추가
                await this.addGuestbook(authorName, message, currentUser.uid);
                
                // 메시지 필드만 리셋
                document.getElementById('message').value = '';
                
                // 이름 필드는 다시 사용자 이름으로 설정 (이미 설정되어 있지만 확실히)
                this.updateAuthorNameField();
                
                // 성공 메시지 (선택사항)
                this.showSuccessMessage();
            }
        });

    }

    // 로그인 필요 메시지 표시
    showLoginRequiredMessage() {
        const loginMessage = document.getElementById('loginRequiredMessage');
        loginMessage.style.display = 'block';
        
        // 메시지가 보이도록 스크롤
        loginMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 로그인 필요 메시지 숨기기
    hideLoginRequiredMessage() {
        const loginMessage = document.getElementById('loginRequiredMessage');
        loginMessage.style.display = 'none';
    }

    // 이름 필드 업데이트 (로그인 상태에 따라)
    updateAuthorNameField() {
        const authorNameInput = document.getElementById('authorName');
        if (!authorNameInput) return;
        
        const currentUser = window.authManager?.currentUser;
        
        if (currentUser && window.authManager?.userDisplayName) {
            authorNameInput.value = window.authManager.userDisplayName;
            authorNameInput.readOnly = true;
            authorNameInput.placeholder = '';
        } else {
            authorNameInput.value = '';
            authorNameInput.readOnly = false;
            authorNameInput.placeholder = '로그인이 필요합니다';
        }
    }

    // 성공 메시지 표시
    showSuccessMessage() {
        const submitBtn = document.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        const originalBg = submitBtn.style.backgroundColor;
        
        submitBtn.textContent = '작성 완료! ✓';
        submitBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.style.backgroundColor = originalBg || '';
        }, 2000);
    }
}

// 인증 관리
class AuthManager {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.init();
    }

    init() {
        // Firebase가 로드될 때까지 대기 (최대 10초)
        let attempts = 0;
        const maxAttempts = 100;
        
        const checkAuth = setInterval(() => {
            attempts++;
            
            if (window.firebaseAuth && window.authFunctions) {
                clearInterval(checkAuth);
                this.auth = window.firebaseAuth;
                console.log('AuthManager 초기화 완료');
                this.setupAuth();
                this.setupEventListeners();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkAuth);
                console.error('Firebase Authentication 초기화 실패: 시간 초과');
                alert('Firebase Authentication 초기화에 실패했습니다.\n\nFirebase 콘솔에서 Authentication을 활성화해주세요.');
            }
        }, 100);
    }

    setupAuth() {
        const { onAuthStateChanged } = window.authFunctions;
        // 기본 관리자 계정 자동 생성
        this.createDefaultAdmin();
        
        onAuthStateChanged(this.auth, async (user) => {
            this.currentUser = user;
            await this.updateUI(user);
            await this.checkAdminExists();
        });
    }

    async createDefaultAdmin() {
        try {
            const { ref, get } = window.firebaseFunctions;
            const usersRef = ref(window.firebaseDb, 'users');
            const snapshot = await get(usersRef);
            const users = snapshot.val() || {};
            
            // 관리자가 이미 있는지 확인
            const hasAdmin = Object.values(users).some(user => user.isAdmin === true);
            if (hasAdmin) {
                console.log('관리자가 이미 존재합니다.');
                return;
            }

            // 기본 관리자 계정 생성
            const defaultEmail = 'admin@admin.com';
            const defaultPassword = 'admin123';

            // 이미 해당 이메일이 있는지 확인
            const isDuplicate = Object.values(users).some(user => 
                user.email === defaultEmail
            );

            if (isDuplicate) {
                console.log('기본 관리자 계정이 이미 존재합니다.');
                return;
            }

            console.log('기본 관리자 계정 생성 중...');
            const { createUserWithEmailAndPassword } = window.authFunctions;
            const { set } = window.firebaseFunctions;
            
            const userCredential = await createUserWithEmailAndPassword(this.auth, defaultEmail, defaultPassword);
            const user = userCredential.user;

            // Realtime Database에 관리자 정보 저장
            const userRef = ref(window.firebaseDb, `users/${user.uid}`);
            await set(userRef, {
                uid: user.uid,
                email: defaultEmail,
                displayName: '관리자',
                isAdmin: true,
                createdAt: new Date().toISOString()
            });

            console.log('기본 관리자 계정이 성공적으로 생성되었습니다!');
            console.log('이메일: admin@admin.com, 비밀번호: admin123');
        } catch (error) {
            console.error('기본 관리자 계정 생성 실패:', error);
            // 이미 존재하는 경우는 무시
            if (error.code !== 'auth/email-already-in-use') {
                console.error('에러 상세:', error.code, error.message);
            }
        }
    }

    async checkAdminExists() {
        // 관리자가 있는지 확인
        const { ref, get } = window.firebaseFunctions;
        try {
            const usersRef = ref(window.firebaseDb, 'users');
            const snapshot = await get(usersRef);
            const users = snapshot.val() || {};
            
            const hasAdmin = Object.values(users).some(user => user.isAdmin === true);
            const createFirstAdminBtn = document.getElementById('createFirstAdminBtn');
            
            // 관리자가 없고 로그인하지 않은 경우에만 버튼 표시
            if (!hasAdmin && !this.currentUser) {
                createFirstAdminBtn.style.display = 'block';
            } else {
                createFirstAdminBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('관리자 확인 실패:', error);
        }
    }

    async updateUI(user) {
        const userDisplayName = document.getElementById('userDisplayName');
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const authButtons = document.getElementById('authButtons');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminBtn = document.getElementById('adminBtn');

        if (user) {
            // Realtime Database에서 사용자 정보 가져오기
            const { ref, get } = window.firebaseFunctions;
            try {
                const userRef = ref(window.firebaseDb, `users/${user.uid}`);
                const snapshot = await get(userRef);
                const userData = snapshot.val();
                
                if (userData) {
                    const displayName = userData.displayName || user.email || '사용자';
                    userDisplayName.textContent = `${displayName}님 환영합니다`;
                    this.userDisplayName = displayName; // 방명록 폼에서 사용하기 위해 저장
                    
                    // 관리자 확인
                    if (userData.isAdmin === true) {
                        adminBtn.style.display = 'block';
                    } else {
                        adminBtn.style.display = 'none';
                    }
                    
                    // 방명록 폼의 이름 필드 업데이트
                    if (window.guestbookManager) {
                        window.guestbookManager.updateAuthorNameField();
                        window.guestbookManager.hideLoginRequiredMessage();
                    }
                } else {
                    const displayName = user.email || '사용자';
                    userDisplayName.textContent = `${displayName}님 환영합니다`;
                    this.userDisplayName = displayName;
                    adminBtn.style.display = 'none';
                    
                    // 방명록 폼의 이름 필드 업데이트
                    if (window.guestbookManager) {
                        window.guestbookManager.updateAuthorNameField();
                        window.guestbookManager.hideLoginRequiredMessage();
                    }
                }
            } catch (error) {
                console.error('사용자 정보 불러오기 실패:', error);
                const displayName = user.email || '사용자';
                userDisplayName.textContent = `${displayName}님 환영합니다`;
                this.userDisplayName = displayName;
                adminBtn.style.display = 'none';
                
                // 방명록 폼의 이름 필드 업데이트
                if (window.guestbookManager) {
                    window.guestbookManager.updateAuthorNameField();
                    window.guestbookManager.hideLoginRequiredMessage();
                }
            }
            
            authButtons.style.display = 'none';
            logoutBtn.style.display = 'block';
        } else {
            userDisplayName.textContent = '';
            this.userDisplayName = null;
            authButtons.style.display = 'flex';
            logoutBtn.style.display = 'none';
            adminBtn.style.display = 'none';
            
            // 방명록 폼의 이름 필드 업데이트
            if (window.guestbookManager) {
                window.guestbookManager.updateAuthorNameField();
            }
        }
    }

    setupEventListeners() {
        // 로그인 버튼
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.showAuthModal('login');
        });

        // 회원가입 버튼
        document.getElementById('signupBtn').addEventListener('click', () => {
            this.showAuthModal('signup');
        });

        // 로그아웃 버튼
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // 관리자 버튼
        document.getElementById('adminBtn').addEventListener('click', () => {
            window.location.href = 'admin.html';
        });

        // 첫 관리자 생성 버튼
        document.getElementById('createFirstAdminBtn').addEventListener('click', () => {
            this.showFirstAdminModal();
        });

        // 첫 관리자 모달 닫기
        document.getElementById('closeFirstAdminModal').addEventListener('click', () => {
            this.hideFirstAdminModal();
        });

        // 첫 관리자 모달 배경 클릭 시 닫기
        document.getElementById('firstAdminModal').addEventListener('click', (e) => {
            if (e.target.id === 'firstAdminModal') {
                this.hideFirstAdminModal();
            }
        });

        // 첫 관리자 생성 폼
        document.getElementById('firstAdminForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createFirstAdmin();
        });

        // 모달 닫기
        document.getElementById('closeAuthModal').addEventListener('click', () => {
            this.hideAuthModal();
        });

        // 모달 배경 클릭 시 닫기
        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target.id === 'authModal') {
                this.hideAuthModal();
            }
        });

        // 탭 전환
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 로그인 폼
        document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });

        // 회원가입 폼
        document.getElementById('signupFormElement').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.signup();
        });
    }

    showAuthModal(tab = 'login') {
        document.getElementById('authModal').style.display = 'flex';
        this.switchTab(tab);
    }

    hideAuthModal() {
        document.getElementById('authModal').style.display = 'none';
        // 에러 메시지 초기화
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('signupError').classList.remove('show');
        // 폼 초기화
        document.getElementById('loginFormElement').reset();
        document.getElementById('signupFormElement').reset();
    }

    switchTab(tab) {
        // 탭 버튼 활성화
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        // 폼 표시/숨김
        document.getElementById('loginForm').classList.toggle('active', tab === 'login');
        document.getElementById('signupForm').classList.toggle('active', tab === 'signup');
    }

    async login() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        // Firebase 초기화 확인
        if (!window.firebaseAuth || !window.authFunctions) {
            errorDiv.textContent = 'Firebase Authentication이 초기화되지 않았습니다.\n\nFirebase 콘솔에서 Authentication을 활성화해주세요:\n1. Firebase 콘솔 → Authentication\n2. "시작하기" 클릭\n3. "이메일/비밀번호" 활성화';
            errorDiv.classList.add('show');
            return;
        }

        if (!this.auth) {
            this.auth = window.firebaseAuth;
        }

        if (!email) {
            errorDiv.textContent = '이메일을 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        if (!password) {
            errorDiv.textContent = '비밀번호를 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        try {
            const { signInWithEmailAndPassword } = window.authFunctions;
            console.log('로그인 시도:', email);
            await signInWithEmailAndPassword(this.auth, email, password);
            console.log('로그인 성공');
            this.hideAuthModal();
        } catch (error) {
            console.error('로그인 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            errorDiv.textContent = this.getErrorMessage(error.code);
            errorDiv.classList.add('show');
        }
    }

    async signup() {
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
        const errorDiv = document.getElementById('signupError');

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        // Firebase 초기화 확인
        if (!this.auth || !window.authFunctions || !window.firebaseFunctions || !window.firebaseDb) {
            errorDiv.textContent = 'Firebase가 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        // 입력값 확인
        if (!name) {
            errorDiv.textContent = '이름을 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        if (!email) {
            errorDiv.textContent = '이메일을 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorDiv.textContent = '유효한 이메일 주소를 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        if (!password) {
            errorDiv.textContent = '비밀번호를 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        // 비밀번호 확인
        if (password !== passwordConfirm) {
            errorDiv.textContent = '비밀번호가 일치하지 않습니다.';
            errorDiv.classList.add('show');
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
            errorDiv.classList.add('show');
            return;
        }

        try {
            const { createUserWithEmailAndPassword } = window.authFunctions;
            const { ref, set } = window.firebaseFunctions;
            
            console.log('회원가입 시도:', { name, email });

            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            console.log('사용자 생성 성공:', user.uid);

            // 사용자 정보를 Realtime Database에 저장
            try {
                const userRef = ref(window.firebaseDb, `users/${user.uid}`);
                await set(userRef, {
                    uid: user.uid,
                    email: email,
                    displayName: name,
                    isAdmin: false,
                    createdAt: new Date().toISOString()
                });
                console.log('사용자 정보 저장 완료');
            } catch (dbError) {
                console.error('사용자 정보 저장 실패:', dbError);
                // Auth는 성공했지만 DB 저장 실패 시 경고
                alert('계정은 생성되었지만, 사용자 정보 저장에 실패했습니다.');
            }

            this.hideAuthModal();
        } catch (error) {
            console.error('회원가입 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            errorDiv.textContent = this.getErrorMessage(error.code);
            errorDiv.classList.add('show');
        }
    }

    async logout() {
        try {
            const { signOut } = window.authFunctions;
            await signOut(this.auth);
        } catch (error) {
            console.error('로그아웃 실패:', error);
            alert('로그아웃에 실패했습니다.');
        }
    }

    showFirstAdminModal() {
        document.getElementById('firstAdminModal').style.display = 'flex';
    }

    hideFirstAdminModal() {
        document.getElementById('firstAdminModal').style.display = 'none';
        document.getElementById('firstAdminError').classList.remove('show');
        document.getElementById('firstAdminForm').reset();
    }

    async createFirstAdmin() {
        const email = document.getElementById('firstAdminEmail').value.trim();
        const password = document.getElementById('firstAdminPassword').value;
        const passwordConfirm = document.getElementById('firstAdminPasswordConfirm').value;
        const errorDiv = document.getElementById('firstAdminError');

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        // Firebase 초기화 확인
        if (!this.auth || !window.authFunctions || !window.firebaseFunctions || !window.firebaseDb) {
            errorDiv.textContent = 'Firebase가 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.';
            errorDiv.classList.add('show');
            console.error('Firebase 초기화 상태:', {
                auth: !!this.auth,
                authFunctions: !!window.authFunctions,
                firebaseFunctions: !!window.firebaseFunctions,
                firebaseDb: !!window.firebaseDb
            });
            return;
        }

        // 입력값 확인
        if (!email) {
            errorDiv.textContent = '이메일을 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorDiv.textContent = '유효한 이메일 주소를 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        if (!password) {
            errorDiv.textContent = '비밀번호를 입력해주세요.';
            errorDiv.classList.add('show');
            return;
        }

        // 비밀번호 확인
        if (password !== passwordConfirm) {
            errorDiv.textContent = '비밀번호가 일치하지 않습니다.';
            errorDiv.classList.add('show');
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
            errorDiv.classList.add('show');
            return;
        }

        try {
            const { createUserWithEmailAndPassword } = window.authFunctions;
            const { ref, set, get } = window.firebaseFunctions;
            
            console.log('관리자 생성 시도:', { email });

            // 이메일 중복 확인 (Realtime Database)
            let isDuplicate = false;
            try {
                const usersRef = ref(window.firebaseDb, 'users');
                const snapshot = await get(usersRef);
                const users = snapshot.val() || {};
                
                isDuplicate = Object.values(users).some(user => 
                    user.email === email
                );
            } catch (dbError) {
                console.warn('사용자 목록 확인 실패 (계속 진행):', dbError);
            }

            if (isDuplicate) {
                errorDiv.textContent = '이미 사용 중인 이메일입니다.';
                errorDiv.classList.add('show');
                return;
            }

            // Firebase Auth에 사용자 생성
            console.log('Firebase Auth에 사용자 생성 중...');
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            console.log('사용자 생성 성공:', user.uid);

            // Realtime Database에 관리자 정보 저장
            try {
                const userRef = ref(window.firebaseDb, `users/${user.uid}`);
                await set(userRef, {
                    uid: user.uid,
                    email: email,
                    displayName: '관리자',
                    isAdmin: true,
                    createdAt: new Date().toISOString()
                });
                console.log('Realtime Database에 관리자 정보 저장 완료');
            } catch (dbError) {
                console.error('Realtime Database 저장 실패:', dbError);
                alert('관리자 계정은 생성되었지만, 데이터베이스 저장에 실패했습니다. 관리자 페이지에서 수동으로 권한을 부여해주세요.');
            }

            alert(`첫 관리자가 성공적으로 생성되었습니다!\n\n이메일: ${email}\n\n이제 해당 이메일과 비밀번호로 로그인하실 수 있습니다.`);
            this.hideFirstAdminModal();
            
            // 자동 로그인
            try {
                const { signInWithEmailAndPassword } = window.authFunctions;
                await signInWithEmailAndPassword(this.auth, email, password);
                console.log('자동 로그인 성공');
            } catch (loginError) {
                console.warn('자동 로그인 실패:', loginError);
            }
            
            await this.checkAdminExists();
        } catch (error) {
            console.error('첫 관리자 생성 실패:', error);
            console.error('에러 상세:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            let errorMessage = this.getErrorMessage(error.code);
            if (!errorMessage || errorMessage.includes('오류가 발생했습니다')) {
                errorMessage = `오류가 발생했습니다: ${error.message || error.code || '알 수 없는 오류'}`;
            }
            
            errorDiv.textContent = errorMessage;
            errorDiv.classList.add('show');
        }
    }

    getErrorMessage(errorCode) {
        const messages = {
            'auth/user-not-found': '등록되지 않은 이메일입니다.',
            'auth/wrong-password': '비밀번호가 잘못되었습니다.',
            'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
            'auth/weak-password': '비밀번호가 너무 약합니다. (최소 6자)',
            'auth/invalid-email': '유효하지 않은 이메일 주소입니다.',
            'auth/network-request-failed': '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
            'auth/too-many-requests': '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
            'auth/operation-not-allowed': '이 작업이 허용되지 않았습니다. Firebase 설정을 확인해주세요.',
            'auth/invalid-credential': '인증 정보가 유효하지 않습니다.',
            'auth/user-disabled': '사용자 계정이 비활성화되었습니다.',
            'auth/requires-recent-login': '보안을 위해 다시 로그인해주세요.',
            'auth/configuration-not-found': 'Firebase Authentication이 설정되지 않았습니다.\n\nFirebase 콘솔에서 다음을 확인해주세요:\n1. Authentication 메뉴 접속\n2. "시작하기" 클릭\n3. "이메일/비밀번호" 인증 방법 활성화\n4. "이메일/비밀번호" → "사용 설정" 클릭'
        };
        return messages[errorCode] || `오류가 발생했습니다. (코드: ${errorCode || '알 수 없음'})\n\nFirebase 콘솔에서 Authentication을 활성화해주세요.`;
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.guestbookManager = new GuestbookManager();
    window.authManager = new AuthManager();
    
    // 로그인 필요 메시지의 로그인 버튼 이벤트
    const loginFromFormBtn = document.getElementById('loginFromFormBtn');
    if (loginFromFormBtn) {
        loginFromFormBtn.addEventListener('click', () => {
            if (window.authManager) {
                window.authManager.showAuthModal('login');
            }
        });
    }
});

