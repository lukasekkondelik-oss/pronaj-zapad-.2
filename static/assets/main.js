(function(){
  var b=document.querySelector('.burger'),n=document.querySelector('.nav');
  if(b&&n){b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});
    n.addEventListener('click',function(e){if(e.target.tagName==='A'){n.classList.remove('open');b.setAttribute('aria-expanded','false')}})}

  document.querySelectorAll('form[data-lead]').forEach(function(f){
    var msg=f.querySelector('.msg');
    function show(t,c){msg.className='msg '+c;msg.textContent=t}
    f.addEventListener('submit',function(e){
      e.preventDefault();
      if(f.querySelector('[name=web]').value){return}            // honeypot
      if(!f.checkValidity()){f.reportValidity();return}
      var d={};new FormData(f).forEach(function(v,k){if(k!=='web')d[k]=v});
      d.zdroj=location.pathname;d.odeslano=new Date().toISOString();
      var ep=f.getAttribute('data-endpoint');
      if(ep){
        var btn=f.querySelector('button[type=submit]');btn.disabled=true;
        fetch(ep,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(d)})
          .then(function(r){if(!r.ok)throw 0;f.reset();show(f.getAttribute('data-success')||'Děkujeme, nabídku jsme přijali. Ozveme se vám co nejdříve.','ok')})
          .catch(function(){show('Odeslání se nepovedlo. Zavolejte prosím na 603 382 392 nebo napište na alfaestate@alfaestate.cz.','err')})
          .then(function(){btn.disabled=false});
      }else{
        // bez backendu: otevře e-mail s předvyplněnou zprávou
        var body=Object.keys(d).map(function(k){return k+': '+d[k]}).join('\n');
        location.href='mailto:alfaestate@alfaestate.cz?subject='+encodeURIComponent(f.getAttribute('data-subject')||('Nabídka pronájmu – '+(d.mesto||'')))+'&body='+encodeURIComponent(body);
        show('Otevřeli jsme vám e-mail s vyplněnou nabídkou. Stačí ho odeslat.','ok');
      }
    });
  });

  // filtr nabídek (karty jsou staticky v HTML, JS je jen skrývá)
  var ff=document.querySelector('[data-filters]');
  if(ff){
    var cards=[].slice.call(document.querySelectorAll('[data-list] .lcard')),cnt=document.querySelector('[data-count]'),emp=document.querySelector('[data-empty]');
    var apply=function(){
      var v={};ff.querySelectorAll('[data-f]').forEach(function(el){v[el.getAttribute('data-f')]=el.value.trim()});
      var max=parseInt(v.rent.replace(/\s/g,''),10),n=0;
      cards.forEach(function(c){
        var ok=(!v.city||c.dataset.city===v.city)&&(!v.type||c.dataset.type===v.type)&&(!v.disp||c.dataset.disp===v.disp)&&(isNaN(max)||+c.dataset.rent<=max);
        c.hidden=!ok;if(ok)n++});
      cnt.textContent=n+' '+(n===1?'nabídka':(n>1&&n<5?'nabídky':'nabídek'));
      emp.hidden=n>0};
    ff.addEventListener('input',apply);ff.addEventListener('submit',function(e){e.preventDefault()});apply();
  }
})();
