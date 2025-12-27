// グローバル変数
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const itemsPerPage = 10;
let editingIssueId = null;
let currentSortField = 'created_at';
let currentSortOrder = 'desc';
let currentStatusFilter = '';

// DOM要素
let issuesContainer;
let issueModal;
let detailModal;
let issueForm;
let searchInput;
let screenshotInput;
let screenshotPreview;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔵 app.js DOMContentLoaded');
});

// イベントリスナーの設定
function setupEventListeners() {
    const closeModal = document.getElementById('closeModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (closeModal) closeModal.addEventListener('click', closeModals);
    if (closeDetailModal) closeDetailModal.addEventListener('click', closeModals);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModals);
    
    if (issueModal) {
        issueModal.addEventListener('click', (e) => {
            if (e.target === issueModal) closeModals();
        });
    }
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeModals();
        });
    }
    
    if (issueForm) {
        issueForm.addEventListener('submit', handleSubmit);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchIssues, 300));
    }
    
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleImageUpload);
    }
    
    setupDragAndDrop();
    setupClipboardPaste();
}

// アプリ初期化（認証後に呼ばれる）
function initializeApp() {
    issuesContainer = document.getElementById('issuesContainer');
    issueModal = document.getElementById('issueModal');
    detailModal = document.getElementById('detailModal');
    issueForm = document.getElementById('issueForm');
    searchInput = document.getElementById('searchInput');
    screenshotInput = document.getElementById('issueScreenshot');
    screenshotPreview = document.getElementById('screenshotPreview');
    
    setupEventListeners();
    loadIssues();
}

// データ読み込み
async function loadIssues() {
    try {
        showLoading();
        allIssues = await SupabaseAPI.getAll();
        applyFilters();
        updateStats();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        showError('データの読み込みに失敗しました。');
    }
}

// 統計情報の更新
function updateStats() {
    const stats = {
        total: allIssues.length,
        pending: allIssues.filter(i => i.status === '未対応').length,
        progress: allIssues.filter(i => i.status === '対応中').length,
        waiting: allIssues.filter(i => i.status === '確認待ち').length,
        completed: allIssues.filter(i => i.status === '完了').length,
        onhold: allIssues.filter(i => i.status === '保留').length
    };
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statProgress').textContent = stats.progress;
    document.getElementById('statWaiting').textContent = stats.waiting;
    document.getElementById('statCompleted').textContent = stats.completed;
    document.getElementById('statOnHold').textContent = stats.onhold;
}

