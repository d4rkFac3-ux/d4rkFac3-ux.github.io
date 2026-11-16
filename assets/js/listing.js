/* D4rkFace · listados dinámicos a partir de /assets/data/retos.json
   (el archivo lo genera tools/build.mjs leyendo cada entrada). */
(function () {
    'use strict';

    var D4 = window.D4;
    var el = D4.el;
    var normalize = D4.normalize;

    var LEVELS = ['Fácil', 'Media', 'Difícil', 'Insana'];

    function levelRank(value) {
        var v = normalize(value);
        for (var i = 0; i < LEVELS.length; i++) {
            if (normalize(LEVELS[i]).slice(0, 4) === v.slice(0, 4)) return i;
        }
        return LEVELS.length;
    }

    function unique(values) {
        return values.filter(function (v, i, all) { return v && all.indexOf(v) === i; });
    }

    function countBy(list, key) {
        var map = {};
        list.forEach(function (item) { map[item[key]] = (map[item[key]] || 0) + 1; });
        return map;
    }

    function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function storageSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* sin almacenamiento */ } }

    function entryItem(entry) {
        var badges = el('div', { 'class': 'badges' }, [
            D4.badge(entry.plataforma, 'badge-platform'),
            entry.categoria ? D4.badge(entry.categoria) : '',
            entry.dificultad ? D4.badge(entry.dificultad, D4.difficultyClass(entry.dificultad)) : ''
        ].filter(Boolean));

        var link = el('a', { 'class': 'entry-link', href: entry.url }, [
            el('span', { 'class': 'entry-title', text: entry.titulo }),
            entry.resumen ? el('span', { 'class': 'entry-summary', text: entry.resumen }) : '',
            badges
        ].filter(Boolean));

        var checkbox = el('input', { type: 'checkbox' });
        var key = 'd4-done:' + entry.url;
        checkbox.checked = storageGet(key) === '1';
        checkbox.addEventListener('change', function () { storageSet(key, checkbox.checked ? '1' : ''); });
        var done = el('label', { 'class': 'check-done' }, [checkbox, 'Completado']);

        return el('li', { 'class': 'entry-item' }, [link, done]);
    }

    /* ---------- Portada: plataformas y últimas entradas ---------- */

    function renderPlatforms(target, data) {
        var counts = countBy(data, 'plataforma');
        var slugs = {};
        data.forEach(function (e) { slugs[e.plataforma] = e.plataformaSlug; });
        var names = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, 'es'); });
        if (!names.length) {
            target.appendChild(el('p', { 'class': 'empty-state', text: 'Pronto habrá soluciones publicadas.' }));
            return;
        }
        names.forEach(function (name) {
            target.appendChild(el('a', { 'class': 'platform-tile', href: '/retos/?plataforma=' + encodeURIComponent(name) }, [
                el('strong', { text: name }),
                el('span', { text: counts[name] + (counts[name] === 1 ? ' entrada' : ' entradas') })
            ]));
        });
    }

    function renderLatest(target, data) {
        var latest = data.slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).slice(0, 6);
        if (!latest.length) {
            target.appendChild(el('li', { 'class': 'empty-state', text: 'Aún no hay entradas publicadas.' }));
            return;
        }
        latest.forEach(function (entry) { target.appendChild(entryItem(entry)); });
    }

    /* ---------- Listado completo con filtros ---------- */

    function renderListing(root, all) {
        var section = root.getAttribute('data-listing');
        var data = all.filter(function (e) { return e.seccion === section; });
        var params = new URLSearchParams(location.search);

        var state = {
            q: params.get('q') || '',
            plataformas: (params.get('plataforma') || '').split(',').filter(Boolean),
            categoria: params.get('categoria') || '',
            dificultad: params.get('dificultad') || '',
            tipo: params.get('tipo') || '',
            orden: params.get('orden') || 'recientes'
        };

        if (!data.length) {
            root.appendChild(el('p', { 'class': 'empty-state', text: 'Aún no hay entradas en esta sección. Crea la primera copiando la carpeta _plantilla.' }));
            return;
        }

        var platforms = unique(data.map(function (e) { return e.plataforma; })).sort(function (a, b) { return a.localeCompare(b, 'es'); });
        var platformCounts = countBy(data, 'plataforma');
        var categories = unique(data.map(function (e) { return e.categoria; })).sort(function (a, b) { return a.localeCompare(b, 'es'); });
        var levels = unique(data.map(function (e) { return e.dificultad; })).sort(function (a, b) { return levelRank(a) - levelRank(b); });
        var types = unique(data.map(function (e) { return e.tipo; })).sort();

        function selectField(id, label, options, current, labels) {
            var select = el('select', { id: id }, [el('option', { value: '', text: 'Todas' })]);
            options.forEach(function (option) {
                var node = el('option', { value: option, text: (labels && labels[option]) || option });
                if (option === current) node.setAttribute('selected', 'selected');
                select.appendChild(node);
            });
            return { node: el('div', { 'class': 'field' }, [el('label', { 'for': id, text: label }), select]), select: select };
        }

        var TYPE_LABELS = { reto: 'Reto', maquina: 'Máquina', ejercicio: 'Ejercicio', guia: 'Guía', vulnerabilidad: 'Vulnerabilidad' };

        var search = el('input', { id: 'f-buscar', type: 'search', placeholder: 'Título, etiqueta, plataforma…', value: state.q });
        var categoryField = selectField('f-categoria', 'Categoría', categories, state.categoria);
        var levelField = selectField('f-dificultad', 'Dificultad', levels, state.dificultad);
        var typeField = selectField('f-tipo', 'Tipo', types, state.tipo, TYPE_LABELS);
        var sortSelect = el('select', { id: 'f-orden' }, [
            el('option', { value: 'recientes', text: 'Más recientes' }),
            el('option', { value: 'az', text: 'Título A–Z' }),
            el('option', { value: 'dificultad', text: 'Dificultad' })
        ]);
        sortSelect.value = state.orden;

        var chipGroup = el('fieldset', { 'class': 'chip-group' }, [el('legend', { text: 'Plataformas (sin marcar = todas)' })]);
        var chipInputs = platforms.map(function (name) {
            var input = el('input', { type: 'checkbox', value: name });
            input.checked = state.plataformas.indexOf(name) !== -1;
            chipGroup.appendChild(el('label', { 'class': 'chip-option' }, [input, el('span', { text: name + ' (' + platformCounts[name] + ')' })]));
            return input;
        });

        var status = el('p', { 'class': 'list-status', 'aria-live': 'polite' });
        var list = el('ul', { 'class': 'entry-list' });
        var empty = el('p', { 'class': 'empty-state', hidden: 'hidden', text: 'No hay entradas que coincidan con los filtros.' });
        var clear = el('button', { 'class': 'btn', type: 'button', text: 'Limpiar filtros' });

        var filters = el('div', { 'class': 'filters' }, [
            el('div', { 'class': 'filter-row' }, [
                el('div', { 'class': 'field' }, [el('label', { 'for': 'f-buscar', text: 'Buscar' }), search]),
                categoryField.node, levelField.node, typeField.node,
                el('div', { 'class': 'field' }, [el('label', { 'for': 'f-orden', text: 'Ordenar' }), sortSelect])
            ]),
            chipGroup,
            el('div', {}, [clear])
        ]);

        root.appendChild(filters);
        root.appendChild(status);
        root.appendChild(list);
        root.appendChild(empty);

        function currentMatches() {
            var term = normalize(state.q.trim());
            return data.filter(function (e) {
                if (state.plataformas.length && state.plataformas.indexOf(e.plataforma) === -1) return false;
                if (state.categoria && e.categoria !== state.categoria) return false;
                if (state.dificultad && e.dificultad !== state.dificultad) return false;
                if (state.tipo && e.tipo !== state.tipo) return false;
                if (term) {
                    var haystack = normalize([e.titulo, e.resumen, e.plataforma, e.categoria, (e.etiquetas || []).join(' ')].join(' '));
                    return haystack.indexOf(term) !== -1;
                }
                return true;
            }).sort(function (a, b) {
                if (state.orden === 'az') return a.titulo.localeCompare(b.titulo, 'es');
                if (state.orden === 'dificultad') return levelRank(a.dificultad) - levelRank(b.dificultad) || a.titulo.localeCompare(b.titulo, 'es');
                return String(b.fecha).localeCompare(String(a.fecha)) || a.titulo.localeCompare(b.titulo, 'es');
            });
        }

        function syncUrl() {
            var p = new URLSearchParams();
            if (state.q) p.set('q', state.q);
            if (state.plataformas.length) p.set('plataforma', state.plataformas.join(','));
            if (state.categoria) p.set('categoria', state.categoria);
            if (state.dificultad) p.set('dificultad', state.dificultad);
            if (state.tipo) p.set('tipo', state.tipo);
            if (state.orden !== 'recientes') p.set('orden', state.orden);
            var query = p.toString();
            history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
        }

        function paint() {
            var matches = currentMatches();
            while (list.firstChild) list.removeChild(list.firstChild);
            matches.forEach(function (entry) { list.appendChild(entryItem(entry)); });
            status.textContent = matches.length + (matches.length === 1 ? ' entrada' : ' entradas') + ' de ' + data.length;
            empty.hidden = matches.length !== 0;
            syncUrl();
        }

        search.addEventListener('input', function () { state.q = search.value; paint(); });
        categoryField.select.addEventListener('change', function (e) { state.categoria = e.target.value; paint(); });
        levelField.select.addEventListener('change', function (e) { state.dificultad = e.target.value; paint(); });
        typeField.select.addEventListener('change', function (e) { state.tipo = e.target.value; paint(); });
        sortSelect.addEventListener('change', function (e) { state.orden = e.target.value; paint(); });
        chipInputs.forEach(function (input) {
            input.addEventListener('change', function () {
                state.plataformas = chipInputs.filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
                paint();
            });
        });
        clear.addEventListener('click', function () {
            state = { q: '', plataformas: [], categoria: '', dificultad: '', tipo: '', orden: 'recientes' };
            search.value = '';
            categoryField.select.value = '';
            levelField.select.value = '';
            typeField.select.value = '';
            sortSelect.value = 'recientes';
            chipInputs.forEach(function (i) { i.checked = false; });
            paint();
        });

        paint();
    }

    /* ---------- Arranque ---------- */

    var hooks = {
        grid: document.querySelector('[data-platform-grid]'),
        latest: document.querySelector('[data-latest]'),
        listing: document.querySelector('[data-listing]')
    };
    if (!hooks.grid && !hooks.latest && !hooks.listing) return;

    fetch('/assets/data/retos.json', { cache: 'no-cache' })
        .then(function (response) { return response.ok ? response.json() : []; })
        .catch(function () { return []; })
        .then(function (data) {
            var visible = data.filter(function (e) { return !e.borrador; });
            if (hooks.grid) renderPlatforms(hooks.grid, visible);
            if (hooks.latest) renderLatest(hooks.latest, visible);
            if (hooks.listing) renderListing(hooks.listing, visible);
        });
})();
