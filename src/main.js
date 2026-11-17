// Client-side navigation between pre-rendered pages.
//
// Every page is also a real HTML file, so this is only an enhancement:
// with JavaScript off, links just load the next page normally.
//
// The site can live at any base path (https://washtenawcampplacement.org/ or
// https://<org>.github.io/website/). Built pages use relative links for that;
// routes below are keyed by the path under the site root, e.g. "/team/".

import routes from 'virtual:pages';

const main = document.getElementById('content');

// Site root: this script sits one folder down from it (assets/ when built, src/ in dev).
const scriptUrl = import.meta.url;
const ROOT = new URL('../', scriptUrl);

function normalize(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

// Route key for a URL on this site ("/team/"), or null if it is outside the site.
function routeOf(url) {
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return null;
  return normalize('/' + url.pathname.slice(ROOT.pathname.length));
}

function lookup(route) {
  let r = route && routes[route];
  if (r && r.redirect) r = routes[r.redirect];
  return r;
}

// Page HTML in the route table uses root-absolute links ("/team/"); point them at the real root.
const rebase = (html) => html.replace(/(\s(?:href|src)=")\/(?!\/)/g, `$1${ROOT.pathname}`);

// Relative links in the pre-rendered page are relative to the URL it was loaded from.
// Pin them to absolute URLs before client-side navigation changes that URL.
for (const el of document.querySelectorAll('a[href], img[src]')) {
  const attr = el.tagName === 'A' ? 'href' : 'src';
  if (!/^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(el.getAttribute(attr))) el.setAttribute(attr, el[attr]);
}

function markCurrent(route) {
  for (const a of document.querySelectorAll('.site-nav a')) {
    if (routeOf(new URL(a.href)) === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function render(url, { scroll = true } = {}) {
  const route = routeOf(url);
  const r = lookup(route);
  if (!r) return false;
  // Pre-rendered HTML is already in place on first load; don't redo it.
  if (main.dataset.path || !main.firstElementChild) {
    main.innerHTML = rebase(r.html);
    document.title = r.title;
  }
  main.dataset.path = route;
  markCurrent(route);
  if (scroll) window.scrollTo(0, 0);
  return true;
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return;
  const route = routeOf(url);
  if (!lookup(route)) return;
  e.preventDefault();
  history.pushState(null, '', new URL(route.slice(1), ROOT).href + url.search + url.hash);
  render(url);
  document.body.classList.remove('menu-open');
  document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
});

window.addEventListener('popstate', () => render(new URL(location.href), { scroll: false }));
// Mobile menu.
document.querySelector('.menu-toggle')?.addEventListener('click', (e) => {
  const open = document.body.classList.toggle('menu-open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

// Spanish: what the free GTranslate plugin did on the WordPress site. Google's
// Website Translator script rewrites the page text in the browser, and its
// "googtrans" cookie keeps the language as the visitor moves between pages.
const langLink = document.querySelector('[data-translate]');
const translating = /(?:^|;\s*)googtrans=\/en\/\w/.test(document.cookie);

function setGoogtrans(value) {
  // Google's script may also set the cookie on the domain, so write both forms.
  const expires = value ? '' : '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `googtrans=${value}; path=/${expires}`;
  document.cookie = `googtrans=${value}; path=/; domain=${location.hostname}${expires}`;
}

function loadTranslator() {
  const holder = document.createElement('div');
  holder.id = 'google_translate_element';
  holder.hidden = true;
  document.body.append(holder);
  window.wcpTranslateInit = () =>
    new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, holder.id);
  const s = document.createElement('script');
  s.src = 'https://translate.google.com/translate_a/element.js?cb=wcpTranslateInit';
  document.head.append(s);
}

if (langLink) {
  if (translating) {
    langLink.textContent = 'English';
    langLink.lang = 'en';
    loadTranslator();
  }
  langLink.addEventListener('click', (e) => {
    e.preventDefault();
    setGoogtrans(translating ? '' : `/en/${langLink.dataset.translate}`);
    location.reload();
  });
}

if (!render(new URL(location.href), { scroll: false })) {
  main.innerHTML = `<div class="page"><h1>Page not found</h1><p>Sorry, that page doesn’t exist. Try the <a href="${ROOT.pathname}">home page</a>.</p></div>`;
}
