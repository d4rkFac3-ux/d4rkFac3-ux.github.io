/* Aplica el tema guardado antes de pintar la página (evita el parpadeo). */
(function () {
    var theme = 'dark';
    try {
        var saved = localStorage.getItem('d4-theme');
        if (saved === 'light' || saved === 'dark') theme = saved;
    } catch (e) { /* almacenamiento no disponible */ }
    document.documentElement.setAttribute('data-theme', theme);
})();