// フィルター適用
function applyFilters() {
    let filtered = [...allIssues];
    
    if (currentStatusFilter) {
        filtered = filtered.filter(issue => issue.status === currentStatusFilter);
    }
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filtered = filtered.filter(issue => 
            (issue.title && issue.title.toLowerCase().includes(searchTerm)) ||
            (issue.description && issue.description.toLowerCase().includes(searchTerm))
        );
    }
    
    filtered.sort((a, b) => {
        let aVal = a[currentSortField];
        let bVal = b[currentSortField];
        
        if (currentSortField === 'created_at' || currentSortField === 'due_date') {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        
        if (currentSortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    filteredIssues = filtered;
    currentPage = 1;
    renderIssues();
}

// 検索
function searchIssues() {
    applyFilters();
}

// ステータスフィルター
function filterByStatus(status) {
    currentStatusFilter = currentStatusFilter === status ? '' : status;
    
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    
    if (currentStatusFilter) {
        const activeCard = document.querySelector(`.stat-card[data-filter="${currentStatusFilter}"]`);
        if (activeCard) activeCard.classList.add('active');
    }
    
    applyFilters();
}

// ソート
function sortIssues(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'desc';
    }
    applyFilters();
}

// モーダル：使い方ガイド
function showGuideModal() {
    const modal = document.getElementById('guideModal');
    if (modal) modal.classList.add('show');
}

function closeGuideModal() {
    const modal = document.getElementById('guideModal');
    if (modal) modal.classList.remove('show');
}

// モーダル：新規追加
function openNewIssueModal() {
    editingIssueId = null;
    document.getElementById('modalTitle').textContent = '新規追加';
    issueForm.reset();
    screenshotPreview.innerHTML = '';
    screenshotPreview.classList.remove('show');
    
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.display = 'flex';
    
    issueModal.classList.add('show');
}

window.openAddModal = openNewIssueModal;

// モーダル：編集
window.editIssue = async function(id) {
    try {
        const issue = await SupabaseAPI.getById(id);
        if (!issue) {
            alert('データの読み込みに失敗しました。');
            return;
        }
        
        editingIssueId = id;
        document.getElementById('modalTitle').textContent = '編集';
        
        document.getElementById('issueTitle').value = issue.title || '';
        document.getElementById('issueStatus').value = issue.status || '未対応';
        document.getElementById('issuePriority').value = issue.priority || '中';
        document.getElementById('issueCategory').value = issue.category || 'デザイン';
        document.getElementById('issueAssignee').value = issue.assignee || '';
        document.getElementById('issuePageUrl').value = issue.page_url || '';
        
        // due_dateをYYYY-MM-DD形式に変換
        if (issue.due_date) {
            try {
                const date = new Date(issue.due_date);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                document.getElementById('issueDueDate').value = `${year}-${month}-${day}`;
            } catch (e) {
                document.getElementById('issueDueDate').value = '';
            }
        } else {
            document.getElementById('issueDueDate').value = '';
        }
        
        document.getElementById('issueDescription').value = issue.description || '';
        
        if (issue.screenshot) {
            displayImagePreview(issue.screenshot);
        } else {
            screenshotPreview.innerHTML = '';
            screenshotPreview.classList.remove('show');
        }
        
        issueModal.classList.add('show');
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。');
    }
};

// モーダル：詳細表示
window.showDetail = async function(id) {
    try {
        const issue = await SupabaseAPI.getById(id);
        if (!issue) {
            alert('データの読み込みに失敗しました。');
            return;
        }
        
        const detailContent = document.getElementById('detailContent');
        const globalIndex = allIssues.findIndex(i => i.id === issue.id) + 1;
        
        detailContent.innerHTML = `
            <div class="detail-row" style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <div class="detail-label" style="font-weight: 700; font-size: 18px; color: #1e293b;">ID</div>
                <div class="detail-value" style="font-weight: 700; font-size: 18px; color: #2563eb;">#${globalIndex}</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">タイトル</div>
                <div class="detail-value" style="font-weight: 600; color: #1e293b;">${escapeHtml(issue.title)}</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">ステータス</div>
                <div class="detail-value"><span class="status-badge status-${issue.status}">${issue.status}</span></div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">優先度</div>
                <div class="detail-value"><span class="priority-badge priority-${issue.priority}">${issue.priority}</span></div>
            </div>
            
            ${issue.category ? `
                <div class="detail-row">
                    <div class="detail-label">カテゴリ</div>
                    <div class="detail-value">${escapeHtml(issue.category)}</div>
                </div>
            ` : ''}
            
            ${issue.assignee ? `
                <div class="detail-row">
                    <div class="detail-label">担当者</div>
                    <div class="detail-value">${escapeHtml(issue.assignee)}</div>
                </div>
            ` : ''}
            
            ${issue.page_url ? `
                <div class="detail-row">
                    <div class="detail-label">対象ページURL</div>
                    <div class="detail-value"><a href="${escapeHtml(issue.page_url)}" target="_blank">${escapeHtml(issue.page_url)}</a></div>
                </div>
            ` : ''}
            
            ${issue.due_date ? `
                <div class="detail-row">
                    <div class="detail-label">期限</div>
                    <div class="detail-value ${isOverdue(issue.due_date) ? 'overdue' : ''}">${formatDate(issue.due_date)}</div>
                </div>
            ` : ''}
            
            ${issue.description ? `
                <div class="detail-row">
                    <div class="detail-label">詳細説明</div>
                    <div class="detail-value">${escapeHtml(issue.description).replace(/\n/g, '<br>')}</div>
                </div>
            ` : ''}
            
            ${issue.screenshot ? `
                <div class="detail-row">
                    <div class="detail-label">画面キャプチャ</div>
                    <div class="detail-value">
                        <img src="${issue.screenshot}" alt="スクリーンショット" class="detail-screenshot" onclick="showImageModal('${issue.screenshot}')">
                    </div>
                </div>
            ` : ''}
            
            <div class="detail-row" style="border-bottom: none;">
                <div class="detail-label">登録日時</div>
                <div class="detail-value">${formatDateTime(issue.created_at)}</div>
            </div>
        `;
        
        detailModal.classList.add('show');
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。');
    }
}

// フォーム送信中フラグ
let isSubmitting = false;

// フォーム送信処理
async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        console.log('⚠️ すでに送信中です');
        return;
    }
    
    isSubmitting = true;
    
    const formData = {
        title: document.getElementById('issueTitle').value,
        status: document.getElementById('issueStatus').value,
        priority: document.getElementById('issuePriority').value,
        category: document.getElementById('issueCategory').value,
        assignee: document.getElementById('issueAssignee').value,
        page_url: document.getElementById('issuePageUrl').value,
        due_date: document.getElementById('issueDueDate').value || null,
        description: document.getElementById('issueDescription').value,
        screenshot: ''
    };
    
    const previewImg = screenshotPreview.querySelector('img');
    if (previewImg) {
        formData.screenshot = previewImg.src;
        
        const sizeInBytes = Math.ceil((formData.screenshot.length * 3) / 4);
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`📦 画像サイズ: ${sizeInMB.toFixed(2)}MB`);
        
        if (sizeInMB > 5) {
            alert(`画像サイズが大きすぎます（${sizeInMB.toFixed(2)}MB）。\n5MB以下の画像を使用してください。\n\n画像をもっと小さくトリミングしてください。`);
            isSubmitting = false;
            return;
        }
    }
    
    try {
        if (editingIssueId) {
            await SupabaseAPI.update(editingIssueId, formData);
        } else {
            await SupabaseAPI.create(formData);
        }
        
        closeModals();
        await loadIssues();
        showSuccess(editingIssueId ? '更新しました' : '登録しました');
    } catch (error) {
        console.error('保存エラー:', error);
        alert('保存に失敗しました。もう一度お試しください。');
    } finally {
        isSubmitting = false;
    }
}

