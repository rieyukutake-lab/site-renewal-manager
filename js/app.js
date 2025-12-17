// グローバル変数
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentSortField = 'created_at';
let currentSortOrder = 'desc';
let currentStatusFilter = '';

// DOM要素の参照
let issuesContainer;
let addIssueBtn;
let issueModal;
let detailModal;
let modalTitle;
let issueForm;
let searchInput;
let screenshotInput;
let screenshotPreview;
let editingIssueId = null;

// アプリケーションの初期化
function initializeApp() {
    // DOM要素の取得
    issuesContainer = document.getElementById('issuesContainer');
    addIssueBtn = document.getElementById('addIssueBtn');
    issueModal = document.getElementById('issueModal');
    detailModal = document.getElementById('detailModal');
    modalTitle = document.getElementById('modalTitle');
    issueForm = document.getElementById('issueForm');
    searchInput = document.getElementById('searchInput');
    screenshotInput = document.getElementById('issueScreenshot');
    screenshotPreview = document.getElementById('screenshotPreview');
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // ドラッグ&ドロップの設定
    setupDragAndDrop();
    
    // クリップボード貼り付けの設定
    setupClipboardPaste();
    
    // 初期データの読み込み
    loadIssues();
}

// DOMContentLoadedイベント
document.addEventListener('DOMContentLoaded', () => {
    // 認証チェックは auth.js で行われる
    // ログイン成功後に initializeApp() が呼ばれる
});

// イベントリスナーの設定
function setupEventListeners() {
    // モーダルを開く
    if (addIssueBtn) {
        addIssueBtn.addEventListener('click', () => openAddModal());
    }
    
    // モーダルを閉じる
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', () => closeModals());
    }
    
    const closeDetailModal = document.getElementById('closeDetailModal');
    if (closeDetailModal) {
        closeDetailModal.addEventListener('click', () => closeModals());
    }
    
    // キャンセルボタン
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModals());
    }
    
    // フォーム送信
    if (issueForm) {
        issueForm.addEventListener('submit', handleSubmit);
    }
    
    // 検索
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // ファイル選択ボタン
    const selectFileBtn = document.getElementById('selectFileBtn');
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => {
            if (screenshotInput) screenshotInput.click();
        });
    }
    
    // ファイル選択
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleImageUpload);
    }
    
    // モーダル外クリックで閉じる
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
}

// データの読み込み
async function loadIssues() {
    try {
        showLoading();
        
        const data = await SupabaseAPI.getAll();
        allIssues = data || [];
        
        applyFilters();
        updateStatistics();
        renderIssues();
        renderPagination();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        showError('データの読み込みに失敗しました。');
    }
}

// 検索処理
function handleSearch() {
    applyFilters();
    renderIssues();
    renderPagination();
}

