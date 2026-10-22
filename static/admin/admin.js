(function () {
  'use strict';
  var C = window.PZ_CONFIG || {};
  var app = document.getElementById('app'), who = document.getElementById('who'), toastEl = document.getElementById('toast');
  var TYPES = ['Byt', 'Rodinný dům', 'Chata / rekreační objekt', 'Komerční prostor', 'Jiné'];
  var DISPS = ['', 'Garsonka', '1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk a větší'];
  var CITIES = ['Karlovy Vary', 'Cheb', 'Sokolov', 'Mariánské Lázně', 'Ostrov'];
  var FEATS = ['Balkon', 'Lodžie', 'Terasa', 'Zahrada', 'Garáž', 'Parkování', 'Sklep', 'Výtah', 'Klimatizace', 'Internet', 'Domácí mazlíčci povoleni', 'Bezbariérový přístup'];
  var STATUS = { draft: 'Koncept', published: 'Zveřejněno', archived: 'Archiv' };

  if (!C.url || !C.anonKey) {
    app.innerHTML = '<div class="box login"><h2>Chybí konfigurace</h2><p>Při buildu nejsou nastavené proměnné <code>SUPABASE_URL</code> a <code>SUPABASE_ANON_KEY</code>. Viz docs/SETUP.md.</p></div>';
    return;
  }
  var sb = supabase.createClient(C.url, C.anonKey);

  // ---------- pomocné ----------
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
  function slugify(t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function photoUrl(p) { return C.url + '/storage/v1/object/public/listings/' + encodeURI(p); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  function fld(label, input, hint) { return h('div', {}, [h('label', { text: label }), input].concat(hint ? [h('p', { class: 'hint', text: hint })] : [])); }
  function sel(name, opts, val) { var s = h('select', { name: name }); opts.forEach(function (o) { var op = h('option', { value: o, text: o || '—' }); if (o === val) op.selected = true; s.appendChild(op); }); return s; }
  function inp(name, val, extra) { var i = h('input', Object.assign({ name: name, value: val == null ? '' : val }, extra || {})); i.value = val == null ? '' : val; return i; }
  function num(v) { v = String(v == null ? '' : v).replace(/\s/g, ''); return v === '' || isNaN(+v) ? null : Math.round(+v); }

  // zmenší fotku v prohlížeči (max 1600 px, JPEG) – rychlejší web i menší úložiště
  function resize(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Převod fotky selhal')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { rej(new Error('Soubor ' + file.name + ' nejde načíst jako obrázek')); };
      img.src = u;
    });
  }

  // ---------- přihlášení ----------
  function loginView(msg) {
    who.textContent = '';
    var email = inp('email', '', { type: 'email', required: true, autocomplete: 'username' });
    var pass = inp('password', '', { type: 'password', required: true, autocomplete: 'current-password' });
    var err = h('p', { class: 'msg err', text: msg || '' }); if (!msg) err.style.display = 'none';
    var f = h('form', { class: 'box login', onsubmit: function (e) {
      e.preventDefault();
      sb.auth.signInWithPassword({ email: email.value, password: pass.value }).then(function (r) {
        if (r.error) { err.textContent = 'Přihlášení se nepovedlo: špatný e-mail nebo heslo.'; err.style.display = 'block'; } else start();
      });
    } }, [h('h2', { text: 'Přihlášení' }), fld('E-mail', email), fld('Heslo', pass), h('div', { class: 'actions' }, [h('button', { class: 'btn', type: 'submit', text: 'Přihlásit se' })]), err]);
    app.replaceChildren(f);
  }

  // ---------- seznam ----------
  function listView() {
    app.replaceChildren(h('p', { text: 'Načítám nabídky…', style: 'padding:30px 0' }));
    sb.from('listings').select('id,title,city,rent_czk,status,photos,updated_at,slug').order('updated_at', { ascending: false }).then(function (r) {
      if (r.error) { toast('Chyba načtení: ' + r.error.message); return; }
      var rows = (r.data || []).map(function (l) {
        var ph = (l.photos || [])[0];
        return h('tr', {}, [
          h('td', {}, [ph ? h('img', { src: photoUrl(ph.path), alt: '' }) : h('span', { text: '—' })]),
          h('td', {}, [h('b', { text: l.title })]),
          h('td', { class: 'hm', text: l.city }),
          h('td', { text: l.rent_czk.toLocaleString('cs-CZ') + ' Kč' }),
          h('td', {}, [h('span', { class: 'badge b-' + l.status, text: STATUS[l.status] || l.status })]),
          h('td', {}, [h('button', { class: 'btn sm out', text: 'Upravit', onclick: function () { editView(l.id); } })])
        ]);
      });
      var tbl = h('table', { class: 'l' }, [h('thead', {}, [h('tr', {}, ['', 'Nabídka', 'Město', 'Nájemné', 'Stav', ''].map(function (t, i) { return h('th', { text: t, class: i === 2 ? 'hm' : '' }); }))]), h('tbody', {}, rows)]);
      app.replaceChildren(h('div', { class: 'box' }, [
        h('div', { class: 'actions', style: 'margin:0 0 18px;justify-content:space-between' }, [h('h2', { text: 'Nabídky', style: 'margin:0' }), h('button', { class: 'btn', text: '+ Nová nabídka', onclick: function () { editView(null); } })]),
        rows.length ? tbl : h('p', { text: 'Zatím tu nic není. Přidejte první nabídku.' }),
        h('p', { class: 'hint', text: 'Po každé změně se web sám přegeneruje, obvykle do 1–2 minut. Zveřejněné jsou jen nabídky ve stavu „Zveřejněno“.' })
      ]));
    });
  }

  // ---------- editace ----------
  function editView(id) {
    var isNew = !id;
    (isNew ? Promise.resolve({ data: null }) : sb.from('listings').select('*').eq('id', id).single()).then(function (r) {
      if (r.error) { toast('Chyba načtení: ' + r.error.message); return; }
      var l = r.data || { id: uuid(), status: 'draft', type: 'Byt', city: 'Karlovy Vary', features: [], photos: [], contact: 'sona' };
      var photos = (l.photos || []).slice(), toDelete = [];
      var form = h('form', { class: 'box' });
      var F = {};
      F.title = inp('title', l.title, { required: true, maxlength: 120, placeholder: 'Např. Světlý byt 2+kk s balkonem v Drahovicích' });
      F.status = sel('status', ['draft', 'published', 'archived'], l.status); [].forEach.call(F.status.options, function (o) { o.textContent = STATUS[o.value]; });
      F.type = sel('type', TYPES, l.type);
      F.disposition = sel('disposition', DISPS, l.disposition || '');
      F.city = inp('city', l.city, { required: true, list: 'cities' });
      F.district = inp('district', l.district, { placeholder: 'Např. Drahovice' });
      F.area = inp('area_m2', l.area_m2, { inputmode: 'numeric' });
      F.floor = inp('floor', l.floor, { placeholder: 'Např. 3. patro' });
      F.rent = inp('rent_czk', l.rent_czk, { inputmode: 'numeric', required: true });
      F.fees = inp('fees_czk', l.fees_czk, { inputmode: 'numeric' });
      F.deposit = inp('deposit_czk', l.deposit_czk, { inputmode: 'numeric' });
      F.avail = inp('available_from', l.available_from, { type: 'date' });
      F.furn = sel('furnished', ['', 'ano', 'castecne', 'ne'], l.furnished || ''); [].forEach.call(F.furn.options, function (o) { o.textContent = { '': '—', ano: 'Zařízeno', castecne: 'Částečně zařízeno', ne: 'Nezařízeno' }[o.value]; });
      F.energy = sel('energy_class', ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], l.energy_class || '');
      F.contact = sel('contact', ['sona', 'vit'], l.contact || 'sona'); [].forEach.call(F.contact.options, function (o) { o.textContent = o.value === 'sona' ? 'Soňa Petříková (603 382 392)' : 'Vít Čirik (776 686 776)'; });
      F.street = inp('street', l.street, { placeholder: 'Interní, na webu se nezobrazuje' });
      F.desc = h('textarea', { name: 'description', rows: 9, placeholder: 'Popis nemovitosti. Odstavce oddělte prázdným řádkem.' }); F.desc.value = l.description || '';
      var dl = h('datalist', { id: 'cities' }, CITIES.map(function (c) { return h('option', { value: c }); }));

      var chips = h('div', { class: 'chips' }), known = {};
      FEATS.forEach(function (f) { known[f] = 1; var cb = h('input', { type: 'checkbox', value: f }); cb.checked = (l.features || []).indexOf(f) > -1; chips.appendChild(h('label', {}, [cb, f])); });
      F.extra = inp('extra', (l.features || []).filter(function (f) { return !known[f]; }).join(', '), { 'aria-label': 'Další vybavení', placeholder: 'Další vybavení, oddělte čárkou' });

      var grid = h('div', { class: 'ph' }), fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true });
      function drawPhotos() {
        grid.replaceChildren.apply(grid, photos.map(function (p, i) {
          var fig = h('figure', {}, [h('img', { src: photoUrl(p.path), alt: p.alt || '' }),
            h('div', { class: 'bar' }, [
              h('button', { type: 'button', title: 'Posunout doleva', text: '←', onclick: function () { if (i > 0) { photos.splice(i - 1, 0, photos.splice(i, 1)[0]); drawPhotos(); } } }),
              h('button', { type: 'button', title: 'Posunout doprava', text: '→', onclick: function () { if (i < photos.length - 1) { photos.splice(i + 1, 0, photos.splice(i, 1)[0]); drawPhotos(); } } }),
              h('button', { type: 'button', title: 'Odstranit', text: '✕', onclick: function () { toDelete.push(p.path); photos.splice(i, 1); drawPhotos(); } })])]);
          if (i === 0) fig.appendChild(h('span', { class: 'cover', text: 'Titulní' }));
          return fig;
        }));
      }
      fileIn.addEventListener('change', function () {
        var files = [].slice.call(fileIn.files); if (!files.length) return;
        toast('Nahrávám ' + files.length + ' fotek…', 60000);
        files.reduce(function (chain, f) {
          return chain.then(function () {
            return resize(f).then(function (blob) {
              var path = l.id + '/' + uuid() + '.jpg';
              return sb.storage.from('listings').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }).then(function (u) {
                if (u.error) throw u.error; photos.push({ path: path, alt: '' }); drawPhotos();
              });
            });
          });
        }, Promise.resolve()).then(function () { toast('Fotky nahrány. Nezapomeňte nabídku uložit.'); fileIn.value = ''; }).catch(function (e) { toast('Chyba při nahrávání: ' + e.message, 8000); });
      });
      drawPhotos();

      var save = function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var feats = [].filter.call(chips.querySelectorAll('input'), function (c) { return c.checked; }).map(function (c) { return c.value; })
          .concat(F.extra.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean));
        if (F.status.value === 'published' && !photos.length && !confirm('Nabídka nemá žádné fotografie. Opravdu zveřejnit?')) return;
        var row = {
          id: l.id, title: F.title.value.trim(), status: F.status.value, type: F.type.value, disposition: F.disposition.value || null,
          city: F.city.value.trim(), district: F.district.value.trim() || null, street: F.street.value.trim() || null,
          area_m2: num(F.area.value), floor: F.floor.value.trim() || null, rent_czk: num(F.rent.value), fees_czk: num(F.fees.value), deposit_czk: num(F.deposit.value),
          available_from: F.avail.value || null, furnished: F.furn.value || null, energy_class: F.energy.value || null,
          description: F.desc.value.trim() || null, features: feats, photos: photos, contact: F.contact.value
        };
        if (row.rent_czk == null) { toast('Vyplňte nájemné.'); return; }
        row.slug = l.slug || (slugify(row.title + ' ' + row.city) + '-' + l.id.slice(0, 6));
        if (row.status === 'published' && !l.published_at) row.published_at = new Date().toISOString();
        var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        sb.from('listings').upsert(row).then(function (r) {
          btn.disabled = false;
          if (r.error) { toast('Uložení selhalo: ' + r.error.message, 9000); return; }
          if (toDelete.length) sb.storage.from('listings').remove(toDelete);
          toast('Uloženo. Web se přegeneruje během 1–2 minut.', 7000); listView();
        });
      };
      var del = isNew ? null : h('button', { type: 'button', class: 'btn danger', text: 'Smazat nabídku', onclick: function () {
        if (!confirm('Opravdu trvale smazat tuto nabídku včetně fotek? Pokud ji jen nechcete zobrazovat, nastavte stav Archiv.')) return;
        var paths = (l.photos || []).map(function (p) { return p.path; });
        sb.from('listings').delete().eq('id', l.id).then(function (r) {
          if (r.error) { toast('Smazání selhalo: ' + r.error.message); return; }
          if (paths.length) sb.storage.from('listings').remove(paths);
          toast('Smazáno.'); listView();
        });
      } });
      [h('h2', { text: isNew ? 'Nová nabídka' : 'Úprava nabídky', style: 'margin-bottom:18px' }),
        h('div', { class: 'g2' }, [fld('Nadpis nabídky', F.title), fld('Stav', F.status, 'Na webu jsou jen nabídky ve stavu „Zveřejněno“.')]),
        h('div', { class: 'g3' }, [fld('Typ nemovitosti', F.type), fld('Dispozice', F.disposition), fld('Plocha (m²)', F.area)]),
        h('div', { class: 'g3' }, [fld('Město', F.city), fld('Městská část / čtvrť', F.district), fld('Podlaží', F.floor)]),
        h('div', { class: 'g3' }, [fld('Nájemné (Kč / měsíc)', F.rent), fld('Zálohy na služby (Kč / měsíc)', F.fees), fld('Jistota / kauce (Kč)', F.deposit)]),
        h('div', { class: 'g3' }, [fld('Dostupné od', F.avail, 'Prázdné = ihned / dle dohody'), fld('Vybavení bytem', F.furn), fld('Energetická třída (PENB)', F.energy)]),
        h('div', { class: 'g2' }, [fld('Kontaktní osoba', F.contact), fld('Ulice (interní)', F.street)]),
        fld('Popis', F.desc), h('label', { text: 'Vybavení a výhody', style: 'margin-top:14px' }), chips, F.extra, dl,
        h('label', { text: 'Fotografie', style: 'margin-top:18px' }), h('p', { class: 'hint', text: 'První fotka je titulní. Fotky se při nahrání automaticky zmenší.' }), grid, fileIn,
        h('div', { class: 'actions' }, [h('button', { class: 'btn', type: 'submit', text: 'Uložit' }), h('button', { class: 'btn out', type: 'button', text: 'Zpět', onclick: listView })].concat(del ? [del] : []))
      ].forEach(function (n) { form.appendChild(n); });
      form.addEventListener('submit', save);
      app.replaceChildren(form);
    });
  }

  // ---------- start ----------
  function start() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { loginView(); return; }
      who.replaceChildren(document.createTextNode(s.user.email + ' · '), h('a', { href: '#', text: 'Odhlásit', style: 'color:var(--gold-l)', onclick: function (e) { e.preventDefault(); sb.auth.signOut().then(function () { loginView(); }); } }));
      listView();
    });
  }
  start();
})();
