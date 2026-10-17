import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, renderPosts, replaceSection, START, END } from './latest-posts.mjs';

const item = (title, link, pubDate) =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>`;

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>lsalik.dev</title>
${item('BashCraft: a bash shell for Minecraft&apos;s command line', 'https://lsalik.dev/blog/bashcraft/', 'Wed, 14 Oct 2026 00:00:00 GMT')}
${item('Tom &amp; Jerry &#8212; &#x41;', 'https://lsalik.dev/blog/tom/', 'Fri, 09 Oct 2026 00:00:00 GMT')}
</channel></rss>`;

const post = (n, iso) => ({ title: `post ${n}`, link: `https://lsalik.dev/blog/${n}/`, date: new Date(iso) });

test('parseFeed reads each item and decodes XML entities', () => {
  assert.deepEqual(parseFeed(FEED), [
    { title: "BashCraft: a bash shell for Minecraft's command line", link: 'https://lsalik.dev/blog/bashcraft/', date: new Date('2026-10-14T00:00:00Z') },
    { title: 'Tom & Jerry — A', link: 'https://lsalik.dev/blog/tom/', date: new Date('2026-10-09T00:00:00Z') },
  ]);
});

test('parseFeed skips items without a link or a valid date', () => {
  const xml = item('no link', '', 'Wed, 14 Oct 2026 00:00:00 GMT') + item('bad date', 'https://lsalik.dev/x/', 'someday');
  assert.deepEqual(parseFeed(xml), []);
});

test('parseFeed finds nothing in the terminal text view', () => {
  assert.deepEqual(parseFeed('┌ ~/blog ──┐\n│ BashCraft │'), []);
});

test('renderPosts lists the three newest, newest first, as dated links', () => {
  const posts = [1, 2, 3, 4, 5, 6].map((n) => post(n, `2026-0${n}-0${n}T00:00:00Z`));
  assert.equal(
    renderPosts(posts),
    [6, 5, 4].map((n) => `2026-0${n}-0${n}  <a href="https://lsalik.dev/blog/${n}/">post ${n}</a>`).join('\n'),
  );
});

test('renderPosts keeps feed order for posts on the same day', () => {
  const posts = [post('a', '2026-10-14T00:00:00Z'), post('b', '2026-10-14T00:00:00Z')];
  assert.match(renderPosts(posts), /post a[^]*post b/);
});

test('renderPosts escapes HTML in titles and links', () => {
  const posts = [{ title: 'Tom & <Jerry>', link: 'https://lsalik.dev/blog/?a=1&b="2"', date: new Date('2026-10-14T00:00:00Z') }];
  assert.equal(
    renderPosts(posts),
    '2026-10-14  <a href="https://lsalik.dev/blog/?a=1&amp;b=&quot;2&quot;">Tom &amp; &lt;Jerry&gt;</a>',
  );
});

test('replaceSection swaps only the text between the markers, and is stable', () => {
  const readme = `# top\n${START}\n- old\n${END}\nbottom\n`;
  const once = replaceSection(readme, '- new');
  assert.equal(once, `# top\n${START}\n- new\n${END}\nbottom\n`);
  assert.equal(replaceSection(once, '- new'), once);
});

test('replaceSection refuses a README without the markers', () => {
  assert.throws(() => replaceSection('# no markers here\n', '- new'), /markers/);
});
