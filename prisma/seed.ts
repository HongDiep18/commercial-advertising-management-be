import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  { slug: 'NEWS',          nameVi: 'Tin tức',     nameZhTw: '新聞',  nameEn: 'News' },
  { slug: 'BUSINESS',      nameVi: 'Kinh doanh',  nameZhTw: '商業',  nameEn: 'Business' },
  { slug: 'TECH',          nameVi: 'Công nghệ',   nameZhTw: '科技',  nameEn: 'Technology' },
  { slug: 'ENTERTAINMENT', nameVi: 'Giải trí',    nameZhTw: '娛樂',  nameEn: 'Entertainment' },
  { slug: 'LIFESTYLE',     nameVi: 'Đời sống',    nameZhTw: '生活',  nameEn: 'Lifestyle' },
];

const subcategories: {
  slug: string;
  nameVi: string;
  nameZhTw: string;
  nameEn: string;
  categorySlug: string;
}[] = [
  // NEWS
  { slug: 'tin-moi-nhat',  nameVi: 'Tin mới nhất',       nameZhTw: '最新消息', nameEn: 'Latest News',      categorySlug: 'NEWS' },
  { slug: 'thoi-su',       nameVi: 'Thời sự',             nameZhTw: '時事',     nameEn: 'Current Affairs',  categorySlug: 'NEWS' },
  { slug: 'the-gioi',      nameVi: 'Thế giới',            nameZhTw: '世界',     nameEn: 'World',            categorySlug: 'NEWS' },
  { slug: 'phap-luat',     nameVi: 'Pháp luật',           nameZhTw: '法律',     nameEn: 'Law',              categorySlug: 'NEWS' },
  { slug: 'giao-duc',      nameVi: 'Giáo dục',            nameZhTw: '教育',     nameEn: 'Education',        categorySlug: 'NEWS' },
  { slug: 'the-thao',      nameVi: 'Thể thao',            nameZhTw: '體育',     nameEn: 'Sports',           categorySlug: 'NEWS' },
  { slug: 'xa-hoi',        nameVi: 'Xã hội',              nameZhTw: '社會',     nameEn: 'Society',          categorySlug: 'NEWS' },
  { slug: 'viet-nam',      nameVi: 'Việt Nam',            nameZhTw: '越南',     nameEn: 'Vietnam',          categorySlug: 'NEWS' },
  // BUSINESS
  { slug: 'kinh-doanh',    nameVi: 'Kinh doanh',          nameZhTw: '商業',     nameEn: 'Business',         categorySlug: 'BUSINESS' },
  { slug: 'bat-dong-san',  nameVi: 'Bất động sản',        nameZhTw: '房地產',   nameEn: 'Real Estate',      categorySlug: 'BUSINESS' },
  { slug: 'kinh-te',       nameVi: 'Kinh tế',             nameZhTw: '經濟',     nameEn: 'Economy',          categorySlug: 'BUSINESS' },
  { slug: 'vi-mo',         nameVi: 'Vĩ mô',               nameZhTw: '宏觀經濟', nameEn: 'Macroeconomics',    categorySlug: 'BUSINESS' },
  // TECH
  { slug: 'so-hoa',        nameVi: 'Số hóa',              nameZhTw: '數位化',   nameEn: 'Digital',          categorySlug: 'TECH' },
  { slug: 'khoa-hoc',      nameVi: 'Khoa học',            nameZhTw: '科學',     nameEn: 'Science',          categorySlug: 'TECH' },
  { slug: 'cong-nghe',     nameVi: 'Công nghệ',           nameZhTw: '科技',     nameEn: 'Technology',       categorySlug: 'TECH' },
  { slug: 'xe',            nameVi: 'Xe',                  nameZhTw: '汽車',     nameEn: 'Automotive',       categorySlug: 'TECH' },
  { slug: 'oto-xe-may',    nameVi: 'Ô tô - Xe máy',       nameZhTw: '汽機車',   nameEn: 'Automotive',       categorySlug: 'TECH' },
  // ENTERTAINMENT
  { slug: 'giai-tri',      nameVi: 'Giải trí',            nameZhTw: '娛樂',     nameEn: 'Entertainment',    categorySlug: 'ENTERTAINMENT' },
  { slug: 'van-hoa',       nameVi: 'Văn hóa',             nameZhTw: '文化',     nameEn: 'Culture',          categorySlug: 'ENTERTAINMENT' },
  // LIFESTYLE
  { slug: 'doi-song',      nameVi: 'Đời sống',            nameZhTw: '生活',     nameEn: 'Lifestyle',        categorySlug: 'LIFESTYLE' },
  { slug: 'suc-khoe',      nameVi: 'Sức khỏe',            nameZhTw: '健康',     nameEn: 'Health',           categorySlug: 'LIFESTYLE' },
  { slug: 'du-lich',       nameVi: 'Du lịch',             nameZhTw: '旅遊',     nameEn: 'Travel',           categorySlug: 'LIFESTYLE' },
  { slug: 'y-kien',        nameVi: 'Ý kiến',              nameZhTw: '觀點',     nameEn: 'Opinion',          categorySlug: 'LIFESTYLE' },
  { slug: 'tam-su',        nameVi: 'Tâm sự',              nameZhTw: '心情',     nameEn: 'Personal',         categorySlug: 'LIFESTYLE' },
  { slug: 'cuoi',          nameVi: 'Cười',                nameZhTw: '搞笑',     nameEn: 'Humor',            categorySlug: 'LIFESTYLE' },
  { slug: 'nhip-song-tre', nameVi: 'Nhịp sống trẻ',       nameZhTw: '年輕生活', nameEn: 'Youth Life',       categorySlug: 'LIFESTYLE' },
  { slug: 'ban-doc',       nameVi: 'Bạn đọc',             nameZhTw: '讀者',     nameEn: 'Readers',          categorySlug: 'LIFESTYLE' },
];

async function main() {
  console.log('Seeding news categories...');

  for (const cat of categories) {
    await prisma.newsCategory.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: { nameVi: cat.nameVi, nameZhTw: cat.nameZhTw, nameEn: cat.nameEn },
    });
  }

  console.log(`  ✓ ${categories.length} categories seeded`);

  console.log('Seeding news subcategories...');

  const categoryMap = new Map(
    (await prisma.newsCategory.findMany({ select: { id: true, slug: true } })).map(
      (c) => [c.slug, c.id],
    ),
  );

  for (const sub of subcategories) {
    const categoryId = categoryMap.get(sub.categorySlug);
    if (!categoryId) {
      console.warn(`  ⚠ Category not found for slug: ${sub.categorySlug}`);
      continue;
    }
    await prisma.newsSubcategory.upsert({
      where: { slug: sub.slug },
      create: {
        slug: sub.slug,
        nameVi: sub.nameVi,
        nameZhTw: sub.nameZhTw,
        nameEn: sub.nameEn,
        categoryId,
      },
      update: { nameVi: sub.nameVi, nameZhTw: sub.nameZhTw, nameEn: sub.nameEn, categoryId },
    });
  }

  console.log(`  ✓ ${subcategories.length} subcategories seeded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
