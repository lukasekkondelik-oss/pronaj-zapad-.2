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
})();
