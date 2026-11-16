(function () {
  'use strict';
  var C = window.PZ_CONFIG || {};
  var app = document.getElementById('app'), who = document.getElementById('who'), toastEl = document.getElementById('toast');
  var STATUS = { nova: 'Nová', v_reseni: 'V řešení', prevzato: 'Převzato', zamitnuto: 'Zamítnuto' };
  // musí odpovídat RETENTION_DAYS v lib/core.js
  var RETENTION = { nova: 90, v_reseni: 90, zamitnuto: 30, prevzato: null };
  var BUCKET = 'submissions', UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var filter = 'nova', all = [];

  if (!C.url || !C.anonKey) {
    app.innerHTML = '<div class="box login"><h2>Chybí konfigurace</h2><p>Při buildu nejsou nastavené proměnné <code>SUPABASE_URL</code> a <code>SUPABASE_ANON_KEY</code>. Viz docs/SETUP.md.</p></div>';
    return;
  }
  var sb = supabase.createClient(C.url, C.anonKey);

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function toast(msg, ms) { toastEl.textContent = msg; toastEl.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.style.display = 'none'; }, ms || 4500); }
  function fmtDate(iso) { var d = new Date(iso); return d.toLocaleDateString('cs-CZ') + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }
  function daysLeft(r) {
    var days = RETENTION[r.status]; if (!days) return null;
    return Math.ceil((Date.parse(r.status_changed_at) + days * 86400000 - Date.now()) / 86400000);
  }
  function fld(label, input) { return h('div', {}, [h('label', { text: label }), input]); }

  function loginView(msg) {
    who.textContent = '';
    var email = h('input', { type: 'email', required: true, autocomplete: 'username' });
    var pass = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    var err = h('p', { class: 'msg err', text: msg || '' }); if (!msg) err.style.display = 'none';
    app.replaceChildren(h('form', { class: 'box login', onsubmit: function (e) {
      e.preventDefault();
      sb.auth.signInWithPassword({ email: email.value, password: pass.value }).then(function (r) {
        if (r.error) { err.textContent = 'Přihlášení se nepovedlo: špatný e-mail nebo heslo.'; err.style.display = 'block'; } else start();
      });
    } }, [h('h2', { text: 'Přihlášení' }), fld('E-mail', email), fld('Heslo', pass), h('div', { class: 'actions' }, [h('button', { class: 'btn', type: 'submit', text: 'Přihlásit se' })]), err]));
  }

  // ---------- seznam ----------
  function listView() {
    history.replaceState(null, '', location.pathname);
    app.replaceChildren(h('p', { text: 'Načítám podklady…', style: 'padding:30px 0' }));
    sb.from('submissions').select('id,status,created_at,status_changed_at,name,city,property_type,disposition,photo_paths,notified').order('created_at', { ascending: false }).limit(500).then(function (r) {
      if (r.error) { toast('Chyba načtení: ' + r.error.message, 8000); return; }
      all = r.data || [];
      renderList();
    });
  }
  function renderList() {
    var counts = {}; all.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
    var tabs = h('div', { class: 'tabs' }, Object.keys(STATUS).concat(['vse']).map(function (k) {
      var label = k === 'vse' ? 'Vše (' + all.length + ')' : STATUS[k] + ' (' + (counts[k] || 0) + ')';
      return h('button', { class: filter === k ? 'on' : '', text: label, onclick: function () { filter = k; renderList(); } });
    }));
    var rows = all.filter(function (x) { return filter === 'vse' || x.status === filter; }).map(function (x) {
      var dl = daysLeft(x);
      return h('tr', { onclick: function () { detailView(x.id); } }, [
        h('td', { text: fmtDate(x.created_at) }),
        h('td', {}, [h('b', { text: x.name })]),
        h('td', { class: 'hm', text: x.city + ' · ' + x.property_type + (x.disposition ? ' ' + x.disposition : '') }),
        h('td', { text: String((x.photo_paths || []).length) }),
        h('td', {}, [h('span', { class: 'badge b-' + x.status, text: STATUS[x.status] || x.status })].concat(x.notified ? [] : [' ', h('span', { class: 'badge warn', text: 'e-mail neodešel' })])),
        h('td', { class: 'hm', text: dl == null ? '' : 'smaže se za ' + dl + ' dní' })
      ]);
    });
    app.replaceChildren(h('div', { class: 'box' }, [
      h('h2', { text: 'Podklady od majitelů', style: 'margin-bottom:16px' }), tabs,
      rows.length ? h('table', { class: 'l' }, [h('thead', {}, [h('tr', {}, ['Přijato', 'Majitel', 'Nemovitost', 'Fotek', 'Stav', ''].map(function (t, i) { return h('th', { text: t, class: i === 2 || i === 5 ? 'hm' : '' }); }))]), h('tbody', {}, rows)])
                  : h('p', { text: 'V této části zatím nic není.' }),
      h('p', { class: 'hint', text: 'Podklady ve stavu Nová a V řešení se po 90 dnech mažou, Zamítnuto po 30 dnech. Převzato zůstává.' })
    ]));
  }

  // ---------- detail ----------
  function loadZip() {
    return new Promise(function (res, rej) {
      if (window.JSZip) return res(window.JSZip);
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = function () { res(window.JSZip); }; s.onerror = function () { rej(new Error('JSZip se nenačetl')); }; document.head.appendChild(s);
    });
  }
  function detailView(id) {
    if (!UUID.test(id)) { listView(); return; }
    history.replaceState(null, '', '#' + id);
    app.replaceChildren(h('p', { text: 'Načítám…', style: 'padding:30px 0' }));
    sb.from('submissions').select('*').eq('id', id).single().then(function (r) {
      if (r.error || !r.data) { toast('Podklady nenalezeny (možná už byly smazány).', 6000); listView(); return; }
      var x = r.data, paths = x.photo_paths || [], urls = [];
      var statusSel = h('select', {}, Object.keys(STATUS).map(function (k) { var o = h('option', { value: k, text: STATUS[k] }); if (k === x.status) o.selected = true; return o; }));
      var note = h('textarea', { rows: 4, placeholder: 'Poznámka (vidí jen makléř)' }); note.value = x.note || '';
      var grid = h('div', { class: 'ph' });
      var dl = daysLeft(x);
      var rowsDl = [['Telefon', h('a', { href: 'tel:' + x.phone.replace(/[^+0-9]/g, ''), text: x.phone })], ['E-mail', h('a', { href: 'mailto:' + x.email, text: x.email })],
        ['Nemovitost', x.property_type + (x.disposition ? ' ' + x.disposition : '')], ['Město / obec', x.city], ['Plocha', x.area_m2 ? x.area_m2 + ' m²' : ''],
        ['Požadované nájemné', x.rent_czk ? x.rent_czk.toLocaleString('cs-CZ') + ' Kč / měsíc' : ''], ['K dispozici od', x.available_from || ''], ['Zájem o pomoc', x.help || ''],
        ['Přijato', fmtDate(x.created_at)], ['Zdroj', x.source || '']].filter(function (p) { return p[1]; });
      var dlEl = h('dl', {}); rowsDl.forEach(function (p) { dlEl.appendChild(h('dt', { text: p[0] })); dlEl.appendChild(h('dd', {}, [p[1]])); });

      function drawPhotos() {
        grid.replaceChildren.apply(grid, urls.map(function (u, i) {
          return h('a', { href: u.signedUrl, target: '_blank', rel: 'noopener' }, [h('img', { src: u.signedUrl, alt: 'Fotka ' + (i + 1), loading: 'lazy' })]);
        }));
      }
      if (paths.length) sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (s) {
        if (s.error) { toast('Fotky se nepodařilo načíst: ' + s.error.message, 7000); return; }
        urls = (s.data || []).filter(function (u) { return u.signedUrl; }); drawPhotos();
      });

      function zip() {
        if (!urls.length) return;
        toast('Připravuji ZIP…', 60000);
        loadZip().then(function (JSZip) {
          var z = new JSZip();
          return Promise.all(urls.map(function (u, i) { return fetch(u.signedUrl).then(function (res) { return res.blob(); }).then(function (b) { z.file((i + 1) + '.jpg', b); }); }))
            .then(function () { return z.generateAsync({ type: 'blob' }); });
        }).then(function (blob) {
          var a = document.createElement('a'), nm = (x.name + '-' + x.city).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
          a.href = URL.createObjectURL(blob); a.download = 'fotky-' + nm + '.zip'; document.body.appendChild(a); a.click(); a.remove(); toast('ZIP stažen.');
        }).catch(function (e) { toast('ZIP se nepodařilo vytvořit: ' + e.message, 8000); });
      }
      function save() {
        var patch = { status: statusSel.value, note: note.value.trim() || null };
        if (patch.status !== x.status) patch.status_changed_at = new Date().toISOString();
        sb.from('submissions').update(patch).eq('id', x.id).then(function (u) {
          if (u.error) { toast('Uložení selhalo: ' + u.error.message, 8000); return; }
          toast('Uloženo.'); listView();
        });
      }
      function del() {
        if (!confirm('Opravdu trvale smazat tyto podklady včetně fotek?')) return;
        sb.from('submissions').delete().eq('id', x.id).then(function (d) {
          if (d.error) { toast('Smazání selhalo: ' + d.error.message, 8000); return; }
          if (paths.length) sb.storage.from(BUCKET).remove(paths);
          toast('Smazáno.'); listView();
        });
      }
      app.replaceChildren(h('div', { class: 'box' }, [
        h('p', {}, [h('a', { href: '#', text: '← Zpět na seznam', onclick: function (e) { e.preventDefault(); listView(); } })]),
        h('h2', { text: x.name + ' · ' + x.city }),
        h('p', {}, [h('span', { class: 'badge b-' + x.status, text: STATUS[x.status] })].concat(x.notified ? [] : [' ', h('span', { class: 'badge warn', text: 'e-mail makléřce se neodeslal, zkontrolujte Make' })], dl == null ? [] : [' ', h('span', { class: 'hint', text: 'Smaže se za ' + dl + ' dní' })])),
        dlEl,
        x.description ? h('div', {}, [h('h3', { text: 'Popis od majitele', style: 'margin-top:22px' }), h('p', { text: x.description, style: 'white-space:pre-wrap' })]) : h('span'),
        h('h3', { text: 'Fotografie (' + paths.length + ')', style: 'margin-top:22px' }), grid,
        paths.length ? h('button', { class: 'btn out', type: 'button', text: 'Stáhnout všechny fotky (ZIP)', onclick: zip }) : h('span'),
        h('div', { style: 'margin-top:24px;max-width:560px' }, [fld('Stav', statusSel), h('div', { style: 'height:12px' }), fld('Poznámka', note)]),
        h('div', { class: 'actions' }, [h('button', { class: 'btn', type: 'button', text: 'Uložit', onclick: save }), h('button', { class: 'btn danger', type: 'button', text: 'Smazat', onclick: del })])
      ]));
    });
  }

  function start() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { loginView(); return; }
      who.replaceChildren(document.createTextNode(s.user.email + ' · '), h('a', { href: '#', text: 'Odhlásit', style: 'color:var(--gold-l)', onclick: function (e) { e.preventDefault(); sb.auth.signOut().then(function () { loginView(); }); } }));
      var hash = location.hash.slice(1);
      if (UUID.test(hash)) detailView(hash); else listView();
    });
  }
  start();
})();
