/* D4rkFace · comportamiento común: cabecera, pie, tema, contador,
   y funciones de las páginas de entrada (TOC, copiar código, ampliar imágenes). */
(function () {
    'use strict';

    var $ = function (selector, root) { return (root || document).querySelector(selector); };
    var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (key) {
            if (key === 'text') node.textContent = attrs[key];
            else if (attrs[key] !== false && attrs[key] != null) node.setAttribute(key, attrs[key]);
        });
        (children || []).forEach(function (child) {
            node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return node;
    }

    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function slugify(value) {
        return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
    }

    function difficultyClass(value) {
        var v = normalize(value);
        if (v.indexOf('facil') === 0 || v === 'easy') return 'badge-easy';
        if (v.indexOf('medi') === 0) return 'badge-medium';
        if (v.indexOf('dificil') === 0 || v === 'hard') return 'badge-hard';
        if (v.indexOf('insan') === 0) return 'badge-insane';
        return '';
    }

    function badge(text, extraClass) {
        return el('span', { 'class': 'badge ' + (extraClass || ''), text: text });
    }

    window.D4 = { el: el, normalize: normalize, slugify: slugify, difficultyClass: difficultyClass, badge: badge };

    var config = { nombre: 'D4rkFace', correo: '', contador: {} };

    var NAV = [
        ['Inicio', '/'],
        ['Retos', '/retos/'],
        ['Vulnerabilidades', '/vulnerabilidades/'],
        ['Sobre mí', '/sobre-mi/']
    ];

    function isCurrent(href) {
        var path = location.pathname.replace(/index\.html$/, '');
        if (href === '/') return path === '/';
        return path.indexOf(href) === 0;
    }

    /* ---------- Cabecera y pie ---------- */

    function buildHeader(target) {
        var nav = el('nav', { 'class': 'site-nav', 'aria-label': 'Navegación principal' });
        NAV.forEach(function (item) {
            var link = el('a', { href: item[1], text: item[0] });
            if (isCurrent(item[1])) link.setAttribute('aria-current', 'page');
            nav.appendChild(link);
        });

        var toggle = el('button', { 'class': 'theme-toggle', type: 'button', 'aria-label': 'Cambiar entre tema claro y oscuro' });
        function paintToggle() {
            var dark = document.documentElement.getAttribute('data-theme') !== 'light';
            toggle.textContent = dark ? '☀' : '☾';
            toggle.setAttribute('title', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
        }
        toggle.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('d4-theme', next); } catch (e) { /* sin almacenamiento */ }
            paintToggle();
        });
        paintToggle();

        target.classList.add('site-header');
        target.appendChild(el('a', { 'class': 'brand', href: '/', 'aria-label': config.nombre + ', ir al inicio' }, [
            el('img', { 'class': 'brand-mark', src: '/assets/img/brand-mark.png', alt: '', width: '32', height: '32' }),
            el('span', { text: config.nombre })
        ]));
        target.appendChild(nav);
        target.appendChild(el('div', { 'class': 'header-actions' }, [
            toggle,
            el('a', { 'class': 'header-cta', href: '/sobre-mi/#contacto' }, ['Contacto ', el('span', { 'aria-hidden': 'true', text: '↗' })])
        ]));
    }

    function buildFooter(target) {
        target.classList.add('site-footer');
        target.appendChild(el('p', { text: '© ' + new Date().getFullYear() + ' ' + config.nombre + '. Contenido educativo para entornos autorizados.' }));
        var links = el('nav', { 'class': 'footer-nav', 'aria-label': 'Navegación del pie de página' });
        [['Inicio', '/'], ['Retos', '/retos/'], ['Vulnerabilidades', '/vulnerabilidades/'], ['Privacidad', '/privacidad/']].forEach(function (item) {
            links.appendChild(el('a', { href: item[1], text: item[0] }));
        });
        target.appendChild(links);
        var counter = el('p', { 'class': 'visit-counter', hidden: 'hidden' }, ['Visitas: ', el('strong', { id: 'visit-count', text: '—' })]);
        target.appendChild(counter);
    }

    /* ---------- Contador de visitas (opcional, GoatCounter, sin cookies) ---------- */

    function initCounter() {
        var code = config.contador && config.contador.goatcounter;
        var box = $('.visit-counter');
        if (!code || !/^[a-z0-9-]+$/i.test(code) || !box) return;

        var script = el('script', { async: 'async', src: 'https://gc.zgo.at/count.js', 'data-goatcounter': 'https://' + code + '.goatcounter.com/count' });
        document.head.appendChild(script);

        fetch('https://' + code + '.goatcounter.com/counter/TOTAL.json')
            .then(function (response) { return response.ok ? response.json() : Promise.reject(); })
            .then(function (data) {
                $('#visit-count').textContent = String(data.count || '—');
                box.hidden = false;
            })
            .catch(function () { /* si falla, el contador permanece oculto */ });
    }

    /* ---------- Volver arriba ---------- */

    function initToTop() {
        var button = el('button', { 'class': 'to-top', type: 'button', 'aria-label': 'Volver arriba', text: '↑' });
        button.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
        document.body.appendChild(button);
        function toggle() { button.classList.toggle('is-visible', window.scrollY > 600); }
        window.addEventListener('scroll', toggle, { passive: true });
        toggle();
    }

    /* ---------- Página de entrada ---------- */

    function initEntry() {
        var metaNode = $('#reto-meta');
        var article = $('.reto-solucion');
        if (!metaNode || !article) return;

        var meta = {};
        try { meta = JSON.parse(metaNode.textContent); } catch (e) { /* JSON mal formado: se ignora */ }

        var crumb = $('[data-breadcrumb]');
        if (crumb) {
            var section = location.pathname.split('/').filter(Boolean)[0];
            var sectionName = section === 'vulnerabilidades' ? 'Vulnerabilidades' : 'Retos';
            var sep = function () { return el('span', { 'aria-hidden': 'true', text: '›' }); };
            crumb.appendChild(el('a', { href: '/', text: 'Inicio' }));
            crumb.appendChild(sep());
            crumb.appendChild(el('a', { href: '/' + (section === 'vulnerabilidades' ? 'vulnerabilidades' : 'retos') + '/', text: sectionName }));
            if (meta.plataforma) {
                crumb.appendChild(sep());
                crumb.appendChild(el('a', { href: '/' + (section === 'vulnerabilidades' ? 'vulnerabilidades' : 'retos') + '/?plataforma=' + encodeURIComponent(meta.plataforma), text: meta.plataforma }));
            }
        }

        var chips = $('[data-meta-chips]');
        if (chips) {
            if (meta.plataforma) chips.appendChild(badge(meta.plataforma, 'badge-platform'));
            if (meta.categoria) chips.appendChild(badge(meta.categoria));
            if (meta.dificultad) chips.appendChild(badge(meta.dificultad, difficultyClass(meta.dificultad)));
            if (meta.estado) chips.appendChild(badge(meta.estado));
            if (meta.fecha) chips.appendChild(badge(meta.fecha));
            (meta.etiquetas || []).forEach(function (tag) { chips.appendChild(badge('#' + tag)); });
        }

        buildToc(article);
        enhanceCode(article);
        enableZoom(article);
        lazyFrames(article);
    }

    function buildToc(article) {
        var headings = $$('h2, h3', article).filter(function (h) { return h.textContent.trim(); });
        var side = $('[data-toc]');
        var mobile = $('[data-toc-mobile]');
        if (headings.length < 2) {
            if (side) side.hidden = true;
            return;
        }

        var used = {};
        headings.forEach(function (heading) {
            if (!heading.id) {
                var base = slugify(heading.textContent);
                var id = base, n = 2;
                while (used[id] || document.getElementById(id)) { id = base + '-' + n++; }
                heading.id = id;
            }
            used[heading.id] = true;
        });

        function makeList() {
            var list = el('ol');
            headings.forEach(function (heading) {
                var item = el('li');
                item.appendChild(el('a', { href: '#' + heading.id, 'class': heading.tagName === 'H3' ? 'toc-sub' : '', text: heading.textContent.trim() }));
                list.appendChild(item);
            });
            return list;
        }

        if (side) side.appendChild(makeList());
        if (mobile) {
            var details = el('details', { 'class': 'reto-toc' }, [el('summary', { text: 'Contenido de la solución' }), makeList()]);
            mobile.appendChild(details);
            mobile.classList.add('has-items');
        }

        if ('IntersectionObserver' in window && side) {
            var links = $$('a', side);
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        links.forEach(function (link) {
                            link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
                        });
                    }
                });
            }, { rootMargin: '0px 0px -70% 0px' });
            headings.forEach(function (heading) { observer.observe(heading); });
        }
    }

    function enhanceCode(article) {
        $$('pre', article).forEach(function (pre) {
            if (pre.parentNode.classList.contains('code-block')) return;
            var wrapper = el('div', { 'class': 'code-block' });
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            var button = el('button', { 'class': 'copy-btn', type: 'button', text: 'Copiar', 'aria-label': 'Copiar el código al portapapeles' });
            button.addEventListener('click', function () {
                var text = pre.innerText;
                var done = function () {
                    button.textContent = '¡Copiado!';
                    button.classList.add('is-done');
                    setTimeout(function () { button.textContent = 'Copiar'; button.classList.remove('is-done'); }, 1600);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(done, function () { button.textContent = 'Error'; });
                } else {
                    var area = el('textarea', { 'class': 'sr-only' });
                    area.value = text;
                    document.body.appendChild(area);
                    area.select();
                    try { document.execCommand('copy'); done(); } catch (e) { button.textContent = 'Error'; }
                    area.remove();
                }
            });
            wrapper.appendChild(button);
        });
    }

    function enableZoom(article) {
        var box = el('div', { 'class': 'lightbox', hidden: 'hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Imagen ampliada' });
        var image = el('img', { alt: '' });
        var close = el('button', { 'class': 'lightbox-close', type: 'button', 'aria-label': 'Cerrar', text: '×' });
        box.appendChild(image);
        box.appendChild(close);
        document.body.appendChild(box);

        function hide() { box.hidden = true; document.body.style.overflow = ''; }
        function show(source) {
            image.src = source.currentSrc || source.src;
            image.alt = source.alt || '';
            box.hidden = false;
            close.focus();
        }
        box.addEventListener('click', hide);
        document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !box.hidden) hide(); });

        $$('img', article).forEach(function (img) {
            if (img.closest('a') || img.hasAttribute('data-nozoom')) return;
            img.setAttribute('tabindex', '0');
            img.setAttribute('role', 'button');
            if (!img.alt) img.alt = 'Captura de evidencia';
            img.addEventListener('click', function () { show(img); });
            img.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(img); }
            });
        });
    }

    function lazyFrames(article) {
        $$('iframe', article).forEach(function (frame) { frame.setAttribute('loading', 'lazy'); });
    }

    /* ---------- Arranque ---------- */

    function start() {
        var skip = el('a', { 'class': 'skip-link', href: '#contenido', text: 'Saltar al contenido' });
        document.body.insertBefore(skip, document.body.firstChild);

        var header = $('[data-include="header"]');
        var footer = $('[data-include="footer"]');
        if (header) buildHeader(header);
        if (footer) buildFooter(footer);
        $$('[data-mail]').forEach(function (link) {
            if (!config.correo) { link.hidden = true; return; }
            link.setAttribute('href', 'mailto:' + config.correo);
            if (link.classList.contains('btn')) return;
            link.textContent = config.correo;
        });
        initToTop();
        initEntry();
        initCounter();
    }

    fetch('/site.config.json', { cache: 'no-cache' })
        .then(function (response) { return response.ok ? response.json() : {}; })
        .catch(function () { return {}; })
        .then(function (data) {
            config = Object.assign(config, data);
            start();
        });
})();
