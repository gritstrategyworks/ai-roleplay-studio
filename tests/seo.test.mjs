import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';

const [html, robots, sitemap, manifest, worker] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
  readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
  readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'),
]);

test('home page exposes complete search and social metadata', () => {
  assert.match(html, /<title>AIロープレ研修｜/);
  assert.match(html, /<meta name="description" content="[^"]{60,}"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/roleplay\.gritstrategyworks\.com\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/roleplay\.gritstrategyworks\.com\/assets\/og-image\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
});

test('structured data describes the web application', () => {
  assert.match(html, /"@type": "WebApplication"/);
  assert.match(html, /"applicationCategory": "EducationalApplication"/);
  assert.match(html, /"offers": \{"@type": "Offer", "price": "0"/);
});

test('crawler discovery files and preview image are publishable', async () => {
  assert.match(robots, /Sitemap: https:\/\/roleplay\.gritstrategyworks\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/roleplay\.gritstrategyworks\.com\/<\/loc>/);
  assert.match(manifest, /AI実践ロープレ研修/);
  assert.match(worker, /v1-41-dialogue-positioning/);
  assert.ok((await stat(new URL('../public/assets/og-image.png', import.meta.url))).size > 10_000);
});
