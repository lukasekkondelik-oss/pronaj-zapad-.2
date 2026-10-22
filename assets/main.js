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
      d.zdroj=location.pathname;
      var ep=f.getAttribute('data-endpoint');
      if(ep){
        var btn=f.querySelector('button[type=submit]');btn.disabled=true;
        fetch(ep,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(d)})
          .then(function(r){if(!r.ok)throw 0;f.reset();show('Děkujeme, nabídku jsme přijali. Ozveme se vám co nejdříve.','ok')})
          .catch(function(){show('Odeslání se nepovedlo. Zavolejte prosím na 603 382 392 nebo napište na alfaestate@alfaestate.cz.','err')})
          .then(function(){btn.disabled=false});
      }else{
        // bez backendu: otevře e-mail s předvyplněnou zprávou
        var body=Object.keys(d).map(function(k){return k+': '+d[k]}).join('\n');
        location.href='mailto:alfaestate@alfaestate.cz?subject='+encodeURIComponent('Nabídka pronájmu – '+(d.mesto||''))+'&body='+encodeURIComponent(body);
        show('Otevřeli jsme vám e-mail s vyplněnou nabídkou. Stačí ho odeslat.','ok');
      }
    });
  });
})();
