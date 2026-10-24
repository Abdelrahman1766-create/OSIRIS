import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, type Gender } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogDraft = {
  slug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionRu: string;
  inspirationName?: string | null;
  brand: string;
  category: string;
  familyEn?: string;
  familyAr?: string;
  familyRu?: string;
  gender: Gender;
  topNotes: string[];
  topNotesAr: string[];
  topNotesRu: string[];
  middleNotes: string[];
  middleNotesAr: string[];
  middleNotesRu: string[];
  baseNotes: string[];
  baseNotesAr: string[];
  baseNotesRu: string[];
  mainImage: string;
  images: string[];
};

const catalogDrafts: CatalogDraft[] = [
  {
    slug: 'arabian-oud-madawi-gold-edition',
    nameEn: 'Madawi Gold Style', nameAr: 'مضاوي غولد ستايل', nameRu: 'Madawi Gold Style', inspirationName: 'Arabian Oud Madawi Gold Edition',
    descriptionEn: 'A warm, rich fragrance with soft vanilla sweetness, a musky character, and a woody base. Made for those who love comforting, deep, and elegant compositions.',
    descriptionAr: 'عطر دافئ وغني بحلاوة فانيليا ناعمة وطابع مسكي وقاعدة خشبية. يناسب محبي التركيبات المريحة والعميقة والأنيقة.',
    descriptionRu: 'Тёплый и насыщенный аромат с мягкой ванильной сладостью, мускусным характером и древесной базой. Подходит для тех, кто любит уютные, глубокие и элегантные композиции.',
    brand: 'OSIRIS', category: 'Oriental / Warm / Woody', gender: 'UNISEX',
    topNotes: ['Vanilla'], topNotesAr: ['فانيليا'], topNotesRu: ['Ваниль'],
    middleNotes: ['Musk'], middleNotesAr: ['مسك'], middleNotesRu: ['Мускус'],
    baseNotes: ['Woody Notes'], baseNotesAr: ['نفحات خشبية'], baseNotesRu: ['Древесные ноты'],
    mainImage: '/products/madawi-gold.jpg', images: ['/products/madawi-gold.jpg'],
  },
  {
    slug: 'arabian-oud-arabian-knight',
    nameEn: 'Arabian Knight Style', nameAr: 'أرابيان نايت ستايل', nameRu: 'Arabian Knight Style', inspirationName: 'Arabian Oud Arabian Knight',
    descriptionEn: 'A deep oriental fragrance with a spicy opening, warm amber, and expressive leather and woody nuances. Musk and sandalwood emerge in the base, creating a confident and refined trail.',
    descriptionAr: 'عطر شرقي عميق بافتتاحية متبلة وعنبر دافئ ولمسات واضحة من الجلد والأخشاب. يظهر المسك وخشب الصندل في القاعدة ليشكلا أثراً واثقاً وراقياً.',
    descriptionRu: 'Глубокий восточный аромат с пряным началом, тёплой амброй и выразительными кожаными и древесными оттенками. В базе раскрываются мускус и сандал, создавая уверенный и благородный шлейф.',
    brand: 'OSIRIS', category: 'Oriental / Spicy / Woody', gender: 'UNISEX',
    topNotes: ['Spices', 'Amber'], topNotesAr: ['توابل', 'عنبر'], topNotesRu: ['Специи', 'Амбра'],
    middleNotes: ['Woods', 'Leather'], middleNotesAr: ['أخشاب', 'جلد'], middleNotesRu: ['Древесина', 'Кожа'],
    baseNotes: ['Musk', 'Sandalwood'], baseNotesAr: ['مسك', 'خشب الصندل'], baseNotesRu: ['Мускус', 'Сандал'],
    mainImage: '/products/arabian-knight-1.jpg', images: ['/products/arabian-knight-1.jpg', '/products/arabian-knight-2.jpg'],
  },
  {
    slug: 'anna-sui-fantasia',
    nameEn: 'Fantasia Style', nameAr: 'فانتازيا ستايل', nameRu: 'Fantasia Style', inspirationName: 'Anna Sui Fantasia',
    descriptionEn: 'A bright, fantastical fragrance with a sparkling blend of pink pepper and citrus, a sweet heart of praline and flowers, and a soft vanilla woody base.',
    descriptionAr: 'عطر مشرق وحالم بمزيج متلألئ من الفلفل الوردي والحمضيات، وقلب حلو من البرالين والزهور، وقاعدة ناعمة من الفانيليا والأخشاب.',
    descriptionRu: 'Яркий и сказочный аромат с искристым сочетанием розового перца и цитрусов, сладким сердцем из пралине и цветов и мягкой ванильно-древесной базой.',
    brand: 'OSIRIS', category: 'Sweet / Floral / Fruity', gender: 'WOMEN',
    topNotes: ['Pink Pepper', 'Citrus'], topNotesAr: ['فلفل وردي', 'حمضيات'], topNotesRu: ['Розовый перец', 'Цитрусы'],
    middleNotes: ['Praline', 'Floral Notes'], middleNotesAr: ['برالين', 'نفحات زهرية'], middleNotesRu: ['Пралине', 'Цветочные ноты'],
    baseNotes: ['Vanilla', 'Woody Notes'], baseNotesAr: ['فانيليا', 'نفحات خشبية'], baseNotesRu: ['Ваниль', 'Древесные ноты'],
    mainImage: '/products/anna-sui-fantasia.jpg', images: ['/products/anna-sui-fantasia.jpg'],
  },
  {
    slug: 'attar-collection-hayati',
    nameEn: 'Hayati Style', nameAr: 'حياتي ستايل', nameRu: 'Hayati Style', inspirationName: 'Attar Collection Hayati',
    descriptionEn: 'A sweet, comforting fragrance with vivid berry and fruit nuances, a delicate vanilla cream heart, and a soft musky base. Made for lovers of gourmand and warm scents.',
    descriptionAr: 'عطر حلو ومريح بنفحات واضحة من التوت والفواكه، وقلب رقيق من الفانيليا والكريمة، وقاعدة مسكية ناعمة. يناسب محبي الروائح الدافئة والغورماند.',
    descriptionRu: 'Сладкий и уютный аромат с яркими ягодно-фруктовыми оттенками, нежной ванильно-сливочной серединой и мягкой мускусной базой. Подходит любителям гурманских и тёплых ароматов.',
    brand: 'OSIRIS', category: 'Sweet / Gourmand / Fruity', gender: 'UNISEX',
    topNotes: ['Berries', 'Fruits'], topNotesAr: ['توت', 'فواكه'], topNotesRu: ['Ягоды', 'Фрукты'],
    middleNotes: ['Vanilla', 'Creamy Notes'], middleNotesAr: ['فانيليا', 'نفحات كريمية'], middleNotesRu: ['Ваниль', 'Сливочные ноты'],
    baseNotes: ['Musk'], baseNotesAr: ['مسك'], baseNotesRu: ['Мускус'],
    mainImage: '/products/hayati.jpg', images: ['/products/hayati.jpg'],
  },
  {
    slug: 'nefertiti-chabrawichi',
    nameEn: 'Nefertiti Style', nameAr: 'نفرتيتي ستايل', nameRu: 'Nefertiti Style', inspirationName: 'Chabrawichi Nefertiti',
    descriptionEn: 'A warm, distinctive fragrance with amber, musky, and powdery tones. The composition has a rich, sensual, and subtly animalic character.',
    descriptionAr: 'عطر دافئ ومميز بطابع عنبري ومسكي وبودري. تتمتع تركيبته بشخصية غنية وحسية ولمسة حيوانية خفيفة.',
    descriptionRu: 'Тёплый и характерный аромат с амбровым, мускусным и пудровым звучанием. Композиция обладает насыщенным, чувственным и слегка анималистичным характером.',
    brand: 'OSIRIS', category: 'Amber / Powdery / Musky', gender: 'UNISEX',
    topNotes: ['Amber'], topNotesAr: ['عنبر'], topNotesRu: ['Амбра'],
    middleNotes: ['Powdery Notes', 'Warm Notes'], middleNotesAr: ['نفحات بودرية', 'نفحات دافئة'], middleNotesRu: ['Пудровые ноты', 'Тёплые ноты'],
    baseNotes: ['Musk', 'Animalic Notes'], baseNotesAr: ['مسك', 'نفحات حيوانية'], baseNotesRu: ['Мускус', 'Анималистичные ноты'],
    mainImage: '/products/nefertiti-chabrawichi.jpg', images: ['/products/nefertiti-chabrawichi.jpg'],
  },
  {
    slug: 'attar-collection-crystal-love',
    nameEn: 'Crystal Love Style', nameAr: 'كريستال لوف ستايل', nameRu: 'Crystal Love Style', inspirationName: 'Attar Collection Crystal Love',
    descriptionEn: 'A delicate, sweet fragrance with fruity and chocolate nuances, a floral rose heart, and a soft base of vanilla and musk. Elegant and romantic in character.',
    descriptionAr: 'عطر رقيق وحلو بنفحات فاكهية وشوكولاتة، وقلب زهري من الورد، وقاعدة ناعمة من الفانيليا والمسك. يتميز بطابع أنيق ورومانسي.',
    descriptionRu: 'Нежный и сладкий аромат с фруктовыми и шоколадными оттенками, цветочно-розовым сердцем и мягкой базой из ванили и мускуса. Элегантный и романтичный характер.',
    brand: 'OSIRIS', category: 'Sweet / Floral / Gourmand', gender: 'WOMEN',
    topNotes: ['Fruits', 'Chocolate'], topNotesAr: ['فواكه', 'شوكولاتة'], topNotesRu: ['Фрукты', 'Шоколад'],
    middleNotes: ['Floral Notes', 'Rose'], middleNotesAr: ['نفحات زهرية', 'ورد'], middleNotesRu: ['Цветочные ноты', 'Роза'],
    baseNotes: ['Vanilla', 'Musk'], baseNotesAr: ['فانيليا', 'مسك'], baseNotesRu: ['Ваниль', 'Мускус'],
    mainImage: '/products/crystal-love.jpg', images: ['/products/crystal-love.jpg'],
  },
  {
    slug: 'antonio-banderas-blue-seduction',
    nameEn: 'Blue Seduction Style', nameAr: 'بلو سيدكشن ستايل', nameRu: 'Blue Seduction Style', inspirationName: 'Antonio Banderas Blue Seduction',
    descriptionEn: 'A fresh, light fragrance with a citrus fruit opening and cool aquatic accents. A musky woody base gives the composition a clean, modern, and versatile character.',
    descriptionAr: 'عطر منعش وخفيف بافتتاحية من الحمضيات والفواكه ولمسات مائية باردة. تمنح القاعدة المسكية الخشبية التركيبة طابعاً نظيفاً وعصرياً ومتعدد الاستخدامات.',
    descriptionRu: 'Свежий и лёгкий аромат с цитрусово-фруктовым стартом и прохладными водными акцентами. Мускусно-древесная база делает композицию чистой, современной и универсальной.',
    brand: 'OSIRIS', category: 'Fresh / Aquatic / Citrus', gender: 'MEN',
    topNotes: ['Citrus', 'Fruits'], topNotesAr: ['حمضيات', 'فواكه'], topNotesRu: ['Цитрусы', 'Фрукты'],
    middleNotes: ['Aquatic Notes', 'Floral Notes'], middleNotesAr: ['نفحات مائية', 'نفحات زهرية'], middleNotesRu: ['Водные ноты', 'Цветочные ноты'],
    baseNotes: ['Vanilla', 'Musk'], baseNotesAr: ['فانيليا', 'مسك'], baseNotesRu: ['Ваниль', 'Мускус'],
    mainImage: '/products/blue-seduction.jpg', images: ['/products/blue-seduction.jpg'],
  },
  {
    slug: 'tiziana-terenzi-kirke',
    nameEn: 'Kirke Style', nameAr: 'كيركي ستايل', nameRu: 'Kirke Style', inspirationName: 'Tiziana Terenzi Kirke',
    descriptionEn: 'A vivid fruity fragrance with juicy passion fruit and peach nuances that develops into a soft, sensual, enveloping trail. Made for those who love expressive, memorable compositions.',
    descriptionAr: 'عطر فاكهي نابض بالحيوية بنفحات عصيرية من فاكهة العاطفة والخوخ، يتطور إلى أثر ناعم وحسي وغامر. يناسب محبي التركيبات المعبرة التي لا تُنسى.',
    descriptionRu: 'Яркий фруктовый аромат с сочными оттенками маракуйи и персика, переходящий в мягкое, чувственное и обволакивающее звучание. Идеален для тех, кто любит выразительные и запоминающиеся композиции.',
    brand: 'OSIRIS', category: 'Fruity / Sweet / Vibrant', gender: 'UNISEX',
    topNotes: ['Passion Fruit', 'Peach'], topNotesAr: ['فاكهة العاطفة', 'خوخ'], topNotesRu: ['Маракуйя', 'Персик'],
    middleNotes: [], middleNotesAr: [], middleNotesRu: [],
    baseNotes: [], baseNotesAr: [], baseNotesRu: [],
    mainImage: '/products/kirke.jpg', images: ['/products/kirke.jpg'],
  },
  {
    slug: 'pyramids',
    nameEn: 'Pyramids', nameAr: 'بيراميدز', nameRu: 'Pyramids',
    descriptionEn: 'A bright and memorable original OSIRIS fragrance with a fruity opening of pink strawberry and green apple. Juicy raspberry unfolds in the heart, while patchouli, oakmoss, sandalwood and tonka beans create a warm, deep and elegant trail.',
    descriptionAr: 'عطر أصلي من OSIRIS يبدأ بنفحات فاكهية من الفراولة الوردية والتفاح الأخضر، ثم يظهر توت العليق في القلب، بينما تمنح القاعدة المكوّنة من الباتشولي وطحلب البلوط وخشب الصندل وحبوب التونكا دفئًا وعمقًا ولمسة أنيقة.',
    descriptionRu: 'Яркий и запоминающийся авторский аромат OSIRIS с фруктовым началом из розовой клубники и зелёного яблока. В сердце раскрывается сочная малина, а база из пачули, дубового мха, сандала и бобов тонка создаёт тёплый, глубокий и элегантный шлейф.',
    inspirationName: null,
    brand: 'OSIRIS', category: 'Fruity / Chypre / Woody', familyEn: 'Fruity / Chypre / Woody', familyAr: 'فاكهي / شيبر / خشبي', familyRu: 'Фруктовый / Шипровый / Древесный', gender: 'UNISEX',
    topNotes: ['Pink Strawberry', 'Green Apple'], topNotesAr: ['الفراولة الوردية', 'التفاح الأخضر'], topNotesRu: ['Розовая клубника', 'Зелёное яблоко'],
    middleNotes: ['Raspberry'], middleNotesAr: ['توت العليق'], middleNotesRu: ['Малина'],
    baseNotes: ['Patchouli', 'Oakmoss', 'Sandalwood', 'Tonka Beans'], baseNotesAr: ['الباتشولي', 'طحلب البلوط', 'خشب الصندل', 'حبوب التونكا'], baseNotesRu: ['Пачули', 'Дубовый мох', 'Сандал', 'Бобы тонка'],
    mainImage: '/products/pyramids.png', images: ['/products/pyramids.png'],
  },
];

