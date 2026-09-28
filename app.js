/* ZARA — versão leve. Roteamento por hash (#/...) para funcionar abrindo o index.html direto. */
(() => {
  'use strict';

  const P = window.PRODUCTS;
  const SIZES = ['PP', 'P', 'M', 'G', 'GG'];
  const FREE_SHIPPING = 299;
  const PIX = 0.05;
  const CATS = [
    { slug: 'novidades', name: 'Novidades', title: 'Novidades em moda praia', img: 'img/biquini-violeta-riviera.webp' },
    { slug: 'biquinis', name: 'Biquínis', title: 'Biquínis femininos', img: 'img/biquini-sunset-coral.webp' },
    { slug: 'praia', name: 'Praia', title: 'Moda praia', img: 'img/biquini-forest-green.webp' },
    { slug: 'feminino', name: 'Feminino', title: 'Moda feminina' },
    { slug: 'colecoes', name: 'Coleções', title: 'Coleções' },
    { slug: 'promocoes', name: 'Promoções', title: 'Promoções', sale: true },
  ];
  const BEST = { slug: 'mais-vendidos', name: 'Mais vendidos', title: 'Mais vendidos', img: 'img/biquini-ocean-blue.webp' };

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const icon = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
  const HEART = '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20Z"/>';
  const bySlug = (s) => P.find((p) => p.slug === s);
  const byId = (id) => P.find((p) => p.id === id);
  const catProducts = (slug) =>
    ['feminino', 'colecoes'].includes(slug) ? P : P.filter((p) => (slug === 'promocoes' ? p.compareAt : p.cats.includes(slug)));

  /* ---------- Estado (salvo no navegador) ---------- */
  const store = {
    cart: [],
    favs: [],
    load() {
      try {
        Object.assign(this, JSON.parse(localStorage.getItem('zara-leve') || '{}'));
      } catch {}
    },
    save() {
      try {
        localStorage.setItem('zara-leve', JSON.stringify({ cart: this.cart, favs: this.favs }));
      } catch {}
      updateBadges();
    },
  };

  const cartLines = () => store.cart.map((l) => ({ ...l, p: byId(l.id) })).filter((l) => l.p);
  const subtotal = () => cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);

  function updateBadges() {
    const n = store.cart.reduce((s, l) => s + l.qty, 0);
    const c = $('#cart-count');
    c.hidden = !n;
    c.textContent = n;
    const f = $('#fav-count');
    f.hidden = !store.favs.length;
    f.textContent = store.favs.length;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  function addToCart(id, size) {
    const line = store.cart.find((l) => l.id === id && l.size === size);
    line ? (line.qty = Math.min(line.qty + 1, 10)) : store.cart.push({ id, size, qty: 1 });
    store.save();
    openCart(true);
  }

  function toggleFav(id) {
    const on = store.favs.includes(id);
    store.favs = on ? store.favs.filter((f) => f !== id) : [...store.favs, id];
    store.save();
    toast(on ? 'Removido dos favoritos' : 'Salvo nos favoritos');
    document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(!on)));
  }

  /* ---------- Componentes ---------- */
  const priceHTML = (p) =>
    p.compareAt
      ? `<p class="price"><span class="now">${brl(p.price)}</span><s>${brl(p.compareAt)}</s></p>`
      : `<p class="price">${brl(p.price)}</p>`;

  function card(p, eager) {
    const [a, b] = p.images;
    const tag = p.compareAt
      ? `<span class="tag sale">-${Math.round((1 - p.price / p.compareAt) * 100)}%</span>`
      : p.isNew ? '<span class="tag">Novo</span>' : '';
    return `<li class="card">
      <div class="card-media">
        <a href="#/p/${p.slug}" tabindex="-1" aria-hidden="true">
          <img src="${a.src}" alt="${esc(a.alt)}" ${eager ? '' : 'loading="lazy"'} decoding="async" width="720" height="1080">
          ${b ? `<img class="alt" src="${b.src}" alt="" loading="lazy" decoding="async">` : ''}
        </a>
        ${tag}
        <button class="fav" data-fav="${p.id}" aria-pressed="${store.favs.includes(p.id)}" aria-label="Favoritar ${esc(p.name)}">${icon(HEART)}</button>
        <button class="quick" data-quick="${p.id}" aria-label="Adicionar ${esc(p.name)} à sacola">+</button>
      </div>
      <div class="card-info">
        <h3><a href="#/p/${p.slug}">${esc(p.name)}</a></h3>
        ${priceHTML(p)}
        <p class="muted"><span class="swatch" style="background:${p.color.hex}"></span>${esc(p.color.name)}</p>
      </div>
    </li>`;
  }

  const grid = (list, eagerCount = 0) => `<ul class="grid">${list.map((p, i) => card(p, i < eagerCount)).join('')}</ul>`;
  const sortBest = (list) => [...list].sort((a, b) => a.rank - b.rank);

  /* ---------- Páginas ---------- */
  function home() {
    const news = P.filter((p) => p.isNew).slice(0, 8);
    const cards = [CATS[1], { ...CATS[2], name: 'Moda Praia' }, CATS[0], BEST];
    return `
      <section class="hero">
        <img src="img/campanha-summer-2027.webp" alt="Modelo de costas na borda de uma piscina com vista para o mar, usando biquíni marrom-cacau" fetchpriority="high">
        <div class="wrap">
          <p class="eyebrow">Summer Collection 2027</p>
          <h1>Descubra a nova coleção.</h1>
          <div class="hero-ctas"><a class="btn btn-light" href="#/c/novidades">Comprar agora</a><a class="link" href="#/c/biquinis">Ver biquínis</a></div>
        </div>
      </section>
      <section class="wrap section" aria-label="Categorias">
        <ul class="cats">${cards
          .map((c) => `<li><a class="cat" href="#/c/${c.slug}"><figure><img src="${c.img}" alt="" loading="lazy"></figure><span>${c.name} →</span></a></li>`)
          .join('')}</ul>
      </section>
      <section class="wrap section">
        <div class="section-head"><h2 class="section-title">Novidades</h2><a class="link" href="#/c/novidades">Ver tudo</a></div>
        ${grid(news)}
      </section>
      <section class="campaign">
        <div class="campaign-imgs">
          <img src="img/biquini-cacau-cortininha.webp" alt="Modelo na piscina usando biquíni cortininha marrom-cacau" loading="lazy">
          <img src="img/biquini-cacau-cortininha-espelho.webp" alt="Modelo em foto no espelho usando biquíni marrom-cacau" loading="lazy">
        </div>
        <div class="campaign-text">
          <p class="eyebrow">Cápsula Cacau</p>
          <h2>O marrom que define o verão 2027</h2>
          <p>Cortes mínimos, amarrações finas e um tom que realça qualquer pele. Do PP ao GG.</p>
          <a class="btn" href="#/p/biquini-cacau-cortininha">Comprar o look</a>
        </div>
      </section>
      <section class="wrap section">
        <div class="section-head"><h2 class="section-title">Mais vendidos</h2><a class="link" href="#/c/mais-vendidos">Ver tudo</a></div>
        ${grid(sortBest(P).slice(0, 4))}
      </section>
      <section class="wrap">
        <ul class="perks">
          <li><strong>Frete grátis</strong>Acima de R$ 299</li>
          <li><strong>Troca grátis</strong>Em até 30 dias</li>
          <li><strong>3x sem juros</strong>Em todos os cartões</li>
          <li><strong>5% off no Pix</strong>Aprovação imediata</li>
        </ul>
      </section>`;
  }

  function listing(title, list, crumbs, activeSlug) {
    const colors = [...new Set(list.map((p) => p.color.name))];
    const cols = [...new Set(list.map((p) => p.collection))];
    return `<div class="wrap">
      <nav class="crumbs" aria-label="Você está em"><a href="#/">Início</a> / ${esc(crumbs)}</nav>
      <h1 class="page-title">${esc(title)}</h1>
      <nav class="pills" aria-label="Categorias">${CATS.map(
        (c) => `<a href="#/c/${c.slug}" ${c.slug === activeSlug ? 'aria-current="page"' : ''}>${c.name}</a>`,
      ).join('')}</nav>
      <div class="toolbar" id="toolbar">
        <label class="sr" for="f-size">Tamanho</label>
        <select id="f-size"><option value="">Tamanho</option>${SIZES.map((s) => `<option>${s}</option>`).join('')}</select>
        <label class="sr" for="f-color">Cor</label>
        <select id="f-color"><option value="">Cor</option>${colors.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <label class="sr" for="f-price">Preço</label>
        <select id="f-price"><option value="">Preço</option><option value="0-150">Até R$ 150</option><option value="150-200">R$ 150 a 200</option><option value="200-9999">Acima de R$ 200</option></select>
        <label class="sr" for="f-col">Coleção</label>
        <select id="f-col"><option value="">Coleção</option>${cols.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <label class="sr" for="f-sort">Ordenar</label>
        <select id="f-sort"><option value="">Recomendados</option><option value="best">Mais vendidos</option><option value="asc">Menor preço</option><option value="desc">Maior preço</option></select>
        <span class="count muted" id="count" aria-live="polite"></span>
      </div>
      <div id="results"></div>
    </div>`;
  }

  function bindListing(list) {
    const bar = $('#toolbar');
    const run = () => {
      const v = (id) => $(id).value;
      let out = list.filter((p) => {
        if (v('#f-size') && !p.stock[v('#f-size')]) return false;
        if (v('#f-color') && p.color.name !== v('#f-color')) return false;
        if (v('#f-col') && p.collection !== v('#f-col')) return false;
        if (v('#f-price')) {
          const [min, max] = v('#f-price').split('-').map(Number);
          if (p.price < min || p.price >= max) return false;
        }
        return true;
      });
      const s = v('#f-sort');
      if (s === 'asc') out.sort((a, b) => a.price - b.price);
      else if (s === 'desc') out.sort((a, b) => b.price - a.price);
      else if (s === 'best') out = sortBest(out);
      $('#count').textContent = `${out.length} ${out.length === 1 ? 'produto' : 'produtos'}`;
      $('#results').innerHTML = out.length
        ? grid(out, 2)
        : '<div class="empty"><p>Nenhum produto com esses filtros.</p><button class="btn btn-outline" id="clear">Limpar filtros</button></div>';
    };
    bar.addEventListener('change', run);
    app.addEventListener('click', (e) => {
      if (e.target.id === 'clear') {
        bar.querySelectorAll('select').forEach((s) => (s.value = ''));
        run();
      }
    });
    run();
  }

  function product(p) {
    const cat = CATS.find((c) => p.cats.includes(c.slug) && c.slug !== 'novidades') || CATS[3];
    const related = sortBest(P.filter((x) => x.id !== p.id && x.collection === p.collection)).slice(0, 4);
    const pix = brl(p.price * (1 - PIX));
    return `<div class="wrap">
      <nav class="crumbs" aria-label="Você está em"><a href="#/">Início</a> / <a href="#/c/${cat.slug}">${cat.name}</a> / ${esc(p.name)}</nav>
      <div class="pdp">
        <div class="gallery ${p.images.length === 1 ? 'one' : ''}" aria-label="Fotos de ${esc(p.name)}">
          ${p.images.map((im, i) => `<button data-zoom="${im.src}" aria-label="Ampliar foto ${i + 1}"><img src="${im.src}" alt="${esc(im.alt)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></button>`).join('')}
        </div>
        <div class="buy">
          <div>
            <p class="eyebrow muted">${esc(p.collection)}</p>
            <h1>${esc(p.name)}</h1>
            <a href="#avaliacoes" class="muted"><span class="stars" aria-hidden="true">★★★★★</span> ${p.rating.toFixed(1).replace('.', ',')} (${p.reviews} avaliações)</a>
          </div>
          <div>
            <p class="big">${p.compareAt ? `<span class="price"><span class="now">${brl(p.price)}</span><s>${brl(p.compareAt)}</s></span>` : brl(p.price)}</p>
            <p class="muted">ou 3x de ${brl(p.price / 3)} sem juros · <span class="pix">${pix} no Pix</span></p>
          </div>
          <p><span class="swatch"style="background:${p.color.hex}"></span>Cor: <strong>${esc(p.color.name)}</strong></p>
          <div>
            <div class="sizes-head"><span id="size-label">Tamanho</span><button class="link" data-open="guide">Guia de tamanhos</button></div>
            <fieldset class="sizes" aria-labelledby="size-label">${SIZES.map(
              (s) => `<label><input type="radio" name="size" value="${s}" ${p.stock[s] ? '' : 'disabled'}>${s}${p.stock[s] ? '' : '<span class="sr"> (esgotado)</span>'}</label>`,
            ).join('')}</fieldset>
            <p class="err" id="size-err" role="alert" hidden>Selecione um tamanho para continuar</p>
          </div>
          <div class="buy-actions">
            <button class="btn" id="add">Adicionar à sacola</button>
            <button class="fav-lg" data-fav="${p.id}" aria-pressed="${store.favs.includes(p.id)}" aria-label="Favoritar ${esc(p.name)}">${icon(HEART)}</button>
          </div>
          <ul class="perk-box"><li>🚚 Frete grátis acima de R$ 299</li><li>↺ Primeira troca grátis em até 30 dias</li><li>🔒 Compra 100% segura</li></ul>
          <div>
            <details open><summary>Descrição e detalhes</summary><div><p>${esc(p.desc)}</p><ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div></details>
            <details><summary>Composição e cuidados</summary><div><p>${esc(p.composition)}</p><p>Lavar à mão em água fria e secar à sombra.</p></div></details>
            <details><summary>Entrega e trocas</summary><div><p>Entrega padrão em 5 a 8 dias úteis. Frete grátis acima de R$ 299.</p><p>Biquínis só podem ser trocados com etiqueta e adesivo de proteção intactos.</p></div></details>
          </div>
        </div>
      </div>
      <section class="section" id="avaliacoes">
        <h2 class="section-title">Avaliações · ${p.rating.toFixed(1).replace('.', ',')} ★</h2>
        <div class="review"><strong>Camila R.</strong> ★★★★★<p>Tecido grosso, não fica transparente molhado. Serviu perfeitamente.</p></div>
        <div class="review"><strong>Juliana M.</strong> ★★★★★<p>A cor é igual à foto. Chegou antes do prazo.</p></div>
        <p class="muted">Avaliações ilustrativas — projeto demonstrativo.</p>
      </section>
      ${related.length ? `<section class="section"><h2 class="section-title" style="margin-bottom:24px">Você também pode gostar</h2>${grid(related)}</section>` : ''}
    </div>`;
  }

  function bindProduct(p) {
    $('#add').addEventListener('click', () => {
      const sel = $('input[name="size"]:checked');
      const err = $('#size-err');
      if (!sel) {
        err.hidden = false;
        $('.sizes').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      err.hidden = true;
      addToCart(p.id, sel.value);
    });
    $('.sizes').addEventListener('change', () => ($('#size-err').hidden = true));
  }

  function favorites() {
    const list = store.favs.map(byId).filter(Boolean);
    return `<div class="wrap"><h1 class="page-title" style="padding-top:32px">Favoritos</h1>${
      list.length ? grid(list) : '<div class="empty"><p>Nenhum favorito ainda. Toque no coração das peças que você amar.</p><a class="btn" href="#/c/novidades">Explorar novidades</a></div>'
    }</div>`;
  }

  function checkout() {
    const lines = cartLines();
    if (!lines.length)
      return '<div class="wrap empty"><p>Sua sacola está vazia.</p><a class="btn" href="#/c/novidades">Ver novidades</a></div>';
    return `<div class="wrap checkout">
      <form class="form" id="co" novalidate>
        <h1 class="page-title">Finalizar compra</h1>
        <h2>1. Contato</h2>
        <label class="field">E-mail<input type="email" name="email" autocomplete="email" required></label>
        <label class="field">Celular (WhatsApp)<input type="tel" name="tel" autocomplete="tel" inputmode="numeric" required placeholder="(11) 91234-5678"></label>
        <h2>2. Endereço</h2>
        <label class="field">Nome completo<input name="nome" autocomplete="name" required></label>
        <div class="row2"><label class="field">CEP<input name="cep" autocomplete="postal-code" inputmode="numeric" required placeholder="00000-000"></label><label class="field">Número<input name="num" required></label></div>
        <label class="field">Endereço<input name="end" autocomplete="address-line1" required></label>
        <div class="row2"><label class="field">Cidade<input name="cidade" autocomplete="address-level2" required></label><label class="field">Estado<select name="uf" required><option value="">Selecione</option>${'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map((u) => `<option>${u}</option>`).join('')}</select></label></div>
        <h2>3. Entrega</h2>
        <label class="opt"><input type="radio" name="frete" value="padrao" checked><span><strong>Padrão</strong><br><small class="muted">5 a 8 dias úteis</small></span><b id="ship-std"></b></label>
        <label class="opt"><input type="radio" name="frete" value="expressa"><span><strong>Expressa</strong><br><small class="muted">1 a 3 dias úteis</small></span><b>${brl(34.9)}</b></label>
        <h2>4. Pagamento</h2>
        <label class="opt"><input type="radio" name="pag" value="pix" checked><span><strong>Pix</strong> · 5% de desconto</span></label>
        <label class="opt"><input type="radio" name="pag" value="cartao"><span><strong>Cartão de crédito</strong> · até 3x sem juros</span></label>
        <label class="opt"><input type="radio" name="pag" value="boleto"><span><strong>Boleto</strong></span></label>
        <p class="muted">🔒 Demonstração: nenhum dado de pagamento é solicitado ou processado.</p>
        <label class="field">Cupom (opcional)<input name="cupom" placeholder="BEMVINDA10"></label>
        <p class="err" id="co-err" role="alert" hidden>Preencha os campos destacados.</p>
        <button class="btn btn-block" style="min-height:56px">Confirmar pedido</button>
      </form>
      <aside class="summary" aria-label="Resumo do pedido" id="summary"></aside>
    </div>`;
  }

  function bindCheckout() {
    const form = $('#co');
    if (!form) return;
    const calc = () => {
      const sub = subtotal();
      const data = new FormData(form);
      const ship = data.get('frete') === 'expressa' ? 34.9 : sub >= FREE_SHIPPING ? 0 : 19.9;
      let base = sub;
      const lines = [];
      if (String(data.get('cupom')).trim().toUpperCase() === 'BEMVINDA10') {
        lines.push(['Cupom BEMVINDA10', base * 0.1]);
        base *= 0.9;
      }
      if (data.get('pag') === 'pix') lines.push(['Desconto Pix', base * PIX]);
      const total = sub + ship - lines.reduce((s, [, v]) => s + v, 0);
      $('#ship-std').textContent = sub >= FREE_SHIPPING ? 'Grátis' : brl(19.9);
      $('#summary').innerHTML = `<h2 style="font-size:18px">Resumo do pedido</h2>
        ${cartLines().map((l) => `<div><span>${l.qty}× ${esc(l.p.name)} (${l.size})</span><span>${brl(l.p.price * l.qty)}</span></div>`).join('')}
        <hr style="border:0;border-top:1px solid var(--line);width:100%">
        <div><span>Subtotal</span><span>${brl(sub)}</span></div>
        <div><span>Frete</span><span>${ship ? brl(ship) : 'Grátis'}</span></div>
        ${lines.map(([k, v]) => `<div style="color:var(--ok)"><span>${k}</span><span>-${brl(v)}</span></div>`).join('')}
        <div style="font-size:18px;font-weight:600"><span>Total</span><span>${brl(total)}</span></div>`;
      return total;
    };
    form.addEventListener('input', calc);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        $('#co-err').hidden = false;
        form.querySelectorAll('input, select').forEach((el) => el.checkValidity() || el.setAttribute('style', 'border-color:var(--sale)'));
        form.querySelector(':invalid').focus();
        return;
      }
      const total = calc();
      const email = new FormData(form).get('email');
      store.cart = [];
      store.save();
      location.hash = `#/ok/${String(Date.now()).slice(-8)}/${total.toFixed(2)}/${encodeURIComponent(email)}`;
    });
    calc();
  }

  function confirmation([order, total, email]) {
    return `<div class="wrap empty" style="max-width:560px">
      <p style="font-size:40px;color:var(--ok)">✓</p>
      <h1 class="page-title" style="color:var(--text)">Pedido confirmado!</h1>
      <p>Pedido <strong>#${esc(order)}</strong> · Total <strong>${brl(Number(total))}</strong></p>
      <p>Enviamos os detalhes para ${esc(decodeURIComponent(email || ''))}.</p>
      <p class="muted">Demonstração: nenhum pedido real foi criado.</p>
      <a class="btn" href="#/">Voltar para a loja</a>
    </div>`;
  }

  /* ---------- Roteador ---------- */
  function route() {
    // Âncoras internas (#avaliacoes, #app) apenas rolam a página, sem trocar de tela.
    if (location.hash && !location.hash.startsWith('#/')) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) return el.scrollIntoView({ behavior: 'smooth' });
    }
    const [, page = '', ...rest] = (location.hash || '#/').slice(1).split('/');
    let html;
    let after;
    let title = 'ZARA — Moda praia premium';
    if (page === 'c') {
      const c = [...CATS, BEST].find((x) => x.slug === rest[0]) || CATS[3];
      const list = c.slug === 'mais-vendidos' ? sortBest(catProducts(c.slug)) : catProducts(c.slug);
      html = listing(c.title, list, c.name, c.slug);
      after = () => bindListing(list);
      title = `${c.title} | ZARA`;
    } else if (page === 'p' && bySlug(rest[0])) {
      const p = bySlug(rest[0]);
      html = product(p);
      after = () => bindProduct(p);
      title = `${p.name} | ZARA`;
    } else if (page === 'favoritos') {
      html = favorites();
      title = 'Favoritos | ZARA';
    } else if (page === 'checkout') {
      html = checkout();
      after = bindCheckout;
      title = 'Finalizar compra | ZARA';
    } else if (page === 'ok') {
      html = confirmation(rest);
      title = 'Pedido confirmado | ZARA';
    } else {
      html = home();
    }
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    app.innerHTML = html;
    document.title = title;
    after?.();
    document.querySelectorAll('#nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#/c/${rest[0]}` && page === 'c'));
    window.scrollTo(0, 0);
  }

  /* ---------- Painéis ---------- */
  function openCart(justAdded = false) {
    const lines = cartLines();
    const sub = subtotal();
    const falta = FREE_SHIPPING - sub;
    $('#cart-title').textContent = `Sacola (${lines.reduce((s, l) => s + l.qty, 0)})`;
    $('#cart-body').innerHTML = lines.length
      ? `${justAdded ? '<p class="added" role="status">✓ Produto adicionado ao carrinho</p>' : ''}
        <div class="ship">${falta > 0 ? `Faltam <strong>${brl(falta)}</strong> para o frete grátis` : '<strong>Parabéns!</strong> Seu frete é grátis.'}
          <div class="ship-bar"><span style="width:${Math.min(sub / FREE_SHIPPING, 1) * 100}%"></span></div></div>
        ${lines.map((l, i) => `<div class="line"><img src="${l.p.images[0].src}" alt="${esc(l.p.name)}">
          <div><strong>${esc(l.p.name)}</strong>${priceHTML(l.p)}<p class="muted">${esc(l.p.color.name)} · Tamanho ${l.size}</p>
          <div class="line-row"><div class="qty"><button data-qty="${i}" data-d="-1" aria-label="Diminuir quantidade">−</button><span>${l.qty}</span><button data-qty="${i}" data-d="1" aria-label="Aumentar quantidade">+</button></div>
          <button class="link muted" data-rm="${i}">Remover</button></div></div></div>`).join('')}`
      : '<div class="empty"><p><strong>Sua sacola está vazia</strong></p><a class="btn" href="#/c/novidades">Ver novidades</a></div>';
    $('#cart-foot').innerHTML = lines.length
      ? `<div class="totals"><span>Subtotal</span><span>${brl(sub)}</span></div>
         <p class="pix" style="font-size:14px">No Pix: ${brl(sub * (1 - PIX))}</p>
         <a class="btn btn-block" href="#/checkout">Finalizar compra</a>
         <button class="link" data-close>Continuar comprando</button>`
      : '';
    const d = $('#cart');
    if (!d.open) d.showModal();
  }

  function renderSearch(q) {
    const box = $('#search-results');
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      box.innerHTML = `<p class="eyebrow muted" style="margin:20px 0 12px">Buscas populares</p><div class="chips">${['Biquíni preto', 'Cortininha', 'Faixa', 'Verde', 'Coral']
        .map((t) => `<button data-term="${t}">${t}</button>`)
        .join('')}</div>`;
      return;
    }
    const res = P.filter((p) => {
      const hay = norm([p.name, p.color.name, p.collection, p.desc, ...p.cats].join(' '));
      return terms.every((t) => hay.includes(t));
    });
    box.innerHTML = res.length
      ? `<p class="eyebrow muted" style="margin:20px 0 12px">${res.length} ${res.length === 1 ? 'produto' : 'produtos'}</p>${res
          .map((p) => `<a class="s-item" href="#/p/${p.slug}"><img src="${p.images[0].src}" alt="" loading="lazy"><span><strong style="font-weight:500">${esc(p.name)}</strong>${priceHTML(p)}</span></a>`)
          .join('')}`
      : `<p class="muted" style="margin-top:20px">Nenhum resultado para “${esc(q)}”. Tente “biquíni” ou uma cor, como “preto”.</p>`;
  }

  /* ---------- Eventos globais (delegação: um listener para tudo) ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, dialog');
    if (!t) return;
    if (t.tagName === 'DIALOG') return e.target === t && t.close(); // clique no fundo fecha
    const ds = t.dataset;
    if (ds.open === 'cart') return openCart();
    if (ds.open) {
      const d = $('#' + ds.open);
      d.showModal();
      if (ds.open === 'search') {
        renderSearch($('#q').value);
        $('#q').focus();
      }
      return;
    }
    if ('close' in ds) return t.closest('dialog').close();
    if (ds.fav) return toggleFav(ds.fav);
    if (ds.quick) {
      const p = byId(ds.quick);
      const media = t.parentElement;
      t.outerHTML = `<div class="quick-panel" role="group" aria-label="Escolha o tamanho"><p>Escolha o tamanho</p><div>${SIZES.map(
        (s) => `<button data-add="${p.id}" data-size="${s}" ${p.stock[s] ? '' : 'disabled'} aria-label="Adicionar tamanho ${s}">${s}</button>`,
      ).join('')}</div></div>`;
      media.querySelector('[data-size]:not(:disabled)')?.focus();
      return;
    }
    if (ds.add) {
      const panel = t.closest('.quick-panel');
      panel.outerHTML = `<button class="quick" data-quick="${ds.add}" aria-label="Adicionar à sacola">+</button>`;
      return addToCart(ds.add, ds.size);
    }
    if (ds.qty) {
      const l = store.cart[ds.qty];
      l.qty = Math.min(10, l.qty + Number(ds.d));
      if (l.qty < 1) store.cart.splice(ds.qty, 1);
      store.save();
      return openCart();
    }
    if (ds.rm) {
      store.cart.splice(ds.rm, 1);
      store.save();
      return openCart();
    }
    if (ds.term) {
      $('#q').value = ds.term;
      return renderSearch(ds.term);
    }
    if (ds.zoom) {
      $('#zoom-img').src = ds.zoom;
      $('.zoom-stage').classList.remove('on');
      return $('#zoom').showModal();
    }
    if (t.tagName === 'A' && t.closest('dialog') && t.getAttribute('href')?.startsWith('#/')) t.closest('dialog').close();
  });

  $('#zoom-img').addEventListener('click', () => $('.zoom-stage').classList.toggle('on'));
  $('#q').addEventListener('input', (e) => renderSearch(e.target.value));
  $('#q').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      $('#search').close();
    }
  });

  /* ---------- Início ---------- */
  const navHTML = CATS.map((c) => `<a href="#/c/${c.slug}" ${c.sale ? 'class="sale"' : ''}>${c.name}</a>`).join('');
  $('#nav').innerHTML = navHTML;
  $('#menu-list').innerHTML = navHTML.replaceAll('</a>', ' <span aria-hidden="true">›</span></a>') + `<a href="#/c/mais-vendidos">Mais vendidos</a><a href="#/favoritos">Favoritos</a>`;
  $('#foot-cats').innerHTML = CATS.map((c) => `<li><a href="#/c/${c.slug}">${c.name}</a></li>`).join('');
  store.load();
  updateBadges();
  window.addEventListener('hashchange', route);
  route();
})();
