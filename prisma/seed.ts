import { PrismaPg } from '@prisma/adapter-pg';
import {
  AdCategoryType,
  AdPackageType,
  DurationUnit,
  PricingModel,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  console.log('Seeding membership-tier demo accounts (User + Company)...');

  const companyUsers = [
    {
      email: 'bronze@example.com',
      password: 'Bronze123!',
      tier: 'BRONZE' as const,
      companyEmail: 'contact@bronze-vietnam.com',
      companyName: 'Bronze Vietnam Ltd.',
      companyNameVi: 'Công ty TNHH Bronze Việt Nam',
      companyNameZh: '越南青銅有限公司',
      phone: '+84 28 1234 5001',
      taxId: '0123456789',
      contactName: 'Nguyễn Văn Bronze',
      address: '123 Đường Bronze, Quận 1, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'textile', // Maps to Industry.TEXTILE
      website: 'https://bronze.example.com',
      description: 'Công ty chuyên sản xuất và xuất khẩu.',
      primaryIndustry: 'textile', // Bronze user's primary industry
      selectedIndustries: [], // Bronze tier doesn't select additional industries
      industriesSelected: false, // Bronze doesn't need to select
      loyaltyPoints: 75000, // Above Bronze threshold (50,000)
      totalSpending: 25000, // Bronze doesn't require spending
    },
    {
      email: 'silver@example.com',
      password: 'Silver123!',
      tier: 'SILVER' as const,
      companyEmail: 'contact@silver-corp.com',
      companyName: 'Silver Corporation',
      companyNameVi: 'Công ty CP Bạc Silver',
      companyNameZh: '銀業股份有限公司',
      phone: '+84 28 1234 5002',
      taxId: '0123456790',
      contactName: 'Trần Thị Silver',
      address: '456 Đường Silver, Quận 3, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'electronics', // Maps to Industry.ELECTRONICS
      website: 'https://silver.example.com',
      description: 'Công ty thương mại quốc tế.',
      primaryIndustry: 'electronics', // Silver user's primary industry
      selectedIndustries: [], // Silver tier doesn't select additional industries
      industriesSelected: false, // Silver doesn't need to select
      loyaltyPoints: 200000, // Above Silver threshold (150,000)
      totalSpending: 100000, // Above Silver spending threshold (80,000)
    },
    {
      email: 'gold@example.com',
      password: 'Gold123!',
      tier: 'GOLD' as const,
      companyEmail: 'contact@gold-group.com',
      companyName: 'Gold Group International',
      companyNameVi: 'Tập đoàn Vàng Gold',
      companyNameZh: '金業集團',
      phone: '+84 28 1234 5003',
      taxId: '0123456791',
      contactName: 'Lê Văn Gold',
      address: '789 Đường Gold, Quận 7, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'logistics', // Maps to Industry.LOGISTICS
      website: 'https://gold.example.com',
      description: 'Dịch vụ logistics và vận tải quốc tế.',
      primaryIndustry: 'logistics', // Gold user's primary industry
      selectedIndustries: ['furniture', 'machinery', 'agriculture'], // Gold tier selects 3 additional industries
      industriesSelected: true, // Gold has already selected
      loyaltyPoints: 400000, // Above Gold threshold (300,000)
      totalSpending: 300000, // Above Gold spending threshold (230,000)
    },
    {
      email: 'diamond@example.com',
      password: 'Diamond123!',
      tier: 'DIAMOND' as const,
      companyEmail: 'contact@diamond-global.com',
      companyName: 'Diamond Global Technology',
      companyNameVi: 'Công ty Kim cương Diamond Global',
      companyNameZh: '鑽石全球有限公司',
      phone: '+84 28 1234 5004',
      taxId: '0123456792',
      contactName: 'Phạm Thị Diamond',
      address: '100 Đường Diamond, Quận 2, TP.HCM',
      country: 'Vietnam',
      region: 'Ho Chi Minh City',
      industry: 'electronics', // Maps to Industry.ELECTRONICS
      website: 'https://diamond.example.com',
      description: 'Công ty công nghệ và xuất nhập khẩu hàng đầu.',
      primaryIndustry: 'electronics', // Diamond user's primary industry (though they have access to all)
      selectedIndustries: [], // Diamond tier has access to ALL industries
      industriesSelected: false, // Diamond doesn't need to select
      loyaltyPoints: 750000, // Above Diamond threshold (600,000)
      totalSpending: 600000, // Above Diamond spending threshold (530,000)
    },
  ];

  const syncCompanyContacts = async (input: {
    companyId: string;
    email: string;
    contactName: string;
    phone: string;
    address: string;
    taxId: string;
    website: string;
  }): Promise<void> => {
    const contactPairs: Array<{ type: string; value: string }> = [
      { type: 'email', value: input.email },
      { type: 'phone', value: input.phone },
      { type: 'contact_phone', value: input.phone },
      { type: 'address', value: input.address },
      { type: 'tax_id', value: input.taxId },
      { type: 'website', value: input.website },
    ];
    await prisma.companyContact.deleteMany({
      where: {
        companyId: input.companyId,
        type: { in: contactPairs.map((pair) => pair.type) },
      },
    });
    await prisma.companyContact.createMany({
      data: contactPairs.map((pair) => ({
        companyId: input.companyId,
        type: pair.type,
        value: pair.value,
        contactName: input.contactName,
      })),
    });
  };

  for (const u of companyUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
      include: { company: true },
    });
    if (existing) {
      console.log(`  ⏭ User already exists: ${u.email}`);
      continue;
    }

    const existingCompanyEmailContact = await prisma.companyContact.findFirst({
      where: {
        type: 'email',
        value: u.companyEmail,
      },
      select: {
        companyId: true,
      },
    });
    const company = existingCompanyEmailContact
      ? await prisma.company.update({
          where: { id: existingCompanyEmailContact.companyId },
          data: {
            industry: [u.industry],
            description: u.description,
            companyNameVi: u.companyNameVi,
            companyNameZh: u.companyNameZh,
            country: u.country,
            region: u.region,
          },
        })
      : await prisma.company.create({
          data: {
            industry: [u.industry],
            description: u.description,
            companyNameVi: u.companyNameVi,
            companyNameZh: u.companyNameZh,
            country: u.country,
            region: u.region,
          },
        });
    await syncCompanyContacts({
      companyId: company.id,
      email: u.companyEmail,
      contactName: u.contactName,
      phone: u.phone,
      address: u.address,
      taxId: u.taxId,
      website: u.website,
    });

    // Create user linked to company
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        email: u.email,
        password: hashed,
        role: 'MEMBER',
        membershipTier: u.tier,
        companyId: company.id,
        primaryIndustry: u.primaryIndustry,
        selectedIndustries: u.selectedIndustries,
        industriesSelected: u.industriesSelected,
        loyaltyPoints: u.loyaltyPoints,
        totalSpending: u.totalSpending,
      },
    });
    console.log(`  ✓ Created ${u.tier} company user with company: ${u.email}`);
  }
  console.log(`  ✓ ${subcategories.length} subcategories seeded`);

  await seedSuperAdminUser();
  await seedAdPackages();
}

