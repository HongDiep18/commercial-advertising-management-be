import { registerAs } from '@nestjs/config';

export interface RssSource {
  name: string;
  feedUrl: string;
  categorySlug: string;
  subcategorySlug?: string; // pre-determined from feed URL section
}

const DEFAULT_SOURCES: RssSource[] = [
  // ─── NEWS ──────────────────────────────────────────────────────────────────
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/tin-moi-nhat.rss', categorySlug: 'NEWS', subcategorySlug: 'tin-moi-nhat' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/thoi-su.rss',       categorySlug: 'NEWS', subcategorySlug: 'thoi-su' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/the-gioi.rss',      categorySlug: 'NEWS', subcategorySlug: 'the-gioi' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/phap-luat.rss',     categorySlug: 'NEWS', subcategorySlug: 'phap-luat' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/giao-duc.rss',      categorySlug: 'NEWS', subcategorySlug: 'giao-duc' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/the-thao.rss',      categorySlug: 'NEWS', subcategorySlug: 'the-thao' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/tin-moi-nhat.rss',     categorySlug: 'NEWS', subcategorySlug: 'tin-moi-nhat' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/thoi-su.rss',          categorySlug: 'NEWS', subcategorySlug: 'thoi-su' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/the-gioi.rss',         categorySlug: 'NEWS', subcategorySlug: 'the-gioi' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/phap-luat.rss',        categorySlug: 'NEWS', subcategorySlug: 'phap-luat' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/giao-duc.rss',         categorySlug: 'NEWS', subcategorySlug: 'giao-duc' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/the-thao.rss',         categorySlug: 'NEWS', subcategorySlug: 'the-thao' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/thoi-su.rss',         categorySlug: 'NEWS', subcategorySlug: 'thoi-su' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/the-gioi.rss',        categorySlug: 'NEWS', subcategorySlug: 'the-gioi' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/the-thao.rss',        categorySlug: 'NEWS', subcategorySlug: 'the-thao' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/xa-hoi.rss',         categorySlug: 'NEWS', subcategorySlug: 'xa-hoi' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/the-gioi.rss',       categorySlug: 'NEWS', subcategorySlug: 'the-gioi' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/phap-luat.rss',      categorySlug: 'NEWS', subcategorySlug: 'phap-luat' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/giao-duc.rss',       categorySlug: 'NEWS', subcategorySlug: 'giao-duc' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/the-thao.rss',       categorySlug: 'NEWS', subcategorySlug: 'the-thao' },
  { name: 'cafebiz',   feedUrl: 'https://cafebiz.vn/rss/xa-hoi.rss',            categorySlug: 'NEWS', subcategorySlug: 'xa-hoi' },
  { name: 'cafebiz',   feedUrl: 'https://cafebiz.vn/rss/the-gioi.rss',          categorySlug: 'NEWS', subcategorySlug: 'the-gioi' },
  { name: 'cafebiz',   feedUrl: 'https://cafebiz.vn/rss/phap-luat.rss',         categorySlug: 'NEWS', subcategorySlug: 'phap-luat' },
  // ─── BUSINESS ──────────────────────────────────────────────────────────────
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/kinh-doanh.rss',    categorySlug: 'BUSINESS', subcategorySlug: 'kinh-doanh' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/bat-dong-san.rss',  categorySlug: 'BUSINESS', subcategorySlug: 'bat-dong-san' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/kinh-doanh.rss',       categorySlug: 'BUSINESS', subcategorySlug: 'kinh-doanh' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/kinh-te.rss',         categorySlug: 'BUSINESS', subcategorySlug: 'kinh-te' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/kinh-doanh.rss',     categorySlug: 'BUSINESS', subcategorySlug: 'kinh-doanh' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/bat-dong-san.rss',   categorySlug: 'BUSINESS', subcategorySlug: 'bat-dong-san' },
  { name: 'cafebiz',   feedUrl: 'https://cafebiz.vn/rss/vi-mo.rss',             categorySlug: 'BUSINESS', subcategorySlug: 'vi-mo' },
  // ─── TECH ──────────────────────────────────────────────────────────────────
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/so-hoa.rss',        categorySlug: 'TECH', subcategorySlug: 'so-hoa' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/khoa-hoc.rss',      categorySlug: 'TECH', subcategorySlug: 'khoa-hoc' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/oto-xe-may.rss',    categorySlug: 'TECH', subcategorySlug: 'oto-xe-may' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/cong-nghe.rss',        categorySlug: 'TECH', subcategorySlug: 'cong-nghe' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/khoa-hoc.rss',         categorySlug: 'TECH', subcategorySlug: 'khoa-hoc' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/xe.rss',               categorySlug: 'TECH', subcategorySlug: 'xe' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/cong-nghe.rss',       categorySlug: 'TECH', subcategorySlug: 'cong-nghe' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/xe.rss',              categorySlug: 'TECH', subcategorySlug: 'xe' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/khoa-hoc.rss',       categorySlug: 'TECH', subcategorySlug: 'khoa-hoc' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/o-to-xe-may.rss',    categorySlug: 'TECH', subcategorySlug: 'oto-xe-may' },
  // ─── ENTERTAINMENT ─────────────────────────────────────────────────────────
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/giai-tri.rss',      categorySlug: 'ENTERTAINMENT', subcategorySlug: 'giai-tri' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/giai-tri.rss',         categorySlug: 'ENTERTAINMENT', subcategorySlug: 'giai-tri' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/van-hoa.rss',          categorySlug: 'ENTERTAINMENT', subcategorySlug: 'van-hoa' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/giai-tri.rss',        categorySlug: 'ENTERTAINMENT', subcategorySlug: 'giai-tri' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/van-hoa.rss',         categorySlug: 'ENTERTAINMENT', subcategorySlug: 'van-hoa' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/giai-tri.rss',       categorySlug: 'ENTERTAINMENT', subcategorySlug: 'giai-tri' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/van-hoa.rss',        categorySlug: 'ENTERTAINMENT', subcategorySlug: 'van-hoa' },
  // ─── LIFESTYLE ─────────────────────────────────────────────────────────────
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/doi-song.rss',      categorySlug: 'LIFESTYLE', subcategorySlug: 'doi-song' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/suc-khoe.rss',      categorySlug: 'LIFESTYLE', subcategorySlug: 'suc-khoe' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/du-lich.rss',       categorySlug: 'LIFESTYLE', subcategorySlug: 'du-lich' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/y-kien.rss',        categorySlug: 'LIFESTYLE', subcategorySlug: 'y-kien' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/tam-su.rss',        categorySlug: 'LIFESTYLE', subcategorySlug: 'tam-su' },
  { name: 'vnexpress',  feedUrl: 'https://vnexpress.net/rss/cuoi.rss',          categorySlug: 'LIFESTYLE', subcategorySlug: 'cuoi' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/suc-khoe.rss',         categorySlug: 'LIFESTYLE', subcategorySlug: 'suc-khoe' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/du-lich.rss',          categorySlug: 'LIFESTYLE', subcategorySlug: 'du-lich' },
  { name: 'tuoitre',   feedUrl: 'https://tuoitre.vn/rss/nhip-song-tre.rss',    categorySlug: 'LIFESTYLE', subcategorySlug: 'nhip-song-tre' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/doi-song.rss',        categorySlug: 'LIFESTYLE', subcategorySlug: 'doi-song' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/suc-khoe.rss',        categorySlug: 'LIFESTYLE', subcategorySlug: 'suc-khoe' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/du-lich.rss',         categorySlug: 'LIFESTYLE', subcategorySlug: 'du-lich' },
  { name: 'thanhnien', feedUrl: 'https://thanhnien.vn/rss/ban-doc.rss',         categorySlug: 'LIFESTYLE', subcategorySlug: 'ban-doc' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/suc-khoe.rss',       categorySlug: 'LIFESTYLE', subcategorySlug: 'suc-khoe' },
  { name: 'dantri',    feedUrl: 'https://dantri.com.vn/rss/du-lich.rss',        categorySlug: 'LIFESTYLE', subcategorySlug: 'du-lich' },
];

export default registerAs('news', () => {
  let sources: RssSource[] = DEFAULT_SOURCES;
  if (process.env.RSS_SOURCES) {
    try {
      sources = JSON.parse(process.env.RSS_SOURCES) as RssSource[];
    } catch {
      // fall through to default
    }
  }

  return {
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    sources,
    scheduleEnabled: process.env.NEWS_SCHEDULE_ENABLED !== 'false',
    cron: process.env.NEWS_CRON ?? '0 */15 * * * *',
    translateBatchSize: parseInt(process.env.NEWS_TRANSLATE_BATCH_SIZE ?? '5', 10),
    maxContentChars: parseInt(process.env.NEWS_MAX_CONTENT_CHARS ?? '4000', 10),
  };
});
