import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  { slug: 'NEWS', nameVi: 'Tin tức', nameZhTw: '新聞', nameEn: 'News' },
  {
    slug: 'BUSINESS',
    nameVi: 'Kinh doanh',
    nameZhTw: '商業',
    nameEn: 'Business',
  },
  { slug: 'TECH', nameVi: 'Công nghệ', nameZhTw: '科技', nameEn: 'Technology' },
  {
    slug: 'ENTERTAINMENT',
    nameVi: 'Giải trí',
    nameZhTw: '娛樂',
    nameEn: 'Entertainment',
  },
  {
    slug: 'LIFESTYLE',
    nameVi: 'Đời sống',
    nameZhTw: '生活',
    nameEn: 'Lifestyle',
  },
];

const subcategories: {
  slug: string;
  nameVi: string;
  nameZhTw: string;
  nameEn: string;
  categorySlug: string;
}[] = [
  // NEWS
  {
    slug: 'tin-moi-nhat',
    nameVi: 'Tin mới nhất',
    nameZhTw: '最新消息',
    nameEn: 'Latest News',
    categorySlug: 'NEWS',
  },
  {
    slug: 'thoi-su',
    nameVi: 'Thời sự',
    nameZhTw: '時事',
    nameEn: 'Current Affairs',
    categorySlug: 'NEWS',
  },
  {
    slug: 'the-gioi',
    nameVi: 'Thế giới',
    nameZhTw: '世界',
    nameEn: 'World',
    categorySlug: 'NEWS',
  },
  {
    slug: 'phap-luat',
    nameVi: 'Pháp luật',
    nameZhTw: '法律',
    nameEn: 'Law',
    categorySlug: 'NEWS',
  },
  {
    slug: 'giao-duc',
    nameVi: 'Giáo dục',
    nameZhTw: '教育',
    nameEn: 'Education',
    categorySlug: 'NEWS',
  },
  {
    slug: 'the-thao',
    nameVi: 'Thể thao',
    nameZhTw: '體育',
    nameEn: 'Sports',
    categorySlug: 'NEWS',
  },
  {
    slug: 'xa-hoi',
    nameVi: 'Xã hội',
    nameZhTw: '社會',
    nameEn: 'Society',
    categorySlug: 'NEWS',
  },
  {
    slug: 'viet-nam',
    nameVi: 'Việt Nam',
    nameZhTw: '越南',
    nameEn: 'Vietnam',
    categorySlug: 'NEWS',
  },
  // BUSINESS
  {
    slug: 'kinh-doanh',
    nameVi: 'Kinh doanh',
    nameZhTw: '商業',
    nameEn: 'Business',
    categorySlug: 'BUSINESS',
  },
  {
    slug: 'bat-dong-san',
    nameVi: 'Bất động sản',
    nameZhTw: '房地產',
    nameEn: 'Real Estate',
    categorySlug: 'BUSINESS',
  },
  {
    slug: 'kinh-te',
    nameVi: 'Kinh tế',
    nameZhTw: '經濟',
    nameEn: 'Economy',
    categorySlug: 'BUSINESS',
  },
  {
    slug: 'vi-mo',
    nameVi: 'Vĩ mô',
    nameZhTw: '宏觀經濟',
    nameEn: 'Macroeconomics',
    categorySlug: 'BUSINESS',
  },
  // TECH
  {
    slug: 'so-hoa',
    nameVi: 'Số hóa',
    nameZhTw: '數位化',
    nameEn: 'Digital',
    categorySlug: 'TECH',
  },
  {
    slug: 'khoa-hoc',
    nameVi: 'Khoa học',
    nameZhTw: '科學',
    nameEn: 'Science',
    categorySlug: 'TECH',
  },
  {
    slug: 'cong-nghe',
    nameVi: 'Công nghệ',
    nameZhTw: '科技',
    nameEn: 'Technology',
    categorySlug: 'TECH',
  },
  {
    slug: 'xe',
    nameVi: 'Xe',
    nameZhTw: '汽車',
    nameEn: 'Automotive',
    categorySlug: 'TECH',
  },
  {
    slug: 'oto-xe-may',
    nameVi: 'Ô tô - Xe máy',
    nameZhTw: '汽機車',
    nameEn: 'Automotive',
    categorySlug: 'TECH',
  },
  // ENTERTAINMENT
  {
    slug: 'giai-tri',
    nameVi: 'Giải trí',
    nameZhTw: '娛樂',
    nameEn: 'Entertainment',
    categorySlug: 'ENTERTAINMENT',
  },
  {
    slug: 'van-hoa',
    nameVi: 'Văn hóa',
    nameZhTw: '文化',
    nameEn: 'Culture',
    categorySlug: 'ENTERTAINMENT',
  },
  // LIFESTYLE
  {
    slug: 'doi-song',
    nameVi: 'Đời sống',
    nameZhTw: '生活',
    nameEn: 'Lifestyle',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'suc-khoe',
    nameVi: 'Sức khỏe',
    nameZhTw: '健康',
    nameEn: 'Health',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'du-lich',
    nameVi: 'Du lịch',
    nameZhTw: '旅遊',
    nameEn: 'Travel',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'y-kien',
    nameVi: 'Ý kiến',
    nameZhTw: '觀點',
    nameEn: 'Opinion',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'tam-su',
    nameVi: 'Tâm sự',
    nameZhTw: '心情',
    nameEn: 'Personal',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'cuoi',
    nameVi: 'Cười',
    nameZhTw: '搞笑',
    nameEn: 'Humor',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'nhip-song-tre',
    nameVi: 'Nhịp sống trẻ',
    nameZhTw: '年輕生活',
    nameEn: 'Youth Life',
    categorySlug: 'LIFESTYLE',
  },
  {
    slug: 'ban-doc',
    nameVi: 'Bạn đọc',
    nameZhTw: '讀者',
    nameEn: 'Readers',
    categorySlug: 'LIFESTYLE',
  },
];

