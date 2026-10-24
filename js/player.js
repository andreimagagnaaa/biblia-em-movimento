/* Player de vídeo da Bíblia em Movimento.
 * API:
 *   Player.abrir(ep, { lista, aoFechar, aoProgresso })
 *     ep: { id, arq, titulo, modulo: { num, nome }, numero, dur, sinopse }
 *     lista: eps em ordem (para "próximo"); aoFechar(); aoProgresso(id, frac) a cada ~3 s e no fim
 *   Player.fechar()
 *   Player.progresso() → { [id]: frac } (localStorage 'bem-progresso'; o player é o dono da chave)
 * Monta o próprio overlay no <body>. Capítulos e miniaturas vêm de data/capitulos.json.
 */
(() => {
  'use strict';

  const GH = 'https://github.com/andreimagagnaaa/biblia-em-movimento/releases/download/videos/';
  // Safari exige o tipo video/mp4, que o GitHub não envia: nele o vídeo passa pelo proxy da Vercel (/v/ → api/v.js).
  const SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  const BASE = new URL('..', (document.currentScript && document.currentScript.src) || location.href);
  const url = (p) => new URL(p, BASE).href;
  const urlVideo = (arq, q) => (SAFARI ? url('v/') : GH) + `${arq}-${q}.mp4`;
  const capa = (arq) => url(`img/c/${arq}.jpg`);

  const K_PROG = 'bem-progresso', K_QUAL = 'bem-qualidade', K_VOL = 'bem-volume';
  const VELOCIDADES = [0.75, 1, 1.25, 1.5];
  const OCIOSO_MS = 2500, SALVAR_MS = 3000, CONTAGEM_S = 8;

  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const progresso = () => { const p = ler(K_PROG); return p && typeof p === 'object' ? p : {}; };
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };
  const fmtFala = (s) => { s = Math.floor(s || 0); const m = Math.floor(s / 60), r = s % 60; return m ? `${m} min ${r} s` : `${r} s`; };
  const velTxt = (v) => String(v).replace('.', ',') + '×';

  let dadosCap = null;
  const carregarCapitulos = () => dadosCap || (dadosCap = fetch(url('data/capitulos.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

  /* ---------- ícones ---------- */
  const I = {
    play: '<svg viewBox="0 0 24 24"><path class="f" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.2-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24"><rect class="f" x="6" y="4" width="4.2" height="16" rx="1"/><rect class="f" x="13.8" y="4" width="4.2" height="16" rx="1"/></svg>',
    volta: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><text x="12.4" y="15" text-anchor="middle">10</text></svg>',
    avanca: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="11.6" y="15" text-anchor="middle">10</text></svg>',
    vol2: '<svg viewBox="0 0 24 24"><path class="f" d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    vol1: '<svg viewBox="0 0 24 24"><path class="f" d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    mudo: '<svg viewBox="0 0 24 24"><path class="f" d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    prox: '<svg viewBox="0 0 24 24"><path class="f" d="M5 5.2v13.6a.8.8 0 0 0 1.24.67L16 13v6h2.5V5H16v6L6.24 4.53A.8.8 0 0 0 5 5.2z"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><rect class="f" x="12" y="11" width="7.5" height="6" rx="1"/></svg>',
    cheia: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
    sair: '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
    voltar: '<svg viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    fechar: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    repetir: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    rebobinar: '<svg viewBox="0 0 24 24"><path d="M11 19 2 12l9-7zM22 19l-9-7 9-7z"/></svg>',
    adiantar: '<svg viewBox="0 0 24 24"><path d="m13 19 9-7-9-7zM2 19l9-7-9-7z"/></svg>',
  };

  /* ---------- estado ---------- */
  let raiz, v, el = {};
  let ep = null, opcoes = {}, caps = [], sprite = null;
  let pref = 'auto', qAtual = '720', velocidade = 1;
  let arrastando = false, alvoBusca = null, ultimoSalvo = 0, timerOcioso = 0, timerCarreg = 0, timerRetomar = 0, rafContagem = 0;
  let focoAnterior = null, aberto = false, comHistorico = false, sobreControles = false, terminou = false;

  /* ---------- qualidade ---------- */
  function qualidadeAuto() {
    const c = navigator.connection || {};
    const telaGrande = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) >= 1600 || Math.max(innerWidth, innerHeight) >= 1280;
    const redeBoa = !c.saveData && !/(^|-)(2g|3g)$/.test(c.effectiveType || '') && !(c.downlink && c.downlink < 5);
    return telaGrande && redeBoa ? '1080' : '720';
  }
  let forcar720 = false;
  const qualidadeEfetiva = () => (forcar720 ? '720' : pref === 'auto' ? qualidadeAuto() : pref);

  /* ---------- montagem ---------- */
  function montar() {
    if (raiz) return;
    raiz = document.createElement('div');
    raiz.className = 'bp';
    raiz.hidden = true;
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', 'Player de vídeo');
    raiz.innerHTML = `
      <video class="bp-video" playsinline webkit-playsinline preload="auto"></video>
      <div class="bp-toque" aria-hidden="true"></div>
      <div class="bp-pulo esq" aria-hidden="true"><div>${I.rebobinar}<span></span></div></div>
      <div class="bp-pulo dir" aria-hidden="true"><div>${I.adiantar}<span></span></div></div>
      <div class="bp-centro"><div class="bp-carregando" hidden></div></div>
      <div class="bp-centro"><div class="bp-lampejo" aria-hidden="true"></div></div>
      <div class="bp-centro"><button class="bp-play-grande" type="button" aria-label="Reproduzir" hidden>${I.play}</button></div>
      <div class="bp-topo">
        <button class="bp-btn" type="button" data-a="fechar" aria-label="Fechar o player (Esc)">${I.voltar}</button>
        <div class="bp-ident"><div class="bp-eyebrow"></div><h2 class="bp-titulo"></h2></div>
      </div>
      <div class="bp-retomar" hidden><span>Continuando de <b></b></span><button type="button" data-a="inicio">começar do início</button></div>
      <div class="bp-base">
        <div class="bp-barra" role="slider" tabindex="0" aria-label="Posição no vídeo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="bp-trilho">
            <div class="bp-faixas"><i class="bp-buffer"></i><i class="bp-hover-faixa"></i><i class="bp-tocado"></i></div>
            <div class="bp-pino"></div>
          </div>
          <div class="bp-previa" aria-hidden="true"><div class="bp-previa-cap"></div><div class="bp-previa-img"></div><div class="bp-previa-tempo"></div></div>
        </div>
        <div class="bp-linha">
          <button class="bp-btn bp-grande" type="button" data-a="play" aria-label="Reproduzir (espaço)">${I.play}</button>
          <button class="bp-btn" type="button" data-a="volta" aria-label="Voltar 10 segundos (J)">${I.volta}</button>
          <button class="bp-btn" type="button" data-a="avanca" aria-label="Avançar 10 segundos (L)">${I.avanca}</button>
          <div class="bp-vol">
            <button class="bp-btn" type="button" data-a="mudo" aria-label="Silenciar (M)">${I.vol2}</button>
            <input type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">
          </div>
          <div class="bp-tempo" aria-hidden="true"><b class="bp-t-atual">0:00</b> <span>/ <span class="bp-t-total">0:00</span></span></div>
          <div class="bp-cap-atual" aria-hidden="true"></div>
          <div class="bp-esp"></div>
          <button class="bp-btn" type="button" data-a="prox" aria-label="Próximo episódio (N)">${I.prox}</button>
          <button class="bp-btn" type="button" data-a="ajustes" aria-label="Velocidade e qualidade" aria-haspopup="true" aria-expanded="false">${I.ajustes}</button>
          <button class="bp-btn bp-so-largo" type="button" data-a="pip" aria-label="Picture-in-picture">${I.pip}</button>
          <button class="bp-btn" type="button" data-a="cheia" aria-label="Tela cheia (F)">${I.cheia}</button>
        </div>
      </div>
      <div class="bp-menu" hidden role="group" aria-label="Ajustes">
        <div class="bp-grupo"><div class="bp-grupo-tit" id="bp-g-vel">Velocidade</div><div class="bp-chips" role="radiogroup" aria-labelledby="bp-g-vel" data-g="vel">
          ${VELOCIDADES.map((x) => `<button type="button" class="bp-chip" role="radio" data-vel="${x}">${velTxt(x)}</button>`).join('')}</div></div>
        <div class="bp-grupo"><div class="bp-grupo-tit" id="bp-g-q">Qualidade</div><div class="bp-chips" role="radiogroup" aria-labelledby="bp-g-q" data-g="q">
          <button type="button" class="bp-chip" role="radio" data-q="auto">Auto<small></small></button>
          <button type="button" class="bp-chip" role="radio" data-q="720">720p</button>
          <button type="button" class="bp-chip" role="radio" data-q="1080">1080p</button></div></div>
      </div>
      <div class="bp-prox" hidden>
        <button type="button" class="bp-prox-capa" data-a="ir-prox" tabindex="-1" aria-hidden="true">
          <span class="bp-anel"><svg viewBox="0 0 68 68"><circle cx="34" cy="34" r="30"/><circle cx="34" cy="34" r="30"/></svg><b></b></span>
        </button>
        <div class="bp-prox-info">
          <div class="bp-eyebrow">Próximo episódio</div>
          <h3></h3>
          <div class="bp-prox-acoes">
            <button type="button" class="bp-acao ouro" data-a="ir-prox">${I.play}Assistir</button>
            <button type="button" class="bp-acao vidro" data-a="cancelar-prox">Cancelar</button>
          </div>
        </div>
      </div>
      <div class="bp-erro" hidden><p>Não foi possível carregar o vídeo.</p><button type="button" class="bp-acao ouro" data-a="tentar">${I.repetir}Tentar de novo</button></div>
      <div class="bp-vivo" aria-live="polite"></div>`;
    document.body.appendChild(raiz);

    const $ = (s) => raiz.querySelector(s);
    v = $('video');
    el = {
      toque: $('.bp-toque'), carregando: $('.bp-carregando'), lampejo: $('.bp-lampejo'), playGrande: $('.bp-play-grande'),
      eyebrow: $('.bp-topo .bp-eyebrow'), titulo: $('.bp-titulo'), retomar: $('.bp-retomar'), retomarT: $('.bp-retomar b'),
      barra: $('.bp-barra'), faixas: $('.bp-faixas'), buffer: $('.bp-buffer'), hoverFaixa: $('.bp-hover-faixa'), tocado: $('.bp-tocado'), pino: $('.bp-pino'),
      previa: $('.bp-previa'), previaCap: $('.bp-previa-cap'), previaImg: $('.bp-previa-img'), previaTempo: $('.bp-previa-tempo'),
      play: $('[data-a="play"]'), mudo: $('[data-a="mudo"]'), vol: $('.bp-vol input'), tAtual: $('.bp-t-atual'), tTotal: $('.bp-t-total'), capAtual: $('.bp-cap-atual'),
      prox: $('[data-a="prox"]'), ajustes: $('[data-a="ajustes"]'), pip: $('[data-a="pip"]'), cheia: $('[data-a="cheia"]'), menu: $('.bp-menu'),
      cartao: $('.bp-prox'), cartaoCapa: $('.bp-prox-capa'), cartaoTit: $('.bp-prox h3'), anel: $('.bp-anel circle + circle'), anelN: $('.bp-anel b'),
      erro: $('.bp-erro'), vivo: $('.bp-vivo'), puloE: $('.bp-pulo.esq'), puloD: $('.bp-pulo.dir'), base: $('.bp-base'),
    };
    const R = 30, C = 2 * Math.PI * R;
    el.anel.style.strokeDasharray = C;
    el.anelC = C;

    const temPip = (document.pictureInPictureEnabled && !v.disablePictureInPicture) || typeof v.webkitSetPresentationMode === 'function';
    el.pip.hidden = !temPip;

    // volume com memória
    const mv = ler(K_VOL) || {};
    v.volume = typeof mv.v === 'number' ? limitar(mv.v, 0, 1) : 1;
    v.muted = !!mv.mudo;
    const pq = ler(K_QUAL);
    pref = pq === '720' || pq === '1080' || pq === 'auto' ? pq : 'auto';

    ligarEventos();
    atualizarVolume();
  }

  /* ---------- eventos ---------- */
  function ligarEventos() {
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a], [data-vel], [data-q]');
      if (!b) return;
      if (b.dataset.vel) return definirVelocidade(Number(b.dataset.vel));
      if (b.dataset.q) return definirQualidade(b.dataset.q);
      const a = b.dataset.a;
      ({
        fechar, play: alternar, volta: () => pular(-10), avanca: () => pular(10), mudo: alternarMudo,
        prox: irProximo, ajustes: alternarMenu, pip: alternarPip, cheia: alternarTelaCheia,
        inicio: () => { esconderRetomar(); buscar(0); }, 'ir-prox': irProximo, 'cancelar-prox': cancelarProximo,
        tentar: () => { el.erro.hidden = true; carregarFonte(alvoBusca ?? v.currentTime ?? 0, true); },
      })[a]?.();
    });
    el.playGrande.addEventListener('click', alternar);
    el.vol.addEventListener('input', () => { v.volume = Number(el.vol.value); v.muted = v.volume === 0; });

    // vídeo
    v.addEventListener('play', atualizarPlay);
    v.addEventListener('pause', () => { atualizarPlay(); salvar(true); mostrar(); });
    v.addEventListener('playing', () => { carregando(false); el.playGrande.hidden = true; });
    v.addEventListener('waiting', () => carregando(true));
    v.addEventListener('seeking', () => carregando(true));
    v.addEventListener('seeked', () => { alvoBusca = null; if (!v.paused || v.readyState >= 3) carregando(false); atualizarTempo(); });
    v.addEventListener('canplay', () => carregando(false));
    v.addEventListener('timeupdate', () => { atualizarTempo(); salvar(false); posicaoMidia(); });
    v.addEventListener('progress', atualizarBuffer);
    v.addEventListener('durationchange', () => { atualizarTempo(); desenharCapitulos(); });
    v.addEventListener('volumechange', () => { atualizarVolume(); gravar(K_VOL, { v: v.volume, mudo: v.muted }); });
    v.addEventListener('ratechange', () => { if (v.playbackRate !== velocidade && v.readyState > 0) v.playbackRate = velocidade; marcarMenu(); posicaoMidia(); });
    v.addEventListener('ended', aoTerminar);
    v.addEventListener('error', aoErro);
    v.addEventListener('enterpictureinpicture', () => raiz.classList.add('bp-pip'));
    v.addEventListener('leavepictureinpicture', () => raiz.classList.remove('bp-pip'));
    v.addEventListener('webkitendfullscreen', () => { atualizarTelaCheia(); });
    document.addEventListener('fullscreenchange', atualizarTelaCheia);
    document.addEventListener('webkitfullscreenchange', atualizarTelaCheia);

    // controles somem quando parado
    raiz.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') mostrar(); });
    raiz.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !v.paused && !arrastando) esconder(); });
    el.base.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sobreControles = true; });
    el.base.addEventListener('pointerleave', () => { sobreControles = false; mostrar(); });
    raiz.addEventListener('focusin', (e) => { if (e.target !== raiz && e.target.matches(':focus-visible')) mostrar(); });

    // toque/clique na área do vídeo
    let ultimoToque = 0, ultimoLado = '', timerToque = 0, sequenciaAte = 0;
    el.toque.addEventListener('pointerup', (e) => {
      if (!el.menu.hidden) { fecharMenu(); return; }
      const agora = performance.now();
      const r = raiz.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const lado = x < 0.35 ? 'esq' : x > 0.65 ? 'dir' : 'meio';
      if (e.pointerType === 'mouse') {
        // clique simples = play/pausa; duplo = tela cheia
        if (agora - ultimoToque < 300) { clearTimeout(timerToque); ultimoToque = 0; alternarTelaCheia(); return; }
        ultimoToque = agora;
        clearTimeout(timerToque);
        timerToque = setTimeout(() => { alternar(); lampejoPlay(); }, 220);
        return;
      }
      // toque: duplo nas laterais = ±10 s (toques seguidos acumulam); simples = mostra/esconde controles
      const emSequencia = agora < sequenciaAte && lado === ultimoLado && lado !== 'meio';
      if (emSequencia || (agora - ultimoToque < 300 && lado === ultimoLado && lado !== 'meio')) {
        clearTimeout(timerToque);
        sequenciaAte = agora + 650;
        ultimoToque = agora;
        puloToque(lado);
        return;
      }
      ultimoToque = agora; ultimoLado = lado;
      clearTimeout(timerToque);
      timerToque = setTimeout(() => {
        if (raiz.classList.contains('bp-oculto')) mostrar(); else if (!v.paused) esconder(); else alternar();
      }, 280);
    });

    // barra de progresso: arrastar com precisão
    const posBarra = (e) => { const r = el.barra.getBoundingClientRect(); return limitar((e.clientX - r.left) / r.width, 0, 1); };
    el.barra.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      arrastando = true;
      el.barra.setPointerCapture(e.pointerId);
      el.barra.classList.add('bp-arrastando');
      const f = posBarra(e);
      desenharPosicao(f); mostrarPrevia(f);
    });
    el.barra.addEventListener('pointermove', (e) => {
      const f = posBarra(e);
      if (arrastando) { desenharPosicao(f); mostrarPrevia(f); mostrar(); }
      else if (e.pointerType === 'mouse') mostrarPrevia(f);
    });
    const soltar = (e) => {
      if (!arrastando) return;
      arrastando = false;
      el.barra.classList.remove('bp-arrastando');
      const f = posBarra(e);
      buscar(f * duracao());
      if (e.pointerType !== 'mouse' || !el.barra.matches(':hover')) esconderPrevia();
      mostrar();
    };
    el.barra.addEventListener('pointerup', soltar);
    el.barra.addEventListener('pointercancel', (e) => { arrastando = false; el.barra.classList.remove('bp-arrastando'); esconderPrevia(); atualizarTempo(); });
    el.barra.addEventListener('pointerleave', (e) => { if (!arrastando) esconderPrevia(); });

    // teclado
    document.addEventListener('keydown', teclado, true);
    // fechar menu ao clicar fora
    raiz.addEventListener('pointerdown', (e) => { if (!el.menu.hidden && !e.target.closest('.bp-menu, [data-a="ajustes"]')) fecharMenu(); });
    // foco preso no player
    document.addEventListener('focusin', (e) => { if (aberto && !raiz.contains(e.target)) raiz.querySelector('[data-a="play"]').focus({ preventScroll: true }); });
    // botão voltar do celular fecha o player
    window.addEventListener('popstate', () => { if (aberto && comHistorico) { comHistorico = false; fechar(); } });
    addEventListener('resize', () => { if (pref === 'auto') marcarMenu(); });
  }

  function teclado(e) {
    if (!aberto || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const emRange = t && t.type === 'range';
    if (t && (t.isContentEditable || (t.tagName === 'INPUT' && !emRange) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key;
    const feito = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === 'Escape') {
      feito();
      if (!el.menu.hidden) return fecharMenu(true);
      if (!el.cartao.hidden && !terminou) return cancelarProximo();
      if (document.fullscreenElement || document.webkitFullscreenElement) return sairTelaCheia();
      return fechar();
    }
    if (k === 'Tab') { prenderTab(e); mostrar(); return; }
    // dentro do menu as setas/enter funcionam normalmente
    if (t && t.closest && t.closest('.bp-menu') && (k === 'Enter' || k.startsWith('Arrow'))) return;
    if (emRange && k.startsWith('Arrow')) return;
    const naBarra = t === el.barra;
    switch (k) {
      case ' ': case 'k': case 'K':
        if (k === ' ' && t && t.tagName === 'BUTTON' && !t.closest('.bp-linha')) return; // espaço ativa botões do cartão/aviso
        feito(); alternar(); lampejoPlay(); break;
      case 'ArrowLeft': feito(); pular(naBarra && e.shiftKey ? -1 : -5); break;
      case 'ArrowRight': feito(); pular(naBarra && e.shiftKey ? 1 : 5); break;
      case 'j': case 'J': feito(); pular(-10); break;
      case 'l': case 'L': feito(); pular(10); break;
      case 'ArrowUp': feito(); mudarVolume(0.05); break;
      case 'ArrowDown': feito(); mudarVolume(-0.05); break;
      case 'f': case 'F': feito(); alternarTelaCheia(); break;
      case 'm': case 'M': feito(); alternarMudo(); lampejo(v.muted ? I.mudo : I.vol2); break;
      case 'n': case 'N': if (proximoEp()) { feito(); irProximo(); } break;
      case 'Home': if (naBarra) { feito(); buscar(0); } break;
      case 'End': if (naBarra) { feito(); buscar(duracao() - 0.5); } break;
      case ',': if (v.paused) { feito(); buscar(v.currentTime - 1 / 30); } break;
      case '.': if (v.paused) { feito(); buscar(v.currentTime + 1 / 30); } break;
      case '<': feito(); trocarVelocidade(-1); break;
      case '>': feito(); trocarVelocidade(1); break;
      default:
        if (/^[0-9]$/.test(k)) { feito(); buscar(duracao() * Number(k) / 10); mostrar(); }
        else return;
    }
  }

  function prenderTab(e) {
    const foc = [...raiz.querySelectorAll('button, [tabindex="0"], input')].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null && x.tabIndex >= 0);
    if (!foc.length) return;
    const i = foc.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); foc[foc.length - 1].focus(); }
    else if (!e.shiftKey && i === foc.length - 1) { e.preventDefault(); foc[0].focus(); }
  }

  /* ---------- abrir / fechar ---------- */
  async function abrir(novo, op = {}) {
    if (!novo || !novo.arq) return;
    montar();
    const jaAberto = aberto;
    if (ep && jaAberto) salvar(true);
    ep = novo; opcoes = op || {};
    terminou = false;
    cancelarProximo(true);
    el.erro.hidden = true; esconderRetomar(true); fecharMenu();
    caps = []; sprite = null; desenharCapitulos();

    const num = ep.numero ?? Number(String(ep.id).split('-E')[1]);
    const mod = ep.modulo || {};
    el.eyebrow.textContent = [mod.nome, num ? `Ep. ${num}` : ''].filter(Boolean).join(' · ');
    el.titulo.textContent = ep.titulo || '';
    raiz.setAttribute('aria-label', `Player: ${ep.titulo || ep.id}`);
    el.prox.hidden = !proximoEp();
    if (proximoEp()) el.prox.setAttribute('aria-label', `Próximo episódio: ${proximoEp().titulo} (N)`);
    v.poster = capa(ep.arq);

    if (!jaAberto) {
      focoAnterior = document.activeElement;
      aberto = true;
      raiz.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      try { history.pushState({ ...(history.state || {}), bemPlayer: true }, ''); comHistorico = true; } catch { comHistorico = false; }
    }

    // retomar de onde parou
    const p = progresso()[ep.id];
    const durEst = ep.dur || 0;
    let inicio = 0;
    if (p > 0.02 && p < 0.95 && durEst) inicio = Math.max(0, p * durEst - 2);
    v.defaultPlaybackRate = velocidade;
    carregarFonte(inicio, true);
    midiaSessao();
    if (inicio > 0) mostrarRetomar(inicio);
    mostrar();
    requestAnimationFrame(() => el.play.focus({ preventScroll: true }));

    const dados = await carregarCapitulos();
    const d = dados[ep.arq];
    if (d && ep === novo) {
      caps = (d.capitulos || []).filter((c) => typeof c.inicio_s === 'number').sort((a, b) => a.inicio_s - b.inicio_s);
      sprite = d.sprite || null;
      if (sprite) { const img = new Image(); img.src = url(sprite.arquivo); }
      if (!ep.dur && d.duracao) ep = { ...ep, dur: d.duracao };
      desenharCapitulos();
      atualizarTempo();
    }
  }

  function fechar() {
    if (!aberto) return;
    salvar(true);
    aberto = false;
    cancelarProximo(true); fecharMenu();
    clearTimeout(timerOcioso); clearTimeout(timerCarreg); clearTimeout(timerRetomar);
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    if (document.fullscreenElement || document.webkitFullscreenElement) sairTelaCheia();
    v.pause();
    v.removeAttribute('src'); v.load();
    raiz.hidden = true;
    raiz.classList.remove('bp-oculto');
    document.documentElement.style.overflow = '';
    if (comHistorico) { comHistorico = false; try { if (history.state && history.state.bemPlayer) history.back(); } catch {} }
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    const cb = opcoes.aoFechar;
    if (focoAnterior && focoAnterior.focus && document.contains(focoAnterior)) focoAnterior.focus({ preventScroll: true });
    if (typeof cb === 'function') cb();
  }

  /* ---------- fonte / qualidade ---------- */
  function carregarFonte(tempo, tocar) {
    qAtual = qualidadeEfetiva();
    alvoBusca = tempo > 0 ? tempo : null;
    carregando(true);
    v.src = urlVideo(ep.arq, qAtual);
    v.addEventListener('loadedmetadata', function f() {
      v.removeEventListener('loadedmetadata', f);
      v.defaultPlaybackRate = velocidade; v.playbackRate = velocidade;
      if (tempo > 0) v.currentTime = Math.min(tempo, (v.duration || tempo + 1) - 0.5);
    });
    if (tocar) {
      const pr = v.play();
      if (pr && pr.catch) pr.catch((err) => { if (err && err.name === 'NotAllowedError') { carregando(false); el.playGrande.hidden = false; atualizarPlay(); } });
    }
    marcarMenu();
  }

  function definirQualidade(q) {
    pref = q; gravar(K_QUAL, q); forcar720 = false;
    const nova = qualidadeEfetiva();
    marcarMenu();
    if (nova !== qAtual && ep) {
      const t = alvoBusca ?? v.currentTime, tocando = !v.paused;
      carregarFonte(t, tocando);
    }
    anunciar(`Qualidade ${q === 'auto' ? 'automática' : q + 'p'}`);
  }

  function aoErro() {
    if (!ep || !v.getAttribute('src')) return;
    const t = alvoBusca ?? v.currentTime ?? 0;
    if (qAtual === '1080') {
      // 1080p com erro cai para 720p nesta sessão (a preferência gravada não muda)
      forcar720 = true;
      carregarFonte(t, true);
      return;
    }
    carregando(false);
    el.erro.hidden = false;
    alvoBusca = t;
  }

  /* ---------- reprodução ---------- */
  function alternar() {
    if (!ep) return;
    if (terminou) { terminou = false; cancelarProximo(true); buscar(0); v.play().catch(() => {}); return; }
    if (v.paused) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => { el.playGrande.hidden = false; }); }
    else v.pause();
  }
  function lampejoPlay() { lampejo(v.paused ? I.pausa : I.play); }
  function duracao() { return (isFinite(v.duration) && v.duration) || (ep && ep.dur) || 0; }

  function buscar(t) {
    const d = duracao();
    if (!d) return;
    t = limitar(t, 0, Math.max(0, d - 0.05));
    alvoBusca = t;
    v.currentTime = t;
    if (terminou && t < d - 1) { terminou = false; cancelarProximo(true); }
    desenharPosicao(t / d);
    atualizarTempo();
  }
  // saltos seguidos somam a partir do alvo pendente, não do tempo atual
  function pular(s) {
    const base = alvoBusca ?? v.currentTime;
    buscar(base + s);
    lampejo(`<span>${s > 0 ? '+' : '−'}${Math.abs(s)} s</span>`);
    mostrar();
  }

  function mudarVolume(d) {
    v.muted = false;
    v.volume = limitar(Math.round((v.volume + d) * 100) / 100, 0, 1);
    lampejo(`<span>${Math.round(v.volume * 100)}%</span>`);
  }
  function alternarMudo() {
    if (v.muted || v.volume === 0) { v.muted = false; if (v.volume === 0) v.volume = 0.5; }
    else v.muted = true;
  }
  function definirVelocidade(x) { velocidade = x; v.defaultPlaybackRate = x; v.playbackRate = x; marcarMenu(); lampejo(`<span>${velTxt(x)}</span>`); }
  function trocarVelocidade(dir) {
    const i = VELOCIDADES.indexOf(velocidade);
    const n = VELOCIDADES[limitar((i < 0 ? 1 : i) + dir, 0, VELOCIDADES.length - 1)];
    definirVelocidade(n);
  }

  /* ---------- progresso salvo ---------- */
  function salvar(forcar) {
    if (!ep) return;
    const d = duracao();
    if (!d || (!v.currentTime && !forcar)) return;
    const agora = Date.now();
    if (!forcar && agora - ultimoSalvo < SALVAR_MS) return;
    if (!v.currentTime && forcar && !progresso()[ep.id]) return;
    ultimoSalvo = agora;
    const frac = terminou ? 1 : limitar(v.currentTime / d, 0, 1);
    gravarProgresso(frac);
  }
  function gravarProgresso(frac) {
    const p = progresso();
    const anterior = p[ep.id];
    if (frac === anterior) return;
    p[ep.id] = Math.round(frac * 10000) / 10000;
    gravar(K_PROG, p);
    if (typeof opcoes.aoProgresso === 'function') { try { opcoes.aoProgresso(ep.id, p[ep.id]); } catch (e) { console.error(e); } }
  }

  /* ---------- fim e próximo ---------- */
  function proximoEp() {
    const l = opcoes.lista;
    if (!ep || !Array.isArray(l)) return null;
    const i = l.findIndex((x) => x && x.id === ep.id);
    if (i < 0) return null;
    for (let j = i + 1; j < l.length; j++) if (l[j] && l[j].arq) return l[j];
    return null;
  }
  function aoTerminar() {
    terminou = true;
    gravarProgresso(1);
    mostrar();
    const n = proximoEp();
    if (!n) { el.play.innerHTML = I.repetir; el.play.setAttribute('aria-label', 'Assistir de novo'); return; }
    el.cartaoTit.textContent = n.titulo || n.id;
    el.cartaoCapa.style.backgroundImage = `url("${capa(n.arq)}")`;
    el.cartao.hidden = false;
    el.cartao.querySelector('.bp-acao.ouro').focus({ preventScroll: true });
    const t0 = performance.now();
    const passo = (agora) => {
      const resta = CONTAGEM_S - (agora - t0) / 1000;
      if (resta <= 0) { rafContagem = 0; irProximo(); return; }
      el.anelN.textContent = Math.ceil(resta);
      el.anel.style.strokeDashoffset = String(el.anelC * (1 - resta / CONTAGEM_S));
      rafContagem = requestAnimationFrame(passo);
    };
    el.anelN.textContent = CONTAGEM_S;
    rafContagem = requestAnimationFrame(passo);
    anunciar(`Próximo episódio em ${CONTAGEM_S} segundos: ${n.titulo}`);
  }
  function cancelarProximo(silencioso) {
    if (rafContagem) cancelAnimationFrame(rafContagem);
    rafContagem = 0;
    if (!el.cartao) return;
    const estava = !el.cartao.hidden;
    el.cartao.hidden = true;
    if (estava && silencioso !== true) { el.play.focus({ preventScroll: true }); if (terminou) { el.play.innerHTML = I.repetir; el.play.setAttribute('aria-label', 'Assistir de novo'); } }
  }
  function irProximo() {
    const n = proximoEp();
    if (!n) return;
    cancelarProximo(true);
    abrir(n, opcoes);
  }

  /* ---------- aviso de retomada ---------- */
  function mostrarRetomar(t) {
    el.retomarT.textContent = fmt(t);
    el.retomar.hidden = false;
    el.retomar.classList.remove('bp-sai');
    clearTimeout(timerRetomar);
    timerRetomar = setTimeout(() => esconderRetomar(), 7000);
  }
  function esconderRetomar(ja) {
    clearTimeout(timerRetomar);
    if (ja === true) { el.retomar.hidden = true; return; }
    el.retomar.classList.add('bp-sai');
    timerRetomar = setTimeout(() => { el.retomar.hidden = true; }, 350);
  }

  /* ---------- interface ---------- */
  function mostrar() {
    raiz.classList.remove('bp-oculto');
    clearTimeout(timerOcioso);
    timerOcioso = setTimeout(() => { if (!v.paused && !arrastando && !sobreControles && el.menu.hidden && el.cartao.hidden) esconder(); }, OCIOSO_MS);
  }
  function esconder() {
    if (v.paused || arrastando || !el.menu.hidden || !el.cartao.hidden) return;
    raiz.classList.add('bp-oculto');
    esconderPrevia();
  }
  function carregando(sim) {
    clearTimeout(timerCarreg);
    if (sim) timerCarreg = setTimeout(() => { el.carregando.hidden = false; }, 180);
    else el.carregando.hidden = true;
  }
  function atualizarPlay() {
    const pausado = v.paused;
    if (terminou && pausado) return;
    el.play.innerHTML = pausado ? I.play : I.pausa;
    el.play.setAttribute('aria-label', pausado ? 'Reproduzir (espaço)' : 'Pausar (espaço)');
    if (!pausado) el.playGrande.hidden = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = pausado ? 'paused' : 'playing';
  }
  function atualizarVolume() {
    const ef = v.muted ? 0 : v.volume;
    el.mudo.innerHTML = ef === 0 ? I.mudo : ef < 0.5 ? I.vol1 : I.vol2;
    el.mudo.setAttribute('aria-label', ef === 0 ? 'Ativar som (M)' : 'Silenciar (M)');
    el.vol.value = String(ef);
    el.vol.style.setProperty('--v', `${ef * 100}%`);
    el.vol.setAttribute('aria-valuetext', `${Math.round(ef * 100)}%`);
  }
  function desenharPosicao(f) {
    el.tocado.style.width = `${f * 100}%`;
    el.pino.style.left = `${f * 100}%`;
  }
  function capituloEm(t) {
    let c = null;
    for (const x of caps) { if (x.inicio_s <= t + 0.01) c = x; else break; }
    return c;
  }
  function atualizarTempo() {
    const d = duracao();
    const t = alvoBusca ?? v.currentTime ?? 0;
    if (!arrastando && d) desenharPosicao(t / d);
    el.tAtual.textContent = fmt(t);
    el.tTotal.textContent = fmt(d);
    const c = capituloEm(t);
    const nome = c ? c.titulo : '';
    if (el.capAtual.textContent !== nome) el.capAtual.textContent = nome;
    el.barra.setAttribute('aria-valuenow', d ? String(Math.round((t / d) * 100)) : '0');
    el.barra.setAttribute('aria-valuetext', `${fmtFala(t)} de ${fmtFala(d)}${nome ? ', ' + nome : ''}`);
    atualizarBuffer();
  }
  function atualizarBuffer() {
    const d = duracao(), t = v.currentTime, b = v.buffered;
    let fim = 0;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) fim = Math.max(fim, b.end(i));
    el.buffer.style.width = d ? `${limitar(fim / d, 0, 1) * 100}%` : '0';
  }
  // capítulos: pequenos cortes na barra (máscara) e nome na prévia
  function desenharCapitulos() {
    const d = duracao();
    if (!caps.length || !d) { el.faixas.style.webkitMaskImage = el.faixas.style.maskImage = ''; return; }
    const w = el.barra.clientWidth || 1000;
    const meio = (1.5 / w) * 100; // 3 px de corte
    const paradas = [];
    let ult = 0;
    for (const c of caps) {
      const p = (c.inicio_s / d) * 100;
      if (p <= 0.3 || p >= 99.7) continue;
      paradas.push(`#000 ${ult}%`, `#000 ${p - meio}%`, `transparent ${p - meio}%`, `transparent ${p + meio}%`);
      ult = p + meio;
    }
    paradas.push(`#000 ${ult}%`, '#000 100%');
    const m = `linear-gradient(90deg, ${paradas.join(', ')})`;
    el.faixas.style.webkitMaskImage = m;
    el.faixas.style.maskImage = m;
  }
  addEventListener('resize', () => { if (aberto) desenharCapitulos(); });

  function mostrarPrevia(f) {
    const d = duracao();
    if (!d) return;
    const t = f * d;
    el.previaTempo.textContent = fmt(t);
    const c = capituloEm(t);
    el.previaCap.textContent = c ? c.titulo : '';
    el.previaCap.hidden = !c;
    if (sprite) {
      const i = limitar(Math.round(t / sprite.intervalo), 0, (sprite.quadros || 1e9) - 1);
      const w = el.previaImg.clientWidth || 200, esc = w / sprite.largura;
      const col = i % sprite.colunas, lin = Math.floor(i / sprite.colunas);
      const linhas = Math.ceil((sprite.quadros || sprite.colunas) / sprite.colunas);
      el.previaImg.style.backgroundImage = `url("${url(sprite.arquivo)}")`;
      el.previaImg.style.backgroundSize = `${sprite.colunas * sprite.largura * esc}px ${linhas * sprite.altura * esc}px`;
      el.previaImg.style.backgroundPosition = `${-col * sprite.largura * esc}px ${-lin * sprite.altura * esc}px`;
      el.previaImg.hidden = false;
    } else el.previaImg.hidden = true;
    el.hoverFaixa.style.width = `${f * 100}%`;
    // posiciona sem sair da tela
    const bw = el.barra.clientWidth, pw = el.previa.offsetWidth || 200;
    const x = limitar(f * bw - pw / 2, -4, bw - pw + 4);
    el.previa.style.transform = '';
    el.previa.style.left = `${x}px`;
    el.previa.classList.add('bp-vis');
  }
  function esconderPrevia() { el.previa.classList.remove('bp-vis'); }

  let timerLampejo = 0;
  function lampejo(html) {
    el.lampejo.innerHTML = html;
    el.lampejo.classList.remove('bp-anima');
    void el.lampejo.offsetWidth;
    el.lampejo.classList.add('bp-anima');
    clearTimeout(timerLampejo);
    timerLampejo = setTimeout(() => el.lampejo.classList.remove('bp-anima'), 650);
  }

  let acumulado = 0, timerPulo = 0;
  function puloToque(lado) {
    const s = lado === 'esq' ? -10 : 10;
    const alvo = lado === 'esq' ? el.puloE : el.puloD, outro = lado === 'esq' ? el.puloD : el.puloE;
    if (outro.classList.contains('bp-vis')) acumulado = 0;
    outro.classList.remove('bp-vis');
    acumulado += Math.abs(s);
    buscar((alvoBusca ?? v.currentTime) + s);
    alvo.querySelector('span').textContent = `${acumulado} s`;
    alvo.classList.add('bp-vis');
    clearTimeout(timerPulo);
    timerPulo = setTimeout(() => { alvo.classList.remove('bp-vis'); acumulado = 0; }, 700);
  }

  /* ---------- menu ---------- */
  function alternarMenu() { if (el.menu.hidden) abrirMenu(); else fecharMenu(true); }
  function abrirMenu() {
    marcarMenu();
    el.menu.hidden = false;
    el.ajustes.setAttribute('aria-expanded', 'true');
    mostrar();
    const sel = el.menu.querySelector('[aria-checked="true"]');
    if (sel) sel.focus({ preventScroll: true });
  }
  function fecharMenu(devolverFoco) {
    if (!el.menu || el.menu.hidden) return;
    el.menu.hidden = true;
    el.ajustes.setAttribute('aria-expanded', 'false');
    if (devolverFoco) el.ajustes.focus({ preventScroll: true });
    mostrar();
  }
  function marcarMenu() {
    if (!el.menu) return;
    for (const b of el.menu.querySelectorAll('[data-vel]')) b.setAttribute('aria-checked', String(Number(b.dataset.vel) === velocidade));
    for (const b of el.menu.querySelectorAll('[data-q]')) b.setAttribute('aria-checked', String(b.dataset.q === pref));
    el.menu.querySelector('[data-q="auto"] small').textContent = pref === 'auto' ? `${qAtual}p` : '';
  }

  /* ---------- tela cheia e PiP ---------- */
  function alternarTelaCheia() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return sairTelaCheia();
    const r = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
    if (r) {
      const pr = r.call(raiz, { navigationUI: 'hide' });
      if (pr && pr.then) pr.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch {} }).catch(() => {});
    } else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone: tela cheia nativa
  }
  function sairTelaCheia() {
    try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch {}
    const s = document.exitFullscreen || document.webkitExitFullscreen;
    if (s) { const pr = s.call(document); if (pr && pr.catch) pr.catch(() => {}); }
  }
  function atualizarTelaCheia() {
    const cheia = !!(document.fullscreenElement || document.webkitFullscreenElement);
    el.cheia.innerHTML = cheia ? I.sair : I.cheia;
    el.cheia.setAttribute('aria-label', cheia ? 'Sair da tela cheia (F)' : 'Tela cheia (F)');
    if (aberto) setTimeout(desenharCapitulos, 100);
  }
  function alternarPip() {
    if (document.pictureInPictureElement) return document.exitPictureInPicture().catch(() => {});
    if (v.requestPictureInPicture) return v.requestPictureInPicture().catch(() => {});
    if (v.webkitSetPresentationMode) v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
  }

  /* ---------- Media Session ---------- */
  function midiaSessao() {
    if (!('mediaSession' in navigator) || !ep) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: ep.titulo || ep.id,
        artist: 'Bíblia em Movimento',
        album: (ep.modulo && ep.modulo.nome) || '',
        artwork: [{ src: capa(ep.arq), sizes: '1280x720', type: 'image/jpeg' }],
      });
    } catch {}
    const acao = (n, f) => { try { ms.setActionHandler(n, f); } catch {} };
    acao('play', () => v.play());
    acao('pause', () => v.pause());
    acao('seekbackward', (d) => pular(-(d.seekOffset || 10)));
    acao('seekforward', (d) => pular(d.seekOffset || 10));
    acao('seekto', (d) => { if (d.fastSeek && v.fastSeek) v.fastSeek(d.seekTime); else buscar(d.seekTime); });
    acao('nexttrack', proximoEp() ? irProximo : null);
    acao('previoustrack', () => buscar(0));
  }
  function posicaoMidia() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const d = v.duration;
    if (!isFinite(d) || !d) return;
    try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: v.playbackRate || 1, position: limitar(v.currentTime, 0, d) }); } catch {}
  }

  function anunciar(txt) { if (el.vivo) { el.vivo.textContent = ''; setTimeout(() => { el.vivo.textContent = txt; }, 30); } }

  window.Player = { abrir, fechar, progresso };
})();
