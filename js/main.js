/**
 * Player Monetizado — Main JavaScript
 * Interações elegantes e otimizadas
 */

(function () {
  'use strict';

  const CONFIG = window.PM_CONFIG || {};

  /* ── DOM References ── */
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const stickyCta = document.getElementById('stickyCta');
  const countdownEl = document.getElementById('countdown');
  const hero = document.getElementById('hero');
  const vslSection = document.getElementById('vsl');

  document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('visible'));
  document.querySelectorAll('#testimonialsTrack .testimonial-card.reveal').forEach((el) => el.classList.add('visible'));
  document.querySelectorAll('.social-proof.reveal').forEach((el) => el.classList.add('visible'));

  function markTestimonialStarsVisible() {
    document.querySelectorAll('#testimonialsTrack .testimonial-card').forEach((card) => {
      card.classList.add('visible');
    });
  }

  markTestimonialStarsVisible();

  document.querySelectorAll('a[href*="kiwify.com"], .checkout-link').forEach(link => {
    link.classList.add('checkout-link');
  });

  document.querySelectorAll('[data-video-trigger]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      if (vslSection) {
        vslSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  /* ── Header scroll effect + progress + parallax (single rAF loop) ── */
  const scrollProgress = document.getElementById('scrollProgress');
  const glow1 = document.querySelector('.hero__glow--1');
  const glow2 = document.querySelector('.hero__glow--2');
  const prefersReducedMotionGlobal = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enableHeroParallax =
    window.matchMedia('(min-width: 769px) and (pointer: fine)').matches && !prefersReducedMotionGlobal;
  let scrollTicking = false;

  function handleScroll() {
    const scrollY = window.scrollY;

    header.classList.toggle('scrolled', scrollY > 50);

    if (hero && stickyCta) {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      stickyCta.classList.toggle('visible', scrollY > heroBottom * 0.6);
    }

    if (scrollProgress) {
      const doc = document.documentElement;
      const pct = (scrollY / (doc.scrollHeight - doc.clientHeight)) * 100;
      scrollProgress.style.width = `${Math.min(pct, 100)}%`;
    }

    if (enableHeroParallax && hero && (glow1 || glow2)) {
      const y = scrollY * 0.15;
      if (glow1) glow1.style.transform = `translateY(${y}px)`;
      if (glow2) glow2.style.transform = `translateY(${-y * 0.5}px)`;
    }
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      handleScroll();
      scrollTicking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  handleScroll();

  /* ── Mobile navigation ── */
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      navToggle.classList.toggle('active', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    nav.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Scroll reveal animations ── */
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const siblings = entry.target.parentElement.querySelectorAll('.reveal');
          const siblingIndex = Array.from(siblings).indexOf(entry.target);
          entry.target.style.transitionDelay = `${siblingIndex * 0.08}s`;
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
  }

  function refreshRevealsInView() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add('visible');
        revealObserver.unobserve(el);
      }
    });
    observeReveals();
  }

  revealElements.forEach(el => revealObserver.observe(el));
  window.addEventListener('cms:applied', () => {
    refreshRevealsInView();
    document.querySelectorAll('#testimonialsTrack .testimonial-card').forEach((card) => {
      card.classList.add('visible');
    });
  });
  if (window.__cmsReady) refreshRevealsInView();

  /* ── Count-up animation (all landing stats) ── */
  const prefersReducedMotionCount = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let countUpObserver = null;

  function parseBrNumber(str) {
    const raw = String(str).trim();
    if (!raw) return NaN;
    if (raw.includes(',')) {
      return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      return parseFloat(raw.replace(/\./g, ''));
    }
    return parseFloat(raw);
  }

  function getDecimalPlaces(raw) {
    if (raw.includes(',')) return raw.split(',')[1].length;
    if (raw.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(raw)) return raw.split('.')[1].length;
    return 0;
  }

  function formatCountValue(value, decimals) {
    if (decimals > 0) {
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
    return Math.round(value).toLocaleString('pt-BR');
  }

  function getCountText(el) {
    return [...el.childNodes]
      .filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) return true;
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        if (node.tagName === 'SVG') return false;
        if (node.classList.contains('stat-card__suffix')) return false;
        return true;
      })
      .map((node) => node.textContent)
      .join('')
      .trim();
  }

  function parseCountConfig(el) {
    if (el.dataset.count != null && el.dataset.count !== '') {
      return {
        target: parseFloat(el.dataset.count),
        decimals: parseInt(el.dataset.decimals || '0', 10),
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || ''
      };
    }

    const text = getCountText(el);
    if (!text) return null;

    let match;

    match = text.match(/^12x\s+(?:de\s+)?R\$\s*([\d.,]+)$/i);
    if (match) {
      return {
        target: parseBrNumber(match[1]),
        prefix: / de /i.test(text) ? '12x de R$ ' : '12x R$ ',
        suffix: '',
        decimals: getDecimalPlaces(match[1])
      };
    }

    match = text.match(/^R\$\s*([\d.,]+)\+?$/);
    if (match) {
      return {
        target: parseBrNumber(match[1]),
        prefix: 'R$ ',
        suffix: text.endsWith('+') ? '+' : '',
        decimals: String(match[1]).includes(',') ? 2 : 0
      };
    }

    match = text.match(/^R\$\s*([\d.,]+)\s*(à vista)?$/i);
    if (match) {
      return {
        target: parseBrNumber(match[1]),
        prefix: 'R$ ',
        suffix: match[2] ? ' à vista' : '',
        decimals: String(match[1]).includes(',') ? 2 : 0
      };
    }

    match = text.match(/^R\$\s*([\d.,]+)$/);
    if (match) {
      return {
        target: parseBrNumber(match[1]),
        prefix: 'R$ ',
        suffix: '',
        decimals: String(match[1]).includes(',') ? 2 : 0
      };
    }

    match = text.match(/^\+\s*([\d.,]+)\s*[%]?$/);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '+', suffix: text.includes('%') ? '%' : '', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*%$/);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '', suffix: '%', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*M\+$/i);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '', suffix: 'M+', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*K\+?$/i);
    if (match) {
      const suffix = text.includes('+') ? 'K+' : 'K';
      return { target: parseBrNumber(match[1]), prefix: '', suffix, decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*\+$/);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '', suffix: '+', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*dias$/i);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '', suffix: ' dias', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)\s*anos$/i);
    if (match) {
      return { target: parseBrNumber(match[1]), prefix: '', suffix: ' anos', decimals: 0 };
    }

    match = text.match(/^([\d.,]+)$/);
    if (match) {
      const raw = match[1];
      return {
        target: parseBrNumber(raw),
        prefix: '',
        suffix: '',
        decimals: getDecimalPlaces(raw)
      };
    }

    return null;
  }

  function renderCount(el, value, config, preserved) {
    const display = `${config.prefix}${formatCountValue(value, config.decimals)}${config.suffix}`;
    el.textContent = '';
    preserved.forEach((node) => el.appendChild(node));
    el.appendChild(document.createTextNode(display));
  }

  function animateCountUp(el, config) {
    const preserved = [...el.childNodes].filter(
      (node) => node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SVG'
    );

    if (prefersReducedMotionCount || config.target === 0) {
      renderCount(el, config.target, config, preserved);
      return;
    }

    const duration = parseInt(el.dataset.duration || '2000', 10);
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = config.target * eased;
      renderCount(el, current, config, preserved);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        renderCount(el, config.target, config, preserved);
      }
    }

    requestAnimationFrame(update);
  }

  function runCountUp(el) {
    if (el.dataset.countDone === '1') return;

    const config = parseCountConfig(el);
    if (!config || Number.isNaN(config.target)) return;

    el.dataset.countDone = '1';
    animateCountUp(el, config);
  }

  const COUNT_UP_SCOPE = '#metodo, #depoimentos';

  function initCountUps(root = document) {
    const elements = root.querySelectorAll(`${COUNT_UP_SCOPE} .count-up:not([data-count-done])`);

    if (!countUpObserver) {
      countUpObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              runCountUp(entry.target);
              countUpObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35, rootMargin: '0px 0px -10% 0px' }
      );
    }

    elements.forEach((el) => countUpObserver.observe(el));
  }

  window.PM_initCountUps = initCountUps;
  initCountUps();
  window.addEventListener('cms:applied', () => initCountUps());

  /* ── Countdown timer (resets daily at midnight) ── */
  function updateCountdown() {
    if (!countdownEl) return;

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent =
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ── FAQ accordion (single open) ── */
  function bindFaqAccordion(root = document) {
    root.querySelectorAll('.faq-item').forEach(item => {
      if (item.dataset.faqBound === '1') return;
      item.dataset.faqBound = '1';
      item.addEventListener('toggle', () => {
        if (item.open) {
          root.querySelectorAll('.faq-item').forEach(other => {
            if (other !== item) other.open = false;
          });
        }
      });
    });
  }

  bindFaqAccordion();
  window.addEventListener('cms:applied', () => bindFaqAccordion(document.getElementById('faqList') || document));

  /* ── Active nav link on scroll ── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.style.color = link.getAttribute('href') === `#${entry.target.id}`
              ? 'var(--text-primary)'
              : '';
          });
        }
      });
    },
    { threshold: 0.3, rootMargin: '-20% 0px -60% 0px' }
  );

  sections.forEach(section => sectionObserver.observe(section));

  /* ── Scroll progress bar ── */
  /* handled in unified scroll loop above */

  /* ── VSL gate: exibe .depois3minutos após 3 min de vídeo ── */
  const VSL_GATE_SECONDS = 180;
  const vslGate = document.querySelector('.depois3minutos');
  const vslGatePersistKey = `alreadyElsDisplayed${VSL_GATE_SECONDS}`;

  function unlockVslGate() {
    if (!vslGate || vslGate.dataset.vslUnlocked === '1') return;
    vslGate.dataset.vslUnlocked = '1';
    vslGate.classList.remove('hidden');
    localStorage.setItem(vslGatePersistKey, 'true');
    refreshRevealsInView();
    initCountUps(vslGate);
  }

  function scrollToVslAndPlay() {
    if (vslSection) {
      vslSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    window.setTimeout(() => {
      const heroVsl = document.getElementById('heroVsl');
      const vslFacade = document.getElementById('vslFacade');
      if (vslFacade && heroVsl && !heroVsl.classList.contains('is-active')) {
        vslFacade.click();
      }
    }, 650);
  }

  function initVslGatePreview() {
    if (!vslGate?.classList.contains('hidden')) return;
    vslGate.querySelectorAll('.vsl-gate-teaser .reveal').forEach((el) => el.classList.add('visible'));
  }

  function watchVslGateFallback() {
    let attempts = 0;

    function poll() {
      const instance = window.smartplayer?.instances?.[0];
      if (!instance) {
        if (attempts < 30) {
          attempts += 1;
          setTimeout(poll, 1000);
        }
        return;
      }

      instance.on('timeupdate', () => {
        if (vslGate?.dataset.vslUnlocked === '1') return;
        if (instance.smartAutoPlay || (instance.video?.currentTime || 0) >= VSL_GATE_SECONDS) {
          unlockVslGate();
        }
      });
    }

    poll();
  }

  function bindVslGate(player) {
    if (!vslGate || vslGate.dataset.vslUnlocked === '1') return;

    player.addEventListener('player:ready', () => {
      if (typeof player.displayHiddenElements === 'function') {
        player.displayHiddenElements(VSL_GATE_SECONDS, ['.depois3minutos'], { persist: true });

        const gateObserver = new MutationObserver(() => {
          if (getComputedStyle(vslGate).display !== 'none') {
            unlockVslGate();
            gateObserver.disconnect();
          }
        });
        gateObserver.observe(vslGate, { attributes: true, attributeFilter: ['style', 'class'] });
        return;
      }

      watchVslGateFallback();
    }, { once: true });
  }

  function initVslGate() {
    if (!vslGate) return;

    const resetGate = new URLSearchParams(window.location.search).has('resetGate');
    if (resetGate) {
      localStorage.removeItem(vslGatePersistKey);
    }

    if (!resetGate && localStorage.getItem(vslGatePersistKey) === 'true') {
      unlockVslGate();
      return;
    }

    const player = document.querySelector('vturb-smartplayer');
    if (player) {
      bindVslGate(player);
      return;
    }

    watchVslGateFallback();
  }

  const ANCHOR_ALIASES = { resultados: 'depoimentos' };

  function resolveAnchorTarget(hash) {
    if (!hash || hash === '#') return null;
    const id = ANCHOR_ALIASES[hash.replace('#', '')] || hash.replace('#', '');
    return document.getElementById(id);
  }

  function scrollToSection(target) {
    if (!target) return;

    if (vslGate?.classList.contains('hidden') && vslGate.contains(target)) {
      scrollToVslAndPlay();
      return;
    }

    target.scrollIntoView({ behavior: 'smooth' });
  }

  function bindAnchorNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        const target = resolveAnchorTarget(anchor.getAttribute('href'));
        if (!target) return;

        event.preventDefault();
        scrollToSection(target);
      });
    });

    const initialTarget = resolveAnchorTarget(window.location.hash);
    if (initialTarget) {
      window.requestAnimationFrame(() => scrollToSection(initialTarget));
    }
  }

  initVslGate();
  initVslGatePreview();
  bindAnchorNavigation();

  document.getElementById('vslGateUnlockBtn')?.addEventListener('click', scrollToVslAndPlay);

  /* ── Hero visible class for stat stagger ── */
  if (hero) {
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hero.classList.add('visible');
          heroObserver.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    heroObserver.observe(hero);
  }

  /* ── Cursor glow + magnetic dot (desktop only) ── */
  const cursorGlow = document.getElementById('cursorGlow');
  const cursorDot = document.getElementById('cursorDot');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (isFinePointer && !prefersReducedMotion) {
    document.body.classList.add('is-desktop');

    let mouseX = 0;
    let mouseY = 0;
    let activeBtn = null;
    let cursorVisible = false;

    function updateCursor() {
      let x = mouseX;
      let y = mouseY;

      if (activeBtn) {
        const rect = activeBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const pull = 0.52;
        x = mouseX + (cx - mouseX) * pull;
        y = mouseY + (cy - mouseY) * pull;
      }

      if (cursorDot) {
        cursorDot.style.left = `${x}px`;
        cursorDot.style.top = `${y}px`;
        if (!cursorVisible) {
          cursorDot.style.opacity = '1';
          cursorVisible = true;
        }
      }

      if (cursorGlow) {
        cursorGlow.style.left = `${mouseX}px`;
        cursorGlow.style.top = `${mouseY}px`;

        let nearCta = false;
        document.querySelectorAll('.btn--primary').forEach((btn) => {
          const rect = btn.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          if (Math.hypot(mouseX - cx, mouseY - cy) < 130) nearCta = true;
        });
        cursorGlow.classList.toggle('is-near-cta', nearCta);
      }
    }

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      updateCursor();
    }, { passive: true });

    document.querySelectorAll('.btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        activeBtn = btn;
        cursorDot?.classList.add('is-on-btn');
        updateCursor();
      });

      btn.addEventListener('mouseleave', () => {
        if (activeBtn === btn) {
          activeBtn = null;
          cursorDot?.classList.remove('is-on-btn');
          updateCursor();
        }
      });

      btn.addEventListener('mousemove', updateCursor);
    });
  } else if (cursorGlow && isFinePointer) {
    document.body.classList.add('is-desktop');
    document.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }, { passive: true });
  }

  /* ── Button ripple effect ── */
  document.querySelectorAll('.btn--primary').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  /* ── Subtle parallax on hero glows ── */
  /* handled in unified scroll loop above */

  /* ── VTurb player (lazy: não compete com LCP no mobile) ── */
  const VSL_PLAYER_SRC = 'https://scripts.converteai.net/c4d8dc09-d14e-4c12-94a3-b57ca9ac174a/players/6a0911f9f38f377fba3e82ea/v4/player.js';
  const DEFAULT_VSL_VIDEO_ID = 'vid-6a0911f9f38f377fba3e82ea';
  const heroVsl = document.getElementById('heroVsl');
  const vslFacade = document.getElementById('vslFacade');
  let vslLoaded = false;
  let vslPlaybackBound = false;

  function ensureVslPlayer() {
    let player = document.querySelector('vturb-smartplayer');
    if (player) return player;

    player = document.createElement('vturb-smartplayer');
    player.id = heroVsl?.dataset.vslVideoId || DEFAULT_VSL_VIDEO_ID;
    player.style.width = '100%';

    const placeholder = document.createElement('div');
    placeholder.className = 'vturb-player-placeholder';
    placeholder.style.cssText = 'position:relative;width:100%;padding:56.25% 0 0;z-index:0;background-color:#0a1628;';
    player.appendChild(placeholder);
    heroVsl?.appendChild(player);
    bindVslGate(player);
    return player;
  }

  function loadVslPlayer() {
    if (vslLoaded) return Promise.resolve();
    vslLoaded = true;

    return new Promise((resolve) => {
      if (document.querySelector('script[data-vsl-player]')) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://scripts.converteai.net';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = VSL_PLAYER_SRC;
      script.defer = true;
      script.dataset.vslPlayer = '1';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  function startVslPlayback() {
    if (vslPlaybackBound) return;
    vslPlaybackBound = true;

    const tryPlay = () => {
      const instance = window.smartplayer?.instances?.[0];
      if (!instance) return false;

      if (typeof instance.play === 'function') {
        const result = instance.play();
        if (result?.catch) result.catch(() => {});
        return true;
      }

      if (instance.video) {
        instance.video.muted = true;
        const result = instance.video.play();
        if (result?.catch) result.catch(() => {});
        return true;
      }

      return false;
    };

    if (tryPlay()) return;

    const player = document.querySelector('vturb-smartplayer');
    if (!player) return;

    player.addEventListener('player:ready', () => {
      if (!tryPlay()) {
        let attempts = 0;
        const poll = () => {
          if (tryPlay() || attempts >= 10) return;
          attempts += 1;
          setTimeout(poll, 500);
        };
        poll();
      }
    }, { once: true });
  }

  async function activateVsl() {
    if (!heroVsl) return;
    heroVsl.classList.add('is-active');
    ensureVslPlayer();
    await loadVslPlayer();
    startVslPlayback();
  }

  if (heroVsl) {
    if (vslFacade) vslFacade.addEventListener('click', activateVsl);
    activateVsl();
  }

  /* ── Testimonials auto-scroll (marquee) ── */
  function bindTestimonialsMarqueePause() {
    const track = document.getElementById('testimonialsTrack');
    if (!track || track.dataset.pauseBound === '1') return;
    track.dataset.pauseBound = '1';

    track.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.testimonial-card');
      if (!card || !track.contains(card)) return;
      const from = e.relatedTarget;
      if (from && card.contains(from)) return;
      track.classList.add('is-marquee-paused');
    });

    track.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.testimonial-card');
      if (!card || !track.contains(card)) return;
      const related = e.relatedTarget;
      if (related && (card.contains(related) || related.closest?.('.testimonial-card'))) return;
      track.classList.remove('is-marquee-paused');
    });

    track.addEventListener('touchstart', (e) => {
      if (e.target.closest('.testimonial-card')) track.classList.add('is-marquee-paused');
    }, { passive: true });

    track.addEventListener('touchend', () => track.classList.remove('is-marquee-paused'), { passive: true });
    track.addEventListener('touchcancel', () => track.classList.remove('is-marquee-paused'), { passive: true });
  }

  function initTestimonialsMarquee() {
    const track = document.getElementById('testimonialsTrack');
    if (!track) return;

    track.classList.remove('is-marquee-paused');
    track.querySelectorAll('[data-marquee-clone]').forEach((node) => node.remove());
    track.classList.remove('is-marquee-ready');
    track.style.removeProperty('--marquee-duration');

    const cards = [...track.children].filter((el) => el.matches('.testimonial-card'));
    if (!cards.length) return;

    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('data-marquee-clone', '1');
      clone.classList.remove('reveal');
      clone.removeAttribute('style');
      clone.querySelectorAll('.count-up').forEach((el) => {
        delete el.dataset.countDone;
      });
      track.appendChild(clone);
    });

    track.style.setProperty('--marquee-duration', `${Math.max(cards.length * 12, 36)}s`);
    track.classList.add('is-marquee-ready');
    window.PM_initCountUps?.();
  }

  bindTestimonialsMarqueePause();
  initTestimonialsMarquee();
  window.addEventListener('cms:applied', () => {
    initTestimonialsMarquee();
    markTestimonialStarsVisible();
  });

  function initLogosMarquee() {
    const track = document.getElementById('logosTrack');
    const viewport = track?.closest('.logos-bar__viewport');
    if (!track || !viewport) return;

    if (!initLogosMarquee.seed) {
      initLogosMarquee.seed = [...track.querySelectorAll('.logo-item')].map((item) => item.cloneNode(true));
    }

    track.replaceChildren(...initLogosMarquee.seed.map((item) => item.cloneNode(true)));

    const seed = [...track.children];
    let guard = 0;

    while (track.scrollWidth < viewport.clientWidth * 1.2 && guard < 20) {
      seed.forEach((item) => {
        track.appendChild(item.cloneNode(true));
      });
      guard += 1;
    }

    const halfCount = track.children.length;
    for (let i = 0; i < halfCount; i += 1) {
      const clone = track.children[i].cloneNode(true);
      clone.setAttribute('data-marquee-clone', '1');
      track.appendChild(clone);
    }

    track.classList.remove('is-marquee-ready');
    track.style.removeProperty('--logos-marquee-duration');
    const halfWidth = track.scrollWidth / 2;
    const duration = Math.max(halfWidth / 28, 32);
    track.style.setProperty('--logos-marquee-duration', `${duration}s`);
    track.classList.add('is-marquee-ready');
  }

  initLogosMarquee();
  window.addEventListener('load', initLogosMarquee, { once: true });
  window.addEventListener('resize', initLogosMarquee, { passive: true });

  function initStatsMarquee() {
    const track = document.getElementById('statsMarqueeTrack');
    const viewport = track?.closest('.stats-marquee__viewport');
    if (!track || !viewport) return;

    if (!initStatsMarquee.seed) {
      initStatsMarquee.seed = [...track.querySelectorAll('.stats-marquee__item')].map((item) => item.cloneNode(true));
    }

    track.replaceChildren(...initStatsMarquee.seed.map((item) => item.cloneNode(true)));

    const seed = [...track.children];
    let guard = 0;

    while (track.scrollWidth < viewport.clientWidth * 1.2 && guard < 16) {
      seed.forEach((item) => {
        track.appendChild(item.cloneNode(true));
      });
      guard += 1;
    }

    const halfCount = track.children.length;
    for (let i = 0; i < halfCount; i += 1) {
      track.appendChild(track.children[i].cloneNode(true));
    }

    track.classList.remove('is-marquee-ready');
    track.style.removeProperty('--stats-marquee-duration');
    const duration = Math.max(track.scrollWidth / 2 / 22, 36);
    track.style.setProperty('--stats-marquee-duration', `${duration}s`);
    track.classList.add('is-marquee-ready');
  }

  initStatsMarquee();
  window.addEventListener('load', initStatsMarquee, { once: true });
  window.addEventListener('resize', initStatsMarquee, { passive: true });

  function initSocialProofLightbox() {
    const lightbox = document.getElementById('socialProofLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    if (!lightbox || !lightboxImg) return;

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.style.overflow = '';
      lightboxImg.removeAttribute('src');
    }

    function openLightbox(button) {
      const img = button.querySelector('img');
      if (!img) return;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt;
      if (lightboxCaption) {
        lightboxCaption.textContent = button.dataset.caption || img.alt;
      }
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    document.querySelectorAll('.social-proof-zoom').forEach((button) => {
      button.addEventListener('click', () => openLightbox(button));
    });

    lightbox.querySelectorAll('[data-lightbox-close]').forEach((node) => {
      node.addEventListener('click', closeLightbox);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  initSocialProofLightbox();

  /* ── Social proof slider (WhatsApp prints) ── */
  function initSocialProofSlider() {
    const slider = document.getElementById('socialProofSlider');
    const track = document.getElementById('socialProofTrack');
    const viewport = slider?.querySelector('.social-proof-slider__viewport');
    if (!slider || !track || !viewport) return;

    const slides = [...track.children];
    const prevBtn = slider.querySelector('.social-proof-slider__nav--prev');
    const nextBtn = slider.querySelector('.social-proof-slider__nav--next');
    if (!slides.length || !prevBtn || !nextBtn) return;

    let index = 0;
    let touchStartX = 0;
    let slideWidth = 0;

    function layoutSlides() {
      slideWidth = viewport.getBoundingClientRect().width;
      slides.forEach((slide) => {
        slide.style.width = `${slideWidth}px`;
        slide.style.flexBasis = `${slideWidth}px`;
      });
      goTo(index, false);
    }

    function goTo(nextIndex, animate = true) {
      index = ((nextIndex % slides.length) + slides.length) % slides.length;
      track.style.transition = animate ? '' : 'none';
      track.style.transform = `translateX(-${index * slideWidth}px)`;

      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('is-active', active);
        slide.toggleAttribute('aria-hidden', !active);
      });

      if (!animate) {
        requestAnimationFrame(() => {
          track.style.transition = '';
        });
      }
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    slider.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      }
    });

    track.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    track.addEventListener('touchend', (event) => {
      const diff = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) < 48) return;
      goTo(index + (diff < 0 ? 1 : -1));
    }, { passive: true });

    layoutSlides();
    window.addEventListener('resize', layoutSlides, { passive: true });
  }

  initSocialProofSlider();

  /* ── CMS (carrega após a página estar interativa) ── */
  function loadCmsScript() {
    if (document.querySelector('script[data-cms-loader]')) return;
    const script = document.createElement('script');
    const assetVersion = document.querySelector('meta[name="pm-asset-version"]')?.content || '';
    script.src = assetVersion ? `js/cms.min.js?v=${assetVersion}` : 'js/cms.min.js';
    script.defer = true;
    script.dataset.cmsLoader = '1';
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCmsScript);
  } else {
    loadCmsScript();
  }

})();