async function main() {
  console.log('Seeding news categories...');

  for (const cat of categories) {
    await prisma.newsCategory.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: {
        nameVi: cat.nameVi,
        nameZhTw: cat.nameZhTw,
        nameEn: cat.nameEn,
      },
    });
  }

  console.log(`${categories.length} categories seeded`);

  console.log('Seeding news subcategories...');

  const categoryMap = new Map(
    (
      await prisma.newsCategory.findMany({ select: { id: true, slug: true } })
    ).map((c) => [c.slug, c.id]),
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
      update: {
        nameVi: sub.nameVi,
        nameZhTw: sub.nameZhTw,
        nameEn: sub.nameEn,
        categoryId,
      },
    });
  }

  console.log(`${subcategories.length} subcategories seeded`);

  // One admin account (optional: set ADMIN_EMAIL, ADMIN_PASSWORD in .env)
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com')
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`Admin account created: ${adminEmail}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  console.log('Seeding membership-tier demo accounts (User + UserProfile)...');

  const companyUsers = [
    {
      email: 'bronze@example.com',
      password: 'Bronze123!',
      tier: 'BRONZE' as const,
      companyNameVi: 'Công ty TNHH Bronze Việt Nam',
      companyNameCn: '越南青銅有限公司',
      phone: '+84 28 1234 5001',
      taxId: '0123456789',
      contactPerson: 'Nguyễn Văn Bronze',
      contactPhone: '0901234501',
      companyAddress: '123 Đường Bronze, Quận 1, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'Manufacturing',
      website: 'https://bronze.example.com',
      introduction: 'Công ty chuyên sản xuất và xuất khẩu.',
    },
    {
      email: 'silver@example.com',
      password: 'Silver123!',
      tier: 'SILVER' as const,
      companyNameVi: 'Công ty CP Bạc Silver',
      companyNameCn: '銀業股份有限公司',
      phone: '+84 28 1234 5002',
      taxId: '0123456790',
      contactPerson: 'Trần Thị Silver',
      contactPhone: '0901234502',
      companyAddress: '456 Đường Silver, Quận 3, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'Trading',
      website: 'https://silver.example.com',
      introduction: 'Công ty thương mại quốc tế.',
    },
    {
      email: 'gold@example.com',
      password: 'Gold123!',
      tier: 'GOLD' as const,
      companyNameVi: 'Tập đoàn Vàng Gold',
      companyNameCn: '金業集團',
      phone: '+84 28 1234 5003',
      taxId: '0123456791',
      contactPerson: 'Lê Văn Gold',
      contactPhone: '0901234503',
      companyAddress: '789 Đường Gold, Quận 7, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'Logistics',
      website: 'https://gold.example.com',
      introduction: 'Dịch vụ logistics và vận tải quốc tế.',
    },
    {
      email: 'diamond@example.com',
      password: 'Diamond123!',
      tier: 'DIAMOND' as const,
      companyNameVi: 'Công ty Kim cương Diamond Global',
      companyNameCn: '鑽石全球有限公司',
      phone: '+84 28 1234 5004',
      taxId: '0123456792',
      contactPerson: 'Phạm Thị Diamond',
      contactPhone: '0901234504',
      companyAddress: '100 Đường Diamond, Quận 2, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'Technology',
      website: 'https://diamond.example.com',
      introduction: 'Công ty công nghệ và xuất nhập khẩu hàng đầu.',
    },
  ];

  for (const u of companyUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
      include: { profile: true },
    });
    if (existing) {
      console.log(`  ⏭ User already exists: ${u.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        email: u.email,
        password: hashed,
        role: 'MEMBER',
        membershipTier: u.tier,
        profile: {
          create: {
            companyNameVi: u.companyNameVi,
            companyNameCn: u.companyNameCn,
            phone: u.phone,
            taxId: u.taxId,
            contactPerson: u.contactPerson,
            contactPhone: u.contactPhone,
            companyAddress: u.companyAddress,
            email: u.email,
            country: u.country,
            region: u.region,
            industry: u.industry,
            website: u.website,
            introduction: u.introduction,
          },
        },
      },
    });
    console.log(`  ✓ Created ${u.tier} company user with profile: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
