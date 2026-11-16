# D4rkFace · sitio de soluciones CTF

Sitio estático en español, listo para **GitHub Pages**. Escribes cada solución en una carpeta, subes con `git push` y GitHub se encarga del resto: genera el listado y los filtros, optimiza las imágenes y publica.

## Cómo está organizado

```
d4rkface/
├── index.html                  Portada
├── site.config.json            Nombre, URL, correo y contador (edítalo una vez)
├── assets/                     CSS, JS e imágenes del sitio (no lo toques para publicar retos)
├── retos/                      Retos, máquinas y ejercicios
│   └── <plataforma>/<reto>/    ← aquí va cada solución, en árbol (puedes anidar más niveles)
│       ├── index.html
│       └── img/                capturas de evidencia
├── vulnerabilidades/           Guías, tutoriales y análisis (misma estructura)
├── sobre-mi/  privacidad/  404.html
├── _plantilla/reto/            Plantilla que copias para cada solución nueva
└── tools/ .github/             Automatización (no la edites)
```

Reglas del árbol:
- La **primera carpeta dentro de `retos/`** es la plataforma (`tryhackme`, `rootme`, `htb`…). Aparece sola en los filtros y en la portada; el nombre bonito sale del campo `"plataforma"` del reto.
- Las carpetas que empiezan por `_` o `.` no se publican.
- Pon el nombre de cada carpeta en minúsculas, sin espacios ni tildes (`sql-injection-basica`).

## Publicar un reto nuevo (tu rutina diaria)

1. En VS Code, copia `_plantilla/reto` a `retos/<plataforma>/<nombre-del-reto>`. Atajo: **Terminal → Ejecutar tarea → "Nuevo reto (copiar plantilla)"** y escribe la ruta.
2. Abre el `index.html` de la nueva carpeta y edita, siguiendo los comentarios numerados:
   - el `<title>` y el `<h1>`;
   - el bloque `reto-meta` (plataforma, categoría, dificultad, tipo, estado, fecha, etiquetas);
   - la lista de **herramientas** y el texto de la **solución** con `<h2>` y `<h3>`.
3. Copia las capturas a la carpeta `img/` del reto y refiérelas como `./img/captura-01.png`.
4. Mientras escribes, deja `"borrador": true` en `reto-meta` (no se publica). Cuando termines, cámbialo a `false` o bórralo.
5. En VS Code: **Control de código fuente** → mensaje → **Confirmar** → **Sincronizar cambios**. En 1 o 2 minutos está en línea.

Lo que ocurre solo: aparece en el listado, en los filtros por plataforma/categoría/dificultad, en el buscador y en "Últimas soluciones"; se crea el índice lateral; los bloques de código ganan botón **Copiar**; las imágenes se pueden ampliar; se optimizan (máx. 1600 px).

Valores de `reto-meta`:

| Campo | Valores |
|---|---|
| `dificultad` | Fácil · Media · Difícil · Insana |
| `tipo` en `retos/` | reto · maquina · ejercicio |
| `tipo` en `vulnerabilidades/` | guia · vulnerabilidad |
| `estado` | permitido · retirado (publica solo contenido que la plataforma permita) |

Reglas de oro: **nunca** publiques una flag completa (usa `FLAG{********}`; el build avisa si detecta una) ni IPs, claves o datos reales.

## Primera vez: Git y GitHub (Windows)

0. Ejecuta una vez, dentro de la carpeta del proyecto: `powershell -ExecutionPolicy Bypass -File _instalar\instalar.ps1`. Crea `.github\workflows\deploy.yml` (la publicación automática) y `.vscode\` (tarea "Nuevo reto"). Después puedes borrar `_instalar`.

1. Instala Git: en PowerShell `winget install --id Git.Git -e` (o desde https://git-scm.com). Reinicia VS Code.
2. **Mueve esta carpeta fuera de Dropbox/OneDrive**, por ejemplo a `C:\Proyectos\d4rkface`. Dropbox y Git juntos pueden corromper el repositorio.
3. Crea en https://github.com un repositorio **público** llamado `TU-USUARIO.github.io` (sin README ni .gitignore). Así las rutas del sitio funcionan desde la raíz.
4. En la terminal de VS Code, dentro de la carpeta:
   ```powershell
   git config --global user.name "Tu nombre"
   git config --global user.email "tu-correo-de-github@ejemplo.com"
   git init
   git add .
   git commit -m "Sitio inicial"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-USUARIO.github.io.git
   git push -u origin main
   ```
5. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Luego revisa la pestaña **Actions**: cuando el flujo termine en verde, el sitio queda en `https://TU-USUARIO.github.io`.
6. Edita `site.config.json`: pon tu `url` real y un `correo` público (usa uno que no te importe mostrar). Haz commit y push.

## Contador de visitas (opcional, sin cookies)

1. Crea una cuenta gratuita en https://www.goatcounter.com y elige un código (por ejemplo `d4rkface`).
2. En GoatCounter → **Settings** activa "Allow adding visitor counts on your website".
3. Escribe el código en `site.config.json` → `"goatcounter": "d4rkface"`, haz commit y push.

Con el campo vacío no se carga nada externo y el contador queda oculto.

## Más adelante: dominio propio

Compra el dominio, añádelo en **Settings → Pages → Custom domain** y cambia `url` en `site.config.json`. Como todas las rutas parten de la raíz, no hay que modificar ningún reto. Para usar Cloudflare, apunta el dominio a GitHub Pages desde su DNS.

## Probar en tu PC antes de subir

Instala la extensión **Live Server** de VS Code, abre la carpeta del proyecto, y pulsa **Go Live** (abre `index.html`). Las páginas de cada reto se ven al instante. El listado se lee de `assets/data/retos.json`, que genera GitHub Actions; si quieres verlo actualizado en local, instala Node.js y ejecuta `node tools/build.mjs`.

## Seguridad incluida

- Política de seguridad (CSP) estricta en cada página: solo recursos propios, YouTube (modo privacidad) y, si lo activas, GoatCounter. **No uses scripts ni estilos dentro del HTML** (`<script>…</script>` con código, `style="…"`): el navegador los bloquea.
- Sin cookies propias; el tema y el avance "Completado" se guardan solo en el navegador de quien visita.
- Imágenes sin metadatos tras la optimización; el build avisa de flags visibles, imágenes externas o archivos que faltan.

## Si algo falla

- **El listado sale vacío en el sitio**: abre la pestaña *Actions* y mira el error en rojo; suele ser una coma de más en `reto-meta`.
- **No aparece un reto**: revisa que esté dentro de `retos/<plataforma>/<reto>/index.html`, que tenga `reto-meta` y que no sea `"borrador": true`.
- **El CSS no carga**: asegúrate de que el repositorio se llama `TU-USUARIO.github.io`.
