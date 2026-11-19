/* Správa souhlasů s cookies. Načítá se jen na webu, kde je zapnutá volitelná analytika (viz tools/build.py).
   Bez souhlasu se žádný analytický skript nestáhne. Odmítnutí je stejně snadné jako přijetí. */
(function () {
  'use strict';
  var cfg = window.PZ_CONSENT_CFG; if (!cfg) return;
  var KEY = 'pz_consent', V = 1, box = null;

  function read() { try { var j = JSON.parse(localStorage.getItem(KEY)); return j && j.v === V ? j : null; } catch (e) { return null; } }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify({ v: V, analytics: !!a, ts: new Date().toISOString() })); } catch (e) {} }

  function loadAnalytics() {
    if (!cfg.ga || window.__pzGa) return; window.__pzGa = true;
    window['ga-disable-' + cfg.ga] = false;
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga); document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', cfg.ga, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }
  function clearAnalytics() {
    if (cfg.ga) window['ga-disable-' + cfg.ga] = true;
    var host = location.hostname, parts = host.split('.'), doms = ['', ';domain=' + host, ';domain=.' + host];
    if (parts.length > 2) doms.push(';domain=.' + parts.slice(-2).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n === '_gid' || n.indexOf('_ga_') === 0) doms.forEach(function (d) { document.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/' + d; });
    });
  }
  function apply(a) { if (a) loadAnalytics(); else clearAnalytics(); }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function close() { if (box) { box.remove(); box = null; } }
  function choose(a) { write(a); apply(a); close(); }

  function open(openSettings) {
    close();
    var cur = read(), chk = el('input', { type: 'checkbox', id: 'pz-an' }); chk.checked = !!(cur && cur.analytics);
    var panel = el('div', { class: 'pzc-panel', hidden: '' }, [
      el('label', { class: 'pzc-row', for: 'pz-an' }, [chk, el('span', {}, [el('b', { text: 'Analytické cookies' }), ' – měření návštěvnosti webu. Data nejsou použita k reklamě.'])]),
      el('p', { class: 'pzc-note', text: 'Nezbytné technologie (například ověření u formulářů) fungují vždy a souhlas nevyžadují.' }),
      el('button', { type: 'button', class: 'btn sm', text: 'Uložit výběr', onclick: function () { choose(chk.checked); } })
    ]);
    box = el('div', { class: 'pzc', role: 'dialog', 'aria-labelledby': 'pzc-t', 'aria-live': 'polite' }, [
      el('div', { class: 'pzc-in' }, [
        el('p', { id: 'pzc-t' }, [el('b', { text: 'Cookies. ' }), 'Rádi bychom měřili návštěvnost webu, abychom ho mohli zlepšovat. Analytické cookies použijeme jen s vaším souhlasem. ', el('a', { href: '/cookies/', text: 'Zásady cookies' }), '.']),
        el('div', { class: 'pzc-btns' }, [
          el('button', { type: 'button', class: 'btn sm', text: 'Přijmout vše', onclick: function () { choose(true); } }),
          el('button', { type: 'button', class: 'btn sm out', text: 'Odmítnout vše', onclick: function () { choose(false); } }),
          el('button', { type: 'button', class: 'btn sm out', text: 'Nastavení', 'aria-expanded': 'false', onclick: function (e) { var h = panel.hidden; panel.hidden = !h; e.currentTarget.setAttribute('aria-expanded', h ? 'true' : 'false'); } })
        ]),
        panel
      ])
    ]);
    document.body.appendChild(box);
    if (openSettings) { panel.hidden = false; }
    var first = box.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); open(true); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box) { close(); } });

  var c = read();
  if (c) apply(c.analytics); else open(false);
})();