// These are independently blended OSIRIS fragrances. The reference is a scent guide only.
const inspiredCatalog: Array<{
  slug: string; name: string; reference: string; image: string; gender: Gender;
  descriptionRu: string; descriptionEn: string; descriptionAr: string;
  familyRu: string; familyEn: string; familyAr: string;
  profileRu: string[]; profileEn: string[]; profileAr: string[];
}> = [
  {
    slug: 'yara-style', name: 'Yara Style', reference: 'Lattafa Yara', image: '/products/lattafa-yara.jpg', gender: 'WOMEN',
    descriptionRu: 'Нежный, сладкий и женственный аромат с мягким фруктово-цветочным характером. Сливочные, ванильные и тропические оттенки создают уютное и притягательное звучание, а мягкая мускусно-древесная база оставляет элегантный шлейф.',
    descriptionEn: 'A delicate, sweet and feminine fragrance with a soft fruity-floral character. Creamy, vanilla and tropical nuances create a comforting, alluring impression, while a gentle musky-woody base leaves an elegant trail.',
    descriptionAr: 'عطر رقيق وحلو وأنثوي بطابع فاكهي زهري ناعم. تمنح النفحات الكريمية والفانيليا والاستوائية إحساسًا دافئًا وجذابًا، وتترك القاعدة المسكية الخشبية الناعمة أثرًا أنيقًا.',
    familyRu: 'Сладкий / Цветочный / Гурманский', familyEn: 'Sweet / Floral / Gourmand', familyAr: 'حلو / زهري / غورماند',
    profileRu: ['Фрукты', 'Цветы', 'Сливочные ноты', 'Ваниль', 'Мускус', 'Древесные ноты'], profileEn: ['Fruit', 'Flowers', 'Creamy notes', 'Vanilla', 'Musk', 'Woody notes'], profileAr: ['فواكه', 'زهور', 'نفحات كريمية', 'فانيليا', 'مسك', 'نفحات خشبية'],
  },
  {
    slug: 'asad-style', name: 'Asad Style', reference: 'Lattafa Asad', image: '/products/lattafa-asad.jpg', gender: 'MEN',
    descriptionRu: 'Сильный, насыщенный и тёплый мужской аромат с пряным характером. Перечные и фруктовые оттенки переходят в глубокое сердце с кофейно-древесным звучанием, а ванильная и амбровая база создаёт уверенный и выразительный шлейф.',
    descriptionEn: 'A powerful, rich and warm masculine fragrance with a spicy character. Peppery and fruity nuances give way to a deep coffee-wood heart, while a vanilla and amber base creates a confident, expressive trail.',
    descriptionAr: 'عطر رجالي قوي وغني ودافئ بطابع متبّل. تنتقل لمسات الفلفل والفواكه إلى قلب عميق بنفحات القهوة والأخشاب، بينما تترك قاعدة الفانيليا والعنبر أثرًا واثقًا ومعبّرًا.',
    familyRu: 'Пряный / Амбровый / Древесный', familyEn: 'Spicy / Amber / Woody', familyAr: 'متبّل / عنبري / خشبي',
    profileRu: ['Перец', 'Фрукты', 'Кофе', 'Древесные ноты', 'Ваниль', 'Амбра'], profileEn: ['Pepper', 'Fruit', 'Coffee', 'Woody notes', 'Vanilla', 'Amber'], profileAr: ['فلفل', 'فواكه', 'قهوة', 'نفحات خشبية', 'فانيليا', 'عنبر'],
  },
  {
    slug: 'khamrah-style', name: 'Khamrah Style', reference: 'Lattafa Khamrah', image: '/products/lattafa-khamrah.jpg', gender: 'UNISEX',
    descriptionRu: 'Богатый восточно-гурманский аромат с тёплыми пряными и сладкими оттенками. Корица и ароматные специи раскрываются вместе с гурманским сердцем, а ванильная, смолистая и древесная база создаёт густой, уютный и запоминающийся шлейф.',
    descriptionEn: 'A rich oriental-gourmand fragrance with warm spicy and sweet nuances. Cinnamon and aromatic spices unfold around a gourmand heart, while a vanilla, resinous and woody base creates a full, comforting and memorable trail.',
    descriptionAr: 'عطر شرقي غورماند غني بنفحات دافئة متبّلة وحلوة. تتفتح القرفة والتوابل العطرية مع قلب غورماند، بينما تمنح قاعدة الفانيليا والراتنج والأخشاب أثرًا كثيفًا ودافئًا لا يُنسى.',
    familyRu: 'Восточный / Гурманский / Пряный', familyEn: 'Oriental / Gourmand / Spicy', familyAr: 'شرقي / غورماند / متبّل',
    profileRu: ['Корица', 'Специи', 'Гурманские ноты', 'Ваниль', 'Смолы', 'Древесные ноты'], profileEn: ['Cinnamon', 'Spices', 'Gourmand notes', 'Vanilla', 'Resins', 'Woody notes'], profileAr: ['قرفة', 'توابل', 'نفحات غورماند', 'فانيليا', 'راتنج', 'نفحات خشبية'],
  },
  {
    slug: 'narcotic-delight-style', name: 'Narcotic Delight Style', reference: 'Initio Narcotic Delight', image: '/products/initio-narcotic-delight.jpg', gender: 'UNISEX',
    descriptionRu: 'Чувственный и насыщенный аромат с сочным фруктовым характером, тёплыми пряностями и сладкими табачно-ванильными оттенками. Глубокое и соблазнительное звучание особенно подходит для вечерних образов.',
    descriptionEn: 'A sensual, rich fragrance with a juicy fruity character, warm spices and sweet tobacco-vanilla nuances. Its deep, alluring profile is especially suited to evening wear.',
    descriptionAr: 'عطر حسي وغني بطابع فاكهي عصيري وتوابل دافئة ولمسات حلوة من التبغ والفانيليا. تناسب رائحته العميقة والجذابة إطلالات المساء على نحو خاص.',
    familyRu: 'Сладкий / Табачный / Пряный', familyEn: 'Sweet / Tobacco / Spicy', familyAr: 'حلو / تبغي / متبّل',
    profileRu: ['Фрукты', 'Тёплые специи', 'Табак', 'Ваниль'], profileEn: ['Fruit', 'Warm spices', 'Tobacco', 'Vanilla'], profileAr: ['فواكه', 'توابل دافئة', 'تبغ', 'فانيليا'],
  },
  {
    slug: 'molecule-02-style', name: 'Molecule 02 Style', reference: 'Escentric Molecules Molecule 02', image: '/products/molecule-02.jpg', gender: 'UNISEX',
    descriptionRu: 'Минималистичный и современный аромат с чистым, прозрачным и слегка минеральным характером. Мягкое амброво-мускусное звучание постепенно раскрывается на коже и создаёт тонкий, чувственный шлейф.',
    descriptionEn: 'A minimalist, modern fragrance with a clean, transparent and slightly mineral character. Soft amber-musky facets gradually unfold on the skin, creating a subtle, sensual trail.',
    descriptionAr: 'عطر بسيط وعصري بطابع نظيف وشفاف ومعدني قليلًا. تنكشف النفحات العنبرية المسكية الناعمة تدريجيًا على البشرة وتترك أثرًا رقيقًا وحسيًا.',
    familyRu: 'Амбровый / Мускусный / Минеральный', familyEn: 'Amber / Musky / Mineral', familyAr: 'عنبري / مسكي / معدني',
    profileRu: ['Минеральные ноты', 'Амбра', 'Мускус'], profileEn: ['Mineral notes', 'Amber', 'Musk'], profileAr: ['نفحات معدنية', 'عنبر', 'مسك'],
  },
  {
    slug: 'molecule-01-mandarin-style', name: 'Molecule 01 + Mandarin Style', reference: 'Escentric Molecules Molecule 01 + Mandarin', image: '/products/molecule-01-mandarin.jpg', gender: 'UNISEX',
    descriptionRu: 'Свежий и современный аромат, сочетающий яркий цитрусовый характер мандарина с мягким бархатистым древесным звучанием. Лёгкий, чистый и универсальный вариант на каждый день.',
    descriptionEn: 'A fresh, modern fragrance pairing the bright citrus character of mandarin with soft, velvety woods. A light, clean and versatile choice for everyday wear.',
    descriptionAr: 'عطر منعش وعصري يجمع بين الطابع الحمضي المشرق لليوسفي والنفحات الخشبية الناعمة المخملية. خيار خفيف ونظيف ومتعدد الاستخدامات لكل يوم.',
    familyRu: 'Цитрусовый / Древесный / Свежий', familyEn: 'Citrus / Woody / Fresh', familyAr: 'حمضي / خشبي / منعش',
    profileRu: ['Мандарин', 'Цитрусы', 'Древесные ноты'], profileEn: ['Mandarin', 'Citrus', 'Woody notes'], profileAr: ['يوسفي', 'حمضيات', 'نفحات خشبية'],
  },
  {
    slug: 'bois-imperial-style', name: 'Bois Imperial Style', reference: 'Essential Parfums Bois Impérial', image: '/products/bois-imperial.jpg', gender: 'UNISEX',
    descriptionRu: 'Современный древесно-пряный аромат с яркой зелёной свежестью. Пряные и ароматические оттенки раскрываются на фоне мощной древесной базы, создавая элегантное, чистое и выразительное звучание.',
    descriptionEn: 'A modern woody-spicy fragrance with vivid green freshness. Spicy and aromatic nuances unfold over a strong woody base, creating an elegant, clean and expressive profile.',
    descriptionAr: 'عطر خشبي متبّل عصري بانتعاش أخضر واضح. تتفتح اللمسات المتبّلة والعطرية فوق قاعدة خشبية قوية، لتمنح الرائحة طابعًا أنيقًا ونظيفًا ومعبّرًا.',
    familyRu: 'Древесный / Пряный / Зелёный', familyEn: 'Woody / Spicy / Green', familyAr: 'خشبي / متبّل / أخضر',
    profileRu: ['Зелёные ноты', 'Специи', 'Ароматические ноты', 'Древесные ноты'], profileEn: ['Green notes', 'Spices', 'Aromatic notes', 'Woody notes'], profileAr: ['نفحات خضراء', 'توابل', 'نفحات عطرية', 'نفحات خشبية'],
  },
  {
    slug: 'tobacco-vanille-style', name: 'Tobacco Vanille Style', reference: 'Tom Ford Tobacco Vanille', image: '/products/tom-ford-tobacco-vanille.jpg', gender: 'UNISEX',
    descriptionRu: 'Роскошный, тёплый и насыщенный аромат с выразительным табачным характером и мягкой сладостью ванили. Пряные, шоколадные и бальзамические оттенки создают глубокий и уютный вечерний шлейф.',
    descriptionEn: 'A luxurious, warm and rich fragrance with a distinctive tobacco character and the soft sweetness of vanilla. Spicy, chocolate and balsamic nuances create a deep, comforting evening trail.',
    descriptionAr: 'عطر فاخر ودافئ وغني بطابع تبغي واضح وحلاوة ناعمة من الفانيليا. تمنح النفحات المتبّلة والشوكولاتة والبلسمية أثرًا مسائيًا عميقًا ومريحًا.',
    familyRu: 'Табачный / Сладкий / Пряный', familyEn: 'Tobacco / Sweet / Spicy', familyAr: 'تبغي / حلو / متبّل',
    profileRu: ['Табак', 'Ваниль', 'Специи', 'Шоколад', 'Бальзамические ноты'], profileEn: ['Tobacco', 'Vanilla', 'Spices', 'Chocolate', 'Balsamic notes'], profileAr: ['تبغ', 'فانيليا', 'توابل', 'شوكولاتة', 'نفحات بلسمية'],
  },
  {
    slug: 'erba-pura-style', name: 'Erba Pura Style', reference: 'Xerjoff Erba Pura', image: '/products/erba-pura.jpg', gender: 'UNISEX',
    descriptionRu: 'Яркий и сочный фруктовый аромат с искристым цитрусовым началом. Сладкие фруктовые оттенки плавно переходят в тёплую ванильно-мускусную базу, создавая насыщенный и заметный шлейф.',
    descriptionEn: 'A bright, juicy fruity fragrance with a sparkling citrus opening. Sweet fruit nuances flow into a warm vanilla-musky base, creating a rich and noticeable trail.',
    descriptionAr: 'عطر فاكهي مشرق وعصيري بافتتاحية حمضية متلألئة. تنتقل النفحات الفاكهية الحلوة بسلاسة إلى قاعدة دافئة من الفانيليا والمسك، تاركة أثرًا غنيًا وملحوظًا.',
    familyRu: 'Фруктовый / Цитрусовый / Сладкий', familyEn: 'Fruity / Citrus / Sweet', familyAr: 'فاكهي / حمضي / حلو',
    profileRu: ['Цитрусы', 'Фрукты', 'Ваниль', 'Мускус'], profileEn: ['Citrus', 'Fruit', 'Vanilla', 'Musk'], profileAr: ['حمضيات', 'فواكه', 'فانيليا', 'مسك'],
  },
  {
    slug: 'sauvage-style', name: 'Sauvage Style', reference: 'Dior Sauvage', image: '/products/dior-sauvage.jpg', gender: 'MEN',
    descriptionRu: 'Свежий и уверенный мужской аромат с ярким цитрусово-пряным характером. Чистые древесно-амбровые оттенки делают композицию энергичной, современной и универсальной для повседневного использования.',
    descriptionEn: 'A fresh, confident masculine fragrance with a vivid citrus-spicy character. Clean woody-amber nuances make the composition energetic, modern and versatile for everyday wear.',
    descriptionAr: 'عطر رجالي منعش وواثق بطابع حمضي متبّل واضح. تمنح اللمسات الخشبية العنبرية النظيفة التركيبة حيوية وعصرية وتنوعًا يناسب الاستخدام اليومي.',
    familyRu: 'Свежий / Цитрусовый / Древесный', familyEn: 'Fresh / Citrus / Woody', familyAr: 'منعش / حمضي / خشبي',
    profileRu: ['Цитрусы', 'Специи', 'Древесные ноты', 'Амбра'], profileEn: ['Citrus', 'Spices', 'Woody notes', 'Amber'], profileAr: ['حمضيات', 'توابل', 'نفحات خشبية', 'عنبر'],
  },
];