// 削除処理
window.deleteIssue = async function(id) {
    if (!confirm('この修正項目を削除してもよろしいですか?')) {
        return;
    }
    
    try {
        await SupabaseAPI.delete(id);
        await loadIssues();
        showSuccess('削除しました');
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました。もう一度お試しください。');
    }
};

// ステータス変更
window.changeStatus = async function(id, newStatus) {
    try {
        await SupabaseAPI.update(id, { status: newStatus });
        await loadIssues();
        showSuccess(`ステータスを「${newStatus}」に変更しました`);
    } catch (error) {
        console.error('ステータス変更エラー:', error);
        alert('ステータスの変更に失敗しました。');
        await loadIssues();
    }
};
// 画像アップロード処理
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    processImageFile(file);
}

window.handleImageUpload = handleImageUpload;

// 画像処理（ドラッグ&ドロップ、クリップボード用）
function processImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        resizeAndConvertImage(event.target.result);
    };
    reader.readAsDataURL(file);
}

// 画像リサイズ＆WebP変換
function resizeAndConvertImage(dataUrl) {
    const img = new Image();
    img.onload = function() {
        const maxWidth = 2560;
        const maxHeight = 2560;
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        let outputFormat = 'image/webp';
        let quality = 0.9;
        
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        if (webpDataUrl.indexOf('data:image/webp') !== 0) {
            outputFormat = 'image/jpeg';
        }
        
        const finalDataUrl = canvas.toDataURL(outputFormat, quality);
        
        const sizeInBytes = Math.ceil((finalDataUrl.length * 3) / 4);
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`画像変換完了: ${img.width}x${img.height} → ${width}x${height}, サイズ: ${sizeInMB.toFixed(2)}MB`);
        
        if (sizeInMB > 5) {
            alert(`画像サイズが大きすぎます（${sizeInMB.toFixed(2)}MB）。\n5MB以下の画像を使用してください。`);
            return;
        }
        
        displayImagePreview(finalDataUrl);
    };
    
    img.onerror = function() {
        alert('画像の読み込みに失敗しました。');
    };
    
    img.src = dataUrl;
}

