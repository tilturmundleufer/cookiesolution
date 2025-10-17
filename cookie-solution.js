

(() => {
  const VERSION = "1.0.0";
  const CONFIG = {
    showOnlyInRegions: ["EU","UK","CH"], // logical indicator; set geoEndpoint for real gating
    geoEndpoint: null, // e.g. "https://ipapi.co/json/" returning { country_code }
    euCountryCodes: [
      "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO" // EEA ext.
    ],
    ukCodes: ["GB"],
    chCodes: ["CH"],
    categories: ["essential","analytics","functional","marketing"],
    cookie: {
      name: "cs_consent",
      days: 365, // 12 months ≈ 365d
      domain: inferCookieDomain(window.location.hostname), // eTLD+1 best-effort, override if needed
      sameSite: "Lax",
      secure: true
    },
    storageKey: "cs_consent_log",
    i18n: {
      de: {
        banner_title: "Cookies & Datenschutz",
        banner_desc: "Wir verwenden Cookies, um unsere Website zu betreiben und zu verbessern. Sie können Ihre Auswahl anpassen.",
        banner_prefs: "Einstellungen",
        btn_accept: "Alle akzeptieren",
        btn_reject: "Nur Essenzielle",
        btn_save: "Auswahl speichern",
        prefs_title: "Cookie-Einstellungen",
        prefs_intro: "Wählen Sie aus, welche Kategorien wir verwenden dürfen. Essenzielle Cookies sind immer aktiv.",
        cat_essential: "Essenziell",
        cat_essential_desc: "Erforderlich für die Grundfunktionen der Website.",
        cat_analytics: "Analytics",
        cat_analytics_desc: "Hilft uns, die Leistung zu messen (z. B. GA4, Hotjar).",
        cat_functional: "Funktional",
        cat_functional_desc: "Komfortfunktionen & eingebettete Medien (z. B. YouTube, Karten).",
        cat_marketing: "Marketing",
        cat_marketing_desc: "Personalisierte Werbung & Tracking durch Dritte.",
        manage_label: "Cookie-Einstellungen",
        embed_blocked: "Dieses eingebettete Medium ist blockiert, bis Sie <em>Funktional</em> erlauben.",
        enable_functional: "Funktionale Cookies erlauben"
      },
      en: {
        banner_title: "Cookies & Privacy",
        banner_desc: "We use cookies to operate and improve our site. You can adjust your choices.",
        banner_prefs: "Preferences",
        btn_accept: "Accept all",
        btn_reject: "Essentials only",
        btn_save: "Save selection",
        prefs_title: "Cookie settings",
        prefs_intro: "Choose which categories we may use. Essential cookies are always on.",
        cat_essential: "Essential",
        cat_essential_desc: "Required for basic site functionality.",
        cat_analytics: "Analytics",
        cat_analytics_desc: "Helps us measure performance (e.g. GA4, Hotjar).",
        cat_functional: "Functional",
        cat_functional_desc: "Convenience & embedded media (e.g. YouTube, maps).",
        cat_marketing: "Marketing",
        cat_marketing_desc: "Personalised advertising & third‑party tracking.",
        manage_label: "Cookie settings",
        embed_blocked: "This embedded media is blocked until you allow <em>Functional</em>.",
        enable_functional: "Allow functional cookies"
      }
    }
  };

  // ---- Utilities ----
  function inferCookieDomain(host){
    try{
      const parts = host.split(".");
      if(parts.length <= 2) return host; // already eTLD+1
      // naive eTLD+1: last two labels; override in CONFIG.cookie.domain if needed
      const tld2 = ["co.uk","ac.uk","gov.uk","com.au","com.br"]; // common exceptions
      const last2 = parts.slice(-2).join(".");
      const last3 = parts.slice(-3).join(".");
      if(tld2.includes(last2)) return last3; // e.g., sub.example.co.uk -> example.co.uk
      return last2;
    }catch(e){ return host; }
  }
  function setCookie(name,value,days,domain,secure=true,sameSite="Lax"){
    const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `expires=${d.toUTCString()}`,
      `path=/`,
      domain ? `domain=.${domain}` : "",
      secure ? `Secure` : "",
      `SameSite=${sameSite}`
    ].filter(Boolean);
    document.cookie = parts.join("; ");
  }
  function getCookie(name){
    return document.cookie.split("; ").reduce((acc,c)=>{
      const [k,...rest] = c.split("="); if(k===name){ acc=decodeURIComponent(rest.join("=")); }
      return acc;
    },"");
  }
  function onReady(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded",fn); }
  function $(sel,root=document){ return root.querySelector(sel); }
  function $$(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

  // ---- I18N ----
  function currentLang(){
    const htmlLang = document.documentElement.lang || "";
    const navLang = navigator.language || "";
    return /^de/i.test(htmlLang||navLang) ? "de" : "en";
  }
  function applyI18n(){
    const dict = CONFIG.i18n[currentLang()];
    $$('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      if(dict[key]) el.innerHTML = dict[key];
    });
  }

  // ---- Consent State ----
  const defaultState = { version: VERSION, essential: true, analytics: false, functional: false, marketing: false, ts: Date.now(), region: "unknown" };
  function readState(){
    try{ return JSON.parse(getCookie(CONFIG.cookie.name)) || null; }catch(e){ return null; }
  }
  function writeState(state){
    const value = JSON.stringify(state);
    setCookie(CONFIG.cookie.name, value, CONFIG.cookie.days, CONFIG.cookie.domain, CONFIG.cookie.secure, CONFIG.cookie.sameSite);
    // local log for audit
    try{
      const log = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "[]");
      log.push({ ts: Date.now(), state });
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(log));
    }catch(e){}
  }

  // ---- Google Consent Mode v2 ----
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  function applyGcmFrom(state){
    const gpc = (navigator.globalPrivacyControl === true);
    // Effective booleans (deny if GPC and user hasn't opted in explicitly)
    const analytics = state.analytics && !gpc;
    const marketing = state.marketing && !gpc;
    const functional = state.functional; // maps to functionality/security storage when applicable
    gtag('consent','update',{
      'ad_storage': marketing ? 'granted' : 'denied',
      'ad_user_data': marketing ? 'granted' : 'denied',
      'ad_personalization': marketing ? 'granted' : 'denied',
      'analytics_storage': analytics ? 'granted' : 'denied',
      'functionality_storage': functional ? 'granted' : 'denied',
      'security_storage': 'granted' // recommended to keep essential security allowed
    });
  }
  // set defaults ASAP (denied except security)
  gtag('consent','default',{
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'denied',
    'security_storage': 'granted'
  });

  // ---- Script/Embed (un)blocking by category ----
  function unleashScripts(state){
    CONFIG.categories.forEach(cat=>{
      if(cat==='essential') return; // always allowed, but we only transform for non-essentials
      if(state[cat]){
        // Activate any pending scripts for this category
        $$(`script[type="text/plain"][data-category="${cat}"]`).forEach(s=>{
          const n = document.createElement('script');
          // copy attributes except type/data-category
          for(const {name,value} of Array.from(s.attributes)){
            if(name==='type' || name==='data-category') continue; n.setAttribute(name,value);
          }
          if(s.src){ n.src = s.src; } else { n.text = s.text || s.innerHTML; }
          s.parentNode.replaceChild(n,s);
        });
        // Activate iframes marked for this category
        $$(`iframe[data-category="${cat}"][data-blocked="true"]`).forEach(f=>{
          const src = f.getAttribute('data-src');
          if(src){ f.setAttribute('src', src); f.removeAttribute('data-blocked'); }
          const wrapper = f.closest('.cs-embed-wrapper');
          if(wrapper){ const ph = wrapper.querySelector('.cs-embed-placeholder'); if(ph) ph.remove(); }
        });
      }
    });
  }

  function prepareEmbeds(){
    // Convert iframes with data-category to blocked state and show placeholder when not allowed
    CONFIG.categories.forEach(cat=>{
      if(cat==='essential') return;
      $$(`iframe[data-category="${cat}"]:not([data-prepared="1"])`).forEach(f=>{
        f.setAttribute('data-prepared','1');
        const allowed = currentState()[cat];
        const src = f.getAttribute('src');
        if(!allowed && src){
          f.setAttribute('data-src', src);
          f.setAttribute('data-blocked','true');
          f.removeAttribute('src');
          // wrap and inject placeholder
          const wrapper = document.createElement('div');
          wrapper.className = 'cs-embed-wrapper';
          f.parentNode.insertBefore(wrapper, f);
          wrapper.appendChild(f);
          const tpl = document.getElementById('cs-embed-placeholder-template');
          if(tpl){
            const node = tpl.content.cloneNode(true);
            wrapper.appendChild(node);
          }
        }
      });
    });
  }

  // ---- Geo gating (optional) ----
  async function inTargetRegion(){
    if(!CONFIG.geoEndpoint) return true; // show banner everywhere if no endpoint configured
    try{
      const res = await fetch(CONFIG.geoEndpoint, { credentials: 'omit' });
      const data = await res.json();
      const cc = (data.country_code || data.country || "").toUpperCase();
      if(CONFIG.euCountryCodes.includes(cc)) return true;
      if(CONFIG.ukCodes.includes(cc)) return true;
      if(CONFIG.chCodes.includes(cc)) return true;
      return false;
    }catch(e){ return true; } // fail-open to show banner
  }

  // ---- UI control ----
  function openBanner(){ $('#cs-banner').hidden = false; }
  function closeBanner(){ $('#cs-banner').hidden = true; }
  function openPrefs(){ 
    $('#cs-prefs').hidden = false; 
    updateUISwitches(currentState());
    trapFocus('#cs-prefs'); 
  }
  function closePrefs(){ $('#cs-prefs').hidden = true; releaseFocus(); }
  function showManage(){ const m = $('#cs-manage'); if(m) m.hidden = false; }

  // Basic focus trap
  let lastFocus = null;
  function trapFocus(sel){
    const root = $(sel); if(!root) return;
    lastFocus = document.activeElement;
    const focusables = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0]; const last = focusables[focusables.length-1];
    root.addEventListener('keydown', function(e){
      if(e.key==='Tab'){
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
      if(e.key==='Escape'){ closePrefs(); }
    });
    setTimeout(()=>{ if(first) first.focus(); }, 0);
  }
  function releaseFocus(){ if(lastFocus) lastFocus.focus(); }

  // ---- State helpers ----
  let _stateCache = null;
  function currentState(){ return _stateCache || defaultState; }
  function updateUISwitches(state){
    // Update all category switches based on current state
    document.querySelectorAll('[data-cs-cat]').forEach(inp=>{
      const cat = inp.getAttribute('data-cs-cat');
      if(cat==='essential') return; // always true
      inp.checked = !!state[cat];
    });
  }
  function saveAndApply(newState){
    _stateCache = newState;
    writeState(newState);
    applyGcmFrom(newState);
    unleashScripts(newState);
    prepareEmbeds();
    updateUISwitches(newState);
    closeBanner();
    closePrefs();
    showManage();
  }

  // ---- Initialization ----
  onReady(async ()=>{
    applyI18n();

    // Wire buttons
    document.body.addEventListener('click', (e)=>{
      const t = e.target.closest('[data-cs]'); if(!t) return;
      const action = t.getAttribute('data-cs');
      if(action==='open-prefs'){ openPrefs(); }
      if(action==='close'){ closePrefs(); }
      if(action==='accept'){
        const s = { ...defaultState, analytics: true, functional: true, marketing: true, ts: Date.now() };
        saveAndApply(s);
      }
      if(action==='reject'){
        const s = { ...defaultState, analytics: false, functional: false, marketing: false, ts: Date.now() };
        saveAndApply(s);
      }
      if(action==='save'){
        const s = { ...defaultState };
        document.querySelectorAll('[data-cs-cat]').forEach(inp=>{
          const cat = inp.getAttribute('data-cs-cat');
          if(cat==='essential') return; // always true
          s[cat] = !!inp.checked;
        });
        s.ts = Date.now();
        saveAndApply(s);
      }
      if(action==='enable-functional'){
        const s = { ...currentState(), functional: true, ts: Date.now() };
        saveAndApply(s);
      }
    });

    // Restore state
    const stored = readState();
    if(stored){
      _stateCache = { ...defaultState, ...stored };
      applyGcmFrom(_stateCache);
      unleashScripts(_stateCache);
      prepareEmbeds();
      showManage();
      return; // Do not show banner again
    }

    // Geo gating (optional – defaults to show)
    const show = await inTargetRegion();
    if(show){ openBanner(); }

    // Prepare blocked embeds even before consent
    prepareEmbeds();
  });
})();