catalogDrafts.push(...inspiredCatalog.map((item): CatalogDraft => ({
  slug: item.slug, nameEn: item.name, nameRu: item.name, nameAr: item.name,
  inspirationName: item.reference,
  descriptionEn: item.descriptionEn, descriptionRu: item.descriptionRu, descriptionAr: item.descriptionAr,
  brand: 'OSIRIS', category: item.familyEn, familyEn: item.familyEn, familyAr: item.familyAr, familyRu: item.familyRu,
  gender: item.gender,
  topNotes: item.profileEn, topNotesRu: item.profileRu, topNotesAr: item.profileAr,
  middleNotes: [], middleNotesRu: [], middleNotesAr: [],
  baseNotes: [], baseNotesRu: [], baseNotesAr: [],
  mainImage: item.image, images: [item.image],
})));

const existingFamilies: Record<string, { ru: string; ar: string }> = {
  'Oriental / Warm / Woody': { ru: 'Восточный / Тёплый / Древесный', ar: 'شرقي / دافئ / خشبي' },
  'Oriental / Spicy / Woody': { ru: 'Восточный / Пряный / Древесный', ar: 'شرقي / متبّل / خشبي' },
  'Sweet / Floral / Fruity': { ru: 'Сладкий / Цветочный / Фруктовый', ar: 'حلو / زهري / فاكهي' },
  'Sweet / Gourmand / Fruity': { ru: 'Сладкий / Гурманский / Фруктовый', ar: 'حلو / غورماند / فاكهي' },
  'Amber / Powdery / Musky': { ru: 'Амбровый / Пудровый / Мускусный', ar: 'عنبري / بودري / مسكي' },
  'Sweet / Floral / Gourmand': { ru: 'Сладкий / Цветочный / Гурманский', ar: 'حلو / زهري / غورماند' },
  'Fresh / Aquatic / Citrus': { ru: 'Свежий / Водный / Цитрусовый', ar: 'منعش / مائي / حمضي' },
  'Fruity / Sweet / Vibrant': { ru: 'Фруктовый / Сладкий / Яркий', ar: 'فاكهي / حلو / مشرق' },
};

