/**
 * Industry categories enum
 *
 * IMPORTANT: This enum must be kept in sync with fe/src/constants/categories.ts
 * Each value corresponds to the 'id' field in INDUSTRY_CATEGORIES
 */
export enum Industry {
  ALL = 'all', // Special category for Guest, Diamond, Admin
  TEXTILE = 'textile', // Dệt may, phụ kiện
  SHOES = 'shoes', // Ngành giày, da, túi xách, vali
  VEHICLE = 'vehicle', // Ô tô xe máy, linh kiện
  FURNITURE = 'furniture', // Ngành gỗ, mây tre lá, nội thất
  CONSTRUCTION = 'construction', // Kiến trúc, xây dựng
  ELECTRONICS = 'electronics', // Điện tử, điện gia dụng
  MACHINERY = 'machinery', // Cơ khí, điện công nghiệp
  PLASTIC = 'plastic', // Nhựa, cao su, hóa chất
  AGRICULTURE = 'agriculture', // Nông Lâm Ngư nghiệp, Chăn nuôi
  METAL = 'metal', // Kim loại ngũ kim
  PAPER = 'paper', // Bao bì, in ấn
  LOGISTICS = 'logistics', // Hàng hải, hàng không
  FINANCE = 'finance', // Chứng khoán, tài chính, bảo hiểm
  GIFTS = 'gifts', // Thủ công mỹ nghệ, quà tặng, trang sức, gia dụng
  TOURISM = 'tourism', // Du lịch, nhà hàng, thể thao
  FOOD = 'food', // Thực phẩm, nước giải khát
  EDUCATION = 'education', // Giáo dục, Y tế & thiết bị y tế
  OTHER = 'other', // Các ngành phục vụ khác
}

/**
 * Array of all valid industry values (excluding ALL)
 */
export const VALID_INDUSTRIES = [
  Industry.TEXTILE,
  Industry.SHOES,
  Industry.VEHICLE,
  Industry.FURNITURE,
  Industry.CONSTRUCTION,
  Industry.ELECTRONICS,
  Industry.MACHINERY,
  Industry.PLASTIC,
  Industry.AGRICULTURE,
  Industry.METAL,
  Industry.PAPER,
  Industry.LOGISTICS,
  Industry.FINANCE,
  Industry.GIFTS,
  Industry.TOURISM,
  Industry.FOOD,
  Industry.EDUCATION,
  Industry.OTHER,
];

/**
 * Array of all industry values (including ALL)
 */
export const ALL_INDUSTRIES = [Industry.ALL, ...VALID_INDUSTRIES];
