/**
 * home2.js — mobile-specific enhancement for home2.html.
 * On portrait mobile (≤768px) moves #hero-video from its default position
 * (before .hero-content) to immediately before .hero-cta-group, so the
 * video plays as an inline full-bleed strip between the headline and the CTAs.
 * Desktop layout is completely untouched.
 */
(function () {
  'use strict';

  if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;

  const video = document.getElementById('hero-video');
  const ctaGroup = document.querySelector('.hero-cta-group');
  if (!video || !ctaGroup || !ctaGroup.parentNode) return;

  // Insert video immediately before the CTA buttons.
  ctaGroup.parentNode.insertBefore(video, ctaGroup);
})();
