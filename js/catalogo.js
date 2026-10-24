// Catálogo: capa, fileiras por módulo, busca, linha do tempo e painel "Mais informações".
// Dados em data/episodios.json (gerado por ferramentas/episodios.mjs). Player em js/player.js (window.Player).
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dois = n => String(n).padStart(2, '0');
  const min = s => `${Math.max(1, Math.round(s / 60))} min`;
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const IC = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  };

  let MODULOS = [];
  let PRONTOS = [];          // episódios prontos, em ordem cronológica
  const POR_ID = new Map();  // id -> episódio (com .mod)

  // ---------- progresso ----------
  function progresso() {
    try { if (window.Player && typeof window.Player.progresso === 'function') return window.Player.progresso() || {}; } catch {}
    return ler('bem-progresso') || {};
  }
  const emAndamento = p => p > 0.02 && p < 0.95;

  // ---------- mural da capa ----------
  function mural() {
    const cols = innerWidth < 700 ? 3 : 6;
    const ids = Array.from({ length: 26 }, (_, i) => dois(i + 1));
    const grupos = Array.from({ length: cols }, () => []);
    ids.forEach((id, i) => grupos[i % cols].push(id));
    const el = $('#mural');
    el.style.setProperty('--cols', cols);
    el.innerHTML = grupos.map(g => {
      const imgs = g.map(id => `<img src="img/m/${id}.jpg" alt="" width="480" height="270" decoding="async">`).join('');
      return `<div class="col">${imgs}${imgs}</div>`;
    }).join('');
  }

  // ---------- player ----------
  function paraPlayer(e) {
    return { id: e.id, arq: e.arq, titulo: e.titulo, modulo: { num: e.mod.num, nome: e.mod.titulo }, numero: e.numero, dur: e.dur, sinopse: e.sinopse };
  }
  function assistir(id) {
    const e = POR_ID.get(id);
    if (!e || !e.pronto) return;
    gravar('bem-ultimo', id);
    if (!$('#painel').hidden) fecharPainel(true);
    const ep = paraPlayer(e);
    const opcoes = { lista: PRONTOS.map(paraPlayer), aoFechar: atualizar, aoProgresso: aoProgresso };
    if (window.Player && typeof window.Player.abrir === 'function') window.Player.abrir(ep, opcoes);
    else playerProvisorio(e, opcoes);
  }
  function aoProgresso(a, b) {
    const id = typeof a === 'object' && a ? a.id : a;
    const frac = typeof a === 'object' && a ? (a.frac ?? b) : b;
    if (!id || typeof frac !== 'number') return;
    for (const el of $$(`[data-ep="${CSS.escape(id)}"] .barra i`)) el.style.width = `${Math.min(100, frac * 100)}%`;
  }

  // Provisório: só enquanto js/player.js não existir.
  function playerProvisorio(e, { aoFechar }) {
    const GH = 'https://github.com/andreimagagnaaa/biblia-em-movimento/releases/download/videos/';
    const safari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
    const q = ler('bem-qualidade') || (screen.width * (devicePixelRatio || 1) >= 1600 ? '1080' : '720');
    const palco = document.createElement('div');
    palco.className = 'fb-palco';
    palco.setAttribute('role', 'dialog');
    palco.setAttribute('aria-label', e.titulo);
    palco.innerHTML = `<button type="button">Fechar ✕</button><video controls playsinline autoplay preload="metadata" poster="${esc(e.hero)}"></video>`;
    document.body.append(palco);
    document.body.classList.add('travado');
    const v = $('video', palco);
    v.src = (safari ? '/v/' : GH) + `${e.arq}-${q}.mp4`;
    const p0 = progresso()[e.id];
    v.addEventListener('loadedmetadata', () => { if (emAndamento(p0)) v.currentTime = p0 * v.duration; }, { once: true });
    let ultimo = 0;
    const salvar = f => { const p = ler('bem-progresso') || {}; p[e.id] = f; gravar('bem-progresso', p); };
    v.addEventListener('timeupdate', () => { if (v.duration && Date.now() - ultimo > 3000) { ultimo = Date.now(); salvar(v.currentTime / v.duration); } });
    v.addEventListener('ended', () => salvar(1));
    const fechar = () => { v.pause(); v.removeAttribute('src'); v.load(); palco.remove(); document.body.classList.remove('travado'); document.removeEventListener('keydown', tecla); aoFechar && aoFechar(); };
    const tecla = ev => { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', tecla);
    $('button', palco).addEventListener('click', fechar);
    $('button', palco).focus();
  }

  // ---------- capa: botão principal e destaque ----------
  function alvoPrincipal() {
    const p = progresso();
    const ult = POR_ID.get(ler('bem-ultimo'));
    if (ult && ult.pronto) {
      if (emAndamento(p[ult.id])) return { ep: ult, rotulo: `Continuar Ep. ${ult.numero}` };
      if (p[ult.id] >= 0.95) {
        const prox = PRONTOS[PRONTOS.indexOf(ult) + 1];
        if (prox) return { ep: prox, rotulo: `Assistir Ep. ${prox.numero}` };
      }
    }
    const andamento = PRONTOS.find(e => emAndamento(p[e.id]));
    if (andamento) return { ep: andamento, rotulo: `Continuar Ep. ${andamento.numero}` };
    return { ep: PRONTOS[0], rotulo: 'Assistir' };
  }
  function capa() {
    const { ep, rotulo } = alvoPrincipal();
    if (!ep) return;
    const b = $('#btn-principal');
    $('span', b).textContent = rotulo;
    b.setAttribute('aria-label', `${rotulo}: ${ep.titulo} (Módulo ${ep.mod.num} · ${ep.mod.titulo})`);
    b.onclick = () => assistir(ep.id);
    $('#btn-info').onclick = () => abrirEpisodio(ep.id, true);
  }

  let destaqueTimer = null, destaqueI = 0, destaqueLista = [];
  function destaque() {
    const el = $('#destaque');
    destaqueLista = [...PRONTOS].sort(() => Math.random() - .5).slice(0, 6);
    if (destaqueLista.length < 2) return;
    el.hidden = false;
    el.innerHTML = `<button class="destaque-cartao" type="button"></button><div class="destaque-pontos">${destaqueLista.map((_, i) => `<button type="button" aria-label="Destaque ${i + 1}"></button>`).join('')}</div>`;
    const mostrar = i => {
      destaqueI = (i + destaqueLista.length) % destaqueLista.length;
      const e = destaqueLista[destaqueI];
      const c = $('.destaque-cartao', el);
      c.innerHTML = `<img src="${esc(e.capa)}" alt="" width="128" height="72"><span><small>Módulo ${e.mod.num} · Ep. ${e.numero}</small><b>${esc(e.titulo)}</b></span>`;
      c.dataset.info = e.id;
      c.setAttribute('aria-label', `Em destaque: ${e.titulo}. Mais informações`);
      $$('.destaque-pontos button', el).forEach((b, j) => b.setAttribute('aria-current', String(j === destaqueI)));
    };
    const trocar = i => {
      if (reduzir) return mostrar(i);
      el.classList.add('trocando');
      setTimeout(() => { mostrar(i); el.classList.remove('trocando'); }, 380);
    };
    const iniciar = () => { parar(); if (!reduzir) destaqueTimer = setInterval(() => { if (!document.hidden) trocar(destaqueI + 1); }, 7000); };
    const parar = () => clearInterval(destaqueTimer);
    mostrar(0);
    iniciar();
    el.addEventListener('mouseenter', parar);
    el.addEventListener('mouseleave', iniciar);
    el.addEventListener('focusin', parar);
    el.addEventListener('focusout', iniciar);
    el.addEventListener('click', ev => {
      const pts = $$('.destaque-pontos button', el), j = pts.indexOf(ev.target.closest('button'));
      if (j >= 0) trocar(j);
    });
  }

  // ---------- cartões e fileiras ----------
  function card(e, p) {
    const f = p[e.id] || 0;
    const barra = f > 0.02 ? `<span class="barra"><i style="width:${Math.min(100, f * 100).toFixed(1)}%"></i></span>` : '';
    return `<div class="card" role="listitem" data-ep="${e.id}">
      <button class="card-play" type="button" data-play="${e.id}" aria-label="Assistir Ep. ${e.numero}: ${esc(e.titulo)}, Módulo ${e.mod.num}">
        <span class="thumb"><img src="${esc(e.capa)}" alt="" width="640" height="360" loading="lazy" decoding="async"><span class="play">${IC.play}</span>${barra}</span>
        <span class="card-titulo"><span class="n">${e.numero}</span><span>${esc(e.titulo)}</span></span>
      </button>
      <button class="card-info" type="button" data-info="${e.id}" aria-label="Mais informações: ${esc(e.titulo)}" tabindex="-1">${IC.info}</button>
    </div>`;
  }
  function cardBreve(m) {
    const n = m.total - m.prontos;
    return `<div class="card breve" role="listitem"><button class="card-play" type="button" data-modulo="${m.num}" aria-label="Mais ${n} episódios de ${esc(m.titulo)} em breve">
      <span class="thumb"><b>+${n}</b><small>em breve</small></span><span class="card-titulo"><span>Próximos episódios</span></span></button></div>`;
  }
  function trilho(html) {
    return `<div class="trilho-wrap"><button class="seta esq" type="button" aria-label="Anteriores" tabindex="-1">${IC.esq}</button><div class="trilho" role="list">${html}</div><button class="seta dir" type="button" aria-label="Próximos" tabindex="-1">${IC.dir}</button></div>`;
  }

  function renderCatalogo() {
    const p = progresso();
    let html = '';
    const continuar = PRONTOS.filter(e => emAndamento(p[e.id]));
    const ult = ler('bem-ultimo');
    continuar.sort((a, b) => (b.id === ult) - (a.id === ult));
    if (continuar.length) html += `<section class="fileira fileira-simples" aria-labelledby="f-cont"><h2 id="f-cont">Continuar assistindo</h2>${trilho(continuar.map(e => card(e, p)).join(''))}</section>`;
    for (const m of MODULOS) {
      if (!m.prontos) continue;
      const eps = m.episodios.filter(e => e.pronto);
      html += `<section class="fileira" id="modulo-${m.num}" aria-labelledby="f-${m.num}">
        <div class="fileira-topo"><span class="fileira-num" aria-hidden="true">${dois(m.num)}</span><div><h2 id="f-${m.num}"><span class="sr">Módulo ${m.num}: </span>${esc(m.titulo)}</h2><p>${esc(m.periodo)}</p></div>
        <button class="mais" type="button" data-modulo="${m.num}">${m.prontos} de ${m.total} ›</button></div>
        ${trilho(eps.map(e => card(e, p)).join('') + (m.total > m.prontos ? cardBreve(m) : ''))}</section>`;
    }
    $('#catalogo').innerHTML = html;
    $$('.trilho').forEach(t => { setas(t); t.addEventListener('scroll', () => setas(t), { passive: true }); });
  }
  function setas(t) {
    const w = t.parentElement;
    $('.seta.esq', w).disabled = t.scrollLeft < 8;
    $('.seta.dir', w).disabled = t.scrollLeft + t.clientWidth > t.scrollWidth - 8;
  }

  function renderLinha() {
    $('#linha-trilho').innerHTML = MODULOS.map(m => `<button class="marco${m.prontos ? ' tem' : ''}" type="button" data-marco="${m.num}" aria-label="Módulo ${m.num}: ${esc(m.titulo)}, ${esc(m.periodo)}, ${m.prontos ? `${m.prontos} de ${m.total} episódios prontos` : `${m.total} episódios, em breve`}">
      <span class="marco-num" aria-hidden="true">${dois(m.num)}</span><span class="marco-nome">${esc(m.titulo)}</span><span class="marco-per">${esc(m.periodo)}</span>
      <span class="marco-cont">${m.prontos ? `${m.prontos} de ${m.total} prontos` : `${m.total} episódios · em breve`}</span></button>`).join('');
  }

  function atualizar() { renderCatalogo(); capa(); }

  // ---------- busca ----------
  let INDICE = [];
  function buscar(q) {
    const termos = norm(q).trim().split(/\s+/).filter(Boolean);
    const sec = $('#resultados');
    document.body.classList.toggle('buscando', termos.length > 0);
    if (!termos.length) { sec.hidden = true; sec.innerHTML = ''; return; }
    const achados = INDICE.filter(x => termos.every(t => x.txt.includes(t))).map(x => x.e);
    const prontos = achados.filter(e => e.pronto), breves = achados.filter(e => !e.pronto);
    const p = progresso();
    let html = '';
    if (prontos.length) html += `<div><h2>Episódios<small>${prontos.length}</small></h2><div class="grade" role="list" style="margin-top:14px">${prontos.map(e => card(e, p)).join('')}</div></div>`;
    if (breves.length) {
      const mostra = breves.slice(0, 24);
      html += `<div><h2>Em breve<small>${breves.length}</small></h2><ul class="breves" style="margin-top:6px">${mostra.map(e => `<li><button type="button" data-modulo="${e.mod.num}"><b>${esc(e.titulo)}</b><small>Módulo ${e.mod.num} · ${esc(e.passagens)}</small></button></li>`).join('')}</ul>${breves.length > mostra.length ? `<p class="vazio" style="font-size:16px;margin-top:10px">e mais ${breves.length - mostra.length}…</p>` : ''}</div>`;
    }
    if (!html) html = `<p class="vazio">Nada encontrado para “${esc(q.trim())}”.</p>`;
    sec.innerHTML = html;
    sec.hidden = false;
  }

  // ---------- painel ----------
  let painelOrigem = null, painelEmpurrou = false;
  function linhaEp(e, atual, p) {
    if (!e.pronto) return `<li><div class="pn-ep breve"><span class="n">${e.numero}</span><span class="t">${esc(e.titulo)}</span><span class="d">Em breve</span></div></li>`;
    const f = p[e.id] || 0;
    return `<li><button class="pn-ep${e.id === atual ? ' atual' : ''}" type="button" data-play="${e.id}" data-ep="${e.id}" aria-label="Assistir Ep. ${e.numero}: ${esc(e.titulo)}">
      <span class="n">${e.numero}</span><span class="thumb"><img src="${esc(e.capa)}" alt="" width="640" height="360" loading="lazy" decoding="async">${f > 0.02 ? `<span class="barra"><i style="width:${Math.min(100, f * 100).toFixed(1)}%"></i></span>` : ''}</span>
      <span class="t">${esc(e.titulo)}</span><span class="d">${min(e.dur)}</span></button></li>`;
  }
  function listaModulo(m, atual, p, todos) {
    const prontos = m.episodios.filter(e => e.pronto), breves = m.episodios.filter(e => !e.pronto);
    const LIM = 4;
    const mostra = todos || breves.length <= LIM + 2 ? breves : breves.slice(0, LIM);
    return `<div class="pn-lista-topo"><h3>Episódios</h3><small>${m.prontos} de ${m.total} prontos</small></div>
      <ol class="pn-lista">${prontos.map(e => linhaEp(e, atual, p)).join('')}${mostra.map(e => linhaEp(e, atual, p)).join('')}</ol>
      ${mostra.length < breves.length ? `<button class="pn-ver-todos" type="button" data-todos="${m.num}">Ver todos os ${m.total} episódios</button>` : ''}`;
  }
  function mostrarPainel(html, hash, empurrar) {
    const painel = $('#painel'), caixa = $('#painel-caixa');
    if (painel.hidden) painelOrigem = document.activeElement;
    caixa.innerHTML = `<button class="painel-fechar" type="button" data-fechar aria-label="Fechar">${IC.x}</button>${html}`;
    painel.hidden = false;
    painel.scrollTop = 0;
    document.body.classList.add('travado');
    if (location.hash !== hash) {
      if (empurrar) { history.pushState({ painel: 1 }, '', hash); painelEmpurrou = true; }
      else history.replaceState(history.state, '', hash);
    }
    caixa.focus({ preventScroll: true });
  }
  function abrirEpisodio(id, empurrar) {
    const e = POR_ID.get(id);
    if (!e) return false;
    if (!e.pronto) return abrirModulo(e.mod.num, empurrar);
    const p = progresso(), f = p[e.id];
    const rotulo = emAndamento(f) ? 'Continuar' : f >= 0.95 ? 'Assistir de novo' : 'Assistir';
    mostrarPainel(`
      <div class="pn-hero"><img src="${esc(e.hero)}" alt="" width="1280" height="720">
        <div class="pn-hero-txt"><p class="pn-mod">Módulo ${e.mod.num} · ${esc(e.mod.titulo)}</p><h2 id="pn-titulo">${esc(e.titulo)}</h2>
        <button class="btn btn-ouro" type="button" data-play="${e.id}">${IC.play}${rotulo}</button></div></div>
      <div class="pn-corpo">
        <p class="pn-meta"><b>Ep. ${e.numero}</b><span>${min(e.dur)}</span><span>${esc(e.passagens)}</span></p>
        <p class="pn-sinopse">${esc(e.sinopse)}</p>
        ${e.jesus ? `<p class="pn-jesus"><span>Onde está Jesus</span>${esc(e.jesus)}</p>` : ''}
        <div id="pn-lista">${listaModulo(e.mod, e.id, p)}</div>
      </div>`, `#episodio-${e.id}`, empurrar);
    return true;
  }
  function abrirModulo(num, empurrar, todos) {
    const m = MODULOS.find(x => x.num === Number(num));
    if (!m) return false;
    const capaEp = m.episodios.find(e => e.pronto);
    const img = capaEp ? capaEp.hero : `img/m/${dois(((m.num * 7) % 26) + 1)}.jpg`;
    const primeiro = capaEp ? `<button class="btn btn-ouro" type="button" data-play="${capaEp.id}">${IC.play}Assistir Ep. ${capaEp.numero}</button>` : '';
    mostrarPainel(`
      <div class="pn-hero"><img src="${esc(img)}" alt="" width="1280" height="720">
        <div class="pn-hero-txt"><p class="pn-mod">Módulo ${m.num} · ${esc(m.periodo)}</p><h2 id="pn-titulo">${esc(m.titulo)}</h2>${primeiro}</div></div>
      <div class="pn-corpo">
        <p class="pn-resumo">${esc(m.resumo)}</p>
        <div id="pn-lista">${listaModulo(m, null, progresso(), todos)}</div>
      </div>`, `#modulo-${m.num}`, empurrar);
    return true;
  }
  function fecharPainel(semHistorico) {
    const painel = $('#painel');
    if (painel.hidden) return;
    painel.hidden = true;
    document.body.classList.remove('travado');
    if (!semHistorico && painelEmpurrou && history.state && history.state.painel) { painelEmpurrou = false; history.back(); }
    else { painelEmpurrou = false; history.replaceState(null, '', location.pathname + location.search); }
    if (painelOrigem && document.contains(painelOrigem)) painelOrigem.focus({ preventScroll: true });
  }
  function rota() {
    const h = decodeURIComponent(location.hash.slice(1));
    let m;
    if ((m = h.match(/^episodio-(M\d\d-E\d\d)$/i))) return abrirEpisodio(m[1].toUpperCase(), false);
    if ((m = h.match(/^modulo-(\d+)$/)) && !MODULOS.find(x => x.num === +m[1])?.prontos) return abrirModulo(m[1], false);
    if (!$('#painel').hidden) fecharPainel(true);
    return false;
  }

  // ---------- eventos ----------
  function eventos() {
    document.addEventListener('click', ev => {
      const t = ev.target.closest('[data-play],[data-info],[data-modulo],[data-marco],[data-fechar],[data-todos],.seta');
      if (!t) { if (ev.target.id === 'painel') fecharPainel(); return; }
      if (t.matches('.seta')) {
        const tr = $('.trilho', t.parentElement);
        tr.scrollBy({ left: (t.classList.contains('dir') ? 1 : -1) * tr.clientWidth * 0.85, behavior: reduzir ? 'auto' : 'smooth' });
      } else if (t.dataset.fechar !== undefined) fecharPainel();
      else if (t.dataset.play) assistir(t.dataset.play);
      else if (t.dataset.info) abrirEpisodio(t.dataset.info, true);
      else if (t.dataset.todos) { $('#pn-lista').innerHTML = listaModulo(MODULOS.find(x => x.num === +t.dataset.todos), $('.pn-ep.atual')?.dataset.ep, progresso(), true); }
      else if (t.dataset.modulo) abrirModulo(t.dataset.modulo, true);
      else if (t.dataset.marco) {
        const m = MODULOS.find(x => x.num === +t.dataset.marco);
        const alvo = m.prontos && $(`#modulo-${m.num}`);
        if (alvo) alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
        else abrirModulo(m.num, true);
      }
    });

    addEventListener('popstate', rota);
    addEventListener('hashchange', rota);

    const topo = $('#topo');
    const rolar = () => topo.classList.toggle('solido', scrollY > 40);
    addEventListener('scroll', rolar, { passive: true });
    rolar();

    const busca = $('#busca'), caixaBusca = $('#busca-caixa');
    let tBusca;
    busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { buscar(busca.value); scrollTo(0, 0); }, 80); });
    $('#busca-abrir').addEventListener('click', () => { caixaBusca.classList.add('aberta'); busca.focus(); });
    busca.addEventListener('blur', () => { if (!busca.value) caixaBusca.classList.remove('aberta'); });
    busca.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { busca.value = ''; buscar(''); busca.blur(); }
      if (ev.key === 'Enter' || ev.key === 'ArrowDown') { const c = $('#resultados [data-play], #resultados [data-modulo]'); if (c) { ev.preventDefault(); c.focus(); } }
    });
    $('#marca').addEventListener('click', ev => { ev.preventDefault(); if (busca.value) { busca.value = ''; buscar(''); } fecharPainel(); scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' }); });

    document.addEventListener('keydown', ev => {
      const painelAberto = !$('#painel').hidden;
      if ($('.fb-palco') || $('.bp:not([hidden])')) return; // player aberto: as teclas são dele
      if (painelAberto) {
        if (ev.key === 'Escape') { ev.preventDefault(); fecharPainel(); }
        else if (ev.key === 'Tab') prenderFoco(ev);
        return;
      }
      const emCampo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (ev.key === '/' && !emCampo) { ev.preventDefault(); caixaBusca.classList.add('aberta'); busca.focus(); return; }
      if (emCampo || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const atual = document.activeElement?.closest?.('.card-play');
      if (!atual) return;
      if (ev.key === 'i' || ev.key === 'I') { const c = atual.closest('.card'); if (c?.dataset.ep) abrirEpisodio(c.dataset.ep, true); return; }
      const lista = atual.closest('.trilho, .grade');
      const cards = $$('.card-play', lista), i = cards.indexOf(atual);
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        const prox = cards[i + (ev.key === 'ArrowRight' ? 1 : -1)];
        if (prox) { ev.preventDefault(); prox.focus({ preventScroll: true }); prox.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduzir ? 'auto' : 'smooth' }); }
      } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && lista.matches('.trilho')) {
        const trilhos = $$('main .trilho'), j = trilhos.indexOf(lista) + (ev.key === 'ArrowDown' ? 1 : -1);
        if (trilhos[j]) {
          ev.preventDefault();
          const alvo = $$('.card-play', trilhos[j])[Math.min(i, $$('.card-play', trilhos[j]).length - 1)];
          alvo.focus({ preventScroll: true });
          alvo.closest('.fileira').scrollIntoView({ block: 'center', behavior: reduzir ? 'auto' : 'smooth' });
          alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    });
  }
  function prenderFoco(ev) {
    const f = $$('#painel-caixa button, #painel-caixa a[href]').filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const pri = f[0], ult = f[f.length - 1];
    if (ev.shiftKey && (document.activeElement === pri || document.activeElement === $('#painel-caixa'))) { ev.preventDefault(); ult.focus(); }
    else if (!ev.shiftKey && document.activeElement === ult) { ev.preventDefault(); pri.focus(); }
  }

  // ---------- início ----------
  async function iniciar() {
    mural();
    eventos();
    let dados;
    try { dados = await (await fetch('data/episodios.json')).json(); }
    catch { $('#catalogo').innerHTML = '<p class="vazio">Não foi possível carregar os episódios. Recarregue a página.</p>'; return; }
    MODULOS = dados.modulos;
    for (const m of MODULOS) for (const e of m.episodios) {
      e.mod = m;
      POR_ID.set(e.id, e);
      if (e.pronto) PRONTOS.push(e);
    }
    INDICE = [...POR_ID.values()].map(e => ({ e, txt: norm(`${e.titulo} ${e.passagens} ${e.mod.titulo} modulo ${e.mod.num} ep ${e.numero}`) }));
    renderCatalogo();
    renderLinha();
    capa();
    destaque();
    rota();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
