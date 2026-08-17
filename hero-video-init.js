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
  // Once the visitor has clicked the button themselves, their choice is
  // final -- the (possibly still-pending) automatic unmuted-upgrade attempt
  // below must never overwrite it after the fact.
  let userHasChosen = false;

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
  //
  // video.muted flips to false synchronously on the very next line, but the
  // browser's play() promise can take a while to settle (it has to decide
  // whether to actually allow audible autoplay). syncButtonToState() is
  // called immediately, right here, so the button's displayed state always
  // matches the real video.muted value at every instant -- otherwise a click
  // during that pending window would toggle the *already-updated* real value
  // starting from a stale displayed state, muting the video when the visitor
  // meant to unmute it (or vice versa).
  video.muted = false;
  syncButtonToState();
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt
      .catch(function () {
        if (!userHasChosen) video.muted = true;
      })
      .then(function () {
        if (!userHasChosen) syncButtonToState();
      });
  }

  btn.addEventListener('click', function () {
    userHasChosen = true;
    video.muted = !video.muted;
    if (!video.muted) video.play().catch(function () {});
    syncButtonToState();
  });
})();