const retiredDemoSlugs = [
  'ru-noir-imperial', 'ru-velvet-rose', 'ru-santal-royale', 'ru-golden-hour',
  'ru-oud-majesty', 'ru-celeste-bloom', 'ru-midnight-vetiver', 'ru-azure-mist',
];

const standardBottleSizes = [12, 17, 20, 35, 55, 100] as const;
type StandardBottleSize = typeof standardBottleSizes[number];

const specialPriceSlugs = new Set([
  'sauvage-style',
  'asad-style',
  'khamrah-style',
  'yara-style',
  'pyramids',
  'tobacco-vanille-style',
  'erba-pura-style',
  'narcotic-delight-style',
  'molecule-01-mandarin-style',
]);

const specialPrices: Record<StandardBottleSize, number> = {
  12: 1550, 17: 2250, 20: 2550, 35: 3550, 55: 5350, 100: 9430,
};

const regularPrices: Record<StandardBottleSize, number> = {
  12: 1480, 17: 2150, 20: 2480, 35: 3430, 55: 5200, 100: 9170,
};

const legacySizeTargets = new Map([[10, 12], [30, 35], [50, 55]] as const);

async function mergeLegacyVariant(tx: Prisma.TransactionClient, productId: string, legacySize: number, targetSize: StandardBottleSize, slug: string) {
  const legacy = await tx.productVariant.findUnique({ where: { productId_sizeMl: { productId, sizeMl: legacySize } } });
  if (!legacy) return;
  const target = await tx.productVariant.findUnique({ where: { productId_sizeMl: { productId, sizeMl: targetSize } } });
  if (!target) {
    await tx.productVariant.update({
      where: { id: legacy.id },
      data: { sizeMl: targetSize, sku: `OS-${slug.toUpperCase()}-${targetSize}` },
    });
    return;
  }

  const carts = await tx.cartItem.findMany({ where: { variantId: legacy.id } });
  for (const cart of carts) {
    const existing = await tx.cartItem.findFirst({ where: { userId: cart.userId, variantId: target.id } });
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + cart.quantity } });
      await tx.cartItem.delete({ where: { id: cart.id } });
    } else {
      await tx.cartItem.update({ where: { id: cart.id }, data: { variantId: target.id } });
    }
  }
  await tx.orderItem.updateMany({ where: { variantId: legacy.id }, data: { variantId: target.id } });
  await tx.productVariant.update({
    where: { id: target.id },
    data: { stock: { increment: legacy.stock }, isActive: target.isActive || legacy.isActive },
  });
  await tx.productVariant.delete({ where: { id: legacy.id } });
}

