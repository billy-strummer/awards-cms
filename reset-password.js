/* reset-password.html — handles the Supabase password-recovery link.
 * External file (not inline) so it runs under this project's CSP, which has
 * no 'unsafe-inline' in script-src.
 */
/* global window, document */

let sb;

function showError(msg) {
  const el = document.getElementById('resetError');
  el.textContent = msg;
  el.classList.remove('d-none');
  document.getElementById('resetSuccess').classList.add('d-none');
}

function showSuccess(msg) {
  const el = document.getElementById('resetSuccess');
  el.textContent = msg;
  el.classList.remove('d-none');
  document.getElementById('resetError').classList.add('d-none');
}

async function handleSubmit(e) {
  e.preventDefault();
  const password = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  const btn = document.getElementById('resetBtn');

  if (password.length < 8) {
    showError('Password must be at least 8 characters.');
    return;
  }
  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

  try {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;

    document.getElementById('resetPasswordForm').classList.add('d-none');
    showSuccess('Your password has been updated. Redirecting to sign in…');
    await sb.auth.signOut();
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2500);
  } catch (error) {
    console.error('Password update error:', error);
    showError(
      error.message && error.message.includes('Failed to fetch')
        ? 'Cannot connect to server. Please check your internet connection and try again.'
        : error.message || 'Something went wrong updating your password. Please request a new reset link and try again.'
    );
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Set New Password';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

  const pending = document.getElementById('resetPending');
  const form = document.getElementById('resetPasswordForm');

  function readyToReset() {
    pending.classList.add('d-none');
    form.classList.remove('d-none');
  }

  function linkInvalid() {
    pending.classList.add('d-none');
    showError('This reset link is invalid or has expired. Please request a new one from the sign-in page.');
  }

  // Supabase's JS SDK auto-detects the recovery token in the URL and fires
  // this event once the temporary recovery session is established — this is
  // the reliable signal to show the form, rather than racing getSession()
  // against the SDK's own URL parsing.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') readyToReset();
  });

  // Fallback: if a recovery session was already established before this
  // listener attached (e.g. slow script load), getSession() will find it.
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session && form.classList.contains('d-none') && pending && !pending.classList.contains('d-none')) {
      readyToReset();
    }
  });

  // If neither fires within a reasonable window, the link was missing/bad.
  setTimeout(() => {
    if (pending && !pending.classList.contains('d-none')) linkInvalid();
  }, 5000);

  form.addEventListener('submit', handleSubmit);
});