async function seedDefaultCompany(): Promise<string> {
  const companyEmail = 'contact@alibaba.com';
  const companyName = 'Alibaba Group Holding Limited';
  const existingCompanyEmailContact = await prisma.companyContact.findFirst({
    where: { type: 'email', value: companyEmail },
    select: { companyId: true },
  });
  const company = existingCompanyEmailContact
    ? await prisma.company.update({
        where: { id: existingCompanyEmailContact.companyId },
        data: {
          industry: ['electronics'],
          description:
            'Alibaba Group is a global technology company specializing in e-commerce, retail, internet, and technology services.',
          companyNameVi: 'Tập đoàn Alibaba',
          companyNameZh: '阿里巴巴集團控股有限公司',
          country: 'China',
          region: 'Zhejiang',
        },
      })
    : await prisma.company.create({
        data: {
          industry: ['electronics'],
          description:
            'Alibaba Group is a global technology company specializing in e-commerce, retail, internet, and technology services.',
          companyNameVi: 'Tập đoàn Alibaba',
          companyNameZh: '阿里巴巴集團控股有限公司',
          country: 'China',
          region: 'Zhejiang',
        },
      });
  await prisma.companyContact.deleteMany({
    where: {
      companyId: company.id,
      type: {
        in: ['email', 'phone', 'contact_phone', 'address', 'website'],
      },
    },
  });
  await prisma.companyContact.createMany({
    data: [
      {
        companyId: company.id,
        type: 'email',
        value: companyEmail,
        contactName: 'Corporate Communications',
      },
      {
        companyId: company.id,
        type: 'phone',
        value: '+86-571-8502-2088',
        contactName: 'Corporate Communications',
      },
      {
        companyId: company.id,
        type: 'contact_phone',
        value: '+86-571-8502-2088',
        contactName: 'Corporate Communications',
      },
      {
        companyId: company.id,
        type: 'address',
        value:
          '969 West Wen Yi Road, Yuhang District, Hangzhou, Zhejiang, China',
        contactName: 'Corporate Communications',
      },
      {
        companyId: company.id,
        type: 'website',
        value: 'https://www.alibaba.com',
        contactName: 'Corporate Communications',
      },
    ],
  });
  console.log(`  ✓ Default company ensured: ${companyName} (${companyEmail})`);
  return company.id;
}

