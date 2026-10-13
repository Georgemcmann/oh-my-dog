/* ==========================================================================
   OH MY DOG Grooming Salon — script.js
   Vanilla JavaScript only. Each feature lives in its own small module.
   --------------------------------------------------------------------------
   0.  Page loader                8.  Gallery lightbox
   1.  Mobile navigation          9.  "Enquire" service buttons
   2.  Sticky header state       10.  Contact form validation
   3.  Scroll manager (shared)   11.  Back-to-top button
   4.  Toast + placeholder links 12.  Mobile bottom CTA
   5.  Scroll reveal             13.  Image fallback + footer year
   6.  Scroll spy (active nav)
   7.  Gallery filtering
   ========================================================================== */

(function () {
  'use strict';

  // Lets CSS know JS is available (reveal styles are gated behind html.js,
  // so content is never hidden if this script fails to load).
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function select(sel, ctx) { return (ctx || document).querySelector(sel); }
  function selectAll(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------------------------------------------------------------------
     3. Scroll manager — one rAF-throttled listener shared by every
        scroll-driven UI piece (header, spy, back-to-top, mobile CTA).
  --------------------------------------------------------------------- */
  var ScrollManager = (function () {
    var subscribers = [];
    var ticking = false;

    function notify() {
      var y = window.scrollY || window.pageYOffset;
      subscribers.forEach(function (fn) { fn(y); });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { notify(); ticking = false; });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    return {
      subscribe: function (fn) {
        subscribers.push(fn);
        fn(window.scrollY || window.pageYOffset); // run once with the current position
      }
    };
  })();

  /* ---------------------------------------------------------------------
     4a. Toast — small non-blocking notices for placeholder links.
  --------------------------------------------------------------------- */
  var Toast = (function () {
    var region = null;

    function ensureRegion() {
      if (region) return region;
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
      return region;
    }

    function show(message) {
      var host = ensureRegion();
      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      host.appendChild(toast);

      window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });

      window.setTimeout(function () {
        toast.classList.remove('is-visible');
        window.setTimeout(function () { toast.remove(); }, 400);
      }, 3600);
    }

    return { show: show };
  })();

  /* ---------------------------------------------------------------------
     0. Page loader — draws the dog, then hands over to the hero animation.
        First visit ≈ 2s · repeat visits ≈ 0.5s · reduced-motion: skipped.
        Add ?loader to the URL to force the full animation (for demos).
  --------------------------------------------------------------------- */
  function initLoader() {
    var loader = select('#loader');
    if (!loader) { document.body.classList.add('is-loaded'); return; }

    if (reduceMotion.matches) {
      loader.remove();
      document.body.classList.add('is-loaded');
      return;
    }

    var forceDemo = /([?&])loader(=1|&|$)/.test(window.location.search);

    var seen = false;
    if (!forceDemo) {
      try { seen = sessionStorage.getItem('omd-loaded') === '1'; } catch (e) {}
    }
    if (seen) loader.classList.add('is-repeat');

    document.body.classList.add('is-loading');

    var MIN_DISPLAY = seen ? 550 : 1950;
    var start = Date.now();
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded'); // triggers the hero entrance
      window.setTimeout(function () { loader.remove(); }, 1100);
      try { sessionStorage.setItem('omd-loaded', '1'); } catch (e) {}
    }

    function ready() {
      var wait = Math.max(0, MIN_DISPLAY - (Date.now() - start));
      window.setTimeout(finish, wait);
    }

    if (document.readyState === 'complete') ready();
    else window.addEventListener('load', ready);

    window.setTimeout(finish, 4000); // failsafe — never trap the user
  }

  /* ---------------------------------------------------------------------
     4b. Placeholder links (social profiles, reviews URL) — clearly flagged,
         never silently dead: a toast explains the link is coming soon.
  --------------------------------------------------------------------- */
  function initPlaceholderLinks() {
    selectAll('a[href="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        Toast.show(a.dataset.toast || 'This link is a placeholder — the destination will be added soon.');
      });
    });
  }

  /* ---------------------------------------------------------------------
     1. Mobile navigation — hamburger toggle, Escape to close,
        auto-close on link click, resets when resized to desktop.
  --------------------------------------------------------------------- */
  function initMobileNav() {
    var toggle = select('.nav-toggle');
    var nav = select('#primary-nav');
    if (!toggle || !nav) return;

    function setState(open) {
      nav.dataset.state = open ? 'open' : 'closed';
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
    }

    toggle.addEventListener('click', function () {
      setState(nav.dataset.state !== 'open');
    });

    selectAll('.nav__link, .nav__panel-foot .btn', nav).forEach(function (link) {
      link.addEventListener('click', function () { setState(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.dataset.state === 'open') {
        setState(false);
        toggle.focus();
      }
    });

    var desktop = window.matchMedia('(min-width: 992px)');
    function onDesktop(e) { if (e.matches) setState(false); }
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else if (desktop.addListener) desktop.addListener(onDesktop);
  }

  /* ---------------------------------------------------------------------
     2. Sticky header — adds a shadow once the page is scrolled.
  --------------------------------------------------------------------- */
  function initHeaderState() {
    var header = select('.header');
    if (!header) return;
    ScrollManager.subscribe(function (y) {
      header.classList.toggle('is-scrolled', y > 10);
    });
  }

  /* ---------------------------------------------------------------------
     5. Scroll reveal — IntersectionObserver adds .is-visible once.
  --------------------------------------------------------------------- */
  function initReveal() {
    var items = selectAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     6. Scroll spy — highlights the nav link for the section in view.
        Secondary sections point at their parent via data-spy="about" etc.
  --------------------------------------------------------------------- */
  function initScrollSpy() {
    var links = selectAll('.nav__link').filter(function (l) {
      return (l.getAttribute('href') || '').charAt(0) === '#';
    });
    if (!links.length) return;

    var entries = links.map(function (link) {
      var id = link.getAttribute('href').slice(1);
      return {
        id: id,
        link: link,
        sections: Array.prototype.slice.call(
          document.querySelectorAll('#' + id + ', [data-spy="' + id + '"]')
        )
      };
    });

    function update(y) {
      var probe = y + 170;
      var points = [];

      entries.forEach(function (entry) {
        entry.sections.forEach(function (section) {
          points.push({ id: entry.id, top: section.offsetTop });
        });
      });
      points.sort(function (a, b) { return a.top - b.top; });

      var activeId = entries[0].id;
      points.forEach(function (p) { if (p.top <= probe) activeId = p.id; });

      // Snap to the last item at the very bottom of the page.
      var bottomReached = window.innerHeight + y >= document.documentElement.scrollHeight - 60;
      if (bottomReached) activeId = entries[entries.length - 1].id;

      entries.forEach(function (entry) {
        entry.link.classList.toggle('is-active', entry.id === activeId);
      });
    }

    ScrollManager.subscribe(update);
  }

  /* ---------------------------------------------------------------------
     7. Gallery filtering — shows/hides grid items by category with a
        soft re-entry animation and a screen-reader status update.
  --------------------------------------------------------------------- */
  function initGalleryFilter() {
    var grid = select('.gallery__grid');
    var buttons = selectAll('.gallery__filter');
    if (!grid || !buttons.length) return;

    var items = selectAll('.gallery__item', grid);
    var status = select('#gallery-status');
    var LABELS = {
      'all': 'images',
      'full-grooms': 'full groom images',
      'puppies': 'puppy images',
      'before-after': 'before & after images',
      'happy-dogs': 'happy dog images'
    };

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.dataset.filter;

        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });

        var shown = 0;
        items.forEach(function (item) {
          var match = filter === 'all' || item.dataset.category === filter;
          item.classList.remove('is-entering');
          if (match) {
            if (item.classList.contains('is-hidden')) {
              void item.offsetWidth; // restart the entry animation
              item.classList.add('is-entering');
            }
            item.classList.remove('is-hidden');
            shown++;
          } else {
            item.classList.add('is-hidden');
          }
        });

        if (status) status.textContent = 'Showing ' + shown + ' ' + (LABELS[filter] || 'images') + '.';
      });
    });
  }

  /* ---------------------------------------------------------------------
     8. Gallery lightbox — open/close, prev/next within the filtered set,
        keyboard navigation (Escape / arrows / focus trap), click-outside
        to close, focus restore, and simple touch swipe.
  --------------------------------------------------------------------- */
  function initLightbox() {
    var lightbox = select('#lightbox');
    var grid = select('.gallery__grid');
    if (!lightbox || !grid) return;

    var img = select('.lightbox__img', lightbox);
    var captionText = select('.lightbox__caption-text', lightbox);
    var countEl = select('.lightbox__count', lightbox);
    var closeBtn = select('.lightbox__close', lightbox);
    var prevBtn = select('.lightbox__prev', lightbox);
    var nextBtn = select('.lightbox__next', lightbox);

    var visible = [];
    var index = 0;
    var lastTrigger = null;
    var isOpen = false;

    function render() {
      var item = visible[index];
      var tileImg = item ? select('img', item) : null;
      if (!tileImg) return;

      var full = item.dataset.full || tileImg.currentSrc || tileImg.src;
      img.style.opacity = '0';

      var pre = new Image();
      pre.onload = function () { img.src = full; img.alt = tileImg.alt; img.style.opacity = '1'; };
      pre.onerror = function () { img.src = tileImg.dataset.fallback || full; img.alt = tileImg.alt; img.style.opacity = '1'; };
      pre.src = full;

      captionText.textContent = item.dataset.categoryLabel || '';
      countEl.textContent = (index + 1) + ' / ' + visible.length;
      prevBtn.disabled = visible.length < 2;
      nextBtn.disabled = visible.length < 2;
    }

    function open(item, trigger) {
      visible = selectAll('.gallery__item', grid).filter(function (i) {
        return !i.classList.contains('is-hidden');
      });
      index = Math.max(0, visible.indexOf(item));
      lastTrigger = trigger;
      isOpen = true;

      lightbox.hidden = false;
      window.requestAnimationFrame(function () { lightbox.classList.add('is-open'); });
      document.body.classList.add('lightbox-open');
      render();
      closeBtn.focus();
    }

    function close() {
      isOpen = false;
      lightbox.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      window.setTimeout(function () { lightbox.hidden = true; }, 280);
      if (lastTrigger) lastTrigger.focus();
    }

    function step(dir) {
      if (!visible.length) return;
      index = (index + dir + visible.length) % visible.length;
      render();
    }

    selectAll('.gallery__trigger', grid).forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        open(trigger.closest('.gallery__item'), trigger);
      });
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });

    // Click outside (backdrop or close button carries data-lightbox-close)
    lightbox.addEventListener('click', function (e) {
      if (e.target.closest('[data-lightbox-close]')) close();
    });

    // Keyboard: Escape, arrows, and a simple focus trap
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { step(-1); return; }
      if (e.key === 'ArrowRight') { step(1); return; }
      if (e.key === 'Tab') {
        var focusables = [prevBtn, nextBtn, closeBtn];
        var i = focusables.indexOf(document.activeElement);
        if (i === -1) { closeBtn.focus(); e.preventDefault(); return; }
        var next = i + (e.shiftKey ? -1 : 1);
        if (next < 0) next = focusables.length - 1;
        if (next >= focusables.length) next = 0;
        focusables[next].focus();
        e.preventDefault();
      }
    });

    // Touch swipe
    var touchX = null;
    lightbox.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
      touchX = null;
    }, { passive: true });
  }

  /* ---------------------------------------------------------------------
     9. "Enquire" service buttons — pre-select the service in the contact
        form, scroll there and gently highlight the form card.
  --------------------------------------------------------------------- */
  function initEnquireButtons() {
    var serviceSelect = select('#service');
    var form = select('#contact-form');
    var contact = select('#contact');

    selectAll('[data-enquire]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var serviceName = btn.dataset.enquire;

        if (serviceSelect) {
          for (var i = 0; i < serviceSelect.options.length; i++) {
            if (serviceSelect.options[i].value === serviceName) {
              serviceSelect.value = serviceName;
              break;
            }
          }
        }

        if (contact) {
          contact.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }
        if (form) {
          form.classList.remove('is-flash');
          void form.offsetWidth;
          form.classList.add('is-flash');
          window.setTimeout(function () {
            var first = select('#name');
            if (first) first.focus({ preventScroll: true });
          }, reduceMotion.matches ? 0 : 700);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     10. Contact form validation — friendly inline messages, honest
         success state. Nothing is sent until a real endpoint is connected
         (see the TODO comment on the form in index.html).
  --------------------------------------------------------------------- */
  function initContactForm() {
    var form = select('#contact-form');
    if (!form) return;

    var validators = {
      name: function (v) {
        return v.trim().length >= 2 ? '' : 'Please tell us your name.';
      },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
          ? ''
          : 'Please enter a valid email address, e.g. name@example.com.';
      },
      phone: function (v) {
        var digits = v.replace(/[\s\-().]/g, '');
        return /^\+?\d{10,13}$/.test(digits)
          ? ''
          : 'Please enter a valid phone number, e.g. 07733 022817.';
      },
      message: function (v) {
        var t = v.trim();
        if (t.length < 10) return 'Please add a little more detail (at least 10 characters).';
        if (t.length > 1000) return 'Please keep your message under 1,000 characters.';
        return '';
      }
    };
    var requiredFields = ['name', 'email', 'phone', 'message'];

    function fieldWrap(id) { return select('#' + id).closest('.field'); }

    function setError(id, message) {
      var input = select('#' + id);
      var wrap = fieldWrap(id);
      var errorEl = select('#' + id + '-error');
      if (!input || !wrap || !errorEl) return;
      wrap.classList.toggle('is-invalid', Boolean(message));
      errorEl.textContent = message;
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      input.setAttribute('aria-describedby', id + '-error');
    }

    function validateField(id) {
      var input = select('#' + id);
      if (!input) return true;
      var value = input.value;
      var isRequired = requiredFields.indexOf(id) !== -1;
      var message = '';

      if (isRequired && validators[id]) message = validators[id](value);
      else if (validators[id] && value.trim() !== '') message = validators[id](value);

      setError(id, message);
      return !message;
    }

    requiredFields.forEach(function (id) {
      var input = select('#' + id);
      if (!input) return;
      input.addEventListener('blur', function () { validateField(id); });
      input.addEventListener('input', function () {
        if (fieldWrap(id).classList.contains('is-invalid')) validateField(id);
      });
    });

    var success = select('#form-success');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot: bots that fill it get a silent "success" — no real action.
      var honeypot = select('#company');
      if (honeypot && honeypot.value !== '') {
        form.reset();
        return;
      }

      var firstInvalid = null;
      requiredFields.forEach(function (id) {
        var valid = validateField(id);
        if (!valid && !firstInvalid) firstInvalid = select('#' + id);
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      // All valid — show the honest success state (no fake email sent).
      var name = select('#name').value.trim();
      var nameSlot = select('#success-name');
      if (nameSlot) nameSlot.textContent = name ? ', ' + name.split(' ')[0] : '';
      if (success) {
        success.hidden = false;
        success.focus();
        success.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
      }
      form.reset();
      requiredFields.forEach(function (id) { setError(id, ''); });
    });
  }

  /* ---------------------------------------------------------------------
     11. Back-to-top button.
  --------------------------------------------------------------------- */
  function initBackToTop() {
    var btn = select('.to-top');
    if (!btn) return;
    ScrollManager.subscribe(function (y) {
      btn.classList.toggle('is-visible', y > 640);
    });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------------
     12. Mobile bottom CTA — appears once the user scrolls past the hero.
  --------------------------------------------------------------------- */
  function initMobileCta() {
    var bar = select('.mobile-cta');
    var hero = select('.hero');
    if (!bar || !hero) return;
    ScrollManager.subscribe(function (y) {
      bar.classList.toggle('is-visible', y > hero.offsetHeight * 0.7);
    });
  }

  /* ---------------------------------------------------------------------
     13a. Image fallback — if a stock photo URL ever breaks, swap in a
          placeholder so the layout never shows a broken image.
  --------------------------------------------------------------------- */
  function initImageFallback() {
    selectAll('img[data-fallback]').forEach(function (img) {
      img.addEventListener('error', function handler() {
        img.removeEventListener('error', handler);
        img.src = img.dataset.fallback;
      });
    });
  }

  /* ---------------------------------------------------------------------
     13b. Footer year.
  --------------------------------------------------------------------- */
  function initYear() {
    var el = select('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------------------------------------------------------------------
     Boot
  --------------------------------------------------------------------- */
  function init() {
    initLoader();
    initMobileNav();
    initHeaderState();
    initPlaceholderLinks();
    initReveal();
    initScrollSpy();
    initGalleryFilter();
    initLightbox();
    initEnquireButtons();
    initContactForm();
    initBackToTop();
    initMobileCta();
    initImageFallback();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();