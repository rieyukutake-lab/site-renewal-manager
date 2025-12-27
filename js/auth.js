// 認証機能
// 注意: これは簡易的なパスワード保護です。完全なセキュリティを保証するものではありません。

// パスワード設定（変更してください）
const CORRECT_PASSWORD = 'cbl2026';

// セッションストレージのキー
const AUTH_KEY = 'site_renewal_auth';

// ページ読み込み時の認証チェック
(function() {
    // 既にログイン済みかチェック
    if (isAuthenticated()) {
        showMainApp();
    } else {
        showLoginScreen();
    }
})();

// ログインフォームの処理
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const enteredPassword = passwordInput.value;
            
            if (enteredPassword === CORRECT_PASSWORD) {
                // ログイン成功
                login();
                hideLoginError();
                showMainApp();
            } else {
                // ログイン失敗
                showLoginError('パスワードが正しくありません');
                passwordInput.value = '';
                passwordInput.focus();
                
                // 入力欄を振動させる
                passwordInput.classList.add('shake');
                setTimeout(() => {
                    passwordInput.classList.remove('shake');
                }, 500);
            }
        });
    }
});

// 認証状態を確認
function isAuthenticated() {
    const authData = sessionStorage.getItem(AUTH_KEY);
    if (!authData) return false;
    
    try {
        const data = JSON.parse(authData);
        const now = Date.now();
        
        // 24時間有効
        if (data.timestamp && (now - data.timestamp) < 24 * 60 * 60 * 1000) {
            return true;
        }
    } catch (e) {
        return false;
    }
    
    return false;
}

// ログイン処理
function login() {
    const authData = {
        authenticated: true,
        timestamp: Date.now()
    };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(authData));
}

// ログアウト処理（グローバル関数として公開）
window.logout = function() {
    if (confirm('ログアウトしますか？')) {
        sessionStorage.removeItem(AUTH_KEY);
        location.reload();
    }
}

// メインアプリを表示
function showMainApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) {
        mainApp.style.display = 'block';
        
        // アプリケーションの初期化（app.jsの関数を呼び出し）
        // 確実にDOMが準備できるまで待つ
        setTimeout(() => {
            if (typeof initializeApp === 'function') {
                initializeApp();
            } else {
                console.error('initializeApp関数が見つかりません');
            }
        }, 500);
    }
}

// ログイン画面を表示
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
}

// エラーメッセージを表示
function showLoginError(message) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
}

// エラーメッセージを非表示
function hideLoginError() {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.style.display = 'none';
    }
}

// ログアウトボタンは index.html に静的に配置済み
// 動的追加は不要
