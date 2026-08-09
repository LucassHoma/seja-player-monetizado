/**
 * CMS — carrega conteúdo da API e aplica na landing page
 */
(function () {
  'use strict';

  const API = '/api/content';
  const STATIC_CONTENT = '/content.json';
  const GAS_CONTENT = (window.PM_CONFIG && window.PM_CONFIG.gasContentUrl) || '';

  function loadJsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const callback = `pmCms_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        fn(value);
      };

      const cleanup = () => {
        delete window[callback];
        script.remove();
      };

      const timer = setTimeout(() => {
        finish(reject, new Error('Timeout ao carregar CMS (JSONP)'));
      }, timeoutMs || 15000);

      window[callback] = (data) => {
        if (data && data.error) {
          finish(reject, new Error(data.error));
          return;
        }
        finish(resolve, data);
      };

      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
      script.async = true;
      script.onerror = () => finish(reject, new Error('Falha ao carregar CMS (JSONP)'));
      document.head.appendChild(script);
    });
  }

  async function loadStaticContent() {
    try {
      const response = await fetch(`${STATIC_CONTENT}?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) return response.json();
    } catch {
      /* fallback: HTML estático */
    }
    return null;
  }

  function isDrivePhotoUrl(url) {
    return /drive\.google\.com/i.test(String(url || ''));
  }

  /** Prefer local assets/order from content.json over CMS edits no Drive. */
  function reconcileTestimonials(data, staticData) {
    const items = data?.testimonials?.items;
    const staticItems = staticData?.testimonials?.items;
    if (!items?.length || !staticItems?.length) return data;

    const staticById = Object.fromEntries(staticItems.map((item) => [item.id, item]));
    const orderIndex = Object.fromEntries(staticItems.map((item, index) => [item.id, index]));

    data.testimonials.items = items
      .map((item) => {
        const local = staticById[item.id];
        if (!local) return item;

        const next = { ...item };
        if (local.photo?.startsWith('assets/') && isDrivePhotoUrl(item.photo)) {
          next.photo = local.photo;
        }
        if (typeof local.order === 'number') {
          next.order = local.order;
        }
        return next;
      })
      .sort((a, b) => {
        const orderA = orderIndex[a.id];
        const orderB = orderIndex[b.id];
        if (orderA == null && orderB == null) return 0;
        if (orderA == null) return 1;
        if (orderB == null) return -1;
        return orderA - orderB;
      });

    return data;
  }

  async function loadContent() {
    const staticData = await loadStaticContent();

    if (GAS_CONTENT) {
      try {
        const gasData = await loadJsonp(GAS_CONTENT);
        return reconcileTestimonials(gasData, staticData);
      } catch (err) {
        console.warn('[CMS] GAS indisponível, usando content.json:', err.message);
      }
    }

    try {
      const response = await fetch(`${API}?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) return reconcileTestimonials(await response.json(), staticData);
    } catch {
      /* API indisponível (ex.: GitHub Pages) */
    }

    return staticData;
  }

  function getSiteBasePath() {
    const configured = window.PM_CONFIG?.siteBasePath;
    if (configured != null && configured !== '') {
      return String(configured).replace(/\/$/, '');
    }

    const { hostname, pathname } = window.location;
    if (!hostname.endsWith('.github.io')) return '';

    const [first] = pathname.split('/').filter(Boolean);
    if (!first || first.includes('.')) return '';

    const rootPaths = new Set(['assets', 'css', 'js', 'admin']);
    if (rootPaths.has(first)) return '';

    return `/${first}`;
  }

  function extractDriveFileId(url) {
    const value = String(url || '');
    const byQuery = value.match(/[?&]id=([^&]+)/i);
    if (byQuery) return byQuery[1];
    const byPath = value.match(/\/file\/d\/([^/]+)/i);
    return byPath ? byPath[1] : '';
  }

  function resolveMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    if (/^https?:\/\//i.test(url)) {
      const driveId = extractDriveFileId(url);
      if (driveId) {
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w112`;
      }
      return url;
    }

    const normalized = url.replace(/^\.\//, '');

    if (url.startsWith('/')) {
      const base = getSiteBasePath();
      return base ? `${base}${url}` : url;
    }

    return normalized;
  }

  function setText(el, text) {
    if (el && text != null) el.textContent = text;
  }

  function setHtml(el, html) {
    if (el && html != null) el.innerHTML = html;
  }

  function setAll(selector, fn) {
    document.querySelectorAll(selector).forEach(fn);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const FAQ_TOPIC_ICONS = [
    {
      className: 'faq-item__topic-icon--ghost',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 8a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>'
    },
    {
      className: 'faq-item__topic-icon--phone',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>'
    },
    {
      className: 'faq-item__topic-icon--mail',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4z"/><path d="M4 7l8 6 8-6"/></svg>'
    },
    {
      className: 'faq-item__topic-icon--video',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>'
    },
    {
      className: 'faq-item__topic-icon--clock',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
    },
    {
      className: 'faq-item__topic-icon--shield',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    }
  ];

  function setTitleWithAccent(el, title, accent) {
    if (!el || title == null) return;
    if (accent && title.includes(accent)) {
      const i = title.indexOf(accent);
      el.innerHTML =
        `${escapeHtml(title.slice(0, i))}<span class="gradient-text">${escapeHtml(accent)}</span>${escapeHtml(title.slice(i + accent.length))}`;
    } else {
      el.textContent = title;
    }
  }

  function applyHeroTitleLine(lineEl, line, accent, accentClass) {
    if (!lineEl || !line) return;
    const idx = accent ? line.indexOf(accent) : -1;
    if (idx === -1) {
      lineEl.textContent = line;
      return;
    }
    lineEl.innerHTML =
      `${escapeHtml(line.slice(0, idx))}<span class="hero__title-accent ${accentClass}">${escapeHtml(accent)}</span>${escapeHtml(line.slice(idx + accent.length))}`;
  }

  const MODULE_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  ];

  const BONUS_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'
  ];

  function wrapCountUpNumbers(text) {
    if (!text) return '';
    return text
      .split(/(\d[\d.,]*)/g)
      .map((part, index) => (index % 2 === 1
        ? `<span class="count-up">${escapeHtml(part)}</span>`
        : escapeHtml(part)))
      .join('');
  }

  function resetCountUps(selectors) {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.add('count-up');
        delete el.dataset.countDone;
      });
    });
    window.PM_initCountUps?.();
  }

  function renderTestimonialCard(t, star) {
    const photo = resolveMediaUrl(t.photo);
    const fallbackPhoto = t.photo?.startsWith('assets/')
      ? resolveMediaUrl(t.photo)
      : '';
    const onError = fallbackPhoto && fallbackPhoto !== photo
      ? ` onerror="this.onerror=null;this.src='${escapeHtml(fallbackPhoto)}';"`
      : '';

    return `
        <article class="testimonial-card glass-card reveal visible">
          <header class="testimonial-card__header">
            <img src="${escapeHtml(photo)}" alt="${escapeHtml(t.name)}" class="testimonial-card__avatar" width="56" height="56" loading="eager" decoding="async" referrerpolicy="no-referrer"${onError}>
            <div class="testimonial-card__author">
              <strong>${escapeHtml(t.name)}</strong>
              <span>${wrapCountUpNumbers(t.tagline)}</span>
            </div>
          </header>
          <div class="testimonial-card__stars" aria-label="5 estrelas">${star.repeat(5)}</div>
          <p>"${wrapCountUpNumbers(t.text)}"</p>
        </article>
      `;
  }

  function applyTestimonials(track, items) {
    if (!track || !items?.length) return;

    const sortedItems = [...items].sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    const star = '<svg class="icon-star" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    track.innerHTML = sortedItems.map((t) => renderTestimonialCard(t, star)).join('');
  }

  function applyContent(data) {
    if (!data) return;

    const { general, urgencyBar, hero, course, modules, instructor, testimonials, offer, buttons, faq, footer } = data;

    if (general?.siteOnline === false) {
      document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#060a12;color:#f8fafc;font-family:Inter,sans-serif"><p>Site em manutenção. Volte em breve.</p></div>';
      return;
    }

    if (general?.courseName) {
      document.title = `${general.courseName} | Transforme Cortes de Futebol em Dólares`;
    }
    if (general?.favicon) {
      const link = document.querySelector('link[rel="icon"]');
      if (link) link.href = resolveMediaUrl(general.favicon);
    }
    if (buttons?.checkoutUrl && window.PM_CONFIG) {
      window.PM_CONFIG.checkoutUrl = buttons.checkoutUrl;
    }
    if (general?.contactPhone && window.PM_CONFIG) {
      window.PM_CONFIG.contactPhone = general.contactPhone;
    }

    setText(document.querySelector('[data-cms="urgency.badge"]'), urgencyBar?.badge);
    if (urgencyBar?.text) {
      setHtml(
        document.querySelector('[data-cms="urgency.text"]'),
        urgencyBar.text.replace(/vagas limitadas/i, '<strong>vagas limitadas</strong>')
      );
    }

    const heroBadge = document.querySelector('[data-cms="hero.badge"]');
    if (heroBadge && hero?.badge) {
      heroBadge.innerHTML = `<span class="pulse-dot"></span>${escapeHtml(hero.badge)}`;
    }

    const titleLines = document.querySelectorAll('.hero__title-line');
    if (titleLines[0]) applyHeroTitleLine(titleLines[0], hero?.titleLine1, hero?.titleAccent1, 'hero__title-accent--gold');
    if (titleLines[1]) applyHeroTitleLine(titleLines[1], hero?.titleLine2, hero?.titleAccent2, 'hero__title-accent--green');

    if (hero?.subtitle) {
      setHtml(
        document.querySelector('[data-cms="hero.subtitle"]'),
        escapeHtml(hero.subtitle).replace(/1 hora por dia/g, '<strong>1 hora por dia</strong>')
      );
    }
    setText(document.querySelector('[data-cms="hero.buttonText"]'), hero?.buttonText);
    const heroBtn = document.querySelector('[data-cms="hero.buttonLink"]');
    if (heroBtn) {
      const heroCheckout = buttons?.checkoutUrl || window.PM_CONFIG?.checkoutUrl || hero?.buttonLink;
      if (heroCheckout && !heroCheckout.startsWith('#')) heroBtn.href = heroCheckout;
    }

    if (hero?.videoId) {
      const heroVsl = document.getElementById('heroVsl');
      if (heroVsl) heroVsl.dataset.vslVideoId = hero.videoId;
      const player = document.querySelector('vturb-smartplayer');
      if (player) player.id = hero.videoId;
    }

    setTitleWithAccent(
      document.querySelector('[data-cms="course.title"]'),
      course?.title,
      course?.titleAccent || 'Player Monetizado'
    );
    setText(document.querySelector('[data-cms="course.description"]'), course?.description);
    setText(document.querySelector('[data-cms="course.extraText"]'), course?.extraText);
    setText(document.querySelector('[data-cms="course.highlightTitle"]'), course?.highlightTitle);
    setText(document.querySelector('[data-cms="course.highlightText"]'), course?.highlightText);
    setText(document.querySelector('[data-cms="course.ctaText"]'), course?.ctaText);

    const checkList = document.querySelector('[data-cms="course.items"]');
    if (checkList && course?.items) {
      checkList.innerHTML = course.items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    }

    setTitleWithAccent(
      document.querySelector('[data-cms="modules.title"]'),
      modules?.title,
      modules?.titleAccent || 'aprender'
    );
    setText(document.querySelector('[data-cms="modules.subtitle"]'), modules?.subtitle);
    const modulesGrid = document.querySelector('[data-cms="modules.grid"]');
    if (modulesGrid && modules?.items) {
      modulesGrid.innerHTML = modules.items.map((m, i) => `
        <article class="module-card reveal">
          <div class="module-card__number">${escapeHtml(m.number)}</div>
          <div class="module-card__icon">${MODULE_ICONS[i % MODULE_ICONS.length]}</div>
          <h3>${escapeHtml(m.name)}</h3>
          <p>${escapeHtml(m.description)}</p>
          <ul class="module-card__topics">${(m.topics || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </article>
      `).join('');
    }

    setText(document.querySelector('[data-cms="instructor.name"]'), instructor?.name);
    setText(document.querySelector('[data-cms="instructor.bio"]'), instructor?.bio);
    setText(document.querySelector('[data-cms="instructor.bioExtra"]'), instructor?.bioExtra);
    const instImg = document.querySelector('[data-cms="instructor.photo"]');
    if (instImg && instructor?.photo) instImg.src = resolveMediaUrl(instructor.photo);
    const instPhotoLink = document.querySelector('[data-cms="instructor.photoLink"]');
    const instPhotoBubble = document.querySelector('[data-cms="instructor.photoBubble"]');
    if (instPhotoLink && instructor?.instagramUrl) instPhotoLink.href = instructor.instagramUrl;
    if (instPhotoBubble) instPhotoBubble.textContent = instructor?.instagram || '';
    if (instPhotoLink && instructor?.name) {
      instPhotoLink.setAttribute('aria-label', `Instagram de ${instructor.name}`);
    }

    const highlights = document.querySelector('[data-cms="instructor.highlights"]');
    if (highlights && instructor?.highlights) {
      highlights.innerHTML = instructor.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('');
    }

    setText(document.querySelector('[data-cms="testimonials.tag"]'), testimonials?.tag);
    setTitleWithAccent(
      document.querySelector('[data-cms="testimonials.title"]'),
      testimonials?.title,
      testimonials?.titleAccent || 'dizem'
    );
    setText(document.querySelector('[data-cms="testimonials.subtitle"]'), testimonials?.subtitle);
    setText(document.querySelector('[data-cms="testimonials.disclaimer"]'), testimonials?.disclaimer);
    const track = document.querySelector('[data-cms="testimonials.grid"]');
    applyTestimonials(track, testimonials?.items);

    setText(document.querySelector('[data-cms="offer.productName"]'), offer?.productName);
    setText(document.querySelector('[data-cms="offer.productSubtitle"]'), offer?.productSubtitle);
    setText(document.querySelector('[data-cms="offer.badge"]'), offer?.badge);
    setText(document.querySelector('[data-cms="offer.installments"]'), offer?.installments);
    if (offer?.currentPrice) {
      const price = String(offer.currentPrice).startsWith('R$') ? offer.currentPrice : `R$ ${offer.currentPrice}`;
      setText(document.querySelector('[data-cms="offer.currentPrice"]'), `${price} à vista`);
    }
    setText(document.querySelector('[data-cms="offer.guaranteeText"]'), offer?.guaranteeText);
    setText(document.querySelector('[data-cms="offer.urgencyText"]'), offer?.urgencyText);
    setText(document.querySelector('[data-cms="offer.stickyPrice"]'), offer?.stickyPrice || offer?.installments);

    const bonusGrid = document.querySelector('[data-cms="offer.bonuses"]');
    if (bonusGrid && offer?.bonuses) {
      bonusGrid.innerHTML = offer.bonuses.map((b, i) => `
        <article class="bonus-card reveal">
          <div class="bonus-card__value">${escapeHtml(b.value)}</div>
          <div class="bonus-card__icon">${BONUS_ICONS[i % BONUS_ICONS.length]}</div>
          <h3>${escapeHtml(b.title)}</h3>
          <p>${escapeHtml(b.description)}</p>
        </article>
      `).join('');
    }

    const checkoutUrl = buttons?.checkoutUrl || window.PM_CONFIG?.checkoutUrl || '';
    const btnColor = buttons?.buttonColor || '#10b981';

    setText(document.querySelector('[data-cms="buttons.checkoutText"]'), buttons?.checkoutText);
    setText(document.querySelector('[data-cms="buttons.headerCta"]'), buttons?.headerCtaText);
    setText(document.querySelector('[data-cms="buttons.stickyCta"]'), buttons?.stickyCtaText);
    setText(document.querySelector('[data-cms="buttons.finalCta"]'), buttons?.finalCtaText);

    setAll('.checkout-link', el => {
      if (checkoutUrl) el.href = checkoutUrl;
      if (btnColor) el.style.setProperty('--btn-custom', btnColor);
    });

    if (btnColor) {
      document.documentElement.style.setProperty('--accent-green', btnColor);
    }

    setTitleWithAccent(
      document.querySelector('[data-cms="faq.title"]'),
      faq?.title,
      faq?.titleAccent || 'frequentes'
    );
    setText(document.querySelector('[data-cms="faq.tag"]'), faq?.tag);
    const faqList = document.querySelector('[data-cms="faq.list"]');
    if (faqList && faq?.items) {
      faqList.innerHTML = faq.items.map((item, index) => {
        const icon = FAQ_TOPIC_ICONS[index % FAQ_TOPIC_ICONS.length];
        return `
        <details class="faq-item reveal"${index === 0 ? ' open' : ''}>
          <summary class="faq-item__question">
            <span class="faq-item__lead">
              <span class="faq-item__topic-icon ${icon.className}" aria-hidden="true">${icon.svg}</span>
              <span class="faq-item__text">${escapeHtml(item.question)}</span>
            </span>
            <span class="faq-item__icon" aria-hidden="true"></span>
          </summary>
          <div class="faq-item__answer">
            <p>${escapeHtml(item.answer)}</p>
          </div>
        </details>
      `;
      }).join('');
    }

    setText(document.querySelector('[data-cms="footer.tagline"]'), footer?.tagline);
    setText(document.querySelector('[data-cms="footer.copyright"]'), footer?.copyright);
    const footerLinks = document.querySelector('[data-cms="footer.links"]');
    if (footerLinks && footer?.links) {
      footerLinks.innerHTML = footer.links.map(link => `
        <a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>
      `).join('');
    }

    resetCountUps(['#depoimentos .count-up']);
  }

  loadContent()
    .then(applyContent)
    .finally(() => {
      window.__cmsReady = true;
      window.dispatchEvent(new CustomEvent('cms:applied'));
    });
})();
