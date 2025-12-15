// グローバル変数
let allIssues = [];
let filteredIssues = [];
let currentPage = 1;
const itemsPerPage = 50;
let editingIssueId = null;
let currentSortField = 'created_at';
let currentSortOrder = 'desc'; // 'asc' or 'desc'
let currentStatusFilter = ''; // 現在のステータスフィルター

// DOM要素（DOMContentLoaded後に初期化）
let issuesContainer;
let addIssueBtn;
let issueModal;
let detailModal;
let closeModal;
let closeDetailModal;
let cancelBtn;
let issueForm;
let modalTitle;
let searchInput;
let screenshotInput;
let screenshotPreview;

// アプリケーションの初期化関数
function initializeApp() {
    // DOM要素の取得
    issuesContainer = document.getElementById('issuesContainer');
    addIssueBtn = document.getElementById('addIssueBtn');
    issueModal = document.getElementById('issueModal');
    detailModal = document.getElementById('detailModal');
    closeModal = document.getElementById('closeModal');
    closeDetailModal = document.getElementById('closeDetailModal');
    cancelBtn = document.getElementById('cancelBtn');
    issueForm = document.getElementById('issueForm');
    modalTitle = document.getElementById('modalTitle');
    searchInput = document.getElementById('searchInput');
    screenshotInput = document.getElementById('issueScreenshot');
    screenshotPreview = document.getElementById('screenshotPreview');
    
    if (addIssueBtn && issueForm) {
        setupEventListeners();
        setupDragAndDrop();
        setupClipboardPaste();
        loadIssues();
    }
}

// 初期化（認証後に呼び出される）
document.addEventListener('DOMContentLoaded', () => {
    // 認証済みの場合のみ初期化
    // auth.jsから呼び出されるため、ここでは何もしない
});

// イベントリスナーの設定
function setupEventListeners() {
    // モーダル関連
    // 新規追加ボタンはHTMLのonclickで処理
    
    if (closeModal) closeModal.addEventListener('click', closeModals);
    if (closeDetailModal) closeDetailModal.addEventListener('click', closeModals);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModals);
    
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
    
    // フォーム送信
    if (issueForm) {
        issueForm.addEventListener('submit', handleSubmit);
    }
    
    // 検索
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
    
    // 画像アップロード
    if (screenshotInput) screenshotInput.addEventListener('change', handleImageUpload);
    
}

// 修正項目の読み込み
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

// フィルターの適用
function applyFilters() {
    const searchText = searchInput ? searchInput.value.toLowerCase() : '';
    
    filteredIssues = allIssues.filter(issue => {
        const matchStatus = !currentStatusFilter || issue.status === currentStatusFilter;
        const matchSearch = !searchText || 
            issue.title.toLowerCase().includes(searchText) ||
            (issue.description && issue.description.toLowerCase().includes(searchText));
        
        return matchStatus && matchSearch;
    });
    
    // ソートを適用
    applySorting();
    
    currentPage = 1;
    renderIssues();
    renderPagination();
    updateStatCardsActiveState();
}

// ステータスでフィルター（グローバル関数）
window.filterByStatus = function(status) {
    currentStatusFilter = status;
    applyFilters();
};

// 統計カードのアクティブ状態を更新
function updateStatCardsActiveState() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const filterValue = card.getAttribute('data-filter');
        if (filterValue === currentStatusFilter) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

// ソート機能（グローバル関数）
window.sortIssues = function(field) {
    // 同じフィールドをクリックした場合は昇順/降順を切り替え
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    
    applySorting();
    renderIssues();
    renderPagination();
}