async function seedSuperAdminUser(): Promise<void> {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn(
      'Skipping super admin seed: SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set',
    );
    return;
  }
  const email = adminEmail.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const companyId = await seedDefaultCompany();
  await prisma.user.upsert({
    where: { email },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    update: {
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      companyId,
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    create: {
      email,
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      companyId,
    } as any,
  });
  console.log(`  ✓ Super admin user ensured for email: ${email}`);
}

async function seedAdPackages(): Promise<void> {
  console.log('Seeding ad package categories...');

  const categorySeeds: {
    type: AdCategoryType;
    name: string;
    nameZh: string | null;
    sortOrder: number;
  }[] = [
    {
      type: AdCategoryType.HOMEPAGE_POPUP,
      name: 'Homepage Popup Advertising',
      nameZh: '首頁彈窗廣告',
      sortOrder: 1,
    },
    {
      type: AdCategoryType.FEATURED_COMPANY,
      name: 'Featured Company Exposure',
      nameZh: '精選企業曝光',
      sortOrder: 2,
    },
    {
      type: AdCategoryType.COMPANY_DIRECTORY,
      name: 'Company Name Advertising',
      nameZh: '企業名錄廣告',
      sortOrder: 3,
    },
    {
      type: AdCategoryType.PLATFORM_PRINT,
      name: 'Platform Advertising Rate Card',
      nameZh: null,
      sortOrder: 4,
    },
    {
      type: AdCategoryType.PRODUCT_LISTING,
      name: 'Product Listing Packages',
      nameZh: null,
      sortOrder: 5,
    },
  ];

  const categoryIdByType = new Map<AdCategoryType, string>();

  for (const seed of categorySeeds) {
    const category = await prisma.adPackageCategory.upsert({
      where: { type: seed.type },
      update: {
        name: seed.name,
        nameZh: seed.nameZh ?? undefined,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        type: seed.type,
        name: seed.name,
        nameZh: seed.nameZh ?? undefined,
        description: null,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    });
    categoryIdByType.set(seed.type, category.id);
  }

  console.log('  ✓ Ad package categories seeded');

  console.log('Seeding ad packages...');

  type PackageSeed = {
    categoryType: AdCategoryType;
    type: AdPackageType;
    name: string;
    nameZh: string | null;
    description: string | null;
    pricingModel: PricingModel;
    metadata: Record<string, unknown>;
    sortOrder: number;
  };

  const packageSeeds: PackageSeed[] = [
    // homepage_popup
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_PRIORITY_SLOT,
      name: 'Priority Display (First Position)',
      nameZh: '優先展示（第一位）',
      description:
        'Company is displayed at the top (No.1 position) in homepage popup advertising.',
      pricingModel: PricingModel.DURATION,
      metadata: { slot_position_min: 1, slot_position_max: 1 },
      sortOrder: 1,
    },
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_ROTATION_SLOT,
      name: 'General Rotation (2nd–5th Positions)',
      nameZh: '一般輪播（第2–5位）',
      description:
        'Company is displayed in rotational slots ranked 2–5 in homepage popup advertising.',
      pricingModel: PricingModel.DURATION,
      metadata: { slot_position_min: 2, slot_position_max: 5 },
      sortOrder: 2,
    },
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_VIEW_DETAILS_LINK,
      name: '"View Details" Link Setting',
      nameZh: '「查看詳情」連結設定',
      description:
        'Adds a clickable "View Details" link to the popup advertisement. Single-use, one-time fee.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: { action: 'attach_view_details_link' },
      sortOrder: 3,
    },
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
      name: '"View Details" Link (Priority Slot)',
      nameZh: '「查看詳情」連結（優先位）',
      description:
        'Adds a clickable "View Details" link to the Priority Slot (position 1) popup advertisement. Single-use, one-time fee.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: { action: 'attach_view_details_link', slot: 'priority' },
      sortOrder: 3,
    },
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_ROTATION_DETAILS_LINK,
      name: '"View Details" Link (Rotation Slot)',
      nameZh: '「查看詳情」連結（輪播位）',
      description:
        'Adds a clickable "View Details" link to the Rotation Slot (positions 2–5) popup advertisement. Single-use, one-time fee.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: { action: 'attach_view_details_link', slot: 'rotation' },
      sortOrder: 4,
    },
    {
      categoryType: AdCategoryType.HOMEPAGE_POPUP,
      type: AdPackageType.POPUP_RANKING_ADJUSTMENT,
      name: 'Ranking Adjustment (Promoting Rank)',
      nameZh: '排名調整（提升排名）',
      description:
        'One-time action to improve current ranking position. Charged per action.',
      pricingModel: PricingModel.PER_ACTION,
      metadata: {
        action: 'ranking_adjustment',
        min_quantity: 1,
        max_quantity: 10,
      },
      sortOrder: 5,
    },
    // featured_company
    {
      categoryType: AdCategoryType.FEATURED_COMPANY,
      type: AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
      name: 'Homepage Featured Company Display',
      nameZh: '首頁精選企業展示',
      description:
        'Company is displayed in the Homepage Featured Company section.',
      pricingModel: PricingModel.DURATION,
      metadata: { section: 'homepage_featured', visual_emphasis: false },
      sortOrder: 1,
    },
    {
      categoryType: AdCategoryType.FEATURED_COMPANY,
      type: AdPackageType.FEATURED_HIGHLIGHT_BOOST,
      name: 'Featured Company Highlight Boost',
      nameZh: '精選企業高亮強調',
      description:
        'Additional visual emphasis for featured enterprises on the homepage.',
      pricingModel: PricingModel.DURATION,
      metadata: { section: 'homepage_featured', visual_emphasis: true },
      sortOrder: 2,
    },
    // company_directory
    {
      categoryType: AdCategoryType.COMPANY_DIRECTORY,
      type: AdPackageType.COMPANY_CATEGORY_TOP,
      name: 'Category Page Top Display',
      nameZh: '分類頁頂部展示',
      description: 'Company displayed at the top of industry category pages.',
      pricingModel: PricingModel.DURATION,
      metadata: { placement: 'category_top' },
      sortOrder: 1,
    },
    {
      categoryType: AdCategoryType.COMPANY_DIRECTORY,
      type: AdPackageType.COMPANY_INFO_HIGHLIGHT,
      name: 'Company Info Highlight',
      nameZh: '企業資訊高亮',
      description: 'Highlights company info row inside the enterprise listing.',
      pricingModel: PricingModel.DURATION,
      metadata: { placement: 'company_info_row' },
      sortOrder: 2,
    },
    // platform_print (many rows share PRINT_PLACEMENT type)
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Front Cover',
      nameZh: '封面',
      description:
        'Full-page advertisement on the front cover of the platform printed directory.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'front_cover',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 1,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Back Cover',
      nameZh: '封底',
      description: 'Full-page advertisement on the back cover.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'back_cover',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 2,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inside Front Cover — Left',
      nameZh: '封面內頁 — 左',
      description:
        'Full-page advertisement on the left side of the inside front cover.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inside_front_cover',
        page_side: 'left',
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 3,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inside Front Cover — Right',
      nameZh: '封面內頁 — 右',
      description:
        'Full-page advertisement on the right side of the inside front cover.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inside_front_cover',
        page_side: 'right',
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 4,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inside Back Cover — Left',
      nameZh: '封底內頁 — 左',
      description:
        'Full-page advertisement on the left side of the inside back cover.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inside_back_cover',
        page_side: 'left',
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 5,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inside Back Cover — Right',
      nameZh: '封底內頁 — 右',
      description:
        'Full-page advertisement on the right side of the inside back cover.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inside_back_cover',
        page_side: 'right',
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 6,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inside Pages P2–P5',
      nameZh: '內頁 P2–P5',
      description: 'Full-page advertisement placed within pages 2 to 5.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inner_page_p2_p5',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 7,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'First 5 Pages Before Back Cover',
      nameZh: '封底前5頁',
      description:
        'Full-page advertisement in the first 5 pages before the back cover (excluding inside back-left).',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'pre_back_cover_5pages',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 8,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Category Insert Ad',
      nameZh: '分類插頁廣告',
      description:
        'Full-page advertisement inserted within a category section.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'category_insert',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 9,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Next to Table of Contents — Full Page',
      nameZh: '目錄旁 — 整頁',
      description:
        'Full-page advertisement placed next to the table of contents.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'next_to_toc',
        page_side: null,
        color_type: null,
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 10,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Next to Table of Contents — Half Page',
      nameZh: '目錄旁 — 半頁',
      description:
        'Half-page advertisement placed next to the table of contents.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'next_to_toc',
        page_side: null,
        color_type: null,
        page_size: 'half',
        dimensions_cm: null,
      },
      sortOrder: 11,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inner Page — Color',
      nameZh: '內頁 — 彩色',
      description: 'Full-page color advertisement on an inner page.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inner_page',
        page_side: null,
        color_type: 'color',
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 12,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Inner Page — Monochrome',
      nameZh: '內頁 — 黑白',
      description: 'Full-page monochrome advertisement on an inner page.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inner_page',
        page_side: null,
        color_type: 'monochrome',
        page_size: 'full',
        dimensions_cm: null,
      },
      sortOrder: 13,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Half Page — Color',
      nameZh: '半頁 — 彩色',
      description: 'Half-page color advertisement on an inner page.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inner_page',
        page_side: null,
        color_type: 'color',
        page_size: 'half',
        dimensions_cm: null,
      },
      sortOrder: 14,
    },
    {
      categoryType: AdCategoryType.PLATFORM_PRINT,
      type: AdPackageType.PRINT_PLACEMENT,
      name: 'Quarter Inner Page (13 × 9.5 cm)',
      nameZh: '四分之一內頁（13 × 9.5 cm）',
      description:
        'Quarter-page advertisement on an inner page, dimensions 13 × 9.5 cm.',
      pricingModel: PricingModel.ONE_TIME,
      metadata: {
        page_position: 'inner_page',
        page_side: null,
        color_type: null,
        page_size: 'quarter',
        dimensions_cm: '13x9.5',
      },
      sortOrder: 15,
    },
    // product_listing
    {
      categoryType: AdCategoryType.PRODUCT_LISTING,
      type: AdPackageType.LISTING_BASIC_PLAN,
      name: 'Basic Plan — Single Product, up to 3 Images',
      nameZh: '基礎方案 — 單一產品，最多3張圖片',
      description:
        'List a single product with up to 3 images. No video support.',
      pricingModel: PricingModel.DURATION,
      metadata: {
        plan_tier: 'basic',
        max_images: 3,
        supports_video: false,
        boost_placement: null,
      },
      sortOrder: 1,
    },
    {
      categoryType: AdCategoryType.PRODUCT_LISTING,
      type: AdPackageType.LISTING_ADVANCED_PLAN,
      name: 'Advanced Plan — Up to 10 Images + Video',
      nameZh: '進階方案 — 最多10張圖片＋影片',
      description: 'List a product with up to 10 images and video support.',
      pricingModel: PricingModel.DURATION,
      metadata: {
        plan_tier: 'advanced',
        max_images: 10,
        supports_video: true,
        boost_placement: null,
      },
      sortOrder: 2,
    },
    {
      categoryType: AdCategoryType.PRODUCT_LISTING,
      type: AdPackageType.LISTING_BOOST_HOMEPAGE,
      name: 'Homepage Featured Recommendation (Boost)',
      nameZh: '首頁精選推薦（加推）',
      description:
        'Boost a product listing to the Homepage Featured Recommendation section.',
      pricingModel: PricingModel.DURATION,
      metadata: {
        plan_tier: 'boost',
        boost_placement: 'homepage_featured',
        max_images: null,
        supports_video: null,
      },
      sortOrder: 3,
    },
    {
      categoryType: AdCategoryType.PRODUCT_LISTING,
      type: AdPackageType.LISTING_BOOST_CATEGORY,
      name: 'Category Top Placement (Boost)',
      nameZh: '分類頂部展示（加推）',
      description: 'Boost a product listing to the top of its category page.',
      pricingModel: PricingModel.DURATION,
      metadata: {
        plan_tier: 'boost',
        boost_placement: 'category_top',
        max_images: null,
        supports_video: null,
      },
      sortOrder: 4,
    },
  ];

  const packageIdByKey = new Map<string, string>();

  for (const seed of packageSeeds) {
    const categoryId = categoryIdByType.get(seed.categoryType);
    if (!categoryId) {
      console.warn(
        `  ⚠ Skipping package "${seed.name}" because category type ${seed.categoryType} is missing`,
      );
      continue;
    }
    const existing = await prisma.adPackage.findFirst({
      where: {
        categoryId,
        type: seed.type,
        name: seed.name,
      },
    });
    const pkg =
      existing ??
      (await prisma.adPackage.create({
        data: {
          categoryId,
          type: seed.type,
          name: seed.name,
          nameZh: seed.nameZh ?? undefined,
          description: seed.description,
          pricingModel: seed.pricingModel,
          metadata: seed.metadata as Prisma.InputJsonValue,
          sortOrder: seed.sortOrder,
          isActive: true,
        },
      }));
    const key = `${seed.type}:${seed.name}`;
    packageIdByKey.set(key, pkg.id);
  }

  // Deactivate legacy POPUP_VIEW_DETAILS_LINK packages
  await prisma.adPackage.updateMany({
    where: { type: AdPackageType.POPUP_VIEW_DETAILS_LINK },
    data: { isActive: false },
  });

  console.log('  ✓ Ad packages seeded');

  console.log('Seeding ad package pricing...');

  type PricingSeed = {
    packageKey: string;
    pricingModel: PricingModel;
    durationValue: number | null;
    durationUnit: DurationUnit | null;
    basePrice: bigint;
    discountRate: number;
    finalPrice: bigint;
  };

  const pricingSeeds: PricingSeed[] = [
    // popup_priority_slot
    {
      packageKey: `${AdPackageType.POPUP_PRIORITY_SLOT}:Priority Display (First Position)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_500_000),
      discountRate: 0,
      finalPrice: BigInt(2_500_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_PRIORITY_SLOT}:Priority Display (First Position)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_500_000),
      discountRate: 15,
      finalPrice: BigInt(6_375_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_PRIORITY_SLOT}:Priority Display (First Position)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_500_000),
      discountRate: 25,
      finalPrice: BigInt(11_250_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_PRIORITY_SLOT}:Priority Display (First Position)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_500_000),
      discountRate: 35,
      finalPrice: BigInt(19_500_000),
    },
    // popup_rotation_slot
    {
      packageKey: `${AdPackageType.POPUP_ROTATION_SLOT}:General Rotation (2nd–5th Positions)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_800_000),
      discountRate: 0,
      finalPrice: BigInt(1_800_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_ROTATION_SLOT}:General Rotation (2nd–5th Positions)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_800_000),
      discountRate: 15,
      finalPrice: BigInt(4_590_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_ROTATION_SLOT}:General Rotation (2nd–5th Positions)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_800_000),
      discountRate: 25,
      finalPrice: BigInt(8_100_000),
    },
    {
      packageKey: `${AdPackageType.POPUP_ROTATION_SLOT}:General Rotation (2nd–5th Positions)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_800_000),
      discountRate: 35,
      finalPrice: BigInt(14_040_000),
    },
    // popup_view_details_link (one_time)
    {
      packageKey: `${AdPackageType.POPUP_VIEW_DETAILS_LINK}:"View Details" Link Setting`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(500_000),
      discountRate: 0,
      finalPrice: BigInt(500_000),
    },
    // popup_priority_details_link (one_time)
    {
      packageKey: `${AdPackageType.POPUP_PRIORITY_DETAILS_LINK}:"View Details" Link (Priority Slot)`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(500_000),
      discountRate: 0,
      finalPrice: BigInt(500_000),
    },
    // popup_rotation_details_link (one_time)
    {
      packageKey: `${AdPackageType.POPUP_ROTATION_DETAILS_LINK}:"View Details" Link (Rotation Slot)`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(500_000),
      discountRate: 0,
      finalPrice: BigInt(500_000),
    },
    // popup_ranking_adjustment (per_action)
    {
      packageKey: `${AdPackageType.POPUP_RANKING_ADJUSTMENT}:Ranking Adjustment (Promoting Rank)`,
      pricingModel: PricingModel.PER_ACTION,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(300_000),
      discountRate: 0,
      finalPrice: BigInt(300_000),
    },
    // featured_homepage_display
    {
      packageKey: `${AdPackageType.FEATURED_HOMEPAGE_DISPLAY}:Homepage Featured Company Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(3_000_000),
      discountRate: 0,
      finalPrice: BigInt(3_000_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HOMEPAGE_DISPLAY}:Homepage Featured Company Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(3_000_000),
      discountRate: 15,
      finalPrice: BigInt(7_650_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HOMEPAGE_DISPLAY}:Homepage Featured Company Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(3_000_000),
      discountRate: 25,
      finalPrice: BigInt(13_500_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HOMEPAGE_DISPLAY}:Homepage Featured Company Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(3_000_000),
      discountRate: 35,
      finalPrice: BigInt(23_400_000),
    },
    // featured_highlight_boost
    {
      packageKey: `${AdPackageType.FEATURED_HIGHLIGHT_BOOST}:Featured Company Highlight Boost`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 0,
      finalPrice: BigInt(800_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HIGHLIGHT_BOOST}:Featured Company Highlight Boost`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 15,
      finalPrice: BigInt(2_040_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HIGHLIGHT_BOOST}:Featured Company Highlight Boost`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 25,
      finalPrice: BigInt(3_600_000),
    },
    {
      packageKey: `${AdPackageType.FEATURED_HIGHLIGHT_BOOST}:Featured Company Highlight Boost`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 35,
      finalPrice: BigInt(6_240_000),
    },
    // directory_category_top
    {
      packageKey: `${AdPackageType.COMPANY_CATEGORY_TOP}:Category Page Top Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 0,
      finalPrice: BigInt(1_500_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_CATEGORY_TOP}:Category Page Top Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 15,
      finalPrice: BigInt(3_825_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_CATEGORY_TOP}:Category Page Top Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 25,
      finalPrice: BigInt(6_750_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_CATEGORY_TOP}:Category Page Top Display`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 35,
      finalPrice: BigInt(11_700_000),
    },
    // directory_info_highlight
    {
      packageKey: `${AdPackageType.COMPANY_INFO_HIGHLIGHT}:Company Info Highlight`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_000_000),
      discountRate: 0,
      finalPrice: BigInt(1_000_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_INFO_HIGHLIGHT}:Company Info Highlight`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_000_000),
      discountRate: 15,
      finalPrice: BigInt(2_550_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_INFO_HIGHLIGHT}:Company Info Highlight`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_000_000),
      discountRate: 25,
      finalPrice: BigInt(4_500_000),
    },
    {
      packageKey: `${AdPackageType.COMPANY_INFO_HIGHLIGHT}:Company Info Highlight`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_000_000),
      discountRate: 35,
      finalPrice: BigInt(7_800_000),
    },
    // print_placement (one_time) – one row per PRINT_PLACEMENT package
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Front Cover`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(150_000_000),
      discountRate: 0,
      finalPrice: BigInt(150_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Back Cover`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(112_500_000),
      discountRate: 0,
      finalPrice: BigInt(112_500_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inside Front Cover — Left`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(70_000_000),
      discountRate: 0,
      finalPrice: BigInt(70_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inside Front Cover — Right`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(70_000_000),
      discountRate: 0,
      finalPrice: BigInt(70_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inside Back Cover — Left`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(55_000_000),
      discountRate: 0,
      finalPrice: BigInt(55_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inside Back Cover — Right`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(55_000_000),
      discountRate: 0,
      finalPrice: BigInt(55_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inside Pages P2–P5`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(45_000_000),
      discountRate: 0,
      finalPrice: BigInt(45_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:First 5 Pages Before Back Cover`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(30_000_000),
      discountRate: 0,
      finalPrice: BigInt(30_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Category Insert Ad`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(45_000_000),
      discountRate: 0,
      finalPrice: BigInt(45_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Next to Table of Contents — Full Page`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(45_000_000),
      discountRate: 0,
      finalPrice: BigInt(45_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Next to Table of Contents — Half Page`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(25_000_000),
      discountRate: 0,
      finalPrice: BigInt(25_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inner Page — Color`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(20_000_000),
      discountRate: 0,
      finalPrice: BigInt(20_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Inner Page — Monochrome`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(12_500_000),
      discountRate: 0,
      finalPrice: BigInt(12_500_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Half Page — Color`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(10_000_000),
      discountRate: 0,
      finalPrice: BigInt(10_000_000),
    },
    {
      packageKey: `${AdPackageType.PRINT_PLACEMENT}:Quarter Inner Page (13 × 9.5 cm)`,
      pricingModel: PricingModel.ONE_TIME,
      durationValue: null,
      durationUnit: null,
      basePrice: BigInt(5_000_000),
      discountRate: 0,
      finalPrice: BigInt(5_000_000),
    },
    // listing_basic_plan
    {
      packageKey: `${AdPackageType.LISTING_BASIC_PLAN}:Basic Plan — Single Product, up to 3 Images`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 0,
      finalPrice: BigInt(800_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BASIC_PLAN}:Basic Plan — Single Product, up to 3 Images`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 15,
      finalPrice: BigInt(2_040_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BASIC_PLAN}:Basic Plan — Single Product, up to 3 Images`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 25,
      finalPrice: BigInt(3_600_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BASIC_PLAN}:Basic Plan — Single Product, up to 3 Images`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(800_000),
      discountRate: 35,
      finalPrice: BigInt(6_240_000),
    },
    // listing_advanced_plan
    {
      packageKey: `${AdPackageType.LISTING_ADVANCED_PLAN}:Advanced Plan — Up to 10 Images + Video`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 0,
      finalPrice: BigInt(1_500_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_ADVANCED_PLAN}:Advanced Plan — Up to 10 Images + Video`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 15,
      finalPrice: BigInt(3_825_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_ADVANCED_PLAN}:Advanced Plan — Up to 10 Images + Video`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 25,
      finalPrice: BigInt(6_750_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_ADVANCED_PLAN}:Advanced Plan — Up to 10 Images + Video`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_500_000),
      discountRate: 35,
      finalPrice: BigInt(11_700_000),
    },
    // listing_boost_homepage
    {
      packageKey: `${AdPackageType.LISTING_BOOST_HOMEPAGE}:Homepage Featured Recommendation (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_000_000),
      discountRate: 0,
      finalPrice: BigInt(2_000_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_HOMEPAGE}:Homepage Featured Recommendation (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_000_000),
      discountRate: 15,
      finalPrice: BigInt(5_100_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_HOMEPAGE}:Homepage Featured Recommendation (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_000_000),
      discountRate: 25,
      finalPrice: BigInt(9_000_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_HOMEPAGE}:Homepage Featured Recommendation (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(2_000_000),
      discountRate: 35,
      finalPrice: BigInt(15_600_000),
    },
    // listing_boost_category
    {
      packageKey: `${AdPackageType.LISTING_BOOST_CATEGORY}:Category Top Placement (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 1,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_200_000),
      discountRate: 0,
      finalPrice: BigInt(1_200_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_CATEGORY}:Category Top Placement (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 3,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_200_000),
      discountRate: 15,
      finalPrice: BigInt(3_060_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_CATEGORY}:Category Top Placement (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 6,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_200_000),
      discountRate: 25,
      finalPrice: BigInt(5_400_000),
    },
    {
      packageKey: `${AdPackageType.LISTING_BOOST_CATEGORY}:Category Top Placement (Boost)`,
      pricingModel: PricingModel.DURATION,
      durationValue: 12,
      durationUnit: DurationUnit.MONTH,
      basePrice: BigInt(1_200_000),
      discountRate: 35,
      finalPrice: BigInt(9_360_000),
    },
  ];

  for (const seed of pricingSeeds) {
    const packageId = packageIdByKey.get(seed.packageKey);
    if (!packageId) {
      console.warn(
        `  ⚠ Skipping pricing; package not found for key ${seed.packageKey}`,
      );
      continue;
    }
    const existing = await prisma.adPackagePricing.findFirst({
      where: {
        packageId,
        pricingModel: seed.pricingModel,
        durationValue: seed.durationValue ?? undefined,
        durationUnit: seed.durationUnit ?? undefined,
      },
    });
    if (!existing) {
      await prisma.adPackagePricing.create({
        data: {
          packageId,
          pricingModel: seed.pricingModel,
          durationValue: seed.durationValue ?? undefined,
          durationUnit: seed.durationUnit ?? undefined,
          basePrice: seed.basePrice,
          discountRate: seed.discountRate,
          finalPrice: seed.finalPrice,
          isActive: true,
        },
      });
    }
  }

  console.log('  ✓ Ad package pricing seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
