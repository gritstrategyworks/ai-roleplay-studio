(function () {
  const nativeFetch = window.fetch.bind(window);
  let currentUser = null;
  let loadedUserId = null;
  let appLoaded = false;
  let authMode = 'login';
  let signupEnabled = true;

  const gate = document.getElementById('authGate');
  const appShell = document.getElementById('appShell');
  const loading = document.getElementById('authLoading');
  const panel = document.getElementById('authPanel');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const confirmField = document.getElementById('authConfirmField');
  const confirmInput = document.getElementById('authPasswordConfirm');
  const resetCommandField = document.getElementById('authResetCommandField');
  const resetCommandInput = document.getElementById('authResetCommand');
  const resetToggle = document.getElementById('authResetToggle');
  const agreementField = document.getElementById('authAgreementField');
  const agreementInput = document.getElementById('authAgreement');
  const submitButton = document.getElementById('authSubmit');
  const status = document.getElementById('authStatus');
  const loginTab = document.getElementById('authLoginTab');
  const registerTab = document.getElementById('authRegisterTab');
  const guestButton = document.getElementById('authGuest');
  const policyDialog = document.getElementById('authPolicyDialog');
  const policyTitle = document.getElementById('authPolicyTitle');
  const policyContent = document.getElementById('authPolicyContent');

  function setStatus(message, type) {
    status.textContent = message || '';
    status.className = 'auth-status' + (type ? ' ' + type : '');
    status.hidden = !message;
  }

  function setBusy(busy, message) {
    submitButton.disabled = busy;
    emailInput.disabled = busy;
    passwordInput.disabled = busy;
    confirmInput.disabled = busy;
    resetCommandInput.disabled = busy;
    resetToggle.disabled = busy;
    agreementInput.disabled = busy;
    guestButton.disabled = busy;
    if (busy && message) setStatus(message, 'loading');
  }

  function setMode(mode) {
    authMode = mode === 'reset' ? 'reset' : (mode === 'register' && signupEnabled ? 'register' : 'login');
    const registering = authMode === 'register';
    const resetting = authMode === 'reset';
    loginTab.classList.toggle('active', !registering && !resetting);
    registerTab.classList.toggle('active', registering);
    confirmField.hidden = !registering && !resetting;
    resetCommandField.hidden = !resetting;
    agreementField.hidden = !registering;
    confirmInput.required = registering || resetting;
    resetCommandInput.required = resetting;
    agreementInput.required = registering;
    passwordInput.autocomplete = registering || resetting ? 'new-password' : 'current-password';
    submitButton.textContent = resetting ? '新しいパスワードを設定' : (registering ? '無料アカウントを作成' : 'ログイン');
    resetToggle.textContent = resetting ? 'ログインへ戻る' : 'パスワードを忘れた場合';
    document.getElementById('authPanelTitle').textContent = resetting ? 'パスワードを再設定' : (registering ? 'アカウントを作成' : 'おかえりなさい');
    document.getElementById('authPanelLead').textContent = resetting
      ? '登録済みの開発者メール、秘密コマンド、新しいパスワードを入力してください。'
      : registering
      ? 'メールアドレスとパスワードで、利用を開始できます。'
      : '登録したメールアドレスでログインしてください。';
    setStatus('', '');
  }

  function setUserLabels(user) {
    const guest = Boolean(user?.guest);
    document.querySelectorAll('[data-auth-email]').forEach((element) => {
      element.textContent = guest ? 'ゲストモード' : (user?.email || '');
    });
    document.querySelectorAll('[data-auth-logout]').forEach((button) => {
      button.textContent = guest ? 'ゲスト終了' : 'ログアウト';
    });
    document.querySelectorAll('[data-auth-account-title]').forEach((element) => {
      element.textContent = guest ? 'ゲストとして利用中' : 'ログイン中のアカウント';
    });
    document.querySelectorAll('[data-auth-session-note]').forEach((element) => {
      element.textContent = guest
        ? '履歴・設定はこの端末のゲスト専用領域に保存されます。課金機能にはアカウント登録が必要です。'
        : 'この端末では30日間ログイン状態を保持します。';
    });
    document.querySelectorAll('[data-auth-user-pill]').forEach((element) => {
      element.title = guest ? 'ゲストとして利用中' : 'ログイン中';
    });
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('アプリの読み込みに失敗しました。')); };
      document.body.appendChild(script);
    });
  }

  async function loadApplication() {
    if (appLoaded) {
      appShell.hidden = false;
      gate.hidden = true;
      return;
    }
    loading.hidden = false;
    panel.hidden = true;
    document.getElementById('authLoadingText').textContent = 'アプリを準備しています';
    await loadScript('scenario-design.js?v=1.34');
    await loadScript('app.js?v=1.34');
    appLoaded = true;
    loadedUserId = currentUser.id;
    setUserLabels(currentUser);
    appShell.hidden = false;
    gate.hidden = true;
    document.body.classList.remove('auth-pending');
  }

  async function unlock(data) {
    const previousLoadedUserId = loadedUserId;
    currentUser = { ...data.user, guest: Boolean(data.guest || data.user?.guest) };
    setUserLabels(currentUser);
    if (appLoaded && previousLoadedUserId && previousLoadedUserId !== currentUser.id) {
      location.reload();
      return;
    }
    try {
      await loadApplication();
    } catch (error) {
      console.error(error);
      showGate(error.message || 'アプリを読み込めませんでした。');
    }
  }

  function showGate(message) {
    currentUser = null;
    appShell.hidden = true;
    gate.hidden = false;
    loading.hidden = true;
    panel.hidden = false;
    document.body.classList.add('auth-pending');
    setMode('login');
    if (message) setStatus(message, 'error');
    setTimeout(function () { emailInput.focus(); }, 50);
  }

  async function requestAuth(path, body) {
    const response = await nativeFetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      const error = new Error(data.error || '認証処理に失敗しました。');
      error.code = data.code;
      throw error;
    }
    return data;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (authMode === 'register' || authMode === 'reset') {
      if (password.length < 10) {
        setStatus('パスワードは10文字以上で入力してください。', 'error');
        return;
      }
      if (password !== confirmInput.value) {
        setStatus('確認用パスワードが一致しません。', 'error');
        return;
      }
      if (authMode === 'register' && !agreementInput.checked) {
        setStatus('利用規約とプライバシーポリシーへの同意が必要です。', 'error');
        return;
      }
    }

    setBusy(true, authMode === 'reset' ? 'パスワードを再設定しています…' : (authMode === 'register' ? 'アカウントを作成しています…' : 'ログインしています…'));
    try {
      const path = authMode === 'reset' ? '/api/auth/password-reset' : '/api/auth/' + authMode;
      const data = await requestAuth(path, { email: email, password: password, command: resetCommandInput.value });
      passwordInput.value = '';
      confirmInput.value = '';
      resetCommandInput.value = '';
      await unlock(data);
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function enterGuest() {
    setBusy(true, 'ゲストモードを準備しています…');
    try {
      const data = await requestAuth('/api/auth/guest', {});
      await unlock(data);
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const buttons = document.querySelectorAll('[data-auth-logout]');
    buttons.forEach(function (button) { button.disabled = true; });
    try {
      await requestAuth('/api/auth/logout', {});
    } catch (error) {
      console.warn(error);
    }
    location.reload();
  }

  function openPolicy(type) {
    const source = document.getElementById('info-' + type);
    if (!source) return;
    policyTitle.textContent = type === 'terms' ? '利用規約' : 'プライバシーポリシー';
    policyContent.innerHTML = source.innerHTML;
    if (typeof policyDialog.showModal === 'function') policyDialog.showModal();
    else policyDialog.setAttribute('open', '');
  }

  async function bootstrap() {
    try {
      const response = await nativeFetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json();
      signupEnabled = data.signupEnabled !== false;
      registerTab.hidden = !signupEnabled;
      if (response.ok && (data.authenticated || data.guest) && data.user) {
        await unlock(data);
      } else {
        showGate('');
      }
    } catch (error) {
      console.error(error);
      showGate('接続を確認できませんでした。通信環境を確認して再読み込みしてください。');
    }
  }

  window.fetch = async function (input, init) {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (response.status === 401 && url.origin === location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
        showGate('ログインの有効期限が切れました。もう一度ログインしてください。');
      }
    } catch {
      // The original response is returned unchanged.
    }
    return response;
  };

  window.AuthGate = {
    get user() { return currentUser; },
    get isGuest() { return Boolean(currentUser?.guest); },
    logout: logout,
  };
  window.logoutRoleplay = logout;

  form.addEventListener('submit', submitAuth);
  loginTab.addEventListener('click', function () { setMode('login'); });
  registerTab.addEventListener('click', function () { setMode('register'); });
  resetToggle.addEventListener('click', function () { setMode(authMode === 'reset' ? 'login' : 'reset'); });
  guestButton.addEventListener('click', enterGuest);
  document.querySelectorAll('[data-auth-logout]').forEach(function (button) {
    button.addEventListener('click', logout);
  });
  document.querySelectorAll('[data-auth-policy]').forEach(function (button) {
    button.addEventListener('click', function () { openPolicy(button.dataset.authPolicy); });
  });
  document.getElementById('authPolicyClose').addEventListener('click', function () { policyDialog.close(); });
  policyDialog.addEventListener('click', function (event) {
    if (event.target === policyDialog) policyDialog.close();
  });
  bootstrap();
}());
