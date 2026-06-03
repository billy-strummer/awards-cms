/**
 * home2.js — mobile-specific enhancement for home2.html.
 * On portrait mobile (≤768px) moves #hero-video from its default position
 * (before .hero-content) to between .hero-sub and .hero-cta-group, so the
 * video plays as an inline full-bleed strip between the headline and the CTAs.
 * Desktop layout is completely untouched.
 */
(function () {
  'use strict';

  if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;

  const video = document.getElementById('hero-video');
  const heroSub = document.querySelector('.hero-sub');
  if (!video || !heroSub || !heroSub.parentNode) return;

  // Insert video immediately after the subtitle, before the CTA buttons.
  heroSub.parentNode.insertBefore(video, heroSub.nextSibling);
})();