// ソートを適用
function applySorting() {
    filteredIssues.sort((a, b) => {
        let aValue = a[currentSortField];
        let bValue = b[currentSortField];
        
        // 優先度のソート順序を定義
        if (currentSortField === 'priority') {
            const priorityOrder = { '高': 1, '中': 2, '低': 3 };
            aValue = priorityOrder[aValue] || 999;
            bValue = priorityOrder[bValue] || 999;
        }
        
        // ステータスのソート順序を定義
        if (currentSortField === 'status') {
            const statusOrder = { '未対応': 1, '対応中': 2, '確認待ち': 3, '完了': 4, '保留': 5 };
            aValue = statusOrder[aValue] || 999;
            bValue = statusOrder[bValue] || 999;
        }
        
        // 空の値を最後に
        if (!aValue && aValue !== 0) aValue = currentSortOrder === 'asc' ? 'zzz' : '';
        if (!bValue && bValue !== 0) bValue = currentSortOrder === 'asc' ? 'zzz' : '';
        
        // 比較
        if (aValue < bValue) return currentSortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return currentSortOrder === 'asc' ? 1 : -1;
        return 0;
    });
}

// 修正項目の表示（リスト形式）
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
                ${pageIssues.map(issue => `
                    <tr class="issue-row status-${issue.status.replace(/\s/g, '-')}" onclick="showDetail('${issue.id}')">
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
                `).join('')}
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
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // ページ番号
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="page-btn" disabled>...</span>`;
        }
    }
    
    // 次へボタン
    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    pagination.innerHTML = html;
}

// ページ変更
function changePage(page) {
    currentPage = page;
    renderIssues();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 統計情報の更新
function updateStats() {
    document.getElementById('statTotal').textContent = allIssues.length;
    document.getElementById('statPending').textContent = allIssues.filter(i => i.status === '未対応').length;
    document.getElementById('statProgress').textContent = allIssues.filter(i => i.status === '対応中').length;
    document.getElementById('statWaiting').textContent = allIssues.filter(i => i.status === '確認待ち').length;
    document.getElementById('statCompleted').textContent = allIssues.filter(i => i.status === '完了').length;
    document.getElementById('statOnHold').textContent = allIssues.filter(i => i.status === '保留').length;
}

// 新規追加モーダルを開く（グローバル関数として定義）
window.openAddModal = function() {
    // DOM要素を再取得（念のため）
    const modal = issueModal || document.getElementById('issueModal');
    const form = issueForm || document.getElementById('issueForm');
    const title = modalTitle || document.getElementById('modalTitle');
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
        
        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
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
            
            <div class="detail-row">
                <div class="detail-label">登録日時</div>
                <div class="detail-value">${formatDateTime(issue.created_at)}</div>
            </div>
            
            <div class="detail-row" style="border-bottom: none;">
                <div class="detail-label">更新日時</div>
                <div class="detail-value">${formatDateTime(issue.updated_at)}</div>
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
    
    // 多重送信を防ぐ
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
        due_date: document.getElementById('issueDueDate').value || null, // 空の場合はnull
        description: document.getElementById('issueDescription').value,
        screenshot: ''
    };
    
    // スクリーンショットの取得
    const previewImg = screenshotPreview.querySelector('img');
    if (previewImg) {
        formData.screenshot = previewImg.src;
        
        // Base64データのサイズチェック（約2MB）
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
            // 更新
            await SupabaseAPI.update(editingIssueId, formData);
        } else {
            // 新規作成
            await SupabaseAPI.create(formData);
        }
        
        closeModals();
        await loadIssues();
        showSuccess(editingIssueId ? '更新しました' : '登録しました');
    } catch (error) {
        console.error('保存エラー:', error);
        alert('保存に失敗しました。もう一度お試しください。');
    } finally {
        // 送信中フラグをリセット
        isSubmitting = false;
    }
}

// 削除処理（グローバル関数）
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

// ステータス変更（グローバル関数）
window.changeStatus = async function(id, newStatus) {
    try {
        // ステータスのみを更新
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

// 画像ファイルの処理（共通関数）
function processImageFile(file) {
    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
    }
    
    // 画像を読み込んでリサイズ＆WebP変換
    const reader = new FileReader();
    reader.onload = function(event) {
        resizeAndConvertImage(event.target.result);
    };
    reader.readAsDataURL(file);
}

// 画像をリサイズしてWebPに変換
function resizeAndConvertImage(dataUrl) {
    const img = new Image();
    img.onload = function() {
        // 最大幅・高さを設定（これより大きい場合はリサイズ）
        const maxWidth = 2560;
        const maxHeight = 2560;
        
        let width = img.width;
        let height = img.height;
        
        // アスペクト比を維持しながらリサイズ
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        // Canvasで画像を描画
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // WebPに変換（品質90%）
        // WebPがサポートされていない場合はJPEGにフォールバック
        let outputFormat = 'image/webp';
        let quality = 0.9;
        
        // WebPをサポートしているかチェック
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        if (webpDataUrl.indexOf('data:image/webp') !== 0) {
            // WebP非対応の場合はJPEGを使用
            outputFormat = 'image/jpeg';
        }
        
        const finalDataUrl = canvas.toDataURL(outputFormat, quality);
        
        // サイズを確認
        const sizeInBytes = Math.ceil((finalDataUrl.length * 3) / 4);
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`画像変換完了: ${img.width}x${img.height} → ${width}x${height}, サイズ: ${sizeInMB.toFixed(2)}MB`);
        
        // サイズが大きすぎる場合は警告
        if (sizeInMB > 5) {
            alert(`画像サイズが大きすぎます（${sizeInMB.toFixed(2)}MB）。\n5MB以下の画像を使用してください。\n\n画像をもっと小さくトリミングするか、範囲を狭くしてください。`);
            return;
        }
        
        // プレビュー表示
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

// ドラッグ&ドロップ機能の設定
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    // ドラッグオーバー
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    // ドラッグ離脱
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    
    // ドロップ
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processImageFile(files[0]);
        }
    });
    
    // ファイル選択ボタン
    const selectFileBtn = document.getElementById('selectFileBtn');
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => {
            screenshotInput.click();
        });
    }
}

// クリップボードからのペースト機能
function setupClipboardPaste() {
    // モーダル全体でペーストイベントをキャッチ
    const issueModal = document.getElementById('issueModal');
    if (!issueModal) return;
    
    issueModal.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // 画像データの場合
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                processImageFile(file);
                break;
            }
        }
    });
}

// スクリーンショット削除（グローバル関数）
window.removeScreenshot = function() {
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.style.display = 'flex';
    }
    
    screenshotPreview.innerHTML = '';
    screenshotPreview.classList.remove('show');
    screenshotInput.value = '';
}

// 画像モーダル表示（グローバル関数）
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
// モーダルを閉じる（グローバル関数）
window.closeModals = function() {
    const modal1 = issueModal || document.getElementById('issueModal');
    const modal2 = detailModal || document.getElementById('detailModal');
    
    if (modal1) modal1.classList.remove('show');
    if (modal2) modal2.classList.remove('show');
};

// ユーティリティ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP');
}

function isOverdue(dateString) {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
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

function showLoading() {
    issuesContainer.innerHTML = '<div class="loading">読み込み中...</div>';
}

function showError(message) {
    issuesContainer.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-exclamation-triangle"></i><p>${message}</p></div>`;
}

function showSuccess(message) {
    // 簡易的な成功メッセージ表示
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 3000; animation: slideInRight 0.3s ease;';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 使い方・注意事項モーダルの表示（グローバル関数）
window.showGuideModal = function() {
    const guideModal = document.getElementById('guideModal');
    if (guideModal) {
        guideModal.classList.add('show');
    }
}

// 使い方・注意事項モーダルを閉じる（グローバル関数）
window.closeGuideModal = function() {
    const guideModal = document.getElementById('guideModal');
    if (guideModal) {
        guideModal.classList.remove('show');
    }
}

// アニメーション用CSS追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