// フィルター適用
function applyFilters() {
    let filtered = [...allIssues];
    
    // ステータスフィルター
    if (currentStatusFilter) {
        filtered = filtered.filter(issue => issue.status === currentStatusFilter);
    }
    
    // 検索フィルター
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filtered = filtered.filter(issue => {
            return (
                issue.title.toLowerCase().includes(searchTerm) ||
                (issue.description && issue.description.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    // ソート
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
}

// 統計情報の更新
function updateStatistics() {
    document.getElementById('statTotal').textContent = allIssues.length;
    document.getElementById('statPending').textContent = allIssues.filter(i => i.status === '未対応').length;
    document.getElementById('statProgress').textContent = allIssues.filter(i => i.status === '対応中').length;
    document.getElementById('statWaiting').textContent = allIssues.filter(i => i.status === '確認待ち').length;
    document.getElementById('statCompleted').textContent = allIssues.filter(i => i.status === '完了').length;
    document.getElementById('statOnHold').textContent = allIssues.filter(i => i.status === '保留').length;
}

// リストの描画
function renderIssues() {
    if (filteredIssues.length === 0) {
        issuesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>修正項目がありません</p>
            </div>
        `;
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageIssues = filteredIssues.slice(startIndex, endIndex);
    
    issuesContainer.innerHTML = `
        <table class="issues-table">
            <thead>
                <tr>
                    <th style="width: 60px;">ID</th>
                    <th class="sortable" onclick="sortIssues('status')">
                        ステータス <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('priority')">
                        優先度 <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('title')">
                        タイトル / 詳細 <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('category')">
                        カテゴリ <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('assignee')">
                        担当者 <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('due_date')">
                        期限 <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable" onclick="sortIssues('created_at')">
                        登録日 <i class="fas fa-sort"></i>
                    </th>
                    <th class="th-actions">操作</th>
                </tr>
            </thead>
            <tbody>
                ${pageIssues.map((issue, index) => {
                    // 全体のインデックスを計算（ページネーション考慮）
                    const globalIndex = filteredIssues.findIndex(i => i.id === issue.id) + 1;
                    return `
                    <tr class="issue-row status-${issue.status.replace(/\s/g, '-')}" onclick="showDetail('${issue.id}')">
                        <td style="font-weight: 600; color: #64748b;">
                            #${globalIndex}
                        </td>
                        <td onclick="event.stopPropagation();">
                            <select class="status-select status-${issue.status.replace(/\s/g, '-')}" onchange="changeStatus('${issue.id}', this.value)" data-current="${issue.status}">
                                <option value="未対応" ${issue.status === '未対応' ? 'selected' : ''}>未対応</option>
                                <option value="対応中" ${issue.status === '対応中' ? 'selected' : ''}>対応中</option>
                                <option value="確認待ち" ${issue.status === '確認待ち' ? 'selected' : ''}>確認待ち</option>
                                <option value="完了" ${issue.status === '完了' ? 'selected' : ''}>完了</option>
                                <option value="保留" ${issue.status === '保留' ? 'selected' : ''}>保留</option>
                            </select>
                        </td>
                        <td>
                            <span class="badge badge-priority priority-${issue.priority}">${issue.priority}</span>
                        </td>
                        <td class="td-title">
                            <div class="row-title">
                                ${escapeHtml(issue.title)}
                                ${issue.screenshot ? '<i class="fas fa-image" title="画像あり"></i>' : ''}
                            </div>
                            ${issue.description ? `
                                <div class="row-description">${escapeHtml(truncateText(issue.description, 100))}</div>
                            ` : ''}
                        </td>
                        <td>
                            <span class="badge badge-category">${issue.category}</span>
                        </td>
                        <td>${issue.assignee || '<span class="text-muted">未割当</span>'}</td>
                        <td>
                            ${issue.due_date ? `
                                <span class="${isOverdue(issue.due_date) ? 'text-danger' : ''}">${formatDate(issue.due_date)}</span>
                            ` : '<span class="text-muted">-</span>'}
                        </td>
                        <td>${formatDate(issue.created_at)}</td>
                        <td class="td-actions" onclick="event.stopPropagation();">
                            <button class="btn-icon" onclick="editIssue('${issue.id}')" title="編集">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-icon-danger" onclick="deleteIssue('${issue.id}')" title="削除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ページネーション表示
function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // 前へボタン
    html += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // ページ番号
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span>...</span>`;
        }
    }
    
    // 次へボタン
    html += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    pagination.innerHTML = html;
}

// ページ変更
window.changePage = function(page) {
    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderIssues();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ソート
window.sortIssues = function(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    
    applyFilters();
    renderIssues();
}

// ステータスフィルター
window.filterByStatus = function(status) {
    currentStatusFilter = status;
    
    // カードのアクティブ状態を更新
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    
    const activeCard = document.querySelector(`.stat-card[data-filter="${status}"]`);
    if (activeCard) {
        activeCard.classList.add('active');
    }
    
    applyFilters();
    renderIssues();
    renderPagination();
}

// 新規追加モーダルを開く（グローバル関数）
window.openAddModal = function() {
    const modal = issueModal || document.getElementById('issueModal');
    const title = modalTitle || document.getElementById('modalTitle');
    const form = issueForm || document.getElementById('issueForm');
    const preview = screenshotPreview || document.getElementById('screenshotPreview');
    
    if (!modal) return;
    
    editingIssueId = null;
    if (title) title.textContent = '新規追加';
    if (form) form.reset();
    if (preview) {
        preview.innerHTML = '';
        preview.classList.remove('show');
    }
    
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.style.display = 'flex';
    }
    
    modal.classList.add('show');
};

// 編集モーダルを開く（グローバル関数）
window.editIssue = async function(id) {
    try {
        const issue = await SupabaseAPI.getById(id);
        
        editingIssueId = id;
        modalTitle.textContent = '修正項目の編集';
        
        document.getElementById('issueId').value = issue.id;
        document.getElementById('issueTitle').value = issue.title;
        document.getElementById('issueStatus').value = issue.status;
        document.getElementById('issuePriority').value = issue.priority;
        document.getElementById('issueCategory').value = issue.category;
        document.getElementById('issueAssignee').value = issue.assignee || '';
        document.getElementById('issuePageUrl').value = issue.page_url || '';
        
        // due_dateをYYYY-MM-DD形式に変換
        if (issue.due_date) {
            const dueDate = new Date(issue.due_date);
            const year = dueDate.getFullYear();
            const month = String(dueDate.getMonth() + 1).padStart(2, '0');
            const day = String(dueDate.getDate()).padStart(2, '0');
            document.getElementById('issueDueDate').value = `${year}-${month}-${day}`;
        } else {
            document.getElementById('issueDueDate').value = '';
        }
        
        document.getElementById('issueDescription').value = issue.description || '';
        
        const dropZone = document.getElementById('dropZone');
        
        if (issue.screenshot) {
            if (dropZone) dropZone.style.display = 'none';
            screenshotPreview.innerHTML = `
                <img src="${issue.screenshot}" alt="プレビュー">
                <button type="button" class="remove-screenshot" onclick="removeScreenshot()">×</button>
            `;
            screenshotPreview.classList.add('show');
        } else {
            if (dropZone) dropZone.style.display = 'flex';
            screenshotPreview.innerHTML = '';
            screenshotPreview.classList.remove('show');
        }
        
        issueModal.classList.add('show');
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。');
    }
}

// 詳細表示（グローバル関数）
window.showDetail = async function(id) {
    try {
        const issue = await SupabaseAPI.getById(id);
        
        // IDを計算
        const globalIndex = allIssues.findIndex(i => i.id === issue.id) + 1;
        
        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <div class="detail-row">
                <div class="detail-label">ID</div>
                <div class="detail-value" style="font-weight: 600; color: #64748b; font-size: 18px;">#${globalIndex}</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">タイトル</div>
                <div class="detail-value">${escapeHtml(issue.title)}</div>
            </div>
            
            <div class="detail-row">
                <div class="detail-label">ステータス / 優先度 / カテゴリ</div>
                <div class="detail-value">
                    <span class="badge badge-status ${issue.status}">${issue.status}</span>
                    <span class="badge badge-priority ${issue.priority}">優先度: ${issue.priority}</span>
                    <span class="badge badge-category">${issue.category}</span>
                </div>
            </div>
            
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
// ========================================
// 4. データ表示とレンダリング
// ========================================

let currentPage = 1;
const itemsPerPage = 10;

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
                    const rowId = start + index + 1;
                    return `
                    <tr>
                        <td class="id-column">#${rowId}</td>
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

function exportToCSV() {
    const headers = ['ID', 'ステータス', '優先度', 'タイトル', '詳細説明', 'カテゴリ', '担当者', '対象ページURL', '期限', '登録日'];
    
    const rows = filteredIssues.map((issue, index) => {
        return [
            `#${index + 1}`,
            issue.status,
            issue.priority,
            escapeCSV(issue.title),
            escapeCSV(issue.description || ''),
            escapeCSV(issue.category),
            escapeCSV(issue.assignee),
            escapeCSV(issue.page_url || ''),
            formatDate(issue.due_date),
            formatDate(issue.created_at)
        ];
    });
    
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `修正管理表_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeCSV(text) {
    if (!text) return '';
    const str = String(text);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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

// ========================================
// 7. 初期化
// ========================================

console.log('🔵 app.js loaded');
window.loadIssues = loadIssues;
window.openNewIssueModal = openNewIssueModal;
window.closeModal = closeModal;
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
