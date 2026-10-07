// Test navigateur : nécessite PHP et Playwright (dépendances de développement).
// PHP_BINARY et BROWSER_BINARY permettent de choisir les exécutables locaux.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function test(subdirectory) {
    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const server = spawn(process.env.PHP_BINARY || 'php', ['-n', '-S', `127.0.0.1:${port}`, '-t',
        subdirectory ? path.dirname(root) : root], { windowsHide: true, stdio: 'pipe' });
    let serverError;
    server.on('error', error => { serverError = error; });
    server.stderr.resume();
    server.stdout.resume();
    const base = `http://127.0.0.1:${port}/` + (subdirectory ? path.basename(root) + '/' : '');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wordox-pwa-test-'));
    const context = await chromium.launchPersistentContext(profile, {
        headless: true, executablePath: process.env.BROWSER_BINARY || undefined,
        viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true
    });
    try {
        for (let attempt = 0; ; attempt++) {
            if (serverError) throw serverError;
            try { await fetch(base); break; } catch (error) {
                if (attempt === 40) throw error;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.waitForFunction(() => !document.getElementById('home-solo').disabled);
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload();
        await page.waitForFunction(() => navigator.serviceWorker.controller && !document.getElementById('home-solo').disabled);
        const manifest = await (await fetch(new URL('manifest.webmanifest', base))).json();
        assert.equal(manifest.display, 'standalone');
        assert.equal(new URL(manifest.start_url, base).href, base);
        for (const icon of manifest.icons) {
            const dimensions = await page.evaluate(async src => {
                const image = new Image();
                image.src = src;
                await image.decode();
                return `${image.naturalWidth}x${image.naturalHeight}`;
            }, icon.src);
            assert.equal(dimensions, icon.sizes);
        }
        const cdp = await context.newCDPSession(page);
        const appManifest = await cdp.send('Page.getAppManifest');
        assert.deepEqual(appManifest.errors, []);
        const installability = await cdp.send('Page.getInstallabilityErrors');
        assert.deepEqual(installability.installabilityErrors, []);

        const cached = await page.evaluate(async () => {
            const names = await caches.keys();
            const cache = await caches.open(names.find(name => name.startsWith('wordox-')));
            return (await cache.keys()).map(request => request.url);
        });
        assert(cached.some(url => url.includes('/dict.php?v=')));
        assert(cached.some(url => url.includes('/js/ai-worker.js?v=')));
        assert(!cached.some(url => url.includes('/api/')));

        await context.setOffline(true);
        await page.reload();
        await page.waitForFunction(() => !document.getElementById('home-solo').disabled);
        await page.locator('#home-solo').click();
        await page.locator('#solo-start').click();
        await page.locator('#btn-pass').click();
        await page.locator('#pass-confirm').click();
        // L'ordinateur doit réellement charger ses imports et jouer hors connexion.
        await page.waitForFunction(() => document.querySelectorAll('#board .tile').length >= 2, null, { timeout: 30000 });
        await page.reload();
        await page.waitForFunction(() => !document.getElementById('screen-game').hidden);
        assert(await page.locator('#board .tile').count() >= 2);
        await page.goto(base + 'index.php?join=ABCDE');
        await page.waitForFunction(() => !document.getElementById('screen-online').hidden);
        assert.equal(await page.locator('#online-code').inputValue(), 'ABCDE');
        assert.deepEqual(errors, []);
        console.log(`ok - ${subdirectory ? 'sous-dossier' : 'racine'} : manifeste installable, icônes, solo/IA hors connexion, reprise, invitation`);
    } finally {
        await context.close();
        server.kill();
        if (path.dirname(profile) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('wordox-pwa-test-')) {
            fs.rmSync(profile, { recursive: true, force: true });
        }
    }
}

(async function () {
    await test(false);
    await test(true);
})().catch(error => { console.error(error); process.exitCode = 1; });
