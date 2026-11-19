(function () {
  'use strict';
  var API = '/api/podklady', MAX = 12, MAX_SRC = 40 * 1024 * 1024;
  var PHONE = '603 382 392';

  // zmenší fotku na max. 1600 px a převede na JPEG (rychlejší nahrání i web, ~300–600 kB)
  function resize(file) {
    return new Promise(function (res, rej) {
      if (file.size > MAX_SRC) return rej(new Error('Soubor je příliš velký'));
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Převod selhal')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Formát nejde načíst')); };
      img.src = u;
    });
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; });
    });
  }

  document.querySelectorAll('form[data-podklady]').forEach(function (f) {
    var input = f.querySelector('[data-fotky]'), grid = f.querySelector('[data-prev]'), msg = f.querySelector('.msg'),
        btn = f.querySelector('button[type=submit]'), opened = Date.now(), items = [], busy = false;
    var prog = document.createElement('div'); prog.className = 'prog'; prog.innerHTML = '<i></i>'; btn.parentNode.insertBefore(prog, msg);
    var bar = prog.firstChild;

    function show(t, c) { msg.className = 'msg ' + c; msg.textContent = t; }
    function setProgress(p) { prog.style.display = p == null ? 'none' : 'block'; bar.style.width = (p || 0) + '%'; }
    function draw() {
      grid.replaceChildren();
      items.forEach(function (it, i) {
        var fig = document.createElement('figure'), im = document.createElement('img'), x = document.createElement('button');
        im.src = it.url; im.alt = 'Náhled fotky ' + (i + 1);
        x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Odebrat fotku ' + (i + 1));
        x.addEventListener('click', function () { URL.revokeObjectURL(it.url); items.splice(i, 1); draw(); });
        fig.appendChild(im); fig.appendChild(x); grid.appendChild(fig);
      });
    }

    input.addEventListener('change', function () {
      var files = [].slice.call(input.files), skipped = 0, bad = 0;
      input.value = '';
      files.reduce(function (chain, file) {
        return chain.then(function () {
          if (items.length >= MAX) { skipped++; return; }
          return resize(file).then(function (blob) { items.push({ blob: blob, url: URL.createObjectURL(blob) }); draw(); }).catch(function () { bad++; });
        });
      }, Promise.resolve()).then(function () {
        if (skipped) show('Přidat jde nejvýše ' + MAX + ' fotek.', 'err');
        else if (bad) show('Některé soubory nešlo načíst jako fotku (' + bad + '). Zkuste je uložit jako JPEG.', 'err');
        else msg.className = 'msg';
      });
    });

    function upload(id, token, onDone) {
      var next = 0, failed = 0;
      function one(i, retry) {
        return fetch(API + '?akce=foto&id=' + encodeURIComponent(id) + '&n=' + (i + 1), { method: 'PUT', headers: { 'X-Token': token, 'Content-Type': 'image/jpeg' }, body: items[i].blob })
          .then(function (r) { if (!r.ok) throw new Error('upload'); })
          .catch(function (e) { if (retry) return one(i, false); failed++; });
      }
      function worker() {
        if (next >= items.length) return Promise.resolve();
        var i = next++;
        return one(i, true).then(function () { onDone(); return worker(); });
      }
      return Promise.all([worker(), worker(), worker()]).then(function () { return failed; });
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var d = {}; new FormData(f).forEach(function (v, k) { if (k !== 'cf-turnstile-response' && k !== 'fotky') d[k] = v; });
      d.souhlas = f.querySelector('[name=souhlas]').checked;
      d.zdroj = location.pathname; d.otevreno = opened; d.fotek = items.length;
      var t = f.querySelector('[name=cf-turnstile-response]');
      if (f.querySelector('.cf-turnstile')) {
        if (!t || !t.value) { show('Potvrďte prosím, že nejste robot.', 'err'); return; }
        d.turnstile = t.value;
      }
      busy = true; btn.disabled = true; show('Odesílám…', 'ok'); setProgress(5);
      var fail = function (text) {
        busy = false; btn.disabled = false; setProgress(null);
        if (window.turnstile && f.querySelector('.cf-turnstile')) { try { window.turnstile.reset(); } catch (x) {} }
        show(text || 'Odeslání se nepovedlo. Zkuste to prosím znovu, nebo zavolejte na ' + PHONE + '.', 'err');
      };
      post(API, d).then(function (r) {
        if (r.__status === 422) return fail('Zkontrolujte prosím vyplněné údaje (jméno, telefon, e-mail).');
        if (!r.ok) return fail(r.chyba && r.__status < 500 ? r.chyba : null);
        var done = 0, total = items.length;
        show(total ? 'Nahrávám fotky…' : 'Odesílám…', 'ok');
        return upload(r.id, r.token, function () { done++; setProgress(10 + 80 * done / Math.max(1, total)); }).then(function (failed) {
          if (failed) return fail('Nepodařilo se nahrát ' + failed + ' fotek. Zkuste to prosím znovu, nebo zavolejte na ' + PHONE + '.');
          setProgress(95);
          return post(API + '?akce=dokoncit', { id: r.id, token: r.token }).then(function (x) {
            if (!x.ok) return fail();
            items.forEach(function (it) { URL.revokeObjectURL(it.url); });
            items = []; draw(); f.reset(); busy = false; btn.disabled = false; setProgress(null);
            if (window.turnstile && f.querySelector('.cf-turnstile')) { try { window.turnstile.reset(); } catch (y) {} }
            show('Děkujeme, vaše údaje i fotky jsme přijali. Ozveme se vám co nejdříve.', 'ok');
          });
        });
      }).catch(function () { fail(); });
    });
  });

  // ---------- „Mám zájem o prohlídku“ (formulář pod nabídkou) ----------
  document.querySelectorAll('form[data-zajemce]').forEach(function (f) {
    var msg = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]'), opened = Date.now(), busy = false;
    function show(t, c) { msg.className = 'msg ' + c; msg.textContent = t; }
    function resetCaptcha() { if (window.turnstile && f.querySelector('.cf-turnstile')) { try { window.turnstile.reset(); } catch (x) {} } }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var d = {}; new FormData(f).forEach(function (v, k) { if (k !== 'cf-turnstile-response') d[k] = v; });
      d.souhlas = f.querySelector('[name=souhlas]').checked;
      d.zdroj = location.pathname; d.otevreno = opened;
      if (f.querySelector('.cf-turnstile')) {
        var t = f.querySelector('[name=cf-turnstile-response]');
        if (!t || !t.value) { show('Potvrďte prosím, že nejste robot.', 'err'); return; }
        d.turnstile = t.value;
      }
      busy = true; btn.disabled = true; show('Odesílám…', 'ok');
      post('/api/poptavka', d).then(function (r) {
        busy = false; btn.disabled = false;
        if (r.ok) { f.reset(); resetCaptcha(); show('Děkujeme, poptávku jsme přijali. Brzy se vám ozveme a domluvíme prohlídku.', 'ok'); return; }
        resetCaptcha();
        if (r.__status === 422) show('Zkontrolujte prosím vyplněné údaje (jméno, telefon, e-mail).', 'err');
        else show((r.chyba && r.__status < 500 ? r.chyba : 'Odeslání se nepovedlo.') + ' Zavolejte nám prosím na ' + PHONE + '.', 'err');
      }).catch(function () { busy = false; btn.disabled = false; resetCaptcha(); show('Odeslání se nepovedlo. Zavolejte nám prosím na ' + PHONE + '.', 'err'); });
    });
  });
})();
