#!/usr/bin/env node
/**
 * D4rkFace · build
 *
 *   node tools/build.mjs            → regenera assets/data/retos.json (listado y filtros)
 *   node tools/build.mjs --dist dist → además crea la carpeta publicable "dist":
 *                                      copia el sitio, optimiza imágenes (si hay "sharp"),
 *                                      excluye borradores y genera sitemap.xml y robots.txt
 *
 * Lo ejecuta GitHub Actions en cada push; no necesitas correrlo en tu PC.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const distFlag = args.indexOf('--dist');
const DIST = distFlag !== -1 ? path.resolve(ROOT, args[distFlag + 1] || 'dist') : null;

const SECTIONS = ['retos', 'vulnerabilidades'];
const ROOT_IGNORED = new Set(['.git', '.github', 'node_modules', 'tools', 'dist', 'README.md', '.gitignore', '.gitattributes']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

let warnings = 0;
const warn = (message) => { warnings++; console.warn(`  ⚠ ${message}`); };
const fail = (message) => { console.error(`  ✖ ${message}`); process.exit(1); };

/* ---------- utilidades ---------- */

async function walk(dir, rel = '') {
    const files = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (!rel && ROOT_IGNORED.has(entry.name)) continue;          // solo en la raíz
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue; // ocultos y plantillas
        if (entry.isDirectory()) files.push(...await walk(path.join(dir, entry.name), relPath));
        else if (entry.isFile()) files.push(relPath);
    }
    return files;
}

const decode = (text) => text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();

const titleCase = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function exists(file) {
    try { await fs.access(file); return true; } catch { return false; }
}

/* ---------- lectura de entradas ---------- */

async function readConfig() {
    try {
        return JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
    } catch (error) {
        return fail(`No se pudo leer site.config.json: ${error.message}`);
    }
}