// 画像プレビュー表示
function displayImagePreview(dataUrl) {
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.style.display = 'none';
    }
    
    screenshotPreview.innerHTML = `
        <img src="${dataUrl}" alt="プレビュー">
        <button type="button" class="remove-screenshot" onclick="removeScreenshot()">×</button>
    `;
    screenshotPreview.classList.add('show');
}

// ドラッグ&ドロップ設定
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processImageFile(files[0]);
        }
    });
    
    const selectFileBtn = document.getElementById('selectFileBtn');
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => {
            screenshotInput.click();
        });
    }
}

// クリップボードペースト
function setupClipboardPaste() {
    const issueModal = document.getElementById('issueModal');
    if (!issueModal) return;
    
    issueModal.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                processImageFile(file);
                break;
            }
        }
    });
}

// スクリーンショット削除
window.removeScreenshot = function() {
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.style.display = 'flex';
    }
    
    screenshotPreview.innerHTML = '';
    screenshotPreview.classList.remove('show');
    screenshotInput.value = '';
}

// 画像モーダル表示
window.showImageModal = function(src) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.zIndex = '2000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90vh; padding: 0; overflow-y: auto; overflow-x: hidden;">
            <img src="${src}" style="width: 100%; height: auto; display: block;">
        </div>
    `;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

// モーダルを閉じる
window.closeModals = function() {
    const modal1 = issueModal || document.getElementById('issueModal');
    const modal2 = detailModal || document.getElementById('detailModal');
    
    if (modal1) modal1.classList.remove('show');
    if (modal2) modal2.classList.remove('show');
};

// ========================================
// 4. データ表示とレンダリング
// ========================================

function renderIssues() {
    const container = document.getElementById('issuesContainer');
    
    if (filteredIssues.length === 0) {
        container.innerHTML = `
            <div class="no-issues">
                <p>📋 修正項目がありません</p>
                <p class="text-muted">右上の「新規追加」ボタンから項目を追加できます</p>
            </div>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedIssues = filteredIssues.slice(start, end);
    
    container.innerHTML = `
        <table class="issues-table">
            <thead>
                <tr>
                    <th onclick="sortIssues('index')">ID</th>
                    <th onclick="sortIssues('status')">ステータス ▼</th>
                    <th onclick="sortIssues('priority')">優先度 ▼</th>
                    <th onclick="sortIssues('title')">タイトル・詳細 ▼</th>
                    <th onclick="sortIssues('category')">カテゴリ ▼</th>
                    <th onclick="sortIssues('assignee')">担当者 ▼</th>
                    <th onclick="sortIssues('due_date')">期限 ▼</th>
                    <th onclick="sortIssues('created_at')">登録日 ▼</th>
                    <th class="actions-column">操作</th>
                </tr>
            </thead>
            <tbody>
                ${paginatedIssues.map((issue, index) => {
                    const globalIndex = allIssues.findIndex(i => i.id === issue.id) + 1;
                    return `
                    <tr>
                        <td class="id-column">#${globalIndex}</td>
                        <td class="status-column">
                            <select class="status-select status-${issue.status}" onchange="changeStatus('${issue.id}', this.value)">
                                <option value="未対応" ${issue.status === '未対応' ? 'selected' : ''}>未対応</option>
                                <option value="対応中" ${issue.status === '対応中' ? 'selected' : ''}>対応中</option>
                                <option value="確認待ち" ${issue.status === '確認待ち' ? 'selected' : ''}>確認待ち</option>
                                <option value="完了" ${issue.status === '完了' ? 'selected' : ''}>完了</option>
                                <option value="保留" ${issue.status === '保留' ? 'selected' : ''}>保留</option>
                            </select>
                        </td>
                        <td><span class="priority-badge priority-${issue.priority}">${issue.priority}</span></td>
                        <td class="title-column">
                            <div class="title-wrapper">
                                <strong>${escapeHtml(issue.title)}</strong>
                                ${issue.screenshot ? '<i class="fas fa-image screenshot-icon" title="画像あり"></i>' : ''}
                            </div>
                            ${issue.description ? `<div class="description-preview">${escapeHtml(truncateText(issue.description, 60))}</div>` : ''}
                        </td>
                        <td>${escapeHtml(issue.category)}</td>
                        <td>${escapeHtml(issue.assignee)}</td>
                        <td class="${isOverdue(issue.due_date) ? 'overdue-date' : ''}">${formatDate(issue.due_date)}</td>
                        <td>${formatDate(issue.created_at)}</td>
                        <td class="actions-column">
                            <button class="btn-icon" onclick="showDetail('${issue.id}')" title="詳細表示">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon" onclick="editIssue('${issue.id}')" title="編集">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-icon-delete" onclick="if(confirm('この項目を削除しますか？')) deleteIssue('${issue.id}')" title="削除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-container">';
    
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})">前へ</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }
    
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})">次へ</button>`;
    }
    
    html += '</div>';
    pagination.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderIssues();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// ========================================