async function syncRealProductVariants(productId: string, slug: string) {
  const prices = specialPriceSlugs.has(slug) ? specialPrices : regularPrices;
  await prisma.$transaction(async (tx) => {
    for (const [legacySize, targetSize] of legacySizeTargets) {
      await mergeLegacyVariant(tx, productId, legacySize, targetSize, slug);
    }

    for (const sizeMl of standardBottleSizes) {
      await tx.productVariant.upsert({
        where: { productId_sizeMl: { productId, sizeMl } },
        create: {
          productId,
          sizeMl,
          sku: `OS-${slug.toUpperCase()}-${sizeMl}`,
          supplierPrice: new Prisma.Decimal(0),
          sellingPrice: new Prisma.Decimal(prices[sizeMl]),
          currency: 'RUB',
          priceOverride: true,
          stock: 0,
          isActive: false,
        },
        update: {
          sellingPrice: new Prisma.Decimal(prices[sizeMl]),
          currency: 'RUB',
          priceOverride: true,
        },
      });
    }

    const activeVariants = await tx.productVariant.findMany({
      where: { productId, sizeMl: { in: [...standardBottleSizes] }, isActive: true, currency: 'RUB' },
      select: { stock: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        sellingPrice: new Prisma.Decimal(prices[12]),
        stock: activeVariants.reduce((total, variant) => total + variant.stock, 0),
      },
    });
  });
}