async function readEntries(files) {
    const entries = [];
    for (const rel of files) {
        const parts = rel.split('/');
        if (!SECTIONS.includes(parts[0]) || parts[parts.length - 1] !== 'index.html' || parts.length < 4) continue;

        const html = await fs.readFile(path.join(ROOT, rel), 'utf8');
        const metaMatch = html.match(/<script[^>]*id=["']reto-meta["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!metaMatch) { warn(`${rel}: no tiene el bloque "reto-meta"; no aparecerá en el listado.`); continue; }

        let meta;
        try { meta = JSON.parse(metaMatch[1]); }
        catch (error) { fail(`${rel}: el JSON de "reto-meta" no es válido (${error.message}). Revisa comas y comillas.`); }

        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const lead = html.match(/<p[^>]*class=["'][^"']*\blead\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
        const section = parts[0];
        const platformSlug = parts[1];
        const dir = parts.slice(0, -1).join('/');

        const entry = {
            titulo: meta.titulo || (h1 ? decode(h1[1]) : titleCase(parts[parts.length - 2])),
            resumen: meta.resumen || (lead ? decode(lead[1]) : ''),
            url: `/${dir}/`,
            seccion: section,
            plataforma: meta.plataforma || titleCase(platformSlug),
            plataformaSlug: platformSlug,
            categoria: meta.categoria || '',
            dificultad: meta.dificultad || '',
            tipo: meta.tipo || (section === 'retos' ? 'reto' : 'guia'),
            etiquetas: Array.isArray(meta.etiquetas) ? meta.etiquetas : [],
            estado: meta.estado || '',
            fecha: meta.fecha || '',
            borrador: meta.borrador === true
        };

        /* Avisos útiles (no detienen la publicación) */
        if (!entry.fecha) warn(`${rel}: falta "fecha" (AAAA-MM-DD).`);
        if (!entry.estado) warn(`${rel}: falta "estado" (permitido o retirado).`);
        if (!entry.categoria) warn(`${rel}: falta "categoria".`);
        if (!entry.dificultad) warn(`${rel}: falta "dificultad".`);
        const okTypes = section === 'retos' ? ['reto', 'maquina', 'ejercicio'] : ['guia', 'vulnerabilidad'];
        if (!okTypes.includes(entry.tipo)) warn(`${rel}: el tipo "${entry.tipo}" no corresponde a /${section}/ (usa: ${okTypes.join(', ')}).`);
        if (!entry.borrador) {
            if (/(?:flag|thm|htb|ctf)\{[^}*]{3,}\}/i.test(html)) warn(`${rel}: parece contener una flag sin ocultar. Cámbiala por FLAG{********}.`);
            if (/<img[^>]+src=["']https?:/i.test(html)) warn(`${rel}: usa una imagen externa; la política de seguridad la bloqueará. Descárgala a su carpeta img/.`);
            for (const m of html.matchAll(/<img[^>]+src=["']\.\/([^"']+)["']/gi)) {
                if (!await exists(path.join(ROOT, dir, m[1]))) warn(`${rel}: falta la imagen "${m[1]}".`);
            }
        }
        entries.push(entry);
    }
    return entries;
}

/* ---------- salida ---------- */

async function optimizeAndCopy(sharp, rel, siteUrl, stats) {
    const source = path.join(ROOT, rel);
    const target = path.join(DIST, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const ext = path.extname(rel).toLowerCase();

    if (ext === '.html') {
        const html = await fs.readFile(source, 'utf8');
        await fs.writeFile(target, html.replaceAll('%SITE_URL%', siteUrl));
        return;
    }

    const inEntries = SECTIONS.includes(rel.split('/')[0]);
    if (sharp && inEntries && IMAGE_EXT.has(ext)) {
        const input = await fs.readFile(source);
        let image = sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true });
        if (ext === '.png') image = image.png({ compressionLevel: 9, palette: true, quality: 90, effort: 7 });
        else if (ext === '.webp') image = image.webp({ quality: 82 });
        else image = image.jpeg({ quality: 82, mozjpeg: true });
        const output = await image.toBuffer();
        stats.before += input.length;
        stats.after += Math.min(input.length, output.length);
        stats.count++;
        await fs.writeFile(target, output.length < input.length ? output : input);
        return;
    }
    await fs.copyFile(source, target);
}

async function buildDist(files, entries, config) {
    const siteUrl = String(config.url || '').replace(/\/+$/, '');
    if (!siteUrl || siteUrl.includes('TU-USUARIO')) warn('site.config.json: cambia "url" por la dirección real del sitio (afecta sitemap y vista previa al compartir).');

    let sharp = null;
    try { sharp = (await import('sharp')).default; }
    catch { warn('El paquete "sharp" no está instalado: las imágenes se publican sin optimizar.'); }

    const drafts = entries.filter((e) => e.borrador).map((e) => e.url.slice(1, -1));
    await fs.rm(DIST, { recursive: true, force: true });
    await fs.mkdir(DIST, { recursive: true });

    const stats = { count: 0, before: 0, after: 0 };
    for (const rel of files) {
        if (drafts.some((dir) => rel.startsWith(dir + '/'))) continue; // los borradores no se publican
        await optimizeAndCopy(sharp, rel, siteUrl, stats);
    }

    await fs.writeFile(path.join(DIST, '.nojekyll'), '');

    const pages = ['/', '/retos/', '/vulnerabilidades/', '/sobre-mi/', '/privacidad/'].map((u) => ({ url: u }));
    entries.filter((e) => !e.borrador).forEach((e) => pages.push({ url: e.url, fecha: e.fecha }));
    const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + pages.map((p) => `  <url><loc>${siteUrl}${p.url}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') ? `<lastmod>${p.fecha}</lastmod>` : ''}</url>`).join('\n')
        + '\n</urlset>\n';
    await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
    await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

    if (stats.count) {
        const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
        console.log(`  Imágenes optimizadas: ${stats.count} (${kb(stats.before)} → ${kb(stats.after)})`);
    }
    console.log(`  Sitio listo en ${path.relative(ROOT, DIST) || '.'}/ con ${files.length - drafts.length} archivos, ${drafts.length} borrador(es) excluido(s).`);
}

/* ---------- ejecución ---------- */

console.log('D4rkFace · build');
const config = await readConfig();
const files = await walk(ROOT);
const entries = await readEntries(files);

entries.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || a.titulo.localeCompare(b.titulo, 'es'));
const dataDir = path.join(ROOT, 'assets', 'data');
await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(path.join(dataDir, 'retos.json'), JSON.stringify(entries, null, 2) + '\n');
console.log(`  Entradas: ${entries.length} (${entries.filter((e) => e.borrador).length} borrador/es) → assets/data/retos.json`);

if (DIST) {
    // retos.json ya está actualizado en disco, por eso se vuelve a listar antes de copiar
    await buildDist(await walk(ROOT), entries, config);
}

console.log(warnings ? `Terminado con ${warnings} aviso(s).` : 'Terminado sin avisos.');
