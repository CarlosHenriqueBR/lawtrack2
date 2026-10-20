import { createFileRoute } from "@tanstack/react-router";

// Lawtrack browser tracker. First-party cookie + localStorage ids, no fingerprinting.
// Consent: add data-consent="required" and call window.Lawtrack.grantConsent() after the visitor accepts.
const SCRIPT = `(function(){
  var cs=document.currentScript; if(!cs) return;
  var FUNNEL=cs.getAttribute('data-funnel'); if(!FUNNEL) return;
  var API=new URL(cs.src).origin+'/api/public/track';
  var needConsent=cs.getAttribute('data-consent')==='required';
  var started=false;
  function rid(n){var a='abcdefghijklmnopqrstuvwxyz0123456789',s='';var r=new Uint8Array(n);crypto.getRandomValues(r);for(var i=0;i<n;i++)s+=a[r[i]%36];return s;}
  function gc(k){var m=document.cookie.match('(?:^|; )'+k+'=([^;]*)');return m?decodeURIComponent(m[1]):null;}
  function sc(k,v,sec){document.cookie=k+'='+encodeURIComponent(v)+';path=/;max-age='+sec+';SameSite=Lax'+(location.protocol==='https:'?';Secure':'');}
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  var qs=new URLSearchParams(location.search);
  function ids(){
    var vid=qs.get('lt_vid')||gc('lt_vid')||ls('lt_vid'); var returning=!!vid;
    if(!vid) vid='v'+rid(15);
    sc('lt_vid',vid,31536000); ls('lt_vid',vid);
    var sid=qs.get('lt_sid')||gc('lt_sid'); if(!sid) sid='s'+rid(15);
    sc('lt_sid',sid,1800);
    return {vid:vid,sid:sid,returning:returning};
  }
  var P=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ttclid','tt_campaign','tt_adset','tt_ad'];
  function attrib(){var o={};P.forEach(function(k){var v=qs.get(k)||ls('lt_'+k);if(qs.get(k))ls('lt_'+k,qs.get(k));if(v)o[k]=v;});return o;}
  function send(type){
    var i=ids(); var body={funnel_id:FUNNEL,visitor_id:i.vid,session_key:i.sid,event_id:'LT_EVT_'+rid(12),type:type,url:location.href,
      referrer:document.referrer||null,language:navigator.language,screen:screen.width+'x'+screen.height,returning:i.returning};
    var a=attrib(); for(var k in a) body[k]=a[k];
    var data=JSON.stringify(body);
    if(type==='leave'&&navigator.sendBeacon){navigator.sendBeacon(API,new Blob([data],{type:'text/plain'}));return;}
    post(data,type==='page_view');
  }
  // Failed page views are buffered and resent later (same event_id → no duplicates).
  function buf(v){try{if(v===undefined)return JSON.parse(localStorage.getItem('lt_buf')||'[]');localStorage.setItem('lt_buf',JSON.stringify(v.slice(-20)));}catch(e){return [];}}
  function post(data,keep){
    fetch(API,{method:'POST',body:data,headers:{'Content-Type':'text/plain'},keepalive:true})
      .then(function(r){if(r.status>=500)throw 0;})
      .catch(function(){if(keep){var b=buf();b.push(data);buf(b);}});
  }
  function flush(){var b=buf();if(!b.length)return;buf([]);b.forEach(function(d){post(d,true);});}
  function start(){
    if(started) return; started=true;
    flush(); send('page_view');
    setInterval(function(){ if(document.visibilityState==='visible') send('heartbeat'); },15000);
    var push=history.pushState; history.pushState=function(){push.apply(this,arguments);setTimeout(function(){send('page_view');},0);};
    addEventListener('popstate',function(){send('page_view');});
    addEventListener('pagehide',function(){send('leave');});
    // Keep ids when visitors move to a checkout on another domain.
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;try{var u=new URL(a.href);if(u.host!==location.host){var i=ids();u.searchParams.set('lt_vid',i.vid);u.searchParams.set('lt_sid',i.sid);if(/digistore24/i.test(u.host)&&!u.searchParams.get('custom'))u.searchParams.set('custom',i.sid);a.href=u.toString();}}catch(x){}},true);
  }
  window.Lawtrack={grantConsent:function(){ls('lt_consent','1');start();}};
  if(!needConsent||ls('lt_consent')==='1') start();
})();`;

export const Route = createFileRoute("/api/public/tracker.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(SCRIPT, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
