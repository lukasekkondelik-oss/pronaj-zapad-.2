(function(){
  var b=document.querySelector('.burger'),n=document.querySelector('.nav');
  if(b&&n){b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});
    n.addEventListener('click',function(e){if(e.target.tagName==='A'){n.classList.remove('open');b.setAttribute('aria-expanded','false')}})}

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

  // živá adresa: při scrollování se mění #kotva podle sekce, ve které jste (bez skoku a bez plnění historie)
  (function(){
    var secs=[].slice.call(document.querySelectorAll('main section[id]'));
    var links=[].slice.call(document.querySelectorAll('.nav a'));
    var path=location.pathname;
    links.forEach(function(a){var h=a.getAttribute('href');if(h===path)a.setAttribute('aria-current','page')});
    if(secs.length<2||!window.history||!history.replaceState)return;
    var group={'pro-majitele':'jak-to-funguje'},cur=null,tick=false;
    function setActive(id){
      links.forEach(function(a){
        var h=a.getAttribute('href')||'',m=h.match(/#(.+)$/);
        if(!m)return;var key=group[id]||id;
        if(id&&m[1]===key&&(h.charAt(0)==='#'||h.split('#')[0]===path))a.setAttribute('aria-current','location');
        else if(a.getAttribute('aria-current')==='location')a.removeAttribute('aria-current')})}
    function update(){
      tick=false;
      var line=window.innerHeight*0.35,id=null;
      for(var i=0;i<secs.length;i++){if(secs[i].getBoundingClientRect().top<=line)id=secs[i].id;else break}
      if(window.scrollY<80)id=null;
      if(id===cur)return;cur=id;setActive(id);
      try{history.replaceState(null,'',path+location.search+(id?'#'+id:''))}catch(e){}}
    window.addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(update)}},{passive:true});
    window.addEventListener('load',update);
  })();
})();
