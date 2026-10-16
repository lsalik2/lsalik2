// Refreshes the "latest posts" list in README.md from lsalik.dev's RSS feed.
// Run once a day by .github/workflows/latest-posts.yml; no dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const FEED_URL = 'https://lsalik.dev/rss.xml';
export const START = '<!-- latest-posts:start -->';
export const END = '<!-- latest-posts:end -->';
const COUNT = 5;
const README = new URL('../README.md', import.meta.url);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] !== '#') return ENTITIES[name] ?? match;
    const hex = name[1].toLowerCase() === 'x';
    return String.fromCodePoint(parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function field(item, name) {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1].trim()) : '';
}

export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({
      title: field(item, 'title'),
      link: field(item, 'link'),
      date: new Date(field(item, 'pubDate')),
    }))
    .filter((post) => post.title && post.link && !Number.isNaN(post.date.getTime()));
}

function formatDate(date) {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} ${date.getUTCFullYear()}`;
}

export function renderPosts(posts) {
  return [...posts]
    .sort((a, b) => b.date - a.date)
    .slice(0, COUNT)
    .map((post) => `- [${post.title.replace(/[[\]]/g, '\\$&')}](${post.link}) · ${formatDate(post.date)}`)
    .join('\n');
}

export function replaceSection(readme, block) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < start) throw new Error('README.md is missing the latest-posts markers');
  return `${readme.slice(0, start + START.length)}\n${block}\n${readme.slice(end)}`;
}

async function main() {
  // A curl-like user agent gets the site's terminal view instead of the XML.
  const response = await fetch(FEED_URL, { headers: { 'User-Agent': 'lsalik2-profile-readme' } });
  if (!response.ok) throw new Error(`${FEED_URL} answered ${response.status}`);
  const posts = parseFeed(await response.text());
  if (posts.length === 0) throw new Error(`no posts found in ${FEED_URL}`);

  const readme = await readFile(README, 'utf8');
  const updated = replaceSection(readme, renderPosts(posts));
  if (updated === readme) {
    console.log('latest posts: no change');
    return;
  }
  await writeFile(README, updated);
  console.log('latest posts: updated');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