async function main() {
  await prisma.commissionSettings.upsert({
    where: { id: 'default' }, create: { id: 'default', type: 'PERCENTAGE', value: 30 }, update: {},
  });

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({ data: {
        email, name: process.env.ADMIN_NAME || 'Platform Owner', role: 'ADMIN',
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      } });
      console.log(`Created admin ${email}`);
    } else if (existing.role !== 'ADMIN') {
      throw new Error(`Cannot seed admin: ${email} already belongs to another role`);
    }
  } else {
    console.log('ADMIN_EMAIL and ADMIN_PASSWORD not set; admin seed skipped.');
  }

  const supplierEmail = (process.env.DEMO_SUPPLIER_EMAIL || 'demo.supplier@osiris.example').toLowerCase().trim();
  let supplierUser = await prisma.user.findUnique({ where: { email: supplierEmail } });
  if (!supplierUser) {
    supplierUser = await prisma.user.create({ data: {
      email: supplierEmail, name: 'OSIRIS Partner', role: 'SUPPLIER',
      passwordHash: await bcrypt.hash(process.env.DEMO_SUPPLIER_PASSWORD || randomUUID(), 12),
    } });
  }
  if (supplierUser.role !== 'SUPPLIER') throw new Error(`Demo supplier email belongs to a ${supplierUser.role} account`);
  const supplier = await prisma.supplierProfile.upsert({
    where: { userId: supplierUser.id },
    create: { userId: supplierUser.id, shopName: 'OSIRIS Partner', slug: 'osiris-partner', description: 'Curated luxury fragrances.', isApproved: true },
    update: { isApproved: true },
  });

  const retired = await prisma.product.updateMany({
    where: { slug: { in: retiredDemoSlugs } },
    data: { isPublished: false, isFeatured: false },
  });
  await prisma.productVariant.updateMany({
    where: { product: { slug: { in: retiredDemoSlugs } } },
    data: { isActive: false },
  });
  await prisma.cartItem.deleteMany({ where: { product: { slug: { in: retiredDemoSlugs } } } });
  await prisma.favorite.deleteMany({ where: { product: { slug: { in: retiredDemoSlugs } } } });
  console.log(`Disabled ${retired.count} old demo products without deleting order history.`);

  for (const draft of catalogDrafts) {
    const family = existingFamilies[draft.category];
    const data = { ...draft, familyEn: draft.familyEn || draft.category, familyRu: draft.familyRu || family?.ru || draft.category, familyAr: draft.familyAr || family?.ar || draft.category };
    const product = await prisma.product.upsert({
      where: { slug: draft.slug },
      create: {
        ...data,
        supplierId: supplier.id,
        supplierPrice: new Prisma.Decimal(0),
        sellingPrice: new Prisma.Decimal(0),
        stock: 0,
        isPublished: true,
        isFeatured: false,
      },
      update: { ...data, isPublished: true },
    });
    await syncRealProductVariants(product.id, draft.slug);
  }
  console.log(`Synced ${catalogDrafts.length} real products with six standard bottle sizes and RUB selling prices.`);
}

main().finally(async () => prisma.$disconnect());
