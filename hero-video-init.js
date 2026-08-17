// Hero video autoplay-upgrade + mute toggle.
// Loaded as an external, same-origin script (not inline) so it isn't blocked
// by the site's CSP (script-src 'self' ... ; no 'unsafe-inline'). Placed
// right after the video/button markup in home.html so it runs before any
// other page script (home-data.js, home.js) has even started loading.
(function () {
  const video = document.getElementById('hero-video');
  const btn = document.getElementById('video-sound-toggle');
  if (!video || !btn) return;
  const iconMuted = btn.querySelector('.icon-muted');
  const iconUnmuted = btn.querySelector('.icon-unmuted');

  function syncButtonToState() {
    const isMuted = video.muted;
    btn.setAttribute('aria-label', isMuted ? 'Unmute video' : 'Mute video');
    btn.setAttribute('aria-pressed', String(!isMuted));
    iconMuted.style.display = isMuted ? '' : 'none';
    iconUnmuted.style.display = isMuted ? 'none' : '';
  }

  // Native `muted` attribute means the video is already autoplaying by the
  // time this runs. Try to upgrade to unmuted playback; if the browser
  // blocks it, silently stay muted (video keeps playing either way).
  video.muted = false;
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt
      .catch(function () {
        video.muted = true;
      })
      .then(syncButtonToState);
  } else {
    syncButtonToState();
  }

  btn.addEventListener('click', function () {
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(function () {});
    syncButtonToState();
  });
})();
