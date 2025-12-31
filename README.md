# D2BCart - B2B Marketplace Platform

A B2B marketplace connecting manufacturers/importers directly with retail businesses, using an arbitrage/markup model.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase-schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Configure Environment
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
d2bcart/
├── app/
│   ├── page.tsx                    # Homepage
│   ├── login/page.tsx              # Login page
│   ├── register/page.tsx           # Registration (manufacturer/retailer)
│   ├── products/
│   │   ├── page.tsx                # Browse products
│   │   └── [id]/page.tsx           # Product detail
│   ├── manufacturer/
│   │   ├── page.tsx                # Manufacturer dashboard
│   │   └── products/new/page.tsx   # Add new product
│   └── admin/page.tsx              # Admin dashboard
├── components/
│   └── Navbar.tsx                  # Navigation bar
├── lib/
│   ├── supabase.ts                 # Supabase client
│   ├── store.ts                    # Zustand state store
│   └── utils.ts                    # Utility functions
├── types/
│   └── database.ts                 # TypeScript types
└── supabase-schema.sql             # Database schema
```

---

## 💰 Business Model (Arbitrage)

| Entity | Flow |
|--------|------|
| **Manufacturer** | Lists product at ₹100 (base price) |
| **Platform** | Adds 15% markup (category-based) |
| **Retailer** | Sees and pays ₹115 |
| **Your Profit** | ₹15 per unit sold |

### Category Markups
| Category | Markup |
|----------|--------|
| Electronics | 12% |
| Mobile Accessories | 20% |
| Fashion | 25% |
| FMCG | 10% |
| Hardware | 18% |
| Stationery | 30% |

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Icons:** Lucide React

---

## 📋 Features

### ✅ Implemented
- [x] Homepage with hero, features, categories
- [x] User registration (manufacturer/retailer)
- [x] User login with role-based redirect
- [x] Product browsing with search and filters
- [x] Product detail page with quantity selector
- [x] Manufacturer dashboard
- [x] Add product with dynamic pricing preview
- [x] Admin dashboard with profit tracking
- [x] Database schema with RLS policies

### 🔄 Coming Soon
- [ ] Razorpay payment integration
- [ ] Order management
- [ ] Cart functionality
- [ ] Image upload (Cloudinary)
- [ ] Order tracking
- [ ] Payout management
- [ ] Email notifications

---

## 🚀 Deployment

### Deploy to Vercel
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy!

---

## 📞 Support

Built with ❤️ for B2B commerce.