// 5. CSV エクスポート機能
// ========================================

window.exportToCSV = function() {
    const dataToExport = filteredIssues.map((issue) => {
        const globalIndex = allIssues.findIndex(i => i.id === issue.id) + 1;
        return {
            ID: `#${globalIndex}`,
            ステータス: issue.status,
            優先度: issue.priority,
            タイトル: issue.title,
            詳細説明: issue.description || '',
            カテゴリ: issue.category,
            担当者: issue.assignee || '',
            対象ページURL: issue.page_url || '',
            期限: issue.due_date ? formatDate(issue.due_date) : '',
            登録日: formatDate(issue.created_at)
        };
    });
    
    if (dataToExport.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
    }
    
    const headers = ['ID', 'ステータス', '優先度', 'タイトル', '詳細説明', 'カテゴリ', '担当者', '対象ページURL', '期限', '登録日'];
    
    const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
            headers.map(header => {
                const value = row[header] || '';
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') 
                    ? `"${escaped}"` 
                    : escaped;
            }).join(',')
        )
    ].join('\n');
    
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const now = new Date();
    const filename = `修正管理表_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    showSuccess(`CSVファイルをエクスポートしました（${dataToExport.length}件）`);
}

// ========================================
// 6. ヘルパー関数
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    } catch (e) {
        return '-';
    }
}

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP');
}

function isOverdue(dueDateString) {
    if (!dueDateString) return false;
    const dueDate = new Date(dueDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

function showSuccess(message) {
    alert(message);
}

function showError(message) {
    alert(message);
}

function showLoading() {
    issuesContainer.innerHTML = '<div class="loading">読み込み中...</div>';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========================================
// 7. 初期化（グローバル公開）
// ========================================

console.log('🔵 app.js loaded');
window.loadIssues = loadIssues;
window.openNewIssueModal = openNewIssueModal;
window.closeModal = closeModals;
window.handleSubmit = handleSubmit;
window.removeScreenshot = removeScreenshot;
window.changeStatus = changeStatus;
window.deleteIssue = deleteIssue;
window.editIssue = editIssue;
window.showDetail = showDetail;
window.searchIssues = searchIssues;
window.filterByStatus = filterByStatus;
window.sortIssues = sortIssues;
window.processImageFile = processImageFile;
window.handleImageUpload = handleImageUpload;
window.goToPage = goToPage;
window.exportToCSV = exportToCSV;
window.closeModals = closeModals;
window.showGuideModal = showGuideModal;
window.closeGuideModal = closeGuideModal;
window.initializeApp = initializeApp;
