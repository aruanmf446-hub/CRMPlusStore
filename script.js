const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu');
function closeMenu() { menu.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { const open = menu.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); menuButton.focus(); } });
document.querySelector('#year').textContent = new Date().getFullYear();


/* Carrossel contínuo de parceiros: sem bibliotecas, com pausa na interação. */
(() => {
  const carousel = document.querySelector('.partners-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.partners-track');
  const viewport = carousel.querySelector('.partners-viewport');
  if (!track || track.children.length < 2) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 420;
  let animating = false;
  let direction = '';
  let timer = null;
  let visible = !('IntersectionObserver' in window);
  let hovering = false;
  let linkFocused = false;
  let touchStart = null;

  function stepSize() {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return track.firstElementChild.getBoundingClientRect().width + gap;
  }

  function move(to) {
    if (animating) return;
    animating = true;
    direction = to;
    const distance = stepSize();
    const speed = reducedMotion.matches ? 0 : duration;
    if (to === 'previous') {
      track.prepend(track.lastElementChild);
      track.style.transition = 'none';
      track.style.transform = `translate3d(-${distance}px,0,0)`;
      void track.offsetWidth;
      track.style.transition = `transform ${speed}ms cubic-bezier(.25,.8,.25,1)`;
      track.style.transform = 'translate3d(0,0,0)';
    } else {
      track.style.transition = `transform ${speed}ms cubic-bezier(.25,.8,.25,1)`;
      track.style.transform = `translate3d(-${distance}px,0,0)`;
    }
    if (speed === 0) finishMove();
  }

  function finishMove() {
    if (!animating) return;
    if (direction === 'next') {
      track.append(track.firstElementChild);
      track.style.transition = 'none';
      track.style.transform = 'translate3d(0,0,0)';
    }
    animating = false;
    direction = '';
  }

  track.addEventListener('transitionend', (event) => {
    if (event.target === track && event.propertyName === 'transform') finishMove();
  });

  function autoplayAllowed() {
    return !reducedMotion.matches && !document.hidden && visible && !hovering && !linkFocused;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!autoplayAllowed()) return;
    timer = setTimeout(() => {
      if (!animating) move('next');
      schedule();
    }, 1450);
  }

  viewport.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  viewport.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  carousel.addEventListener('focusin', (event) => {
    if (event.target.closest('.partner')) { linkFocused = true; schedule(); }
  });
  carousel.addEventListener('focusout', () => {
    linkFocused = false;
    requestAnimationFrame(() => {
      linkFocused = !!carousel.querySelector('.partner:focus-within');
      schedule();
    });
  });

  viewport.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = {x: touch.clientX, y: touch.clientY};
  }, {passive: true});
  viewport.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      move(dx < 0 ? 'next' : 'previous');
      schedule();
    }
  }, {passive: true});

  document.addEventListener('visibilitychange', schedule);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', schedule);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      schedule();
    }, {threshold: 0.1});
    observer.observe(viewport);
  } else {
    schedule();
  }
})();


/* Vitrines sincronizadas com os quatro sites publicados: sem screenshots fixos.
   Exibe um fallback local até a prévia real carregar. Nenhum dado privado é lido. */
(() => {
  const previews = [...document.querySelectorAll('.showcase-tile[data-live-url]')];
  if (!previews.length) return;
  const frameWidth = 390;
  const minimumRefreshMs = 120000; // Abas abertas também se atualizam.
  const observes = new Map();

  const resize = () => {
    previews.forEach(tile => {
      const width = tile.getBoundingClientRect().width;
      if (width > 0) tile.style.setProperty('--showcase-scale', String(width / frameWidth));
    });
  };
  resize();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resize);
    previews.forEach(tile => ro.observe(tile));
  } else {
    window.addEventListener('resize', resize, {passive: true});
  }

  previews.forEach(tile => {
    const frame = tile.querySelector('.showcase-frame');
    if (!frame) return;
    frame.addEventListener('load', () => {
      tile.classList.add('is-loaded');
      tile.dataset.loadedAt = String(Date.now());
    });
  });

  function requestPreview(tile, refresh = false) {
    if (document.hidden || observes.get(tile) === false) return;
    const frame = tile.querySelector('.showcase-frame');
    if (!frame || (!refresh && frame.hasAttribute('src'))) return;
    const url = tile.dataset.liveUrl;
    if (!url) return;
    const last = Number(tile.dataset.loadedAt || 0);
    if (refresh && Date.now() - last < minimumRefreshMs) return;
    if (refresh) {
      const fresh = new URL(url);
      fresh.searchParams.set('crmplus_preview', String(Date.now()));
      frame.src = fresh.href;
    } else {
      frame.src = url;
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        observes.set(entry.target, entry.isIntersecting);
        if (entry.isIntersecting) requestPreview(entry.target);
      });
    }, {rootMargin: '160px 0px', threshold: 0});
    previews.forEach(tile => observer.observe(tile));
  } else {
    previews.forEach(tile => requestPreview(tile));
  }

  function refreshVisible() {
    if (document.hidden) return;
    previews.forEach(tile => requestPreview(tile, true));
  }
  document.addEventListener('visibilitychange', refreshVisible);
  window.setInterval(refreshVisible, minimumRefreshMs);
})();
