const defaultKnowledgePlan = {
  dailyCount: 2,
  difficulty: "all",
  studyTime: 15,
  careerStage: "",
  learningGoal: "",
  setupComplete: false,
  tracks: ["Fundamentals", "Insurance Fundamentals"]
};

const legacyDefaultKnowledgeTracks = ["Fundamentals", "Life Insurance", "Health Insurance", "Pricing", "Reserving", "IFRS 17", "Solvency II", "Capital Management", "ERM", "Reinsurance", "Investment & ALM", "AI & Insurance", "Data Analytics", "Regulation"];

const defaultLearningProgress = {
  completed: {},
  started: {},
  topicCompletions: {}
};

const storedKnowledgePlanRaw = localStorage.getItem("actuaryRadar.knowledgePlan");
const onboardingSkippedRaw = localStorage.getItem("actuaryRadar.onboardingSkipped");

const state = {
  data: null,
  items: [],
  companyReports: [],
  knowledge: [],
  knowledgeCatalog: [],
  knowledgeSources: { items: {}, daily_concepts: [] },
  learningTaxonomy: null,
  openSourceResources: [],
  knowledgeFocusId: "",
  activePage: "home",
  activeSection: "全部",
  dailyNavExpanded: false,
  language: localStorage.getItem("actuaryRadar.language") || "en",
  knowledgePlan: JSON.parse(storedKnowledgePlanRaw || JSON.stringify(defaultKnowledgePlan)),
  sourcePlan: JSON.parse(localStorage.getItem("actuaryRadar.sourcePlan") || "null"),
  learningProgress: JSON.parse(localStorage.getItem("actuaryRadar.learningProgress") || JSON.stringify(defaultLearningProgress)),
  onboardingSkipped: onboardingSkippedRaw === "true",
  filters: {
    lob: "all",
    topic: "all",
    industry: "all",
    period: "7",
    branch: "all",
    company: "全部公司",
    search: "",
    tag: ""
  },
  saved: new Set(JSON.parse(localStorage.getItem("actuaryDigest.saved") || "[]")),
  done: new Set(JSON.parse(localStorage.getItem("actuaryDigest.done") || "[]")),
  savedDigests: JSON.parse(localStorage.getItem("actuaryDigest.savedDigests") || "{}"),
  learningJournal: JSON.parse(localStorage.getItem("actuaryRadar.learningJournal") || "{}"),
  savedView: "briefings",
  archives: []
};

const taxonomy = window.ActuaryRadarTaxonomy || {};
let lastTrackedPageKey = "";
let searchAnalyticsTimer = null;

function analyticsEvent(name, params = {}) {
  window.ActuaryRadarAnalytics?.event(name, {
    language: state.language,
    active_page: state.activePage,
    active_section: normalizeSection(state.activeSection),
    ...params
  });
}

function analyticsPageView(reason = "route") {
  const pageKey = [
    state.activePage,
    normalizeSection(state.activeSection),
    state.language,
    window.location.pathname,
    window.location.search
  ].join("|");
  if (pageKey === lastTrackedPageKey) return;
  lastTrackedPageKey = pageKey;
  if (reason === "route_change") {
    window.ActuaryRadarAnalytics?.event("route_change", {
      app_page: state.activePage,
      briefing_topic: normalizeSection(state.activeSection),
      language: state.language
    });
  }
  window.ActuaryRadarAnalytics?.pageView({
    app_page: state.activePage,
    briefing_topic: normalizeSection(state.activeSection),
    language: state.language,
    navigation_reason: reason
  });
}

const sectionOrder = [
  "regulation",
  "market",
  "reinsurance",
  "technology_ai",
  "company_results_strategy",
  "research",
  "career_learning"
];

const briefingTopicSlugs = {
  regulation: "regulation",
  market: "market",
  reinsurance: "reinsurance",
  technology_ai: "technology-ai",
  company_results_strategy: "company-results",
  research: "research",
  career_learning: "career-learning"
};

const sectionByBriefingTopicSlug = Object.fromEntries(Object.entries(briefingTopicSlugs).map(([section, slug]) => [slug, section]));

const sectionLabels = {
  regulation: { symbol: "RG", icon: "shield", zh: "监管", en: "Regulation", fr: "Réglementation" },
  market: { symbol: "MK", icon: "building", zh: "市场", en: "Market", fr: "Marché de l'assurance" },
  reinsurance: { symbol: "RE", icon: "network", zh: "再保险", en: "Reinsurance", fr: "Réassurance" },
  technology_ai: { symbol: "AI", icon: "chip", zh: "科技与 AI", en: "Technology & AI", fr: "InsurTech & IA" },
  company_results_strategy: { symbol: "IR", icon: "chart", zh: "公司财报与战略", en: "Company Results & Strategy", fr: "Résultats & stratégie" },
  research: { symbol: "RS", icon: "folder", zh: "研究", en: "Research", fr: "Recherche" },
  career_learning: { symbol: "CL", icon: "book", zh: "职业与学习", en: "Career & Learning", fr: "Formation & carrière" },
  "法规与资本雷达": { symbol: "RG", icon: "shield", zh: "监管", en: "Regulation", fr: "Réglementation" },
  "科技前沿与落地": { symbol: "AI", icon: "chip", zh: "科技与 AI", en: "Technology & AI", fr: "InsurTech & IA" },
  "行业分支观察": { symbol: "MK", icon: "building", zh: "市场", en: "Market", fr: "Marché de l'assurance" },
  "公司财报与战略": { symbol: "IR", icon: "chart", zh: "公司财报与战略", en: "Companies Results & Strategies", fr: "Résultats & stratégie" },
  "研究方向与咨询报告": { symbol: "RS", icon: "folder", zh: "研究", en: "Research", fr: "Recherche" },
  "行业趋势与学习": { symbol: "CL", icon: "book", zh: "职业与学习", en: "Career & Learning", fr: "Formation & carrière" }
};

const fixedCompanyFilters = ["全部公司", "AXA", "Allianz", "Munich Re", "Swiss Re", "Hannover Re", "SCOR", "Generali", "Zurich", "Aviva", "Prudential", "AIG", "Chubb", "Ping An", "China Life", "PICC", "CPIC", "Berkshire Hathaway"];

const valueLabels = {
  "全部险种": { zh: "全部险种", en: "All lines", fr: "Toutes les branches" },
  "全部行业": { zh: "全部行业", en: "All industries", fr: "Tous les secteurs" },
  "全部风险": { zh: "全部风险", en: "All risk levels", fr: "Tous niveaux de risque" },
  "全部分支": { zh: "全部分支", en: "All branches", fr: "Tous les acteurs" },
  "全部公司": { zh: "全部公司", en: "All companies", fr: "Toutes les entreprises" },
  "英国": { zh: "英国", en: "UK", fr: "Royaume-Uni" },
  "德国": { zh: "德国", en: "Germany", fr: "Allemagne" },
  "法国": { zh: "法国", en: "France", fr: "France" },
  "其他国家": { zh: "其他国家", en: "Other countries", fr: "Autres pays" },
  "高": { zh: "高", en: "High", fr: "Élevé" },
  "中": { zh: "中", en: "Medium", fr: "Moyen" },
  "低": { zh: "低", en: "Low", fr: "Faible" },
  "欧洲": { zh: "欧洲", en: "Europe", fr: "Europe" },
  "美国": { zh: "美国", en: "US", fr: "États-Unis" },
  "中国": { zh: "中国", en: "China", fr: "Chine" },
  "全球": { zh: "全球", en: "Global", fr: "Monde" },
  "寿险": { zh: "寿险", en: "Life", fr: "Vie" },
  "健康险": { zh: "健康险", en: "Health", fr: "Santé" },
  "财险": { zh: "财险", en: "P&C", fr: "Assurance dommages" },
  "寿险与年金": { zh: "寿险与年金", en: "Life & annuity", fr: "Vie & épargne retraite" },
  "健康与保障": { zh: "健康与保障", en: "Health & protection", fr: "Santé & prévoyance" },
  "车险与出行": { zh: "车险与出行", en: "Motor & mobility", fr: "Auto & mobilité" },
  "财产与责任险": { zh: "财产与责任险", en: "Property & liability", fr: "Dommages & responsabilité" },
  "金融险与信贷保险": { zh: "金融险与信贷保险", en: "Financial lines & credit", fr: "Lignes financières & assurance-crédit" },
  "巨灾与气候风险": { zh: "巨灾与气候风险", en: "Cat & climate risk", fr: "Catastrophes & climat" },
  "保险科技与数据": { zh: "保险科技与数据", en: "InsurTech & data", fr: "InsurTech & données" },
  "综合/集团战略": { zh: "综合/集团战略", en: "Composite / group strategy", fr: "Groupe multi-branches / stratégie" },
  "综合保险": { zh: "综合保险", en: "Composite insurance", fr: "Assureur multi-branches" },
  "再保险": { zh: "再保险", en: "Reinsurance", fr: "Réassurance" },
  "特殊险": { zh: "特殊险", en: "Specialty", fr: "Risques spéciaux" },
  "金融险": { zh: "金融险", en: "Financial Lines", fr: "Risques financiers" },
  "信贷保险": { zh: "信贷保险", en: "Credit Insurance", fr: "Assurance-crédit" },
  "Cyber Risk": { zh: "网络风险", en: "Cyber Risk", fr: "Risque cyber" },
  "保险本业/其他": { zh: "保险本业/其他", en: "Insurance / Other", fr: "Assurance / autres secteurs" },
  "保险本业": { zh: "保险", en: "Insurance", fr: "Assurance" },
  "其他": { zh: "其他", en: "Other", fr: "Autre" },
  "其他行业": { zh: "其他行业", en: "Other industries", fr: "Autres secteurs" },
  "生态伙伴": { zh: "生态伙伴", en: "Ecosystem partners", fr: "Partenaires écosystème" },
  "生态伙伴/其他行业": { zh: "生态伙伴/其他行业", en: "Ecosystem partners / Other industries", fr: "Partenaires écosystème / autres secteurs" },
  "保险公司": { zh: "保险公司", en: "Insurers", fr: "Assureurs" },
  "再保险公司": { zh: "再保险公司", en: "Reinsurers", fr: "Réassureurs" },
  "MGA/代理": { zh: "MGA/代理", en: "MGA / Agents", fr: "MGA / agents" },
  "咨询/评级/资本市场": { zh: "咨询与评级机构", en: "Consulting / Rating Agencies", fr: "Conseil & notation" },
  "行业协会/监管": { zh: "行业协会/监管", en: "Associations / Regulators", fr: "Fédérations & superviseurs" },
  "其他分支": { zh: "其他分支", en: "Other branches", fr: "Autres acteurs" },
  "银行": { zh: "银行", en: "Banking", fr: "Banque" },
  "信贷": { zh: "信贷", en: "Credit", fr: "Crédit" },
  "出行": { zh: "出行", en: "Mobility", fr: "Mobilité" },
  "投行": { zh: "投行", en: "Investment banking", fr: "Banque de financement et d'investissement" },
  "车企": { zh: "车企", en: "Automotive", fr: "Automobile" },
  "能源": { zh: "能源", en: "Energy", fr: "Énergie" },
  "科技": { zh: "科技", en: "Technology", fr: "Technologies" },
  "资本市场": { zh: "资本市场", en: "Capital markets", fr: "Marchés de capitaux" },
  "投行/资本市场": { zh: "金融服务", en: "Financial Services", fr: "Services financiers" },
  "车企/出行": { zh: "车企/出行", en: "Automotive / mobility", fr: "Auto / mobilité" },
  "科技/AI/云": { zh: "科技/AI/云", en: "Tech / AI / cloud", fr: "Technologies / IA / cloud" },
  "医疗健康": { zh: "医疗健康", en: "Healthcare", fr: "Santé" },
  "房地产/基建": { zh: "房地产/基建", en: "Real estate / infrastructure", fr: "Immobilier / infrastructure" },
  "农业/食品": { zh: "农业/食品", en: "Agriculture / food", fr: "Agriculture / alimentation" },
  "航空航运": { zh: "航空航运", en: "Aviation / shipping", fr: "Aviation / maritime" },
  "零售/电商": { zh: "零售/电商", en: "Retail / e-commerce", fr: "Distribution / e-commerce" },
  "政府/公共部门": { zh: "政府/公共部门", en: "Government / public sector", fr: "Secteur public" },
  "咨询/评级": { zh: "咨询/评级", en: "Consulting / ratings", fr: "Conseil / notation" },
  "监管": { zh: "监管", en: "Regulation", fr: "Réglementation" },
  "保险科技": { zh: "保险科技", en: "InsurTech", fr: "InsurTech" },
  "再保": { zh: "再保", en: "Reinsurance", fr: "Réassurance" },
  "保险经纪": { zh: "保险经纪", en: "Brokerage", fr: "Courtage" },
  "经纪": { zh: "经纪", en: "Brokerage", fr: "Courtage" },
  "咨询研究": { zh: "咨询研究", en: "Consulting research", fr: "Conseil et recherche" },
  "巨灾": { zh: "巨灾", en: "Catastrophe", fr: "Catastrophe" },
  "气候": { zh: "气候", en: "Climate", fr: "Climat" },
  "财报": { zh: "财报", en: "Earnings", fr: "Résultats" },
  "战略": { zh: "战略", en: "Strategy", fr: "Stratégie" },
  "年金": { zh: "年金", en: "Annuity", fr: "Rente" },
  "车险": { zh: "车险", en: "Motor", fr: "Auto" }
};

const secondaryTaxonomyLabels = {
  life_insurance: { en: "Life Insurance", zh: "寿险", fr: "Assurance vie" },
  non_life_insurance: { en: "Non-Life Insurance", zh: "财险", fr: "Assurance non-vie" },
  health_insurance: { en: "Health Insurance", zh: "健康险", fr: "Santé & prévoyance" },
  reinsurance: { en: "Reinsurance", zh: "再保险", fr: "Réassurance" },
  pricing: { en: "Pricing", zh: "定价", fr: "Tarification" },
  reserving: { en: "Reserving", zh: "准备金", fr: "Provisionnement" },
  risk_management: { en: "Risk Management", zh: "风险管理", fr: "Gestion des risques" },
  solvency_ii: { en: "Solvency II", zh: "Solvency II", fr: "Solvabilité II" },
  ifrs17: { en: "IFRS 17", zh: "IFRS 17", fr: "IFRS 17" },
  regulation: { en: "Regulation", zh: "监管", fr: "Réglementation" },
  climate_risk: { en: "Climate Risk", zh: "气候风险", fr: "Risque climatique" },
  catastrophe_risk: { en: "Catastrophe Risk", zh: "巨灾风险", fr: "Risque catastrophe" },
  insurtech: { en: "InsurTech", zh: "保险科技", fr: "InsurTech" },
  claims: { en: "Claims", zh: "理赔", fr: "Gestion des sinistres" },
  distribution: { en: "Distribution", zh: "分销", fr: "Distribution" },
  pensions: { en: "Pensions", zh: "养老金", fr: "Retraite" },
  investment: { en: "Investment", zh: "投资", fr: "Investissements" },
  data_ai: { en: "Data & AI", zh: "数据与 AI", fr: "Données & IA" },
  cyber_risk: { en: "Cyber Risk", zh: "网络风险", fr: "Risque cyber" }
};

const legacySectionMap = {
  "法规与资本雷达": "regulation",
  "行业分支观察": "market",
  "跨行业联动": "market",
  "科技前沿与落地": "technology_ai",
  "公司财报与战略": "company_results_strategy",
  "研究方向与咨询报告": "research",
  "行业趋势与学习": "career_learning"
};

const sourceLibrary = [
  {
    id: "soa",
    title: "Society of Actuaries Resources",
    url: "https://www.soa.org/resources/",
    tracks: ["Fundamentals", "Insurance Fundamentals", "IFRS 17", "ALM", "Insurance Finance", "Data Analytics"],
    zh: "SOA 研究报告适合补寿险、健康险、养老金、财务报告、预测建模和经验分析。",
    en: "SOA research reports are useful for life, health, pensions, financial reporting, predictive analytics and experience studies.",
    fr: "Les ressources de la SOA sont utiles pour l’assurance vie, la santé, la retraite, l’information financière, la modélisation prédictive et les études d’expérience."
  },
  {
    id: "cas",
    title: "Casualty Actuarial Society Research",
    url: "https://www.casact.org/publications-research",
    tracks: ["Pricing", "Reserving", "Catastrophe Modelling", "Credit Risk", "Operational Risk"],
    zh: "CAS 是财险定价、准备金、ERM、巨灾和模型风险的重要公开学习源。",
    en: "CAS is a core public source for P&C ratemaking, reserving, ERM, catastrophe risk and model risk.",
    fr: "La CAS est une référence pour la tarification dommages, le provisionnement, l’ERM, le risque catastrophe et le risque de modèle."
  },
  {
    id: "ifoa",
    title: "Institute and Faculty of Actuaries Research",
    url: "https://actuaries.org.uk/learn-and-develop/research-and-knowledge/",
    tracks: ["ERM", "Regulation", "AI for Insurance", "Climate", "Business Skills"],
    zh: "IFoA 的 Research and Knowledge 适合跟踪气候、AI、职业能力、风险管理和公共政策议题。",
    en: "IFoA Research and Knowledge is useful for climate, AI, professionalism, risk management and public policy topics.",
    fr: "Les publications de l’IFoA couvrent le climat, l’IA, le professionnalisme, la gestion des risques et les politiques publiques."
  },
  {
    id: "eiopa",
    title: "EIOPA Publications and Solvency II",
    url: "https://www.eiopa.europa.eu/publications_en",
    tracks: ["Solvency II", "Regulation", "ERM", "Capital Management", "Market Risk"],
    zh: "EIOPA 适合学习欧洲保险监管、Solvency II、压力测试、风险仪表盘和消费者保护。",
    en: "EIOPA is the primary source for European insurance supervision, Solvency II, stress tests, risk dashboards and consumer protection.",
    fr: "L’EIOPA est la source de référence pour la supervision européenne, Solvabilité II, les stress tests, les tableaux de risques et la protection des assurés."
  },
  {
    id: "institut",
    title: "Institut des Actuaires",
    url: "https://www.institutdesactuaires.com/",
    tracks: ["Regulation", "Solvency II", "ERM", "AI for Insurance", "Business Skills", "Insurance Finance"],
    zh: "法国精算师协会适合跟踪法国精算职业、研讨会、工作组、AI、气候和监管主题。",
    en: "Institut des Actuaires is useful for French actuarial practice, seminars, working groups, AI, climate and regulatory topics.",
    fr: "L’Institut des Actuaires permet de suivre la pratique actuarielle française, les séminaires, groupes de travail, sujets IA, climat et réglementation."
  },
  {
    id: "ifrs",
    title: "IFRS 17 Insurance Contracts",
    url: "https://www.ifrs.org/issued-standards/list-of-standards/ifrs-17-insurance-contracts/",
    tracks: ["IFRS 17", "Insurance Accounting", "Insurance Finance"],
    zh: "IFRS Foundation 是 IFRS 17 定义、准则文本、实施材料和教育材料的第一来源。",
    en: "The IFRS Foundation is the primary source for IFRS 17 definitions, standards text, implementation and educational material.",
    fr: "L’IFRS Foundation est la source de référence pour IFRS 17 : norme, supports de mise en œuvre et documents pédagogiques."
  },
  {
    id: "swissre",
    title: "Swiss Re Institute",
    url: "https://www.swissre.com/institute/",
    tracks: ["Reinsurance", "Catastrophe Modelling", "Market Risk", "Insurance Strategy", "Life", "Health"],
    zh: "Swiss Re Institute 适合读 Sigma、全球保险市场、再保险、自然灾害、生命健康和宏观风险。",
    en: "Swiss Re Institute is useful for sigma reports, global insurance markets, reinsurance, natural catastrophes, life-health and macro risk.",
    fr: "Swiss Re Institute publie des analyses de référence sur les marchés d’assurance, la réassurance, les catastrophes naturelles, la vie-santé et les risques macroéconomiques."
  },
  {
    id: "munichre",
    title: "Munich Re Insights",
    url: "https://www.munichre.com/en/insights.html",
    tracks: ["Reinsurance", "Catastrophe Modelling", "Cyber", "AI for Insurance", "Climate"],
    zh: "Munich Re Insights 适合学习巨灾、气候、网络风险、再保险和保险科技案例。",
    en: "Munich Re Insights is useful for catastrophe, climate, cyber, reinsurance and insurance technology cases.",
    fr: "Munich Re Insights couvre les catastrophes naturelles, le climat, le cyber, la réassurance et les cas d’usage technologiques en assurance."
  },
  {
    id: "mitocw",
    title: "MIT OpenCourseWare Statistics",
    url: "https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/",
    tracks: ["Pricing", "Reserving", "Data Analytics", "Catastrophe Modelling", "Credit Risk", "AI for Insurance"],
    zh: "MIT OCW 统计课程适合补 GLM、假设检验、置信区间、回归和模型验证等精算建模基础。",
    en: "MIT OCW statistics is useful for GLM foundations, inference, regression, uncertainty and model validation.",
    fr: "MIT OCW Statistics est utile pour consolider les bases statistiques : GLM, inférence, régression, incertitude et validation de modèles."
  }
];

const specificResources = [
  {
    sourceId: "ifrs",
    tracks: ["IFRS 17", "Insurance Accounting", "Insurance Finance"],
    title: "IFRS Foundation: IFRS 17 Insurance Contracts",
    url: "https://www.ifrs.org/issued-standards/list-of-standards/ifrs-17-insurance-contracts/",
    type: "Standard page"
  },
  {
    sourceId: "eiopa",
    tracks: ["Solvency II", "Regulation", "ERM", "Capital Management", "Market Risk"],
    title: "EIOPA: Solvency II regulatory framework",
    url: "https://www.eiopa.europa.eu/browse/regulation-and-policy/solvency-ii_en",
    type: "Regulatory topic"
  },
  {
    sourceId: "cas",
    tracks: ["Pricing", "Reserving", "Insurance Fundamentals"],
    title: "CAS: Basic Ratemaking",
    url: "https://www.casact.org/sites/default/files/database/studynotes_werner_modlin_ratemaking.pdf",
    type: "Actuarial study note"
  },
  {
    sourceId: "mitocw",
    tracks: ["Data Analytics", "Catastrophe Modelling", "Credit Risk", "AI for Insurance"],
    title: "MIT OCW: Statistics for Applications",
    url: "https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/",
    type: "Open course"
  },
  {
    sourceId: "swissre",
    tracks: ["Reinsurance", "Catastrophe Modelling", "Insurance Finance", "Market Risk", "Life", "Health"],
    title: "Swiss Re Institute: sigma research",
    url: "https://www.swissre.com/institute/research/sigma-research.html",
    type: "Research series"
  },
  {
    sourceId: "munichre",
    tracks: ["Reinsurance", "Catastrophe Modelling", "Climate", "Cyber", "AI for Insurance"],
    title: "Munich Re: Natural disasters and climate change",
    url: "https://www.munichre.com/en/insights/natural-disaster-and-climate-change.html",
    type: "Research article hub"
  },
  {
    sourceId: "cas",
    tracks: ["Pricing", "Reserving", "Operational Risk"],
    title: "CAS: Publications and research",
    url: "https://www.casact.org/publications-research",
    type: "Research library"
  },
  {
    sourceId: "ifoa",
    tracks: ["ERM", "Climate", "AI for Insurance", "Business Skills"],
    title: "IFoA: Research and knowledge",
    url: "https://actuaries.org.uk/learn-and-develop/research-and-knowledge/",
    type: "Research library"
  },
  {
    sourceId: "institut",
    tracks: ["Regulation", "Solvency II", "ERM", "AI for Insurance", "Business Skills"],
    title: "Institut des Actuaires: resources and events",
    url: "https://www.institutdesactuaires.com/",
    type: "Professional body"
  },
  {
    sourceId: "soa",
    tracks: ["Fundamentals", "Insurance Fundamentals", "ALM", "Insurance Finance", "Data Analytics"],
    title: "SOA: actuarial resources",
    url: "https://www.soa.org/resources/",
    type: "Research library"
  }
];

const pageCopy = {
  zh: {
    brandTagline: "保险情报与精算学习平台",
    documentTitle: "ActuaryRadar | All-in-One Insurance Intelligence & Actuarial Learning Platform",
    navHome: "首页",
    navDaily: "每日情报",
    navKnowledge: "精算知识库",
    navSaved: "保存与学习日志",
    dailyConcept: "每日概念",
    heroTitle: "每天明确该学什么。",
    heroSubtitle: "一个连接精算知识、行业情报与可信资料的个性化每日学习工作台。",
    heroSubsubtitle: "行业新闻、技术洞察、研究资料与学习资源，集中在一个更适合持续阅读和专业判断的工作台。",
    startLearning: "开始今日学习",
    browseBriefing: "浏览情报",
    latestAvailableBriefing: "最新可用情报",
    actuarialKnowledge: "精算知识库",
    continueLearningArrow: "继续学习 →",
    learningTimeToday: "今日预计学习时间：15 分钟",
    briefingArticleCount: "24 条精选文章",
    briefingFeaturedCount: "5 条重点洞察",
    browseArrow: "浏览 →",
    readOriginalArrow: "阅读原文 →",
    heroKnowledge: "精算知识库",
    heroDaily: "每日情报汇总",
    portalToday: "今日精选",
    homeLearningEyebrow: "学习花园",
    homeLearningTitle: "今天我该学什么？",
    buildJourneyArrow: "建立我的学习旅程",
    editLearningPreferences: "编辑学习偏好",
    next15Minutes: "接下来 15 分钟",
    todaysLearning: "今日学习花园",
    continueLearning: "继续学习",
    recommendedNext: "推荐下一步",
    homeLearningSummaryReady: "今日学习计划已准备好",
    homeLearningSummarySetup: "先设置兴趣和学习时间，ActuaryRadar 会为你安排今日任务。",
    progressToday: "今日进度",
    recommendationSelectedTopic: "因为你选择了 {topic}。",
    recommendationGoalRegulatory: "适合你的目标：理解监管与资本。",
    recommendationGoalPricing: "适合你的目标：提升定价与准备金能力。",
    recommendationGoalIndustry: "适合你的目标：理解保险行业。",
    recommendationGoalExam: "适合你的目标：准备精算考试。",
    recommendationGoalJob: "适合你的目标：提升求职与实务能力。",
    recommendationIndustryInsight: "把今天的学习主题连接到当前行业动态。",
    browseAllEyebrow: "浏览",
    browseAllTitle: "浏览全部内容",
    learningLibraryHint: "概念、知识卡和可信资料源",
    openLearningLibrary: "打开学习库 →",
    relatedBriefing: "相关情报",
    labelSeparator: "：",
    estimatedTime: "预计时间：15 分钟",
    portalKnowledgeText: "通过每日概念、知识卡片、可信资料源和个性化学习路径建立精算判断力。",
    portalDailyText: "浏览最近保险、再保险、监管、科技和资本市场重要情报。",
    portalSavedText: "回看收藏内容、稍后读内容和历史日报。",
    portalConceptText: "每天复习一个精算概念，并用真实业务问题理解它如何影响假设、利润和资本。",
    weeklyPlanEyebrow: "学习计划",
    portalLatestEyebrow: "最新保险资讯",
    portalLatestTitle: "最新保险情报",
    viewAllBriefings: "查看全部情报",
    viewAllIntelligence: "查看全部情报",
    portalSectionsEyebrow: "专业栏目",
    portalSectionsTitle: "按主题探索",
    topicRegulationText: "跟踪监管、资本要求、消费者保护和合规变化。",
    topicMarketText: "观察保险市场、产品、渠道和竞争格局。",
    topicReinsuranceText: "跟踪再保险续转、巨灾、资本和市场周期。",
    topicTechnologyText: "关注 AI、数据、自动化理赔和保险科技落地。",
    topicCompanyText: "阅读保险公司业绩、战略、资本和投资者信息。",
    topicResearchText: "发现协会、再保机构、咨询公司和准则机构研究。",
    topicCareerText: "连接学习资料、职业能力和精算成长路径。",
    weeklyPlan: "我的学习旅程",
    myLearningPlan: "我的学习旅程",
    myLearningPlanHint: "根据你的主题、难度和学习时间生成今日学习任务。",
    myLearningJourney: "我的学习旅程",
    myLearningJourneyHint: "告诉 ActuaryRadar 你今天有多少时间，系统会推荐最值得学习的内容。",
    buildLearningJourney: "建立我的学习旅程",
    buildLearningJourneyHint: "告诉我们你想学什么，ActuaryRadar 会推荐你今天该学的内容。",
    editPreferences: "编辑偏好",
    savePreferences: "保存偏好",
    resetPreferences: "重置",
    onboardingEyebrow: "个性化学习设置",
    onboardingTitle: "建立你的学习旅程",
    onboardingIntro: "选择阶段、目标、主题和每日学习时间。",
    interestedTopics: "关注主题",
    createMyPlan: "生成我的计划",
    skipForNow: "暂时跳过",
    careerStageLabel: "职业阶段",
    careerStudent: "学生",
    careerEarlyInsurance: "保险行业新人",
    careerJunior: "初级精算师 / 分析师",
    careerMid: "中级专业人士",
    careerSenior: "资深专业人士",
    careerManager: "管理者 / 高管",
    learningGoalLabel: "学习目标",
    goalExamReady: "准备精算考试",
    goalJobReady: "提升入门工作能力",
    goalPricingReserving: "学习定价与准备金",
    goalRegulatoryLiteracy: "理解监管与资本",
    goalIndustryContext: "建立保险行业认知",
    goalExams: "通过精算考试",
    goalJobSkills: "提升当前工作技能",
    goalStrategyIr: "转向战略 / IR",
    goalStayUpdated: "保持行业更新",
    goalGeneralKnowledge: "建立保险通识",
    completedToday: "今日开花",
    learningStreak: "连续成长",
    growthStage: "成长阶段",
    growthSeed: "Seed",
    growthSprout: "Sprout",
    growthBud: "Bud",
    growthBloom: "Bloom",
    topicsCompleted: "已推进主题",
    dailyTarget: "今日目标",
    todaysLearningPlan: "今日学习",
    progressByTopic: "按主题进度",
    difficultyLabel: "难度",
    allLevels: "全部难度",
    beginner: "入门",
    intermediate: "中级",
    advanced: "进阶",
    studyTimeLabel: "预计学习时间",
    minutesShort: "分钟",
    estimated: "预计",
    learningItemDailyConcept: "概念种子",
    learningItemKnowledgeCard: "知识植株",
    learningItemNews: "行业气候",
    learningItemResearch: "研究报告",
    learningItemOfficialSource: "官方学习源",
    learningItemGithubExample: "开源实践",
    openSourceResourcesTitle: "开源实践资源",
    openSourceResourcesHint: "精选 GitHub 项目，只提供原创摘要和外部链接，不复制项目文档。",
    repositoryLanguage: "语言",
    repositoryLicense: "许可证",
    repositoryDifficulty: "难度",
    repositoryUseCase: "用途",
    repositoryFor: "适合",
    viewRepository: "查看仓库",
    startLearningItem: "开始",
    startedLabel: "已开始",
    inProgress: "进行中",
    notStarted: "尚未开始",
    markComplete: "标记完成",
    completedLabel: "已完成",
    noCompletedToday: "今天还没有完成记录。完成一项学习后会在这里收起保存。",
    activeTopicLabel: "主题",
    noLearningPlanItems: "当前设置下暂无学习任务。请增加主题或切换难度。",
    noStartedLearningItems: "还没有正在进行的学习项。先从今日学习开始。",
    moreContentSoon: "这个主题的更多可信资料正在整理中。",
    setupLearningFirst: "先保存你的学习偏好，ActuaryRadar 会生成今日学习旅程。",
    customizePlan: "定制学习计划",
    language: "语言",
    date: "日期",
    history: "历史",
    todayTasks: "今日任务",
    topPicks: "每日均衡精选",
    knowledgeIntro: "从精算知识地图中定制学习主题和每日学习数量",
    sourceLibraryTitle: "公开权威资料库",
    sourceLibraryHint: "知识卡片将优先引用公开协会、监管机构、准则制定机构、再保险研究和英文名校公开课件。",
    referenceSources: "参考资料",
    sourcePack: "资料源包",
    sourceBasedPrompt: "基于公开资料的学习任务",
    selectAllSources: "全选资料源",
    clearSources: "清空资料源",
    sourceWebsite: "资料",
    sourceVideo: "视频",
    weeklyFocus: "每周学习计划",
    autoWeekly: "按星期自动安排",
    editWeeklyPlan: "编辑计划",
    resetWeeklyPlan: "恢复默认",
    saveWeeklyPlan: "保存计划",
    conceptExample: "通俗例子",
    plannerTitle: "我的精算学习计划",
    plannerHint: "选择学习主题、难度、每日数量和预计学习时间。设置会保存在当前浏览器。",
    dailyCount: "每天学习数量",
    dailyTitle: "每日情报",
    knowledgeTitle: "精算知识库",
    savedTitle: "保存与学习日志",
    allTopics: "全部主题",
    navAllBriefings: "全部情报",
    pageDailySubtitle: "按监管、险种、公司、科技、再保险和跨行业联动阅读今日情报",
    pageKnowledgeSubtitle: "选择主题、每日数量、概念复习和案例练习",
    pageSavedSubtitle: "回看你保存过的日报内容",
    searchPlaceholder: "搜索公司、主题、险种、关键词",
    loadReport: "加载日期日报",
    openHtml: "打开 HTML 日报",
    saveToday: "保存今日内容",
    exportPdf: "导出 PDF",
    allTime: "全部时间",
    last7: "最近7天",
    last30: "最近30天",
    last180: "最近半年",
    last365: "最近一年",
    cardsTitle: "情报卡片",
    sectionCoverage: "覆盖板块",
    actionBoard: "Action 看板",
    marked: "已标记",
    completed: "已完成",
    shareTextTitle: "分享文本",
    copyShare: "复制分享摘要",
    copied: "已复制",
    aiAssistant: "AI 学习助手",
    promptTop3: "总结3条新闻",
    promptTop5: "总结3条新闻",
    chineseOnlyConcept: "该概念目前仅提供中文版本。",
    chineseOnlyTasks: "今日任务目前仅提供中文版本。",
    sourceViaGoogleNews: "通过 Google News 来源",
    languageSourceNotice: "",
    aiSummaryUnavailable: "AI 摘要正在准备中。请稍后查看今日精选内容。",
    aiPlaceholder: "围绕今天内容提问，例如：健康险有哪些action？",
    ask: "提问",
    savedIntro: "保存每日情报与学习日志，方便回看和导出。",
    saveCurrent: "保存当前日报",
    currentReportSaved: "已保存",
    noCurrentReport: "当前没有可保存的日报",
    saveTodayLearning: "保存今日学习",
    savedBriefingsTab: "已保存日报",
    learningJournalTab: "学习日志",
    noLearningJournal: "还没有学习日志。保存今日学习后，你可以在这里回看每天培养过的概念与情报。",
    exportMarkdown: "导出 Markdown",
    exportHtml: "导出 HTML",
    learningJournalTitle: "ActuaryRadar 学习日志",
    learningJournalSaved: "今日学习已保存",
    studyTopics: "学习主题",
    learningPreferences: "学习偏好",
    actuarialAngle: "精算视角",
    suggestedActions: "建议行动",
    source: "原文",
    sourceUrl: "来源链接",
    originalTitle: "原文标题",
    originalLanguage: "原文语言",
    standardizedCategory: "标准分类",
    keyTakeaway: "关键结论",
    aiSummary: "AI 摘要",
    whyItMatters: "为什么重要",
    readOriginal: "阅读原文",
    articleDetails: "详细信息",
    generatedTime: "生成时间",
    exportTitle: "ActuaryRadar 每日情报",
    exportDate: "日期",
    exportSource: "来源",
    exportKeyTakeaway: "关键结论",
    exportWhyItMatters: "为什么重要",
    exportReadOriginal: "阅读原文",
    exportGeneratedBy: "由 ActuaryRadar 生成",
    moreTags: "更多",
    aiTransparency: "本摘要由 AI 基于原文生成，仅用于快速了解信息。完整内容请以原文为准。",
    rssExcerptOnly: "本摘要仅基于 RSS 摘要片段生成。",
    reportIssue: "反馈问题",
    issueWrongTranslation: "翻译不准确",
    issueWrongCategory: "分类不准确",
    issueOutdatedLink: "链接失效",
    issueDuplicate: "重复新闻",
    issueOther: "其他",
    issueComment: "补充说明",
    issueSaved: "反馈已保存在本浏览器",
    save: "标记",
    saved: "已标记",
    markDone: "标记完成",
    done: "完成",
    doneAlready: "已完成",
    learningPoint: "学习点",
    regulatoryAlert: "监管提醒",
    noRegAlerts: "当前筛选范围内暂无明确监管更新提醒。",
    noItems: "当前筛选下暂无内容",
    selectArchive: "选择历史",
    noArchive: "暂无历史",
    loadError: "无法加载日报数据",
    knowledgeLoadError: "知识库数据暂时无法加载。",
    noKnowledge: "当前学习设置下暂无知识卡片。可以调整主题，让学习路径重新生长。",
    coreConcepts: "核心概念",
    casePractice: "Case 练习",
    showAnswer: "查看参考答案",
    hideAnswer: "收起参考答案",
    noSavedReports: "还没有保存内容。保存今日学习或情报后，会在这里形成你的学习记录。",
    untitledTheme: "未标注主题",
    savedAt: "保存于",
    contentItems: "条内容",
    open: "打开"
  },
  en: {
    brandTagline: "Insurance intelligence and actuarial learning platform",
    documentTitle: "ActuaryRadar | All-in-One Insurance Intelligence & Actuarial Learning Platform",
    navHome: "Home",
    navDaily: "Insurance Briefing",
    navKnowledge: "Actuarial Knowledge",
    navSaved: "Saved & Journal",
    dailyConcept: "Daily Concept",
    heroTitle: "Know what to learn today.",
    heroSubtitle: "A personalized daily learning workspace combining actuarial knowledge, industry intelligence and trusted resources.",
    heroSubsubtitle: "Industry news, technical insight, research and learning resources in one focused workspace for continuous professional judgment.",
    startLearning: "Start Today’s Learning",
    browseBriefing: "Browse Intelligence",
    latestAvailableBriefing: "Latest available briefing",
    actuarialKnowledge: "Actuarial Knowledge",
    continueLearningArrow: "Continue Learning →",
    learningTimeToday: "Estimated learning time today: 15 min",
    briefingArticleCount: "24 curated articles",
    briefingFeaturedCount: "5 featured insights",
    browseArrow: "Browse →",
    readOriginalArrow: "Read Original →",
    heroKnowledge: "Actuarial Library",
    heroDaily: "Insurance Briefing",
    portalToday: "Today’s Highlight",
    homeLearningEyebrow: "Learning Garden",
    homeLearningTitle: "What should I learn today?",
    buildJourneyArrow: "Build My Learning Journey",
    editLearningPreferences: "Edit learning preferences",
    next15Minutes: "Next 15 minutes",
    todaysLearning: "Today’s Garden",
    continueLearning: "Continue Learning",
    recommendedNext: "Recommended Next",
    homeLearningSummaryReady: "Today’s learning plan is ready",
    homeLearningSummarySetup: "Set your interests and available time so ActuaryRadar can guide today’s learning.",
    progressToday: "progress today",
    recommendationSelectedTopic: "Because you selected {topic}.",
    recommendationGoalRegulatory: "Recommended for your goal: understand regulation and capital.",
    recommendationGoalPricing: "Recommended for your goal: build pricing and reserving skills.",
    recommendationGoalIndustry: "Recommended for your goal: understand the insurance industry.",
    recommendationGoalExam: "Recommended for your goal: prepare for actuarial exams.",
    recommendationGoalJob: "Recommended for your goal: become job-ready.",
    recommendationIndustryInsight: "Connects today’s learning topic with a current industry development.",
    browseAllEyebrow: "Browse",
    browseAllTitle: "Browse All Intelligence",
    learningLibraryHint: "Concepts, cards and curated references",
    openLearningLibrary: "Open learning library →",
    relatedBriefing: "Related Briefing",
    labelSeparator: ": ",
    estimatedTime: "Estimated time: 15 min",
    portalKnowledgeText: "Build actuarial judgment through daily concepts, knowledge cards, trusted sources and personalized learning paths.",
    portalDailyText: "Track recent developments across insurance, reinsurance, supervision, technology and capital markets.",
    portalSavedText: "Return to bookmarked items, read-later content and historical reports.",
    portalConceptText: "Review one actuarial concept a day and connect it to assumptions, financial results and capital decisions.",
    weeklyPlanEyebrow: "Learning plan",
    portalLatestEyebrow: "Latest insurance news",
    portalLatestTitle: "Latest Intelligence",
    viewAllBriefings: "View all briefings",
    viewAllIntelligence: "View all intelligence",
    portalSectionsEyebrow: "Coverage areas",
    portalSectionsTitle: "Explore by Topic",
    topicRegulationText: "Track supervision, capital requirements, consumer protection and compliance changes.",
    topicMarketText: "Monitor insurance markets, products, distribution and competitive dynamics.",
    topicReinsuranceText: "Follow renewals, catastrophe risk, capital relief and reinsurance cycles.",
    topicTechnologyText: "Explore AI, data, claims automation and practical InsurTech adoption.",
    topicCompanyText: "Read insurer results, strategy updates, capital and investor materials.",
    topicResearchText: "Find research from actuarial bodies, reinsurers, consultants and standard setters.",
    topicCareerText: "Connect learning resources, professional skills and actuarial career development.",
    weeklyPlan: "My Learning Journey",
    myLearningPlan: "My Learning Journey",
    myLearningPlanHint: "A personalized daily learning queue based on your topics, level and study time.",
    myLearningJourney: "My Learning Journey",
    myLearningJourneyHint: "Tell ActuaryRadar how much time you have today, and it will suggest what to learn next.",
    buildLearningJourney: "Build My Learning Journey",
    buildLearningJourneyHint: "Tell us what you want to learn, and ActuaryRadar will suggest what to study today.",
    editPreferences: "Edit preferences",
    savePreferences: "Save preferences",
    resetPreferences: "Reset",
    onboardingEyebrow: "Personalized learning setup",
    onboardingTitle: "Build your learning journey",
    onboardingIntro: "Choose your stage, goal, topics and daily study time.",
    interestedTopics: "Interested Topics",
    createMyPlan: "Create My Plan",
    skipForNow: "Skip for now",
    careerStageLabel: "Career stage",
    careerStudent: "Student",
    careerEarlyInsurance: "Early-Career Insurance Professional",
    careerJunior: "Junior Actuary / Analyst",
    careerMid: "Mid-level Professional",
    careerSenior: "Senior Professional",
    careerManager: "Manager / Executive",
    learningGoalLabel: "Learning goal",
    goalExamReady: "Prepare for actuarial exams",
    goalJobReady: "Become job-ready",
    goalPricingReserving: "Build pricing and reserving skills",
    goalRegulatoryLiteracy: "Understand regulation and capital",
    goalIndustryContext: "Understand the insurance industry",
    goalExams: "Pass actuarial exams",
    goalJobSkills: "Improve current job skills",
    goalStrategyIr: "Move into Strategy / IR",
    goalStayUpdated: "Stay up to date",
    goalGeneralKnowledge: "Build general insurance knowledge",
    completedToday: "Blooms today",
    learningStreak: "Growth streak",
    growthStage: "Growth stage",
    growthSeed: "Seed",
    growthSprout: "Sprout",
    growthBud: "Bud",
    growthBloom: "Bloom",
    topicsCompleted: "Topics advanced",
    dailyTarget: "Daily target",
    todaysLearningPlan: "Today's Learning",
    progressByTopic: "Progress by Topic",
    difficultyLabel: "Difficulty",
    allLevels: "All levels",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    studyTimeLabel: "Estimated study time",
    minutesShort: "min",
    estimated: "Estimated",
    learningItemDailyConcept: "Concept Seed",
    learningItemKnowledgeCard: "Knowledge Plant",
    learningItemNews: "Industry Weather",
    learningItemResearch: "Research Report",
    learningItemOfficialSource: "Official Learning Source",
    learningItemGithubExample: "GitHub Example",
    openSourceResourcesTitle: "Open Source Resources",
    openSourceResourcesHint: "Curated GitHub projects with original summaries and external links only. ActuaryRadar does not copy repository documentation.",
    repositoryLanguage: "Language",
    repositoryLicense: "License",
    repositoryDifficulty: "Difficulty",
    repositoryUseCase: "Use case",
    repositoryFor: "Recommended for",
    viewRepository: "View repository",
    startLearningItem: "Start",
    startedLabel: "Started",
    inProgress: "In progress",
    notStarted: "Not started",
    markComplete: "Mark complete",
    completedLabel: "Completed",
    noCompletedToday: "Nothing completed yet today. Finished items will fold into this space.",
    activeTopicLabel: "Topic",
    noLearningPlanItems: "No learning items match the current setup. Add topics or change difficulty.",
    noStartedLearningItems: "No active learning item yet. Start with today’s learning.",
    moreContentSoon: "More trusted resources for this topic are being curated.",
    setupLearningFirst: "Save your preferences first, then ActuaryRadar will build today’s learning journey.",
    customizePlan: "Customize Plan",
    language: "Language",
    date: "Date",
    history: "Archive",
    todayTasks: "Today's Tasks",
    topPicks: "Balanced Daily Picks",
    knowledgeIntro: "Customize topics and daily volume from the actuarial knowledge map",
    sourceLibraryTitle: "Public Authoritative Library",
    sourceLibraryHint: "Knowledge cards prioritize public actuarial associations, regulators, standard setters, reinsurer research and open university courses.",
    referenceSources: "References",
    sourcePack: "Source pack",
    sourceBasedPrompt: "Source-based learning task",
    selectAllSources: "Select all sources",
    clearSources: "Clear sources",
    sourceWebsite: "Source",
    sourceVideo: "Video",
    weeklyFocus: "Weekly plan",
    autoWeekly: "Auto by weekday",
    editWeeklyPlan: "Edit plan",
    resetWeeklyPlan: "Reset default",
    saveWeeklyPlan: "Save plan",
    conceptExample: "Plain example",
    plannerTitle: "My Actuarial Learning Plan",
    plannerHint: "Choose topics, difficulty, daily volume and study time. Settings are saved in this browser.",
    dailyCount: "Items per day",
    dailyTitle: "Insurance Briefing",
    knowledgeTitle: "Actuarial Knowledge",
    savedTitle: "Saved & Learning Journal",
    allTopics: "All Topics",
    navAllBriefings: "All Briefings",
    pageDailySubtitle: "A curated insurance briefing by supervision, business line, company, technology and market theme",
    pageKnowledgeSubtitle: "Personalize your actuarial learning path, concepts and case practice",
    pageSavedSubtitle: "Review briefings saved in this browser",
    searchPlaceholder: "Search companies, topics, lines or keywords",
    loadReport: "Load report",
    openHtml: "Open HTML report",
    saveToday: "Save today",
    exportPdf: "Export PDF",
    allTime: "All time",
    last7: "Last 7 days",
    last30: "Last 30 days",
    last180: "Last 6 months",
    last365: "Last year",
    cardsTitle: "Briefing Cards",
    sectionCoverage: "Sections",
    actionBoard: "Reading Board",
    marked: "Marked",
    completed: "Done",
    shareTextTitle: "Shareable Summary",
    copyShare: "Copy summary",
    copied: "Copied",
    aiAssistant: "AI Learning Assistant",
    promptTop3: "Summarize Top 3",
    promptTop5: "Summarize Top 3",
    chineseOnlyConcept: "This concept is currently available in Chinese only.",
    chineseOnlyTasks: "Today's tasks are currently available in Chinese only.",
    sourceViaGoogleNews: "Source via Google News",
    languageSourceNotice: "",
    aiSummaryUnavailable: "AI-generated summaries are being prepared. Please check back later for today’s curated insights.",
    aiPlaceholder: "Ask about today's content, e.g. what actions for health insurance?",
    ask: "Ask",
    savedIntro: "Review saved briefings and learning journals from this browser.",
    saveCurrent: "Save current report",
    currentReportSaved: "Saved",
    noCurrentReport: "No current report to save",
    saveTodayLearning: "Save today",
    savedBriefingsTab: "Briefings",
    learningJournalTab: "Learning Journal",
    noLearningJournal: "No learning journal yet. Save today’s learning to revisit the concepts and insights you cultivated.",
    exportMarkdown: "Export Markdown",
    exportHtml: "Export HTML",
    learningJournalTitle: "ActuaryRadar Learning Journal",
    learningJournalSaved: "Today’s learning has been saved",
    studyTopics: "Study topics",
    learningPreferences: "Learning preferences",
    actuarialAngle: "Actuarial View",
    suggestedActions: "Suggested Actions",
    source: "Source",
    sourceUrl: "Source URL",
    originalTitle: "Original Title",
    originalLanguage: "Original Language",
    standardizedCategory: "Standardized Category",
    keyTakeaway: "Key Takeaway",
    aiSummary: "AI Summary",
    whyItMatters: "Why It Matters",
    readOriginal: "Read Original",
    articleDetails: "Details",
    generatedTime: "Generated Time",
    exportTitle: "ActuaryRadar Daily Briefing",
    exportDate: "Date",
    exportSource: "Source",
    exportKeyTakeaway: "Key Takeaway",
    exportWhyItMatters: "Why It Matters",
    exportReadOriginal: "Read Original",
    exportGeneratedBy: "Generated by ActuaryRadar",
    moreTags: "more",
    aiTransparency: "AI-generated summary based on the original source. Please refer to the original article for full context.",
    rssExcerptOnly: "Summary based on RSS excerpt only.",
    reportIssue: "Report issue",
    issueWrongTranslation: "Wrong translation",
    issueWrongCategory: "Wrong category",
    issueOutdatedLink: "Outdated link",
    issueDuplicate: "Duplicate news",
    issueOther: "Other",
    issueComment: "Comment",
    issueSaved: "Feedback saved in this browser",
    save: "Mark",
    saved: "Marked",
    markDone: "Mark Done",
    done: "Done",
    doneAlready: "Done",
    learningPoint: "Learning point",
    regulatoryAlert: "regulatory updates",
    noRegAlerts: "No clear regulatory updates in the current filter.",
    noItems: "No content under the current filter",
    selectArchive: "Select archive",
    noArchive: "No archive",
    loadError: "Unable to load report data",
    knowledgeLoadError: "Knowledge library could not be loaded.",
    noKnowledge: "No knowledge cards match the current setup. Adjust your topics to let the learning path grow.",
    coreConcepts: "Core Concepts",
    casePractice: "Case Practice",
    showAnswer: "Show reference answer",
    hideAnswer: "Hide reference answer",
    noSavedReports: "No saved content yet. Save today’s learning or intelligence to build your learning record.",
    untitledTheme: "Untitled theme",
    savedAt: "saved at",
    contentItems: "items",
    open: "Open"
  },
  fr: {
    brandTagline: "Veille assurance et formation actuarielle",
    documentTitle: "ActuaryRadar | All-in-One Insurance Intelligence & Actuarial Learning Platform",
    navHome: "Accueil",
    navDaily: "Veille assurance",
    navKnowledge: "Connaissances actuarielles",
    navSaved: "Sauvegardes & journal",
    dailyConcept: "Concept du jour",
    heroTitle: "Sachez quoi apprendre aujourd’hui.",
    heroSubtitle: "Un espace d’apprentissage quotidien personnalisé reliant connaissances actuarielles, veille sectorielle et sources fiables.",
    heroSubsubtitle: "Actualité sectorielle, analyses techniques, recherche et ressources de formation réunies dans un espace de veille plus lisible.",
    startLearning: "Commencer la formation du jour",
    browseBriefing: "Parcourir la veille",
    latestAvailableBriefing: "Dernière veille disponible",
    actuarialKnowledge: "Connaissances actuarielles",
    continueLearningArrow: "Poursuivre la formation →",
    learningTimeToday: "Temps de formation estimé aujourd’hui : 15 min",
    briefingArticleCount: "24 articles sélectionnés",
    briefingFeaturedCount: "5 analyses clés",
    browseArrow: "Parcourir →",
    readOriginalArrow: "Consulter la source →",
    heroKnowledge: "Base de connaissances",
    heroDaily: "Veille assurance",
    portalToday: "À la une",
    homeLearningEyebrow: "Jardin d’apprentissage",
    homeLearningTitle: "Que travailler aujourd’hui ?",
    buildJourneyArrow: "Construire mon parcours",
    editLearningPreferences: "Modifier mes préférences",
    next15Minutes: "Les 15 prochaines minutes",
    todaysLearning: "Jardin du jour",
    continueLearning: "Poursuivre la formation",
    recommendedNext: "À travailler ensuite",
    homeLearningSummaryReady: "Votre parcours du jour est prêt",
    homeLearningSummarySetup: "Définissez vos intérêts et votre temps disponible pour orienter la formation du jour.",
    progressToday: "progression du jour",
    recommendationSelectedTopic: "Parce que vous avez sélectionné {topic}.",
    recommendationGoalRegulatory: "Recommandé pour votre objectif : comprendre la réglementation et le capital.",
    recommendationGoalPricing: "Recommandé pour votre objectif : renforcer la tarification et le provisionnement.",
    recommendationGoalIndustry: "Recommandé pour votre objectif : comprendre le secteur de l’assurance.",
    recommendationGoalExam: "Recommandé pour votre objectif : préparer les examens actuariels.",
    recommendationGoalJob: "Recommandé pour votre objectif : développer des compétences opérationnelles.",
    recommendationIndustryInsight: "Relie le thème du jour à une évolution récente du marché.",
    browseAllEyebrow: "Parcourir",
    browseAllTitle: "Parcourir toute la veille",
    learningLibraryHint: "Concepts, fiches et sources de confiance",
    openLearningLibrary: "Ouvrir la base de connaissances →",
    relatedBriefing: "Veille associée",
    labelSeparator: " : ",
    estimatedTime: "Temps estimé : 15 min",
    portalKnowledgeText: "Renforcer son jugement actuariel avec des concepts du jour, fiches de connaissance, sources de confiance et parcours personnalisé.",
    portalDailyText: "Suivre les évolutions récentes en assurance, réassurance, supervision, InsurTech et marchés financiers.",
    portalSavedText: "Retrouver les contenus favoris, à lire plus tard et les veilles archivées.",
    portalConceptText: "Réviser chaque jour un concept actuariel et le relier aux hypothèses, aux résultats et au capital.",
    weeklyPlanEyebrow: "Parcours de formation",
    portalLatestEyebrow: "Actualité assurance",
    portalLatestTitle: "Dernières veilles",
    viewAllBriefings: "Voir toutes les veilles",
    viewAllIntelligence: "Voir toute la veille",
    portalSectionsEyebrow: "Domaines couverts",
    portalSectionsTitle: "Explorer par thème",
    topicRegulationText: "Suivre la supervision, les exigences de capital, la protection des assurés et la conformité.",
    topicMarketText: "Analyser le marché de l’assurance, les produits, la distribution et la concurrence.",
    topicReinsuranceText: "Suivre les renouvellements, les catastrophes, l’allègement du capital et les cycles de réassurance.",
    topicTechnologyText: "Explorer l’IA, la donnée, l’automatisation des sinistres et les usages InsurTech.",
    topicCompanyText: "Lire les résultats, la stratégie, le capital et les informations investisseurs des assureurs.",
    topicResearchText: "Repérer les publications d’associations actuarielles, réassureurs, cabinets de conseil et normalisateurs.",
    topicCareerText: "Relier ressources de formation, compétences professionnelles et progression actuarielle.",
    weeklyPlan: "Mon parcours de formation",
    myLearningPlan: "Mon parcours de formation",
    myLearningPlanHint: "Une sélection quotidienne personnalisée selon vos thèmes, votre niveau et votre temps disponible.",
    myLearningJourney: "Mon parcours de formation",
    myLearningJourneyHint: "Indiquez le temps dont vous disposez aujourd’hui, ActuaryRadar vous propose les contenus à travailler en priorité.",
    buildLearningJourney: "Construire mon parcours",
    buildLearningJourneyHint: "Précisez vos objectifs et vos thèmes d’intérêt ; ActuaryRadar proposera les contenus à travailler aujourd’hui.",
    editPreferences: "Modifier les préférences",
    savePreferences: "Enregistrer les préférences",
    resetPreferences: "Réinitialiser",
    onboardingEyebrow: "Paramétrage personnalisé",
    onboardingTitle: "Construire mon parcours de formation",
    onboardingIntro: "Choisissez votre profil, vos objectifs, vos thèmes et votre temps quotidien.",
    interestedTopics: "Thèmes d’intérêt",
    createMyPlan: "Créer mon parcours",
    skipForNow: "Ignorer pour l’instant",
    careerStageLabel: "Profil professionnel",
    careerStudent: "Étudiant",
    careerEarlyInsurance: "Jeune professionnel de l’assurance",
    careerJunior: "Actuaire junior / analyste",
    careerMid: "Professionnel confirmé",
    careerSenior: "Professionnel senior",
    careerManager: "Manager / dirigeant",
    learningGoalLabel: "Objectif de formation",
    goalExamReady: "Préparer les examens actuariels",
    goalJobReady: "Devenir opérationnel en poste",
    goalPricingReserving: "Renforcer tarification et provisionnement",
    goalRegulatoryLiteracy: "Comprendre réglementation et capital",
    goalIndustryContext: "Comprendre le secteur de l’assurance",
    goalExams: "Préparer les examens actuariels",
    goalJobSkills: "Renforcer les compétences métier",
    goalStrategyIr: "Évoluer vers la stratégie / l’IR",
    goalStayUpdated: "Rester à jour",
    goalGeneralKnowledge: "Construire une culture assurance",
    completedToday: "Floraisons du jour",
    learningStreak: "Série de progression",
    growthStage: "Stade",
    growthSeed: "Graine",
    growthSprout: "Jeune pousse",
    growthBud: "Bourgeon",
    growthBloom: "Floraison",
    topicsCompleted: "Thèmes travaillés",
    dailyTarget: "Objectif du jour",
    todaysLearningPlan: "Formation du jour",
    progressByTopic: "Progression par thème",
    difficultyLabel: "Niveau",
    allLevels: "Tous niveaux",
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Avancé",
    studyTimeLabel: "Temps de formation prévu",
    minutesShort: "min",
    estimated: "Temps estimé",
    learningItemDailyConcept: "Graine de concept",
    learningItemKnowledgeCard: "Jeune pousse de connaissance",
    learningItemNews: "Signal sectoriel",
    learningItemResearch: "Publication de recherche",
    learningItemOfficialSource: "Source de référence",
    learningItemGithubExample: "Exemple open source",
    openSourceResourcesTitle: "Ressources open source",
    openSourceResourcesHint: "Projets GitHub sélectionnés avec résumés originaux et liens externes uniquement. ActuaryRadar ne copie pas la documentation des dépôts.",
    repositoryLanguage: "Langage",
    repositoryLicense: "Licence",
    repositoryDifficulty: "Niveau",
    repositoryUseCase: "Cas d’usage",
    repositoryFor: "Recommandé pour",
    viewRepository: "Voir le dépôt",
    startLearningItem: "Commencer",
    startedLabel: "Commencé",
    inProgress: "En cours",
    notStarted: "Non commencé",
    markComplete: "Marquer comme fait",
    completedLabel: "Terminé",
    noCompletedToday: "Aucun contenu terminé aujourd’hui. Les éléments finalisés seront conservés ici.",
    activeTopicLabel: "Thème",
    noLearningPlanItems: "Aucun contenu ne correspond au paramétrage actuel. Ajoutez des thèmes ou changez de niveau.",
    noStartedLearningItems: "Aucun contenu en cours. Commencez par la formation du jour.",
    moreContentSoon: "D’autres sources fiables sont en cours de sélection pour ce thème.",
    setupLearningFirst: "Enregistrez vos préférences pour générer le parcours de formation du jour.",
    customizePlan: "Personnaliser",
    language: "Langue",
    date: "Date",
    history: "Archives",
    todayTasks: "Priorités du jour",
    topPicks: "Sélection du jour",
    knowledgeIntro: "Personnalisez les thèmes et le rythme de formation depuis la carte des connaissances actuarielles",
    sourceLibraryTitle: "Sources de confiance",
    sourceLibraryHint: "Les fiches privilégient les associations actuarielles, autorités de supervision, normalisateurs, études de réassureurs et cours universitaires ouverts.",
    referenceSources: "Sources",
    sourcePack: "Ensemble de sources",
    sourceBasedPrompt: "Cas pratique fondé sur sources",
    selectAllSources: "Tout sélectionner",
    clearSources: "Désélectionner",
    sourceWebsite: "Consulter",
    sourceVideo: "Vidéo",
    weeklyFocus: "Parcours de formation",
    autoWeekly: "Répartition par jour",
    editWeeklyPlan: "Modifier",
    resetWeeklyPlan: "Réinitialiser",
    saveWeeklyPlan: "Enregistrer",
    conceptExample: "Exemple simple",
    plannerTitle: "Mon parcours de formation actuarielle",
    plannerHint: "Choisissez les thèmes, le niveau, le volume quotidien et le temps de formation. Les réglages sont conservés dans ce navigateur.",
    dailyCount: "Fiches par jour",
    dailyTitle: "Veille assurance",
    knowledgeTitle: "Connaissances actuarielles",
    savedTitle: "Sauvegardes & journal de formation",
    allTopics: "Tous les thèmes",
    navAllBriefings: "Toute la veille",
    pageDailySubtitle: "Une veille structurée par supervision, branche, entreprise, InsurTech et thématique de marché",
    pageKnowledgeSubtitle: "Construire son parcours de formation : concepts, cas pratiques et sources de référence",
    pageSavedSubtitle: "Revoir les veilles sauvegardées dans ce navigateur",
    searchPlaceholder: "Rechercher une entreprise, un thème, une branche ou un mot-clé",
    loadReport: "Charger le rapport",
    openHtml: "Ouvrir la version HTML",
    saveToday: "Enregistrer la veille du jour",
    exportPdf: "Exporter en PDF",
    allTime: "Toute période",
    last7: "7 derniers jours",
    last30: "30 derniers jours",
    last180: "6 derniers mois",
    last365: "Dernière année",
    cardsTitle: "Fiches de veille",
    sectionCoverage: "Rubriques",
    actionBoard: "Tableau de suivi",
    marked: "Marqué",
    completed: "Terminé",
    shareTextTitle: "Synthèse à partager",
    copyShare: "Copier le résumé",
    copied: "Copié",
    aiAssistant: "Assistant de formation IA",
    promptTop3: "Résumer les 3 principales actualités",
    promptTop5: "Résumer les 3 principales actualités",
    chineseOnlyConcept: "Ce concept est actuellement disponible en chinois uniquement.",
    chineseOnlyTasks: "Les priorités du jour sont actuellement disponibles en chinois uniquement.",
    sourceViaGoogleNews: "Source relayée par Google Actualités",
    languageSourceNotice: "",
    aiSummaryUnavailable: "Les résumés générés par IA sont en cours de préparation. Revenez plus tard pour consulter la veille du jour.",
    aiPlaceholder: "Posez une question sur la veille du jour, ex. impacts pour la santé/prévoyance ?",
    ask: "Demander",
    savedIntro: "Retrouvez les veilles et journaux de formation enregistrés dans ce navigateur.",
    saveCurrent: "Enregistrer cette veille",
    currentReportSaved: "Enregistré",
    noCurrentReport: "Aucune veille à enregistrer",
    saveTodayLearning: "Enregistrer le jour",
    savedBriefingsTab: "Veilles",
    learningJournalTab: "Journal de formation",
    noLearningJournal: "Aucun journal de formation pour l’instant. Enregistrez la journée pour retrouver les concepts et veilles travaillés.",
    exportMarkdown: "Exporter Markdown",
    exportHtml: "Exporter HTML",
    learningJournalTitle: "Journal de formation ActuaryRadar",
    learningJournalSaved: "La formation du jour a été enregistrée",
    studyTopics: "Thèmes de formation",
    learningPreferences: "Préférences de formation",
    actuarialAngle: "Analyse actuarielle",
    suggestedActions: "Pistes d’action",
    source: "Source",
    sourceUrl: "Lien source",
    originalTitle: "Titre original",
    originalLanguage: "Langue originale",
    standardizedCategory: "Catégorie normalisée",
    keyTakeaway: "À retenir",
    aiSummary: "Résumé IA",
    whyItMatters: "Pourquoi c’est important",
    readOriginal: "Consulter la source",
    articleDetails: "Détails",
    generatedTime: "Date de génération",
    exportTitle: "Veille quotidienne ActuaryRadar",
    exportDate: "Date",
    exportSource: "Source",
    exportKeyTakeaway: "À retenir",
    exportWhyItMatters: "Pourquoi c’est important",
    exportReadOriginal: "Consulter la source",
    exportGeneratedBy: "Généré par ActuaryRadar",
    moreTags: "de plus",
    aiTransparency: "Résumé généré par IA à partir de la source originale. Consultez l’article source pour disposer du contexte complet.",
    rssExcerptOnly: "Résumé fondé uniquement sur l’extrait RSS.",
    reportIssue: "Signaler un problème",
    issueWrongTranslation: "Traduction incorrecte",
    issueWrongCategory: "Catégorie incorrecte",
    issueOutdatedLink: "Lien obsolète",
    issueDuplicate: "Doublon",
    issueOther: "Autre",
    issueComment: "Commentaire",
    issueSaved: "Signalement enregistré dans ce navigateur",
    save: "Marquer",
    saved: "Marqué",
    markDone: "Marquer comme terminé",
    done: "Terminé",
    doneAlready: "Terminé",
    learningPoint: "Point de formation",
    regulatoryAlert: "alertes prudentielles",
    noRegAlerts: "Aucune alerte prudentielle identifiée avec les filtres actuels.",
    noItems: "Aucun contenu ne correspond aux filtres actuels",
    selectArchive: "Choisir une archive",
    noArchive: "Aucune archive",
    loadError: "Impossible de charger les données du rapport",
    knowledgeLoadError: "La base de connaissances n’a pas pu être chargée.",
    noKnowledge: "Aucune fiche ne correspond au paramétrage actuel. Ajustez vos thèmes pour relancer le parcours.",
    coreConcepts: "Concepts clés",
    casePractice: "Cas pratique",
    showAnswer: "Voir la réponse commentée",
    hideAnswer: "Masquer la réponse",
    noSavedReports: "Aucun contenu sauvegardé. Enregistrez une veille ou une journée de formation pour constituer votre journal.",
    untitledTheme: "Thème non renseigné",
    savedAt: "sauvegardé le",
    contentItems: "contenus",
    open: "Accéder"
  }
};

let learningTopicOptions = [
  {
    id: "Fundamentals",
    labels: { zh: "精算基础", en: "Fundamentals", fr: "Fondamentaux actuariels" },
    focus: { zh: "概率、统计、生存分析和现金流基础", en: "Probability, statistics, survival analysis and cash-flow basics", fr: "Probabilités, statistique, analyse de survie et flux" },
    tracks: ["Fundamentals"],
    keywords: ["fundamental", "statistics", "survival", "probability", "mortality", "lapse", "基础", "概率", "统计", "mortalité", "rachat"]
  },
  {
    id: "Insurance Fundamentals",
    labels: { zh: "保险基础", en: "Insurance Fundamentals", fr: "Fondamentaux de l’assurance" },
    focus: { zh: "保险现金流、风险池、产品结构和财务报表基础", en: "Insurance cash flows, risk pooling, product structures and financial statement basics", fr: "Flux d’assurance, mutualisation, structures de produits et bases financières" },
    tracks: ["Insurance Fundamentals", "Fundamentals", "Insurance Finance"],
    keywords: ["insurance fundamentals", "cash flow", "risk pooling", "premium", "claims", "保险基础", "现金流", "保费", "理赔", "mutualisation", "prime", "sinistre"]
  },
  {
    id: "Life Insurance",
    labels: { zh: "寿险", en: "Life Insurance", fr: "Assurance vie" },
    focus: { zh: "死亡率、退保、年金、利润释放", en: "Mortality, lapses, annuities and profit emergence", fr: "Mortalité, rachats, rentes et émergence du résultat" },
    tracks: ["Insurance Fundamentals", "ALM", "Insurance Finance"],
    keywords: ["life", "annuity", "mortality", "lapse", "寿险", "年金", "死亡率", "vie", "rente", "mortalité"]
  },
  {
    id: "Health Insurance",
    labels: { zh: "健康险", en: "Health Insurance", fr: "Santé / prévoyance" },
    focus: { zh: "医疗趋势、理赔、保障和产品组合", en: "Medical trend, claims, protection and portfolio mix", fr: "Dérive médicale, sinistres, prévoyance et mix portefeuille" },
    tracks: ["Insurance Fundamentals", "Pricing", "Reserving"],
    keywords: ["health", "medical", "claim", "santé", "prévoyance", "健康", "医疗", "理赔"]
  },
  {
    id: "Pricing",
    labels: { zh: "定价", en: "Pricing", fr: "Tarification" },
    focus: { zh: "费率、GLM、风险细分和充足性", en: "Ratemaking, GLM, segmentation and adequacy", fr: "Tarification, GLM, segmentation et suffisance tarifaire" },
    tracks: ["Pricing"],
    keywords: ["pricing", "rate", "premium", "tarification", "费率", "定价", "glm"]
  },
  {
    id: "Reserving",
    labels: { zh: "准备金", en: "Reserving", fr: "Provisionnement" },
    focus: { zh: "IBNR、三角形、赔案发展和不确定性", en: "IBNR, triangles, claims development and uncertainty", fr: "IBNR, triangles, développement des sinistres et incertitude" },
    tracks: ["Reserving"],
    keywords: ["reserve", "reserving", "ibnr", "provisionnement", "准备金"]
  },
  {
    id: "IFRS 17",
    labels: { zh: "IFRS 17", en: "IFRS 17", fr: "IFRS 17" },
    focus: { zh: "CSM、RA、BEL、PAA/GMM/VFA", en: "CSM, risk adjustment, BEL and measurement models", fr: "CSM, ajustement pour risque, BEL et modèles d’évaluation" },
    tracks: ["IFRS 17", "Insurance Accounting", "Insurance Finance"],
    keywords: ["ifrs 17", "csm", "insurance contract", "contrats d’assurance", "合同服务边际"]
  },
  {
    id: "Solvency II",
    labels: { zh: "Solvency II", en: "Solvency II", fr: "Solvabilité II" },
    focus: { zh: "SCR、MCR、BEL、风险边际和 Own Funds", en: "SCR, MCR, BEL, risk margin and own funds", fr: "SCR, MCR, BEL, marge de risque et fonds propres" },
    tracks: ["Solvency II", "Regulation", "Capital Management", "ERM"],
    keywords: ["solvency", "scr", "mcr", "eiopa", "solvabilité", "偿付能力"]
  },
  {
    id: "Capital Management",
    labels: { zh: "资本管理", en: "Capital Management", fr: "Gestion du capital" },
    focus: { zh: "经济资本、监管资本、资本优化和 RAROC", en: "Economic capital, regulatory capital, optimization and RAROC", fr: "Capital économique, capital réglementaire, optimisation et RAROC" },
    tracks: ["Capital Management", "ERM", "Market Risk"],
    keywords: ["capital", "raroc", "own funds", "资本", "fonds propres"]
  },
  {
    id: "ERM",
    labels: { zh: "ERM", en: "ERM", fr: "ERM / gestion des risques" },
    focus: { zh: "风险偏好、ORSA、压力测试和 KRI", en: "Risk appetite, ORSA, stress testing and KRIs", fr: "Appétence au risque, ORSA, stress tests et KRI" },
    tracks: ["ERM", "Operational Risk", "Regulation"],
    keywords: ["erm", "orsa", "risk management", "stress", "风险管理", "gestion des risques"]
  },
  {
    id: "Reinsurance",
    labels: { zh: "再保险", en: "Reinsurance", fr: "Réassurance" },
    focus: { zh: "合约、临分、XoL、资本缓释和续转", en: "Treaty, facultative, XoL, capital relief and renewals", fr: "Traités, facultative, XoL, allègement du capital et renouvellements" },
    tracks: ["Reinsurance", "Catastrophe Modelling"],
    keywords: ["reinsurance", "reinsurer", "retrocession", "réassurance", "再保险", "再保"]
  },
  {
    id: "Investment & ALM",
    labels: { zh: "投资与 ALM", en: "Investment & ALM", fr: "Investissement & ALM" },
    focus: { zh: "久期、流动性、资产配置和利率风险", en: "Duration, liquidity, asset allocation and interest-rate risk", fr: "Duration, liquidité, allocation d’actifs et risque de taux" },
    tracks: ["ALM", "Investment", "Market Risk", "Insurance Finance"],
    keywords: ["alm", "investment", "asset", "duration", "asset-liability", "投资", "资产", "actif-passif"]
  },
  {
    id: "AI & Insurance",
    labels: { zh: "AI 与保险", en: "AI & Insurance", fr: "IA & assurance" },
    focus: { zh: "生成式 AI、理赔自动化、反欺诈和模型治理", en: "Generative AI, claims automation, fraud detection and model governance", fr: "IA générative, automatisation des sinistres, fraude et gouvernance des modèles" },
    tracks: ["AI for Insurance", "Data Analytics"],
    keywords: ["ai", "machine learning", "data", "insurtech", "人工智能", "数据", "ia"]
  },
  {
    id: "Climate Risk",
    labels: { zh: "气候风险", en: "Climate Risk", fr: "Risque climatique" },
    focus: { zh: "物理风险、转型风险、压力测试和披露", en: "Physical risk, transition risk, stress testing and disclosure", fr: "Risque physique, transition, stress tests et reporting" },
    tracks: ["Catastrophe Modelling", "ERM", "Regulation"],
    keywords: ["climate", "transition", "physical risk", "climat", "气候"]
  },
  {
    id: "Catastrophe Risk",
    labels: { zh: "巨灾风险", en: "Catastrophe Risk", fr: "Risque catastrophe" },
    focus: { zh: "洪水、风暴、地震、野火和巨灾模型", en: "Flood, storm, earthquake, wildfire and cat models", fr: "Inondation, tempête, séisme, feu de forêt et modèles cat" },
    tracks: ["Catastrophe Modelling", "Reinsurance"],
    keywords: ["catastrophe", "nat cat", "flood", "earthquake", "wildfire", "巨灾", "catastrophe"]
  },
  {
    id: "Data Analytics",
    labels: { zh: "数据分析", en: "Data Analytics", fr: "Analyse de données" },
    focus: { zh: "SQL、Python、R、特征工程和模型验证", en: "SQL, Python, R, feature engineering and validation", fr: "SQL, Python, R, variables explicatives et validation" },
    tracks: ["Data Analytics", "Pricing", "AI for Insurance"],
    keywords: ["analytics", "python", "sql", "model", "data", "数据", "modèle"]
  },
  {
    id: "Regulation",
    labels: { zh: "监管", en: "Regulation", fr: "Réglementation" },
    focus: { zh: "EIOPA、ACPR、DORA、AI Act、消费者保护", en: "EIOPA, ACPR, DORA, AI Act and consumer protection", fr: "EIOPA, ACPR, DORA, AI Act et protection des assurés" },
    tracks: ["Regulation", "Solvency II", "ERM"],
    keywords: ["regulation", "eiopa", "acpr", "dora", "监管", "réglementation"]
  }
];

const fallbackLearningTopicOptions = learningTopicOptions.map(topic => ({
  ...topic,
  labels: { ...(topic.labels || {}) },
  focus: { ...(topic.focus || {}) },
  tracks: [...(topic.tracks || [])],
  keywords: [...(topic.keywords || [])]
}));

const onboardingCareerStages = ["student", "early_career_insurance"];
const onboardingLearningGoals = ["exam_ready", "job_ready", "pricing_reserving", "regulatory_literacy", "industry_context"];
const onboardingTopicIds = [
  "Fundamentals",
  "Insurance Fundamentals",
  "Pricing",
  "Reserving",
  "IFRS 17",
  "Solvency II",
  "Reinsurance",
  "Investment & ALM",
  "AI & Insurance",
  "Climate Risk",
  "Data Analytics",
  "Regulation"
];
const onboardingStudyTimes = [10, 15, 20, 30];

const els = {
  sectionNav: document.querySelector("#sectionNav"),
  dailyNavGroup: document.querySelector("#dailyNavGroup"),
  productTabs: document.querySelectorAll(".product-tab"),
  pages: document.querySelectorAll(".page-view"),
  reportDate: document.querySelector("#reportDate"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  dailyThemeLabel: document.querySelector("#dailyThemeLabel"),
  languageSelect: document.querySelector("#languageSelect"),
  learningGoal: document.querySelector("#learningGoal"),
  taskList: document.querySelector("#taskList"),
  learningPlanList: document.querySelector("#learningPlanList"),
  continueLearningList: document.querySelector("#continueLearningList"),
  recommendedLearningList: document.querySelector("#recommendedLearningList"),
  topicProgressList: document.querySelector("#topicProgressList"),
  completedTodayCount: document.querySelector("#completedTodayCount"),
  learningStreakCount: document.querySelector("#learningStreakCount"),
  topicsCompletedCount: document.querySelector("#topicsCompletedCount"),
  dailyTargetSummary: document.querySelector("#dailyTargetSummary"),
  conceptTerm: document.querySelector("#conceptTerm"),
  conceptDefinition: document.querySelector("#conceptDefinition"),
  conceptExample: document.querySelector("#conceptExample"),
  conceptExercise: document.querySelector("#conceptExercise"),
  conceptSourceLink: document.querySelector("#conceptSourceLink"),
  metricGrid: document.querySelector("#metricGrid"),
  topPicks: document.querySelector("#topPicks"),
  languageSourceNotice: document.querySelector("#languageSourceNotice"),
  searchInput: document.querySelector("#searchInput"),
  lobFilter: document.querySelector("#lobFilter"),
  topicFilter: document.querySelector("#topicFilter"),
  activeTopicChip: document.querySelector("#activeTopicChip"),
  industryFilter: document.querySelector("#industryFilter"),
  periodFilter: document.querySelector("#periodFilter"),
  branchFilter: document.querySelector("#branchFilter"),
  companyFilter: document.querySelector("#companyFilter"),
  resultCount: document.querySelector("#resultCount"),
  itemList: document.querySelector("#itemList"),
  savedCount: document.querySelector("#savedCount"),
  doneCount: document.querySelector("#doneCount"),
  shareText: document.querySelector("#shareText"),
  copyShareButton: document.querySelector("#copyShareButton"),
  aiQuestion: document.querySelector("#aiQuestion"),
  askAiButton: document.querySelector("#askAiButton"),
  aiAnswer: document.querySelector("#aiAnswer"),
  itemTemplate: document.querySelector("#itemTemplate"),
  dateInput: document.querySelector("#dateInput"),
  archiveSelect: document.querySelector("#archiveSelect"),
  loadDateButton: document.querySelector("#loadDateButton"),
  htmlReportLink: document.querySelector("#htmlReportLink"),
  saveDailyButton: document.querySelector("#saveDailyButton"),
  exportPdfButton: document.querySelector("#exportPdfButton"),
  saveCurrentDigestButton: document.querySelector("#saveCurrentDigestButton"),
  saveTodayLearningButton: document.querySelector("#saveTodayLearningButton"),
  saveKnowledgeLearningButton: document.querySelector("#saveKnowledgeLearningButton"),
  savedDigestList: document.querySelector("#savedDigestList"),
  savedTabs: document.querySelectorAll("[data-saved-tab]"),
  knowledgeFilter: document.querySelector("#knowledgeFilter"),
  conceptGrid: document.querySelector("#conceptGrid"),
  knowledgeGrid: document.querySelector("#knowledgeGrid"),
  openSourceLearningGrid: document.querySelector("#openSourceLearningGrid"),
  sourceLibrary: document.querySelector("#sourceLibrary"),
  selectAllSourcesButton: document.querySelector("#selectAllSourcesButton"),
  clearSourcesButton: document.querySelector("#clearSourcesButton"),
  knowledgePlanner: document.querySelector("#knowledgePlanner"),
  learningPreferencesCard: document.querySelector("#learningPreferencesCard"),
  careerStage: document.querySelector("#careerStage"),
  learningGoalSelect: document.querySelector("#learningGoalSelect"),
  dailyKnowledgeCount: document.querySelector("#dailyKnowledgeCount"),
  learningDifficulty: document.querySelector("#learningDifficulty"),
  studyTime: document.querySelector("#studyTime"),
  editLearningPreferences: document.querySelector("#editLearningPreferences"),
  saveLearningPreferences: document.querySelector("#saveLearningPreferences"),
  resetLearningPreferences: document.querySelector("#resetLearningPreferences"),
  onboardingModal: document.querySelector("#onboardingModal"),
  onboardingCareerStage: document.querySelector("#onboardingCareerStage"),
  onboardingLearningGoal: document.querySelector("#onboardingLearningGoal"),
  onboardingStudyTime: document.querySelector("#onboardingStudyTime"),
  onboardingTopicGrid: document.querySelector("#onboardingTopicGrid"),
  openOnboardingButton: document.querySelector("#openOnboardingButton"),
  resetHomeLearningPreferences: document.querySelector("#resetHomeLearningPreferences"),
  skipOnboardingButton: document.querySelector("#skipOnboardingButton"),
  createPlanButton: document.querySelector("#createPlanButton"),
  copyContactButton: document.querySelector("#copyContactButton"),
  portalLeadTitle: document.querySelector("#portalLeadTitle"),
  portalLeadSummary: document.querySelector("#portalLeadSummary"),
  portalLeadLink: document.querySelector("#portalLeadLink"),
  homeLearningSummary: document.querySelector("#homeLearningSummary"),
  homeTodayLearningList: document.querySelector("#homeTodayLearningList"),
  homeLearningSide: document.querySelector("#homeLearningSide"),
  homeContinueLearningCard: document.querySelector("#homeContinueLearningCard"),
  homeContinueLearningList: document.querySelector("#homeContinueLearningList"),
  homeRecommendedLearningCard: document.querySelector("#homeRecommendedLearningCard"),
  homeRecommendedLearningList: document.querySelector("#homeRecommendedLearningList"),
  homeCompletedLearningCard: document.querySelector("#homeCompletedLearningCard"),
  homeCompletedLearningTitle: document.querySelector("#homeCompletedLearningTitle"),
  homeCompletedLearningList: document.querySelector("#homeCompletedLearningList"),
  portalLatestGrid: document.querySelector("#portalLatestGrid"),
  portalSectionGrid: document.querySelector("#portalSectionGrid")
};

async function init() {
  window.ActuaryRadarAnalytics?.init();
  await loadLearningTaxonomy();
  normalizeLearningState();
  applyInitialRouteState();
  if (!state.sourcePlan) {
    state.sourcePlan = sourceLibrary.map(source => source.id);
  } else {
    const validSources = new Set(sourceLibrary.map(source => source.id));
    state.sourcePlan = state.sourcePlan.filter(id => validSources.has(id));
  }
  syncBodyState();
  renderOnboardingOptions();
  bindEvents();
  renderStaticIcons();
  els.periodFilter.value = state.filters.period;
  applyLanguage();
  renderLearningPlan();
  await loadArchiveIndex();
  await loadOpenSourceResources();
  await loadKnowledgeSources();
  await loadKnowledge();
  await loadDigest("./data/digest.json");
  setActivePage(state.activePage);
  render();
  maybeOpenOnboardingModal();
  analyticsPageView("initial_load");
}

function applyInitialRouteState() {
  const section = currentRouteBriefingSection();
  if (section) {
    state.activePage = "daily";
    state.activeSection = section;
    state.dailyNavExpanded = false;
  }
}

function currentRouteBriefingSection() {
  const params = new URLSearchParams(window.location.search);
  const topic = params.get("topic");
  return topic ? sectionByBriefingTopicSlug[topic] || null : null;
}

async function loadLearningTaxonomy() {
  try {
    const response = await fetch("./data/learning_taxonomy.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const configuredTopics = Array.isArray(payload.topics)
      ? payload.topics.map(normalizeConfiguredLearningTopic).filter(Boolean)
      : [];
    if (configuredTopics.length) {
      learningTopicOptions = configuredTopics;
      state.learningTaxonomy = payload;
    }
  } catch {
    learningTopicOptions = fallbackLearningTopicOptions;
    state.learningTaxonomy = null;
  }
}

function normalizeConfiguredLearningTopic(topic) {
  if (!topic?.id || !topic?.labels) return null;
  return {
    id: String(topic.id),
    slug: topic.slug || "",
    labels: topic.labels || {},
    focus: topic.focus || {},
    tracks: Array.isArray(topic.tracks) ? topic.tracks.map(String) : [],
    keywords: Array.isArray(topic.keywords) ? topic.keywords.map(String) : []
  };
}

function renderStaticIcons() {
  document.querySelectorAll(".nav-icon[data-icon]").forEach(node => {
    node.innerHTML = navIcon(node.dataset.icon);
  });
}

function renderOnboardingOptions() {
  if (!els.onboardingModal) return;
  if (els.onboardingCareerStage) {
    els.onboardingCareerStage.innerHTML = onboardingCareerStages.map(id => `
      <option value="${escapeHtml(id)}">${escapeHtml(onboardingCareerLabel(id))}</option>
    `).join("");
    els.onboardingCareerStage.value = onboardingCareerStages.includes(state.knowledgePlan.careerStage)
      ? state.knowledgePlan.careerStage
      : "student";
  }
  if (els.onboardingLearningGoal) {
    els.onboardingLearningGoal.innerHTML = onboardingLearningGoals.map(id => `
      <option value="${escapeHtml(id)}">${escapeHtml(onboardingGoalLabel(id))}</option>
    `).join("");
    els.onboardingLearningGoal.value = onboardingLearningGoals.includes(state.knowledgePlan.learningGoal)
      ? state.knowledgePlan.learningGoal
      : "job_ready";
  }
  if (els.onboardingStudyTime) {
    els.onboardingStudyTime.innerHTML = onboardingStudyTimes.map(minutes => `
      <option value="${minutes}">${minutes} ${escapeHtml(t("minutesShort"))}</option>
    `).join("");
    els.onboardingStudyTime.value = String(onboardingStudyTimes.includes(Number(state.knowledgePlan.studyTime))
      ? state.knowledgePlan.studyTime
      : 15);
  }
  if (els.onboardingTopicGrid) {
    const selected = new Set(state.knowledgePlan.tracks || defaultKnowledgePlan.tracks);
    els.onboardingTopicGrid.innerHTML = onboardingTopicIds.map(topicId => `
      <label class="onboarding-topic-choice">
        <input type="checkbox" value="${escapeHtml(topicId)}"${selected.has(topicId) ? " checked" : ""}>
        <span>${escapeHtml(learningTopicLabel(topicId))}</span>
      </label>
    `).join("");
  }
}

function onboardingCareerLabel(id) {
  const labels = {
    student: t("careerStudent"),
    early_career_insurance: t("careerEarlyInsurance")
  };
  return labels[id] || id;
}

function onboardingGoalLabel(id) {
  const labels = {
    exam_ready: t("goalExamReady"),
    job_ready: t("goalJobReady"),
    pricing_reserving: t("goalPricingReserving"),
    regulatory_literacy: t("goalRegulatoryLiteracy"),
    industry_context: t("goalIndustryContext")
  };
  return labels[id] || id;
}

function maybeOpenOnboardingModal() {
  if (!els.onboardingModal) return;
  if (state.knowledgePlan.setupComplete || state.onboardingSkipped) return;
  if (state.activePage !== "home") return;
  openOnboardingModal();
}

function openOnboardingModal() {
  if (!els.onboardingModal) return;
  renderOnboardingOptions();
  els.onboardingModal.hidden = false;
  els.onboardingModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  els.onboardingCareerStage?.focus();
}

function closeOnboardingModal() {
  if (!els.onboardingModal) return;
  els.onboardingModal.hidden = true;
  els.onboardingModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function saveOnboardingPlan() {
  const selectedTopics = els.onboardingTopicGrid
    ? [...els.onboardingTopicGrid.querySelectorAll("input:checked")].map(input => input.value)
    : [];
  const studyTime = Number(els.onboardingStudyTime?.value || 15);
  state.knowledgePlan = {
    ...state.knowledgePlan,
    careerStage: els.onboardingCareerStage?.value || "student",
    learningGoal: els.onboardingLearningGoal?.value || "job_ready",
    tracks: selectedTopics.length ? selectedTopics : defaultKnowledgePlan.tracks,
    studyTime,
    dailyCount: dailyCountForStudyTime(studyTime),
    difficulty: state.knowledgePlan.difficulty || "beginner",
    setupComplete: true
  };
  state.onboardingSkipped = false;
  localStorage.removeItem("actuaryRadar.onboardingSkipped");
  saveKnowledgePlan();
  analyticsEvent("learning_journey_created", {
    career_stage: state.knowledgePlan.careerStage,
    learning_goal: state.knowledgePlan.learningGoal,
    study_time: state.knowledgePlan.studyTime,
    topic_count: state.knowledgePlan.tracks.length
  });
  closeOnboardingModal();
  renderKnowledgePlanner();
  renderKnowledge();
  renderLearningPlan();
  renderPortal();
}

function dailyCountForStudyTime(minutes) {
  if (minutes <= 10) return 1;
  if (minutes >= 30) return 3;
  return 2;
}

function skipOnboarding() {
  if (!state.knowledgePlan.setupComplete) {
    state.knowledgePlan = {
      ...state.knowledgePlan,
      tracks: defaultKnowledgePlan.tracks,
      studyTime: defaultKnowledgePlan.studyTime,
      dailyCount: defaultKnowledgePlan.dailyCount,
      setupComplete: true
    };
    saveKnowledgePlan();
  }
  state.onboardingSkipped = true;
  localStorage.setItem("actuaryRadar.onboardingSkipped", "true");
  closeOnboardingModal();
  renderKnowledgePlanner();
  renderLearningPlan();
  renderPortal();
}

function normalizeLearningState() {
  const plan = state.knowledgePlan && typeof state.knowledgePlan === "object" ? state.knowledgePlan : {};
  state.knowledgePlan = {
    ...defaultKnowledgePlan,
    ...plan,
    dailyCount: clampNumber(plan.dailyCount, 2, 1, 5),
    studyTime: onboardingStudyTimes.includes(Number(plan.studyTime)) ? Number(plan.studyTime) : defaultKnowledgePlan.studyTime,
    difficulty: ["all", "beginner", "intermediate", "advanced"].includes(plan.difficulty) ? plan.difficulty : defaultKnowledgePlan.difficulty,
    careerStage: ["student", "early_career_insurance", "junior", "mid", "senior", "manager"].includes(plan.careerStage) ? plan.careerStage : defaultKnowledgePlan.careerStage,
    learningGoal: ["exam_ready", "job_ready", "pricing_reserving", "regulatory_literacy", "industry_context", "exams", "job_skills", "strategy_ir", "stay_updated", "general_knowledge"].includes(plan.learningGoal) ? plan.learningGoal : defaultKnowledgePlan.learningGoal,
    setupComplete: Boolean(plan.setupComplete || storedKnowledgePlanRaw),
    tracks: normalizeSelectedLearningTopics(plan.tracks)
  };
  const progress = state.learningProgress && typeof state.learningProgress === "object" ? state.learningProgress : {};
  state.learningProgress = {
    completed: progress.completed && typeof progress.completed === "object" ? progress.completed : {},
    started: progress.started && typeof progress.started === "object" ? progress.started : {},
    topicCompletions: progress.topicCompletions && typeof progress.topicCompletions === "object" ? progress.topicCompletions : {}
  };
}

function normalizeSelectedLearningTopics(tracks) {
  const selected = Array.isArray(tracks) ? tracks : defaultKnowledgePlan.tracks;
  const byId = new Map(learningTopicOptions.map(topic => [topic.id, topic]));
  const byTrack = new Map();
  learningTopicOptions.forEach(topic => (topic.tracks || []).forEach(track => byTrack.set(track, topic.id)));
  const normalized = selected
    .map(value => byId.has(value) ? value : byTrack.get(value))
    .filter(Boolean);
  const unique = [...new Set(normalized)];
  const legacySet = new Set(legacyDefaultKnowledgeTracks);
  const looksLikeLegacyDefault = unique.length >= legacyDefaultKnowledgeTracks.length - 1
    && unique.every(topic => legacySet.has(topic));
  if (!unique.length || looksLikeLegacyDefault) return defaultKnowledgePlan.tracks;
  return unique;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function bindEvents() {
  els.productTabs.forEach(button => {
    button.addEventListener("click", () => {
      const nextPage = button.dataset.page;
      if (nextPage === "daily") {
        if (state.activePage !== "daily") state.activeSection = "全部";
        state.dailyNavExpanded = state.activePage !== "daily" ? true : !state.dailyNavExpanded;
      } else {
        state.dailyNavExpanded = false;
      }
      setActivePage(nextPage);
      if (nextPage === "daily") renderSectionNav();
      render();
    });
  });

  document.querySelectorAll(".product-tab-link").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.page === "daily" && !button.dataset.portalSection) {
        state.activeSection = "全部";
        renderSectionNav();
      }
      state.dailyNavExpanded = false;
      setActivePage(button.dataset.page);
      render();
      if (button.dataset.scrollTarget) {
        document.querySelector(`#${button.dataset.scrollTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  els.languageSelect.value = state.language;
  els.languageSelect.addEventListener("change", event => {
    state.language = event.target.value;
    localStorage.setItem("actuaryRadar.language", state.language);
    applyLanguage();
    renderOnboardingOptions();
    loadArchiveIndex();
    if (state.data) renderScaffold();
    renderSectionNav();
    updatePageHeader();
    renderKnowledgeFilter();
    renderSourceLibrary();
    renderKnowledgePlanner();
    renderKnowledge();
    renderLearningPlan();
    renderFilters();
    render();
  });

  els.searchInput.addEventListener("input", event => {
    state.filters.search = event.target.value.trim().toLowerCase();
    window.clearTimeout(searchAnalyticsTimer);
    if (state.filters.search.length >= 2) {
      searchAnalyticsTimer = window.setTimeout(() => {
        analyticsEvent("search_used", {
          search_length: state.filters.search.length,
          result_count: getFilteredItems().length
        });
      }, 700);
    }
    render();
  });

  els.lobFilter.addEventListener("change", event => {
    state.filters.lob = event.target.value;
    render();
  });

  els.topicFilter.addEventListener("change", event => {
    if (state.activeSection !== "全部") return;
    state.filters.topic = event.target.value;
    render();
  });

  els.activeTopicChip?.addEventListener("click", () => {
    state.activeSection = "全部";
    state.filters.topic = "all";
    updateSectionFilters();
    setActivePage("daily");
    renderSectionNav();
    render();
  });

  els.industryFilter.addEventListener("change", event => {
    state.filters.industry = event.target.value;
    render();
  });

  els.periodFilter.addEventListener("change", event => {
    state.filters.period = event.target.value;
    render();
  });

  els.branchFilter.addEventListener("change", event => {
    state.filters.branch = event.target.value;
    render();
  });

  els.companyFilter.addEventListener("change", event => {
    state.filters.company = event.target.value;
    render();
  });

  window.addEventListener("popstate", () => {
    state.activeSection = "全部";
    state.activePage = "home";
    applyInitialRouteState();
    setActivePage(state.activePage);
    renderSectionNav();
    render();
  });

  els.copyShareButton?.addEventListener("click", async () => {
    els.shareText.select();
    try {
      await navigator.clipboard.writeText(els.shareText.value);
      els.copyShareButton.textContent = t("copied");
      setTimeout(() => {
        els.copyShareButton.textContent = t("copyShare");
      }, 1200);
    } catch {
      document.execCommand("copy");
    }
  });

  els.loadDateButton.addEventListener("click", () => {
    if (!els.dateInput.value) return;
    const date = els.dateInput.value;
    const archive = state.archives.find(item => item.date === date);
    loadDigest(archive?.json || `./data/archive/${date}.json`);
  });

  els.archiveSelect.addEventListener("change", event => {
    if (!event.target.value) return;
    loadDigest(event.target.value);
  });

  els.saveDailyButton.addEventListener("click", () => {
    saveCurrentDigest();
  });

  els.saveCurrentDigestButton.addEventListener("click", () => {
    const saved = saveCurrentDigest();
    if (!saved) {
      flashButtonLabel(els.saveCurrentDigestButton, t("noCurrentReport"));
      return;
    }
    flashButtonLabel(els.saveCurrentDigestButton, t("currentReportSaved"));
    renderSavedDigests();
  });
  els.saveTodayLearningButton?.addEventListener("click", saveTodayLearningJournal);
  els.saveKnowledgeLearningButton?.addEventListener("click", saveTodayLearningJournal);
  els.savedTabs?.forEach(button => {
    button.addEventListener("click", () => {
      state.savedView = button.dataset.savedTab || "briefings";
      renderSavedDigests();
    });
  });

  els.exportPdfButton.addEventListener("click", () => {
    window.print();
  });

  els.htmlReportLink.addEventListener("click", event => {
    event.preventDefault();
    exportDailyBriefingHtml();
  });

  els.knowledgeFilter?.addEventListener("change", () => {
    renderKnowledge();
  });

  els.dailyKnowledgeCount?.addEventListener("change", event => {
    state.knowledgePlan.dailyCount = Number(event.target.value);
    saveKnowledgePlan();
    renderKnowledge();
    renderLearningPlan();
  });

  els.careerStage?.addEventListener("change", event => {
    state.knowledgePlan.careerStage = event.target.value;
    saveKnowledgePlan();
    renderLearningPlan();
  });

  els.learningGoalSelect?.addEventListener("change", event => {
    state.knowledgePlan.learningGoal = event.target.value;
    saveKnowledgePlan();
    renderLearningPlan();
  });

  els.learningDifficulty?.addEventListener("change", event => {
    state.knowledgePlan.difficulty = event.target.value;
    saveKnowledgePlan();
    renderKnowledge();
    renderLearningPlan();
  });

  els.studyTime?.addEventListener("change", event => {
    state.knowledgePlan.studyTime = Number(event.target.value);
    saveKnowledgePlan();
    renderLearningPlan();
  });

  els.editLearningPreferences?.addEventListener("click", () => {
    openOnboardingModal();
  });

  els.saveLearningPreferences?.addEventListener("click", () => {
    state.knowledgePlan.setupComplete = true;
    saveKnowledgePlan();
    analyticsEvent("learning_journey_created", {
      career_stage: state.knowledgePlan.careerStage,
      learning_goal: state.knowledgePlan.learningGoal,
      study_time: state.knowledgePlan.studyTime,
      topic_count: state.knowledgePlan.tracks.length,
      source: "knowledge_page"
    });
    renderKnowledgePlanner();
    renderLearningPlan();
  });

  els.resetLearningPreferences?.addEventListener("click", resetLearningPreferences);
  els.resetHomeLearningPreferences?.addEventListener("click", resetLearningPreferences);

  els.learningPlanList?.addEventListener("click", event => {
    handleLearningActionClick(event);
  });

  els.continueLearningList?.addEventListener("click", handleLearningActionClick);
  els.recommendedLearningList?.addEventListener("click", handleLearningActionClick);
  els.homeTodayLearningList?.addEventListener("click", handleLearningActionClick);
  els.homeContinueLearningList?.addEventListener("click", handleLearningActionClick);
  els.homeRecommendedLearningList?.addEventListener("click", handleLearningActionClick);
  els.openOnboardingButton?.addEventListener("click", () => openOnboardingModal());
  els.createPlanButton?.addEventListener("click", saveOnboardingPlan);
  els.skipOnboardingButton?.addEventListener("click", skipOnboarding);
  els.onboardingModal?.querySelectorAll("[data-close-onboarding]").forEach(node => {
    node.addEventListener("click", closeOnboardingModal);
  });

  els.selectAllSourcesButton.addEventListener("click", () => {
    state.sourcePlan = sourceLibrary.map(source => source.id);
    saveSourcePlan();
    renderSourceLibrary();
    renderKnowledge();
    renderLearningPlan();
  });

  els.clearSourcesButton.addEventListener("click", () => {
    state.sourcePlan = [];
    saveSourcePlan();
    renderSourceLibrary();
    renderKnowledge();
    renderLearningPlan();
  });

  els.askAiButton?.addEventListener("click", () => {
    renderAiAnswer(els.aiQuestion.value);
  });

  document.querySelectorAll(".quick-prompts button").forEach(button => {
    button.addEventListener("click", () => {
      renderAiAnswer(button.dataset.prompt);
    });
  });
}

function setActivePage(page) {
  state.activePage = page;
  syncBodyState();
  syncBriefingUrl();
  els.productTabs.forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  syncDailyNavExpanded();
  els.pages.forEach(section => {
    section.classList.toggle("active", section.id === `${page}Page`);
  });
  updatePageHeader();
  updateSectionFilters();
  if (page === "saved") renderSavedDigests();
  if (page === "knowledge") {
    if (state.data) renderScaffold();
    renderKnowledge();
  }
  if (page === "home") renderPortal();
  analyticsPageView("route_change");
}

function syncBodyState() {
  if (state.activePage !== "daily") state.dailyNavExpanded = false;
  document.body.dataset.page = state.activePage;
  document.body.dataset.section = state.activeSection === "全部" ? "all" : "section";
  syncDailyNavExpanded();
}

function syncDailyNavExpanded() {
  if (!els.dailyNavGroup) return;
  const expanded = Boolean(state.dailyNavExpanded);
  els.dailyNavGroup.classList.toggle("expanded", expanded);
  if (els.sectionNav) els.sectionNav.hidden = !expanded;
}

function syncBriefingUrl() {
  const url = new URL(window.location.href);
  if (state.activePage === "daily") {
    const slug = state.activeSection === "全部" ? "" : briefingTopicSlugs[normalizeSection(state.activeSection)];
    if (slug) url.searchParams.set("topic", slug);
    else url.searchParams.delete("topic");
  } else {
    url.searchParams.delete("topic");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.replaceState({}, "", next);
}

async function loadArchiveIndex() {
  try {
    const response = await fetch("./data/archive_index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const archives = payload.archives || [];
    state.archives = archives;
    els.archiveSelect.innerHTML = [
      `<option value="">${escapeHtml(t("selectArchive"))}</option>`,
      ...archives.map(item => {
        const label = state.language === "zh" ? `${item.date}${item.theme ? " · " + item.theme : ""}` : item.date;
        return `<option value="${escapeHtml(item.json)}">${escapeHtml(label)}</option>`;
      })
    ].join("");
  } catch {
    state.archives = [];
    els.archiveSelect.innerHTML = `<option value="">${escapeHtml(t("noArchive"))}</option>`;
  }
}

async function loadKnowledge() {
  try {
    const response = await fetch("./data/knowledge.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.knowledge = payload.modules || [];
    state.knowledgeCatalog = payload.catalog || state.knowledge.map(module => ({
      id: module.id,
      title: module.track || module.title,
      focus: module.summary || ""
    }));
    renderKnowledgeFilter();
    renderSourceLibrary();
    renderKnowledgePlanner();
    renderLearningPlan();
  } catch {
    state.knowledge = [];
    els.knowledgeGrid.innerHTML = `<div class="empty-state">${escapeHtml(t("knowledgeLoadError"))}</div>`;
  }
}

async function loadOpenSourceResources() {
  try {
    const response = await fetch("./data/open_source_resources.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.openSourceResources = payload.repositories || [];
  } catch {
    state.openSourceResources = [];
  }
}

async function loadKnowledgeSources() {
  try {
    const response = await fetch("./data/knowledge_sources.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.knowledgeSources = {
      items: payload.items || {},
      daily_concepts: payload.daily_concepts || []
    };
  } catch {
    state.knowledgeSources = { items: {}, daily_concepts: [] };
  }
}

async function loadDigest(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let data = await response.json();
    data = await refreshDigestIfStale(data, url);
    state.data = data;
    state.items = data.items || [];
    state.companyReports = buildCompanyReportItems(data.company_reports || []);
    state.activeSection = currentRouteBriefingSection() || "全部";
    state.filters.tag = "";
    els.dateInput.value = data.report_date || "";
    const archive = state.archives.find(item => item.date === data.report_date);
    if (els.archiveSelect) {
      const archiveUrl = archive?.json || `./data/archive/${data.report_date}.json`;
      const matchingOption = [...els.archiveSelect.options].find(option => option.value === archiveUrl);
      els.archiveSelect.value = matchingOption ? archiveUrl : "";
    }
    els.htmlReportLink.href = archive?.html || `./reports/${data.report_date}.html`;
    renderScaffold();
    render();
    renderLearningPlan();
    if (state.activePage === "knowledge") renderKnowledge();
  } catch (error) {
    els.itemList.innerHTML = `<div class="empty-state">${escapeHtml(t("loadError"))}: ${escapeHtml(error.message)}</div>`;
  }
}

async function refreshDigestIfStale(data, sourceUrl) {
  const today = parisTodayIsoDate();
  if (!today || data?.report_date === today) return data;
  if (sourceUrl && sourceUrl.includes("/.netlify/functions/")) return data;
  if (!isAfterParisRefreshWindow()) return markDigestStale(data);
  const dynamicData = await fetchDailyRefresh(today);
  return dynamicData || markDigestStale(data);
}

async function fetchDailyRefresh(today) {
  if (location.protocol === "file:") return null;
  const endpoints = [
    `/.netlify/functions/daily-refresh?date=${encodeURIComponent(today)}`,
    `/api/daily-refresh?date=${encodeURIComponent(today)}`
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}&v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload?.report_date === today && Array.isArray(payload.items)) return payload;
    } catch {
      // Static previews do not have a refresh function; keep the bundled digest.
    }
  }
  return null;
}

function todayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parisTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isAfterParisRefreshWindow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(value.hour) >= 8;
}

function markDigestStale(data) {
  return {
    ...data,
    is_stale: data?.report_date !== parisTodayIsoDate(),
    refresh_log: {
      ...(data?.refresh_log || {}),
      refresh_status: data?.refresh_log?.refresh_status || "latest_available_static",
      last_refresh_attempt_at: new Date().toISOString()
    }
  };
}

function renderScaffold() {
  const data = state.data;
  const focus = data.focus_profile || {};

  const datePrefix = data.is_stale ? t("latestAvailableBriefing") : t("dailyTitle");
  els.reportDate.textContent = `${datePrefix}: ${data.report_date || "-"} · ${data.mode || "-"}`;
  const localizedFocus = localizedDailyFocus(data.report_date, focus);
  if (els.dailyThemeLabel) els.dailyThemeLabel.textContent = localizedFocus.theme;
  if (els.learningGoal) els.learningGoal.textContent = localizedFocus.goal;
  if (els.taskList) els.taskList.innerHTML = localizedFocus.tasks.map(task => `<li>${escapeHtml(task)}</li>`).join("");
  renderPersonalizedConceptCards();
  if (els.languageSourceNotice) {
    els.languageSourceNotice.hidden = true;
    els.languageSourceNotice.textContent = "";
  }
  updateFreshnessLabels();

  renderSectionNav();
  renderFilters();
  updatePageHeader();
}

function currentPersonalizedDailyConcepts() {
  const topicIds = (state.knowledgePlan.tracks?.length ? state.knowledgePlan.tracks : defaultKnowledgePlan.tracks).slice(0, 2);
  return topicIds
    .map(topicId => ({ topicId, concept: personalizedDailyConceptForTopic(topicId) }))
    .filter(item => item.concept);
}

function renderPersonalizedConceptCards() {
  if (!els.conceptGrid) return;
  const concepts = currentPersonalizedDailyConcepts();
  const cards = concepts.length
    ? concepts
    : [{ topicId: "Fundamentals", concept: localizedDailyConcept(state.data?.daily_concept || {}) }];
  els.conceptGrid.innerHTML = cards.map(({ topicId, concept }, index) => `
    <section class="concept-card" id="${index === 0 ? "dailyConceptBlock" : escapeHtml(`dailyConceptBlock-${index + 1}`)}">
      <div class="card-meta">
        <span class="chip">${escapeHtml(t("dailyConcept"))}</span>
        <span class="chip">${escapeHtml(learningTopicLabel(topicId))}</span>
        <span class="growth-stage-pill">${escapeHtml(t("growthStage"))}: ${escapeHtml(t("growthSeed"))}</span>
        <span class="chip">${escapeHtml(t("estimated"))}: 8 ${escapeHtml(t("minutesShort"))}</span>
      </div>
      <h4>${escapeHtml(concept.term || "-")}</h4>
      <p>${escapeHtml(concept.definition || "-")}</p>
      ${concept.example ? `<p class="concept-example">${escapeHtml(concept.example)}</p>` : ""}
      ${concept.exercise ? `<p class="prompt">${escapeHtml(concept.exercise)}</p>` : ""}
      <div class="concept-card-actions">
        ${concept.openUrl ? `<a class="concept-source-link" href="${escapeHtml(concept.openUrl)}">${escapeHtml(t("startLearningItem"))} →</a>` : ""}
        ${concept.sourceUrl ? `<a class="concept-source-link" href="${escapeHtml(concept.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(t("sourceWebsite"))} →</a>` : ""}
      </div>
    </section>
  `).join("");
}

function personalizedConceptExample(concept, topicId) {
  const topic = learningTopicLabel(topicId);
  if (state.language === "zh") {
    return `通俗理解：这是你当前学习主题「${topic}」下的今日概念。先用一句话解释 ${concept.term}，再把它连接到一个保险现金流、假设或风险管理场景。`;
  }
  if (state.language === "fr") {
    return `Exemple simple : ce concept vient de votre thème « ${topic} ». Expliquez ${concept.term} en une phrase, puis reliez-le à un flux d’assurance, une hypothèse ou une décision de gestion des risques.`;
  }
  return `Plain example: this concept comes from your selected topic, ${topic}. Explain ${concept.term} in one sentence, then connect it to an insurance cash flow, assumption or risk-management decision.`;
}

function renderSectionNav() {
  const sections = new Set(languageMatchedItems(state.items).map(item => normalizeSection(item.platform_section)));
  if (state.companyReports.length) sections.add("company_results_strategy");
  const visibleSections = sectionOrder.filter(section => sections.has(section));
  if (state.activeSection !== "全部" && !visibleSections.includes(normalizeSection(state.activeSection))) {
    state.activeSection = "全部";
  }
  syncDailyNavExpanded();
  const allCount = languageMatchedItems(state.items).length + state.companyReports.length;
  const counts = visibleSections.reduce((acc, section) => {
    acc[section] = sectionItems(section).length;
    return acc;
  }, {});
  const allActive = state.activeSection === "全部" ? " active" : "";
  const allIcon = navIcon("brief");
  const allButton = `<button class="section-nav-button${allActive}" type="button" data-section="全部"><span><span class="nav-icon">${allIcon}</span>${escapeHtml(t("navAllBriefings"))}</span><strong>${escapeHtml(String(allCount))}</strong></button>`;
  const sectionButtons = visibleSections.map(section => {
    const active = section === state.activeSection ? " active" : "";
    const label = displaySection(section);
    const icon = navIcon(sectionLabels[section]?.icon || "brief");
    return `<button class="section-nav-button${active}" type="button" data-section="${escapeHtml(section)}"><span><span class="nav-icon">${icon}</span>${escapeHtml(label)}</span><strong>${escapeHtml(String(counts[section] || 0))}</strong></button>`;
  }).join("");
  els.sectionNav.innerHTML = allButton + sectionButtons;

  els.sectionNav.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      state.activeSection = button.dataset.section;
      state.dailyNavExpanded = false;
      setActivePage("daily");
      renderSectionNav();
      updateSectionFilters();
      syncBodyState();
      render();
    });
  });
}

function sectionItems(section) {
  const normalized = normalizeSection(section);
  if (normalized === "company_results_strategy") return state.companyReports;
  return languageMatchedItems(state.items).filter(item => normalizeSection(item.platform_section) === normalized);
}

function normalizeSection(section) {
  return legacySectionMap[section] || section || "market";
}

function buildCompanyReportItems(reports) {
  return reports.map(report => {
    const company = report.company || "Company";
    const region = report.region || "全球";
    return {
      title: report.title || `${company} official financial reports`,
      source: `${company} official investor relations`,
      url: report.url,
      published: state.data?.report_date || "",
      summary: `官方公司财报资料库：${company} 年报、业绩公告、投资者演示、战略更新和资本信息。`,
      region,
      source_type: "Official company website",
      platform_section: "company_results_strategy",
      taxonomy_category: "company_results_strategy",
      taxonomy_tags: ["investment", "ifrs17", "risk_management"],
      original_title: report.title || `${company} official financial reports`,
      original_language: "EN",
      localized_title: {
        en: `${company} official results and strategy library`,
        zh: `${company} 官方财报与战略资料库`,
        fr: `${company} - bibliothèque officielle résultats et stratégie`
      },
      ai_summary: {
        en: `Official investor relations source for ${company}: annual reports, financial results, investor presentations, strategy updates and capital information.`,
        zh: `官方公司财报资料库：${company} 年报、业绩公告、投资者演示、战略更新和资本信息。`,
        fr: `Source officielle relations investisseurs pour ${company} : rapports annuels, résultats, présentations investisseurs, stratégie et capital.`
      },
      why_it_matters: {
        en: "Company reports are the primary source for understanding earnings quality, underwriting performance, capital strength and strategic direction.",
        zh: "公司官网财报是理解利润质量、承保表现、资本实力和战略方向的第一来源。",
        fr: "Les rapports officiels permettent d'analyser la qualité du résultat, la performance technique, le capital et l'orientation stratégique."
      },
      category: "公司财报资料库",
      line_of_business: "综合/集团战略",
      branch: "保险公司",
      industry_category: "保险本业",
      risk_level: "资料库",
      score: 0,
      actuarial_angle: `从精算视角跟踪 ${company} 的利润来源、综合成本率、资本充足性、现金流、增长战略和风险偏好变化。`,
      actions: [
        "打开公司官网投资者关系页面，优先阅读最新年报、业绩公告和投资者演示。",
        "记录保费增长、承保利润、准备金、资本、偿付能力和战略重点的变化。",
        "比较同业公司指标，写出一条对定价、准备金、资本或 ALM 的影响。"
      ],
      learning_prompt: "用公司官网财报验证一个精算假设如何影响利润、资本和管理层战略。",
      shareable: `${company} official investor relations: ${report.url}`
    };
  }).filter(item => item.url);
}

function renderFilters() {
  fillTaxonomySelect(els.lobFilter, "insuranceLine");
  fillTaxonomySelect(els.topicFilter, "topic");
  fillTaxonomySelect(els.industryFilter, "industry");
  fillTaxonomySelect(els.branchFilter, "organizationType");
  fillSelect(els.companyFilter, "全部公司", fixedCompanyFilters.filter(value => value !== "全部公司"));
  setSelectValue(els.lobFilter, state.filters.lob, "all");
  setSelectValue(els.topicFilter, state.filters.topic, "all");
  setSelectValue(els.industryFilter, state.filters.industry, "all");
  setSelectValue(els.branchFilter, state.filters.branch, "all");
  setSelectValue(els.companyFilter, state.filters.company, "全部公司");
  updateSectionFilters();
}

function fillTaxonomySelect(select, groupName) {
  if (!select) return;
  const group = taxonomyGroup(groupName);
  select.innerHTML = [
    `<option value="all">${escapeHtml(taxonomyLabel(groupName, "all"))}</option>`,
    ...(group.options || []).map(option => `<option value="${escapeHtml(option.key)}">${escapeHtml(taxonomyLabel(groupName, option.key))}</option>`)
  ].join("");
}

function fillSelect(select, allLabel, values) {
  select.innerHTML = [allLabel, ...values]
    .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(displayValue(value))}</option>`)
    .join("");
}

function setSelectValue(select, value, fallback) {
  if (!select) return;
  const exists = [...select.options].some(option => option.value === value);
  select.value = exists ? value : fallback;
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : state.language;
  document.title = t("documentTitle");
  document.querySelectorAll("[data-i18n]").forEach(node => {
    const key = node.dataset.i18n;
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(node => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(node => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
}

function updatePageHeader() {
  if (!els.pageTitle || !els.pageSubtitle) return;
  if (state.activePage === "home") {
    els.pageTitle.textContent = "ActuaryRadar";
    els.pageSubtitle.textContent = "Insurance Intelligence for Actuaries & Insurance Professionals";
    return;
  }
  if (state.activePage === "daily") {
    const dailyLabel = state.data?.is_stale ? t("latestAvailableBriefing") : t("dailyTitle");
    els.pageTitle.textContent = state.activeSection === "全部" ? dailyLabel : displaySection(state.activeSection);
    els.pageSubtitle.textContent = state.activeSection === "全部" ? t("pageDailySubtitle") : `${dailyLabel} · ${displaySection(state.activeSection)}`;
    return;
  }
  if (state.activePage === "knowledge") {
    els.pageTitle.textContent = t("knowledgeTitle");
    els.pageSubtitle.textContent = t("pageKnowledgeSubtitle");
    return;
  }
  els.pageTitle.textContent = t("savedTitle");
  els.pageSubtitle.textContent = t("pageSavedSubtitle");
}

function updateFreshnessLabels() {
  const briefingLabel = state.data?.is_stale ? t("latestAvailableBriefing") : t("browseBriefing");
  document.querySelectorAll('[data-i18n="browseBriefing"]').forEach(node => {
    node.textContent = briefingLabel;
  });
}

function updateSectionFilters() {
  const companyMode = normalizeSection(state.activeSection) === "company_results_strategy";
  const sectionMode = state.activeSection !== "全部";
  [els.periodFilter, els.lobFilter, els.industryFilter, els.branchFilter].forEach(select => {
    if (select) select.hidden = companyMode;
  });
  if (els.topicFilter) els.topicFilter.hidden = companyMode || sectionMode;
  if (els.companyFilter) els.companyFilter.hidden = !companyMode;
  if (sectionMode) state.filters.topic = "all";
  if (els.activeTopicChip) {
    const showChip = sectionMode && !companyMode;
    els.activeTopicChip.hidden = !showChip;
    els.activeTopicChip.textContent = showChip ? `${t("activeTopicLabel")}: ${displaySection(state.activeSection)} ×` : "";
  }
}

function localizedDailyFocus(reportDate, focus) {
  if (state.language === "zh") {
    return {
      theme: focus.theme || t("dailyTitle"),
      goal: focus.learning_goal || "-",
      tasks: focus.tasks || []
    };
  }
  const translated = focusTranslation(focus.weekday, state.language);
  if (translated) return translated;
  return {
    theme: t("dailyTitle"),
    goal: state.language === "fr" ? t("chineseOnlyTasks") : t("chineseOnlyTasks"),
    tasks: []
  };
}

function focusTranslation(weekday, language) {
  const key = String(weekday || "").toLowerCase();
  const plans = {
    monday: {
      en: {
        theme: "Monday: Life Insurance and Annuities",
        goal: "Focus on interest rates, guarantees, lapse behaviour, new business value, long-duration liabilities and life insurer strategy.",
        tasks: [
          "Review one life insurance item and explain its impact on interest-rate assumptions, lapse rates or new business value.",
          "Break down one life product’s profit sources: investment spread, mortality, expenses and lapse experience.",
          "Record one strategic move by a life insurer worth monitoring."
        ]
      },
      fr: {
        theme: "Lundi : assurance vie et rentes",
        goal: "Suivre les taux, garanties, comportements de rachat, valeur des affaires nouvelles, passifs longs et stratégie des assureurs vie.",
        tasks: [
          "Analysez une actualité vie et son effet sur les hypothèses de taux, rachats ou valeur des affaires nouvelles.",
          "Décomposez les sources de résultat d’un produit vie : marge financière, mortalité, frais et rachats.",
          "Notez une décision stratégique d’un assureur vie à suivre."
        ]
      }
    },
    tuesday: {
      en: {
        theme: "Tuesday: Health Insurance and Medical Trends",
        goal: "Track loss ratios, medical inflation, utilization, renewals, cost control and health services.",
        tasks: [
          "Decompose one health insurance item into frequency, severity, benefit mix and renewal behaviour.",
          "Design a 5% / 10% loss-ratio sensitivity test.",
          "Record one health management or healthcare partnership case."
        ]
      },
      fr: {
        theme: "Mardi : santé, prévoyance et tendances médicales",
        goal: "Suivre la sinistralité, l’inflation médicale, les comportements de soins, le renouvellement, la maîtrise des coûts et les services de santé.",
        tasks: [
          "Décomposez une actualité santé en fréquence, coût moyen, mix de garanties et renouvellement.",
          "Construisez un test de sensibilité avec une hausse du ratio de sinistralité de 5 % et 10 %.",
          "Notez un cas de gestion santé ou de partenariat avec un acteur médical."
        ]
      }
    },
    wednesday: {
      en: {
        theme: "Wednesday: P&C, Motor and Catastrophe Risk",
        goal: "Focus on motor pricing, catastrophe risk, liability, expense ratios, loss ratios and external ecosystem data.",
        tasks: [
          "Choose one P&C or motor item and identify variables that affect claim frequency or severity.",
          "Write a segmentation idea for catastrophe risk or electric-vehicle motor insurance.",
          "Record one data source useful for pricing or fraud detection."
        ]
      },
      fr: {
        theme: "Mercredi : dommages, auto et risque catastrophe",
        goal: "Suivre la tarification auto, le risque catastrophe, la responsabilité civile, les frais, la sinistralité et les données externes.",
        tasks: [
          "Choisissez une actualité dommages ou auto et identifiez les variables influençant fréquence ou coût moyen.",
          "Formulez une piste de segmentation pour le risque catastrophe ou l’assurance auto des véhicules électriques.",
          "Notez une source de données utile pour la tarification ou la détection de fraude."
        ]
      }
    },
    thursday: {
      en: {
        theme: "Thursday: Reinsurance, Brokerage and Risk Transfer",
        goal: "Focus on reinsurance structures, brokers, risk transfer, capital relief and tail risk.",
        tasks: [
          "Map the relationship between insurer, reinsurer, broker and capital markets for one item.",
          "Compare proportional and excess-of-loss reinsurance effects on earnings volatility and capital.",
          "Record one signal about brokerage or reinsurance market pricing."
        ]
      },
      fr: {
        theme: "Jeudi : réassurance, courtage et transfert de risque",
        goal: "Suivre les structures de réassurance, le courtage, le transfert de risque, l’allègement du capital et le risque extrême.",
        tasks: [
          "Cartographiez les relations entre assureur, réassureur, courtier et marchés de capitaux.",
          "Comparez l’effet de la réassurance proportionnelle et non proportionnelle sur la volatilité du résultat et le capital.",
          "Notez un signal de marché sur le courtage ou le prix de la réassurance."
        ]
      }
    },
    friday: {
      en: {
        theme: "Friday: IFRS 17, Results and Capital Management",
        goal: "Focus on CSM, EV/NBV, capital actions, solvency, profit bridges and management strategy.",
        tasks: [
          "Choose one company and link earnings, CSM and capital actions.",
          "Record what a capital raise or dividend policy change means for growth capacity.",
          "Review one IFRS 17 concept and rewrite it in your own words."
        ]
      },
      fr: {
        theme: "Vendredi : IFRS 17, résultats et gestion du capital",
        goal: "Suivre la CSM, l’EV/NBV, les opérations de capital, la solvabilité, les ponts de résultat et le discours stratégique.",
        tasks: [
          "Choisissez une société et reliez résultat, CSM et décisions de capital.",
          "Notez ce qu’une opération de capital ou un changement de dividende implique pour la croissance.",
          "Révisez un concept IFRS 17 et reformulez-le avec vos mots."
        ]
      }
    },
    saturday: {
      en: {
        theme: "Saturday: InsurTech and Cross-sector Partnerships",
        goal: "Track AI, data, cyber, banks, capital markets, automotive, energy, healthcare and technology implementation.",
        tasks: [
          "Classify one technology case as proof of concept, pilot, scale-up or regulatory constraint.",
          "Draw a risk transmission chain between insurance and another sector.",
          "Record one actuarial or risk-management use case that could be implemented."
        ]
      },
      fr: {
        theme: "Samedi : InsurTech et partenariats intersectoriels",
        goal: "Suivre l’IA, les données, le cyber, la banque, les marchés financiers, l’automobile, l’énergie, la santé et les cas d’usage.",
        tasks: [
          "Classez un cas technologique : preuve de concept, pilote, passage à l’échelle ou contrainte réglementaire.",
          "Dessinez une chaîne de transmission du risque entre l’assurance et un autre secteur.",
          "Notez un cas d’usage actuariel ou de gestion des risques pouvant être mis en œuvre."
        ]
      }
    },
    sunday: {
      en: {
        theme: "Sunday: Research, Strategy Review and Next-week Planning",
        goal: "Review the week’s high-value intelligence and turn it into research themes, methods and next actions.",
        tasks: [
          "Select one report or long-form article and extract three reusable conclusions.",
          "Review one company, one regulatory point and one technology trend to monitor.",
          "Define one 30-minute learning task for next week."
        ]
      },
      fr: {
        theme: "Dimanche : recherche, revue stratégique et préparation de la semaine",
        goal: "Synthétiser les informations importantes de la semaine en thèmes de recherche, méthodes et actions.",
        tasks: [
          "Choisissez un rapport ou article de fond et tirez-en trois conclusions réutilisables.",
          "Revenez sur une société, un point réglementaire et une tendance technologique à suivre.",
          "Définissez une tâche de formation de 30 minutes pour la semaine suivante."
        ]
      }
    }
  };
  return plans[key]?.[language] || null;
}

function localizedDailyConcept(concept) {
  const rawTerm = concept.term || "";
  const source = sourceForDailyConcept(rawTerm);
  const translated = conceptTranslation(rawTerm);
  if (state.language === "zh") {
    return {
      term: concept.term || "-",
      definition: concept.definition || "-",
      example: `通俗理解：把这个概念想成精算模型里的一个“解释按钮”。例如看到 ${concept.term || "某个指标"} 变化，不要只记定义，要问：它会改变频率、严重度、退保率、现金流时点、利润确认，还是资本要求？然后用一个真实组合做小例子验证。`,
      exercise: concept.exercise || "-",
      sourceUrl: source.url || "",
      sourceLabel: dailyConceptSourceLabel(source)
    };
  }
  if (state.language === "fr") {
    if (!translated.frTerm || !translated.frDefinition) {
      return unavailableDailyConcept(source);
    }
    const term = translated.frTerm;
    return {
      term,
      definition: translated.frDefinition,
      example: translated.frExample || "",
      exercise: translated.frExercise || "",
      sourceUrl: source.url || "",
      sourceLabel: dailyConceptSourceLabel(source)
    };
  }
  if (!translated.enTerm || !translated.enDefinition) {
    return unavailableDailyConcept(source);
  }
  const term = translated.enTerm;
  return {
    term,
    definition: translated.enDefinition,
    example: translated.enExample || "",
    exercise: translated.enExercise || "",
    sourceUrl: source.url || "",
    sourceLabel: dailyConceptSourceLabel(source)
  };
}

function unavailableDailyConcept(source) {
  return {
    term: t("dailyConcept"),
    definition: t("chineseOnlyConcept"),
    example: "",
    exercise: "",
    sourceUrl: source.url || "",
    sourceLabel: dailyConceptSourceLabel(source)
  };
}

function dailyConceptSourceLabel(source) {
  if (!source?.url) return "";
  return source.group ? `${source.title} · ${sourceGroupLabel(source.group)}` : source.title;
}

function sourceForDailyConcept(term) {
  const normalized = String(term || "").toLowerCase();
  const match = (state.knowledgeSources.daily_concepts || []).find(entry => {
    return (entry.matches || []).some(keyword => normalized.includes(String(keyword).toLowerCase()));
  });
  if (!match?.knowledge_id) return {};
  return firstCuratedSourceForKnowledgeId(match.knowledge_id) || {};
}

function conceptTranslation(term) {
  const normalized = String(term || "").toLowerCase();
  if (normalized.includes("loss ratio") || normalized.includes("赔付率")) {
    return {
      enTerm: "Loss Ratio",
      frTerm: "Ratio de sinistralité",
      enDefinition: "Loss Ratio compares claims and claims handling costs with earned premium. It is a core underwriting metric for health, motor and P&C portfolios.",
      frDefinition: "Le ratio de sinistralité compare les sinistres et frais de gestion des sinistres aux primes acquises. C’est un indicateur technique central en santé, auto et dommages.",
      enExample: "Plain example: if earned premium is 100 and incurred claims plus claims expenses are 72, the loss ratio is 72%. A rise can come from higher frequency, higher severity, claim inflation, mix change or weaker underwriting.",
      frExample: "Exemple simple : si les primes acquises valent 100 et les sinistres chargés avec frais valent 72, le ratio de sinistralité est 72 %. Une hausse peut venir de la fréquence, du coût moyen, de l’inflation sinistres, du mix ou de la sélection.",
      enExercise: "Exercise: split a health or motor loss ratio movement into frequency, severity, benefit mix, pricing adequacy and channel quality.",
      frExercise: "Exercice : décomposez l’évolution du ratio de sinistralité en fréquence, coût moyen, mix de garanties, adéquation tarifaire et qualité du canal."
    };
  }
  if (normalized.includes("risk margin") || normalized.includes("风险边际")) {
    return {
      enTerm: "Risk Margin",
      frTerm: "Marge de risque",
      enDefinition: "Risk Margin is the additional amount above best estimate liabilities that compensates a market participant for taking over non-hedgeable insurance obligations, notably under Solvency II.",
      frDefinition: "La marge de risque est le montant ajouté à la meilleure estimation pour rémunérer un acteur de marché qui reprendrait des engagements d’assurance non couvrables, notamment sous Solvabilité II.",
      enExample: "Plain example: a long-duration annuity book often has a higher Risk Margin because mortality, longevity and expense risks run for many years and require capital over a long horizon.",
      frExample: "Exemple simple : un portefeuille de rentes longues peut avoir une marge de risque élevée car les risques de longévité, de frais et de mortalité consomment du capital pendant longtemps.",
      enExercise: "Exercise: compare a short-tail motor portfolio with a long-duration annuity portfolio and explain which one is more sensitive to the cost-of-capital rate and why.",
      frExercise: "Exercice : comparez un portefeuille auto court avec un portefeuille de rentes longues et expliquez lequel est le plus sensible au taux de coût du capital."
    };
  }
  if (normalized.includes("scr") || normalized.includes("solvency capital") || normalized.includes("偿付能力资本")) {
    return {
      enTerm: "Solvency Capital Requirement (SCR)",
      frTerm: "Capital de solvabilité requis (SCR)",
      enDefinition: "SCR is the capital level intended to ensure that an insurer can absorb significant adverse events over a one-year horizon at a high confidence level under Solvency II.",
      frDefinition: "Le SCR est le niveau de capital visant à permettre à un assureur d’absorber des chocs importants sur un horizon d’un an avec un niveau de confiance élevé sous Solvabilité II."
    };
  }
  if (normalized.includes("combined ratio") || normalized.includes("综合成本率")) {
    return {
      enTerm: "Combined Ratio",
      frTerm: "Ratio combiné",
      enDefinition: "Combined Ratio measures underwriting performance in P&C insurance by adding the loss ratio and expense ratio.",
      frDefinition: "Le ratio combiné mesure la performance technique en assurance dommages en additionnant le ratio de sinistralité et le ratio de frais."
    };
  }
  if (normalized.includes("csm") || normalized.includes("contractual service margin") || normalized.includes("合同服务边际")) {
    return {
      enTerm: "Contractual Service Margin (CSM)",
      frTerm: "Marge sur services contractuels (CSM)",
      enDefinition: "CSM represents the unearned profit of a group of insurance contracts under IFRS 17 and is released as insurance services are provided.",
      frDefinition: "La CSM représente le profit non acquis d’un groupe de contrats d’assurance sous IFRS 17 et se libère au rythme des services fournis.",
      enExample: "Plain example: new profitable business increases CSM, while services provided during the period release part of CSM into insurance revenue.",
      frExample: "Exemple simple : les affaires nouvelles profitables augmentent la CSM, tandis que les services rendus sur la période en libèrent une partie en résultat.",
      enExercise: "Exercise: choose an insurer and explain whether a CSM movement comes from new business, experience variance, assumption changes or release.",
      frExercise: "Exercice : choisissez un assureur et expliquez si la variation de CSM vient des affaires nouvelles, de l’expérience, des changements d’hypothèses ou de la libération."
    };
  }
  if (normalized.includes("glm") || normalized.includes("generalized linear")) {
    return {
      enTerm: "Generalized Linear Model (GLM)",
      frTerm: "Modèle linéaire généralisé (GLM)",
      enDefinition: "A GLM is a modelling framework widely used in pricing to relate expected claims frequency or severity to rating variables through a link function.",
      frDefinition: "Un GLM est un cadre de modélisation utilisé en tarification pour relier la fréquence ou le coût moyen attendus aux variables tarifaires via une fonction de lien."
    };
  }
  if (normalized.includes("alm") || normalized.includes("asset liability") || normalized.includes("资产负债久期匹配") || normalized.includes("久期匹配")) {
    return {
      enTerm: "Asset-Liability Duration Matching",
      frTerm: "Adossement de duration actif-passif",
      enDefinition: "Asset-liability duration matching aligns the interest-rate sensitivity and cash-flow timing of assets and insurance liabilities to limit economic value volatility.",
      frDefinition: "L’adossement de duration actif-passif aligne la sensibilité aux taux et l’échéancier des flux entre actifs et passifs d’assurance afin de limiter la volatilité de valeur économique.",
      enExample: "Plain example: if liabilities have a longer duration than assets, a fall in interest rates can increase liabilities more than assets, weakening economic surplus.",
      frExample: "Exemple simple : si les passifs ont une duration plus longue que les actifs, une baisse des taux peut augmenter davantage les passifs que les actifs et réduire le surplus économique.",
      enExercise: "Exercise: explain the asset-side and liability-side impact of a 50 bp rate decline for a life product with guaranteed rates.",
      frExercise: "Exercice : expliquez l’effet d’une baisse de taux de 50 pb sur l’actif et le passif d’un produit vie à taux garanti."
    };
  }
  if (normalized.includes("xl") || normalized.includes("巨灾超赔") || normalized.includes("excess of loss")) {
    return {
      enTerm: "Catastrophe Excess-of-Loss Reinsurance",
      frTerm: "Réassurance catastrophe en excédent de sinistre",
      enDefinition: "Catastrophe excess-of-loss reinsurance covers losses above the insurer’s retention up to a defined limit, reducing tail risk from severe events.",
      frDefinition: "La réassurance catastrophe en excédent de sinistre couvre les pertes au-delà de la rétention de l’assureur, dans la limite prévue, et réduit le risque extrême.",
      enExample: "Plain example: with a 50m retention and a 150m limit, a 120m catastrophe loss leaves 50m retained and 70m recovered from reinsurers.",
      frExample: "Exemple simple : avec une rétention de 50 M et une limite de 150 M, une perte catastrophe de 120 M laisse 50 M à charge et 70 M récupérés auprès des réassureurs.",
      enExercise: "Exercise: sketch how retention, limit and reinstatement premium affect net loss under a 1-in-100 catastrophe scenario.",
      frExercise: "Exercice : schématisez l’effet de la rétention, de la limite et de la prime de reconstitution sur la perte nette dans un scénario 1-sur-100."
    };
  }
  return {};
}

function classifyRegion(item) {
  const text = [item.region, item.title, item.summary, item.source, item.category].join(" ").toLowerCase();
  if (text.includes("global") || text.includes("全球") || text.includes("world")) return "全球";
  if (text.includes("uk") || text.includes("united kingdom") || text.includes("britain") || text.includes("英国")) return "英国";
  if (text.includes("germany") || text.includes("german") || text.includes("deutsch") || text.includes("德国")) return "德国";
  if (text.includes("france") || text.includes("french") || text.includes("法国")) return "法国";
  if (text.includes("china") || text.includes("chinese") || text.includes("中国") || text.includes("北京") || text.includes("上海")) return "中国";
  if (text.includes("us") || text.includes("usa") || text.includes("u.s.") || text.includes("america") || text.includes("美国")) return "美国";
  if (item.region === "欧洲") return "其他国家";
  return item.region || "其他国家";
}

function classifyLob(item) {
  return classifyFromTaxonomy("insuranceLine", item, "property_casualty");
}

function classifyTopic(item) {
  return classifyFromTaxonomy("topic", item, "market");
}

function classifyIndustry(item) {
  return classifyFromTaxonomy("industry", item, "insurance");
}

function classifyBranch(item) {
  return classifyFromTaxonomy("organizationType", item, "other");
}

function itemTaxonomyText(item) {
  return [
    item.title,
    item.original_title,
    item.summary,
    item.source,
    item.category,
    item.platform_section,
    item.line_of_business,
    item.industry_category,
    item.branch,
    item.actuarial_angle,
    item.learning_prompt,
    ...(item.taxonomy_tags || [])
  ].join(" ").toLowerCase();
}

function taxonomyOptionMatches(option, item) {
  const tags = new Set((item.taxonomy_tags || []).map(tag => String(tag).toLowerCase()));
  const aliases = [option.key, ...(option.aliases || [])].map(alias => String(alias).toLowerCase());
  if (aliases.some(alias => tags.has(alias))) return true;
  const text = itemTaxonomyText(item);
  return (option.keywords || []).some(keyword => text.includes(String(keyword).toLowerCase()));
}

function classifyFromTaxonomy(groupName, item, fallbackKey) {
  const group = taxonomyGroup(groupName);
  const matched = (group.options || []).find(option => taxonomyOptionMatches(option, item));
  return matched?.key || fallbackKey;
}

function classifyCompany(item) {
  const text = [item.title, item.summary, item.source, item.category, item.branch].join(" ").toLowerCase();
  const company = fixedCompanyFilters.find(name => name !== "全部公司" && text.includes(name.toLowerCase()));
  return company || "";
}

function containsCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function normalizeComparableText(value) {
  return String(value || "").toLowerCase().replace(/[\W_]+/g, "");
}

function isTitleLikeText(value, item) {
  const text = normalizeComparableText(value);
  const title = normalizeComparableText(localizedItemTitle(item));
  if (!text || !title) return false;
  return text === title || (text.length < 260 && (text.includes(title) || title.includes(text)));
}

function localizedItemTitle(item) {
  return item.original_title || item.title || t("untitledTheme");
}

function cleanIntelligenceText(text, item) {
  const blockedPatterns = [
    /google news/i,
    /source via/i,
    /source relay/i,
    /source summary/i,
    /comes from/i,
    /provient de/i,
    /rel[eè]ve de/i,
    /this information/i,
    /this item falls under/i,
    /original source/i,
    /summary based on rss/i,
    /来源/,
    /分类/,
    /来自/,
    /原文要点显示/
  ];
  return splitReadableSentences(sanitizeGoogleNewsText(text, item))
    .filter(sentence => !blockedPatterns.some(pattern => pattern.test(sentence)))
    .filter(sentence => !isTitleLikeText(sentence, item))
    .join(" ");
}

function localizedItemSummary(item) {
  if (itemLanguage(item) !== state.language) return "";
  if (!item.ai_enriched) return "";
  if (item.summary_basis === "title_only" || item.summary_basis === "paywalled_or_blocked") return "";
  const raw = item.ai_summary?.[state.language] || (item.summary_basis === "rss_excerpt" ? item.summary : "");
  const clean = cleanIntelligenceText(raw, item);
  return isTitleLikeText(clean, item) ? "" : clean;
}

function localizedWhyItMatters(item) {
  if (itemLanguage(item) !== state.language) return "";
  if (!item.ai_enriched) return "";
  return item.why_it_matters?.[state.language] || "";
}

function splitReadableSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|[；;]\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

function conciseText(text, maxLength = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function cardKeyTakeaway(item) {
  const grounded = item.ai_enriched ? cleanIntelligenceText(item.key_takeaway?.[state.language] || "", item) : "";
  if (grounded && !isTitleLikeText(grounded, item)) return conciseText(grounded, 260);
  const summary = item.ai_enriched ? localizedItemSummary(item) : cleanIntelligenceText(item.summary || item.rss_description || "", item);
  const firstSentence = splitReadableSentences(summary)[0];
  const takeaway = firstSentence || summary;
  return isTitleLikeText(takeaway, item) ? "" : conciseText(takeaway, 260);
}

function summaryBullets(item) {
  const sentences = splitReadableSentences(localizedItemSummary(item));
  const takeaway = cardKeyTakeaway(item);
  return sentences
    .filter(sentence => !takeaway || normalizeComparableText(sentence) !== normalizeComparableText(takeaway))
    .slice(0, 3)
    .map(sentence => conciseText(sentence, 180));
}

function heroHighlightSummary(item) {
  const why = localizedWhyItMatters(item);
  if (why) return conciseText(why, 220);
  return conciseText(cardKeyTakeaway(item) || localizedItemSummary(item) || localizedItemTitle(item), 220);
}

function summaryNotice(item) {
  if (item.summary_basis === "rss_excerpt") return t("rssExcerptOnly");
  return "";
}

function editorialTeaser(item) {
  return conciseText(cardKeyTakeaway(item) || localizedItemSummary(item) || localizedWhyItMatters(item) || localizedItemTitle(item), 180);
}

function semanticCategoryClass(item) {
  const section = normalizeSection(item.taxonomy_category || item.platform_section);
  if (section === "regulation") return "chip-regulation";
  if (section === "research") return "chip-research";
  if (section === "company_results_strategy" || section === "market") return "chip-market";
  if (section === "technology_ai") return "chip-ai";
  if (section === "reinsurance") return "chip-reinsurance";
  return "chip-neutral";
}

function cardTagChips(item) {
  const tags = (item.taxonomy_tags || []).map(displayTaxonomyTag).filter(Boolean);
  const visible = tags.slice(0, 3).map(tag => ({ label: tag, className: "chip-tag" }));
  if (tags.length > 3) {
    visible.push({ label: `+${tags.length - 3} ${t("moreTags")}`, className: "chip-tag chip-more" });
  }
  return visible;
}

function chipHtml(label, className = "") {
  return `<span class="chip ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

function sanitizeGoogleNewsText(text, item) {
  let output = String(text || "");
  if (!output || !isUnresolvedGoogleNewsItem(item)) return output;
  const source = item.source || "";
  const displaySource = displayItemSource(item);
  if (source) output = output.split(source).join(displaySource);
  output = output.replace(/comes from [^.。]+Google News[^.。]*/gi, `comes from ${displaySource}`);
  output = output.replace(/provient de [^.。]+Google News[^.。]*/gi, `provient de ${displaySource}`);
  output = output.replace(/来源为\s*[^。]*Google News[^。]*/g, `来源为 ${displaySource}`);
  return output;
}

function normalizeLanguageCode(value) {
  const raw = String(value || "").toUpperCase();
  if (raw === "ZH" || raw === "ZH-CN" || raw === "CN") return "zh";
  if (raw === "FR") return "fr";
  return "en";
}

function displayOriginalLanguage(item) {
  return itemLanguage(item).toUpperCase();
}

function itemLanguage(item) {
  return normalizeLanguageCode(item.source_language || item.original_language);
}

function languageMatchedItems(items) {
  return items.filter(item => itemLanguage(item) === state.language);
}

function displayTaxonomyTag(tag) {
  return secondaryTaxonomyLabels[tag]?.[state.language] || tag;
}

function displayStandardCategory(item) {
  const section = displaySection(item.taxonomy_category || item.platform_section);
  const tags = (item.taxonomy_tags || []).map(displayTaxonomyTag).join(", ");
  return tags ? `${section} · ${tags}` : section;
}

function displayItemSource(item) {
  const source = item.source_name || inferPublisherFromTitle(item.original_title || item.title) || item.source;
  if (isUnresolvedGoogleNewsItem(item)) {
    const inferred = inferPublisherFromTitle(item.original_title || item.title);
    return inferred ? `${inferred} · ${t("sourceViaGoogleNews")}` : t("sourceViaGoogleNews");
  }
  return localizedSourceLabel(source);
}

function displayPrimarySource(item) {
  const source = item.source_name || inferPublisherFromTitle(item.original_title || item.title) || item.source;
  return localizedSourceLabel(source);
}

function localizedSourceLabel(source) {
  if (!source) return t("source");
  if (state.language === "zh" || !containsCjk(source)) return source;
  return state.language === "fr" ? "Source en chinois" : "Chinese-language source";
}

function originalArticleUrl(item) {
  return item.original_url || item.source_url || item.url || "#";
}

function isUnresolvedGoogleNewsItem(item) {
  const url = String(item.original_url || item.url || "").toLowerCase();
  const source = String(item.source || "").toLowerCase();
  return url.includes("news.google.com") || (!item.original_url && source.includes("google news"));
}

function inferPublisherFromTitle(title) {
  const clean = String(title || "").trim();
  const parts = clean.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function localizedActuarialAngle(item) {
  if (itemLanguage(item) !== state.language) return "";
  if (state.language === "zh") return item.actuarial_angle || "";
  return "";
}

function localizedActions(item) {
  if (itemLanguage(item) !== state.language) return [];
  if (state.language === "zh") return item.actions || [];
  return [];
}

function localizedLearningPrompt(item) {
  if (itemLanguage(item) !== state.language) return "";
  if (state.language === "zh") return item.learning_prompt || "";
  return "";
}

function render() {
  const filtered = getFilteredItems();
  renderPortal();
  renderMetrics(filtered);
  renderTopPicks(filtered);
  renderCards(filtered);
  renderBoard(filtered);
  renderSavedDigests();
  renderLearningPlan();
}

function renderPortal() {
  if (!els.portalLatestGrid) return;
  const homeLearningItems = renderHomeLearning();
  const sorted = languageMatchedItems(state.items).sort((a, b) => (b.score || 0) - (a.score || 0));
  const lead = sorted[0];
  if (lead) {
    els.portalLeadTitle.textContent = localizedItemTitle(lead);
    els.portalLeadSummary.textContent = "";
    els.portalLeadSummary.hidden = true;
    if (els.portalLeadLink) {
      els.portalLeadLink.href = originalArticleUrl(lead);
      els.portalLeadLink.hidden = originalArticleUrl(lead) === "#";
      els.portalLeadLink.onclick = () => {
        analyticsEvent("industry_insight_opened", {
          article_id: itemId(lead),
          article_title: localizedItemTitle(lead),
          source_name: displayPrimarySource(lead),
          topic: normalizeSection(lead.platform_section),
          source: "hero_highlight"
        });
      };
    }
  } else {
    els.portalLeadTitle.textContent = t("noItems");
    els.portalLeadSummary.textContent = "";
    els.portalLeadSummary.hidden = true;
    if (els.portalLeadLink) {
      els.portalLeadLink.hidden = true;
    }
  }
  const leadId = lead ? itemId(lead) : "";
  const homeNewsIds = new Set((homeLearningItems || [])
    .filter(item => item.type === "news" || item.type === "research")
    .map(item => String(item.id || "").replace(/^(news|research):/, "")));
  const latestItems = sorted
    .filter(item => itemId(item) !== leadId && !homeNewsIds.has(itemId(item)))
    .slice(0, 3);
  els.portalLatestGrid.innerHTML = latestItems.map(item => portalNewsCard(item)).join("");

  const topicDescriptions = {
    regulation: t("topicRegulationText"),
    market: t("topicMarketText"),
    reinsurance: t("topicReinsuranceText"),
    technology_ai: t("topicTechnologyText"),
    company_results_strategy: t("topicCompanyText"),
    research: t("topicResearchText"),
    career_learning: t("topicCareerText")
  };
  if (els.portalSectionGrid) {
    els.portalSectionGrid.innerHTML = sectionOrder.map(section => {
      const itemsForSection = sectionItems(section);
      return `
        <article class="portal-section-card">
          <div>
            <span>${escapeHtml(sectionLabels[section]?.symbol || "IH")}</span>
            <h4>${escapeHtml(displaySection(section))}</h4>
            <p>${escapeHtml(topicDescriptions[section] || "")}</p>
          </div>
          <button class="text-link" type="button" data-portal-section="${escapeHtml(section)}">${escapeHtml(t("open"))} (${itemsForSection.length})</button>
        </article>
      `;
    }).join("");
  }

  els.portalLatestGrid.querySelectorAll("[data-portal-url]").forEach(button => {
    button.addEventListener("click", () => {
      analyticsEvent("industry_insight_opened", {
        article_title: button.dataset.portalTitle || "",
        source: "latest_intelligence"
      });
      state.activeSection = "全部";
      state.dailyNavExpanded = false;
      setActivePage("daily");
      state.filters.search = button.dataset.portalTitle.toLowerCase();
      els.searchInput.value = state.filters.search;
      renderSectionNav();
      render();
    });
  });

  els.portalSectionGrid?.querySelectorAll("[data-portal-section]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeSection = button.dataset.portalSection;
      state.dailyNavExpanded = false;
      setActivePage("daily");
      renderSectionNav();
      render();
    });
  });
}

function renderHomeLearning() {
  if (!els.homeTodayLearningList) return [];
  const planItems = generateHomeTodaysLearningItems();
  const continueItems = generateContinueLearningItems();
  const completedItems = generateCompletedTodayLearningItems();
  const completedCount = planItems.filter(item => isLearningItemCompletedToday(item.id)).length;
  const todaysPlanComplete = planItems.length > 0 && completedCount >= planItems.length;
  const recommendedItems = todaysPlanComplete
    ? generateRecommendedLearningItems(planItems.map(item => item.id)).slice(0, 2)
    : [];
  const minutes = planItems.reduce((sum, item) => sum + Number(item.estimatedMinutes || 0), 0);
  const selectedTopics = state.knowledgePlan.tracks || [];
  const topicText = selectedTopics.slice(0, 3).map(learningTopicLabel).join(", ");
  if (els.homeLearningSummary) {
    els.homeLearningSummary.textContent = state.knowledgePlan.setupComplete
      ? `${minutes || state.knowledgePlan.studyTime || 15} ${t("minutesShort")} · ${planItems.length} ${t("contentItems")} · ${topicText || t("homeLearningSummaryReady")} · ${completedCount}/${planItems.length || 0} ${t("progressToday")}`
      : t("homeLearningSummarySetup");
  }
  if (els.openOnboardingButton) {
    els.openOnboardingButton.textContent = state.knowledgePlan.setupComplete
      ? t("editLearningPreferences")
      : t("buildJourneyArrow");
  }
  els.homeTodayLearningList.innerHTML = renderHomeLearningItemList(planItems.slice(0, 3), {
    emptyKey: state.knowledgePlan.setupComplete ? "noLearningPlanItems" : "setupLearningFirst",
    mode: "today",
    hideEmpty: false
  });
  if (els.homeContinueLearningCard && els.homeContinueLearningList) {
    els.homeContinueLearningCard.hidden = continueItems.length === 0;
    els.homeContinueLearningList.innerHTML = continueItems.length
      ? renderHomeLearningItemList(continueItems.slice(0, 2), { mode: "continue", hideEmpty: true })
      : "";
  }
  if (els.homeRecommendedLearningCard && els.homeRecommendedLearningList) {
    els.homeRecommendedLearningCard.hidden = recommendedItems.length === 0;
    els.homeRecommendedLearningList.innerHTML = recommendedItems.length
      ? renderHomeLearningItemList(recommendedItems, { mode: "recommended", hideEmpty: true })
      : "";
  }
  if (els.homeCompletedLearningCard && els.homeCompletedLearningList) {
    els.homeCompletedLearningCard.hidden = completedItems.length === 0;
    if (els.homeCompletedLearningTitle) {
      els.homeCompletedLearningTitle.textContent = `${t("completedToday")} · ${completedItems.length}`;
    }
    els.homeCompletedLearningList.innerHTML = completedItems.length
      ? renderCompletedLearningList(completedItems.slice(0, 4))
      : "";
  }
  if (els.homeLearningSide) {
    const showSide = continueItems.length > 0 || recommendedItems.length > 0 || completedItems.length > 0;
    els.homeLearningSide.hidden = !showSide;
    els.homeLearningSide.closest(".home-learning-grid")?.classList.toggle("single-column", !showSide);
  }
  return planItems;
}

function renderCompletedLearningList(items) {
  if (!items.length) return `<div class="empty-state">${escapeHtml(t("noCompletedToday"))}</div>`;
  return `
    <details class="completed-learning-details">
      <summary>${escapeHtml(t("completedLabel"))} · ${items.length}</summary>
      <div class="completed-learning-items">
        ${renderHomeLearningItemList(items, { mode: "completed", hideEmpty: true })}
      </div>
    </details>
  `;
}

function portalNewsCard(item) {
  return `
    <article class="portal-news-card">
      <div class="card-meta">
        <span class="chip ${escapeHtml(semanticCategoryClass(item))}">${escapeHtml(displaySection(item.platform_section))}</span>
        <span class="chip chip-source">${escapeHtml(displayPrimarySource(item))}</span>
      </div>
      <h4>${escapeHtml(localizedItemTitle(item))}</h4>
      <button class="text-link" type="button" data-portal-url="${escapeHtml(item.url)}" data-portal-title="${escapeHtml(localizedItemTitle(item))}">${escapeHtml(t("open"))}</button>
    </article>
  `;
}

function getFilteredItems() {
  const companyMode = normalizeSection(state.activeSection) === "company_results_strategy";
  const sectionMode = state.activeSection !== "全部";
  const sourceItems = companyMode ? state.companyReports : languageMatchedItems(state.items);
  return sourceItems.filter(item => {
    const text = [
      item.title,
      item.summary,
      item.source,
      item.category,
      item.platform_section,
      item.line_of_business,
      item.industry_category,
      item.branch,
      item.actuarial_angle,
      item.learning_prompt
    ].join(" ").toLowerCase();

    if (state.activeSection !== "全部" && normalizeSection(item.platform_section) !== normalizeSection(state.activeSection)) return false;
    if (!isWithinPeriod(item)) return false;
    if (!companyMode && state.filters.lob !== "all" && classifyLob(item) !== state.filters.lob) return false;
    if (!companyMode && !sectionMode && state.filters.topic !== "all" && classifyTopic(item) !== state.filters.topic) return false;
    if (!companyMode && state.filters.industry !== "all" && classifyIndustry(item) !== state.filters.industry) return false;
    if (!companyMode && state.filters.branch !== "all" && classifyBranch(item) !== state.filters.branch) return false;
    if (companyMode && state.filters.company !== "全部公司" && classifyCompany(item) !== state.filters.company) return false;
    if (state.filters.search && !text.includes(state.filters.search)) return false;
    if (state.filters.tag && !text.includes(state.filters.tag.toLowerCase())) return false;
    return true;
  });
}

function isWithinPeriod(item) {
  if (normalizeSection(state.activeSection) === "company_results_strategy") {
    if (!item.published || !state.data?.report_date) return true;
    const itemDate = new Date(`${item.published}T00:00:00`);
    const reportDate = new Date(`${state.data.report_date}T00:00:00`);
    if (Number.isNaN(itemDate.getTime()) || Number.isNaN(reportDate.getTime())) return true;
    const diffDays = (reportDate - itemDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 1095;
  }
  if (state.filters.period === "all") return true;
  if (!item.published || !state.data?.report_date) return true;
  const itemDate = new Date(`${item.published}T00:00:00`);
  const reportDate = new Date(`${state.data.report_date}T00:00:00`);
  if (Number.isNaN(itemDate.getTime()) || Number.isNaN(reportDate.getTime())) return true;
  const diffDays = (reportDate - itemDate) / (1000 * 60 * 60 * 24);
  return diffDays <= Number(state.filters.period);
}

function renderMetrics(items) {
  if (!els.metricGrid) return;
  const regions = new Set(items.map(item => item.region)).size;
  const sections = new Set(items.map(item => item.platform_section)).size;
  const regulatory = items.filter(isRegulatoryItem).length;
  const showRegulatoryMetric = state.activeSection === "全部" || normalizeSection(state.activeSection) === "regulation";

  const metrics = [
    [t("contentItems"), items.length],
    [t("topPicks"), getTopPickItems(items).length],
    [t("sectionCoverage"), sections || regions]
  ];
  if (showRegulatoryMetric) {
    metrics.splice(2, 0, [t("regulatoryAlert"), regulatory]);
  }

  els.metricGrid.innerHTML = metrics.map(([label, value]) => `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `).join("");
}

function renderTopPicks(items) {
  const picks = getTopPickItems(items);
  els.topPicks.innerHTML = picks.map((item, index) => `
    <button class="top-pick ${escapeHtml(semanticCategoryClass(item))}" type="button" data-url="${escapeHtml(originalArticleUrl(item))}">
      <span>${index + 1}</span>
      <em>${escapeHtml(displaySection(item.platform_section))}</em>
      <strong>${escapeHtml(localizedItemTitle(item))}</strong>
      <small>${escapeHtml(item.published || "")} · ${escapeHtml(displayValue(classifyLob(item)))}</small>
    </button>
  `).join("");
  els.topPicks.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      state.filters.search = "";
      els.searchInput.value = "";
      const card = [...document.querySelectorAll(".intelligence-card")].find(node => {
        const link = node.querySelector(".source-link");
        return link?.getAttribute("href") === button.dataset.url;
      });
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function getTopPickItems(items) {
  const sorted = [...items]
    .filter(item => normalizeSection(item.platform_section) !== "company_results_strategy")
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  if (state.activeSection !== "全部") return sorted.slice(0, 4);

  const slots = [
    item => normalizeSection(item.platform_section) === "market",
    item => normalizeSection(item.platform_section) === "technology_ai",
    item => normalizeSection(item.platform_section) === "reinsurance" || isReinsuranceMarketItem(item),
    item => normalizeSection(item.platform_section) === "research"
  ];
  const picks = [];
  const used = new Set();
  slots.forEach(match => {
    const item = sorted.find(candidate => !used.has(itemId(candidate)) && match(candidate));
    if (item) {
      picks.push(item);
      used.add(itemId(item));
    }
  });
  sorted.forEach(item => {
    if (picks.length >= 4) return;
    const id = itemId(item);
    if (!used.has(id)) {
      picks.push(item);
      used.add(id);
    }
  });
  return picks;
}

function isReinsuranceMarketItem(item) {
  const text = [
    item.title,
    item.summary,
    item.category,
    item.line_of_business,
    item.branch,
    item.source
  ].join(" ").toLowerCase();
  return text.includes("reinsurance")
    || text.includes("reinsurer")
    || text.includes("renewal")
    || text.includes("cat bond")
    || text.includes("ils")
    || text.includes("再保险")
    || text.includes("再保");
}

function renderCards(items) {
  els.resultCount.textContent = "";
  els.itemList.innerHTML = "";

  if (!items.length) {
    els.itemList.innerHTML = `<div class="empty-state">${escapeHtml(t("noItems"))}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const id = itemId(item);
    const node = els.itemTemplate.content.cloneNode(true);
    const card = node.querySelector(".intelligence-card");
    const meta = node.querySelector(".card-meta");
    const title = node.querySelector("h4");
    const keyTakeaway = node.querySelector(".key-takeaway");
    const keyTakeawayBlock = node.querySelector(".key-takeaway-block");
    const originalLanguage = node.querySelector(".original-language");
    const sourceName = node.querySelector(".source-name");
    const sourceUrlNote = node.querySelector(".source-url-note");
    const publishedDate = node.querySelector(".published-date");
    const standardCategory = node.querySelector(".standard-category");
    const generatedTime = node.querySelector(".generated-time");
    const summaryList = node.querySelector(".summary-list");
    const summaryBlock = node.querySelector(".summary-block");
    const transparency = node.querySelector(".ai-transparency");
    const whyBlock = node.querySelector(".why-block");
    const whyItMatters = node.querySelector(".why-it-matters");
    const detailsBlock = node.querySelector(".details-block");
    const angle = node.querySelector(".angle");
    const analysisBlock = node.querySelector(".analysis-block");
    const actions = node.querySelector(".actions-block ol");
    const actionsBlock = node.querySelector(".actions-block");
    const learning = node.querySelector(".learning");
    const save = node.querySelector(".save-button");
    const done = node.querySelector(".done-button");
    const issue = node.querySelector(".issue-button");
    const link = node.querySelector(".source-link");

    if (state.saved.has(id)) card.classList.add("is-saved");
    if (state.done.has(id)) card.classList.add("is-done");
    node.querySelector(".key-takeaway-block strong").textContent = t("keyTakeaway");
    node.querySelector(".why-block strong").textContent = t("whyItMatters");
    node.querySelector(".summary-block strong").textContent = t("aiSummary");
    node.querySelector(".details-block summary strong").textContent = t("articleDetails");
    node.querySelector('[data-i18n="originalLanguage"]').textContent = t("originalLanguage");
    node.querySelector('[data-i18n="source"]').textContent = t("source");
    node.querySelector('[data-i18n="sourceUrl"]').textContent = t("sourceUrl");
    node.querySelector('[data-i18n="date"]').textContent = t("date");
    node.querySelector('[data-i18n="standardizedCategory"]').textContent = t("standardizedCategory");
    node.querySelector('[data-i18n="generatedTime"]').textContent = t("generatedTime");
    node.querySelector(".analysis-block strong").textContent = t("actuarialAngle");
    node.querySelector(".actions-block strong").textContent = t("suggestedActions");

    const headerChips = [
      { label: displayPrimarySource(item), className: "chip-source" },
      { label: item.published || "-", className: "chip-date" },
      { label: displayOriginalLanguage(item), className: "chip-language" },
      { label: displaySection(item.platform_section), className: semanticCategoryClass(item) },
      ...cardTagChips(item)
    ].filter(chip => chip.label);
    meta.innerHTML = headerChips.map(chip => chipHtml(chip.label, chip.className)).join("");

    title.textContent = localizedItemTitle(item);
    originalLanguage.textContent = displayOriginalLanguage(item);
    sourceName.textContent = displayItemSource(item);
    sourceUrlNote.textContent = isUnresolvedGoogleNewsItem(item) ? t("sourceViaGoogleNews") : originalArticleUrl(item);
    publishedDate.textContent = item.published || "-";
    standardCategory.textContent = displayStandardCategory(item);
    generatedTime.textContent = state.data?.generated_at || state.data?.report_date || "-";
    const itemSummary = localizedItemSummary(item);
    const whyText = localizedWhyItMatters(item);
    const takeawayText = cardKeyTakeaway(item);
    keyTakeaway.textContent = takeawayText;
    keyTakeawayBlock.hidden = !takeawayText;
    const bullets = summaryBullets(item);
    summaryList.innerHTML = bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("");
    const notice = summaryNotice(item);
    summaryBlock.hidden = !bullets.length;
    transparency.textContent = notice || (bullets.length ? t("aiTransparency") : "");
    whyItMatters.textContent = whyText;
    whyBlock.hidden = !whyText;
    const angleText = localizedActuarialAngle(item);
    angle.textContent = angleText;
    analysisBlock.hidden = !angleText;
    const itemActions = localizedActions(item);
    actions.innerHTML = itemActions.map(action => `<li>${escapeHtml(action)}</li>`).join("");
    actionsBlock.hidden = !itemActions.length;
    const learningText = localizedLearningPrompt(item);
    learning.textContent = learningText ? `${t("learningPoint")}: ${learningText}` : "";
    learning.hidden = !learningText;
    link.href = originalArticleUrl(item);
    link.textContent = t("readOriginal");

    save.classList.toggle("active", state.saved.has(id));
    done.classList.toggle("active", state.done.has(id));
    save.textContent = state.saved.has(id) ? t("saved") : t("save");
    done.textContent = state.done.has(id) ? t("doneAlready") : t("markDone");
    issue.textContent = t("reportIssue");

    save.addEventListener("click", () => toggleSet("saved", id));
    done.addEventListener("click", () => toggleSet("done", id));
    issue.addEventListener("click", () => reportIssue(item));
    link.addEventListener("click", () => {
      analyticsEvent("industry_insight_opened", {
        article_id: id,
        article_title: localizedItemTitle(item),
        source_name: displayPrimarySource(item),
        topic: normalizeSection(item.platform_section)
      });
    });

    fragment.appendChild(node);
  });
  els.itemList.appendChild(fragment);
}

function exportDailyBriefingHtml() {
  const items = getFilteredItems();
  const html = renderDailyBriefingExportHtml(items);
  const date = state.data?.report_date || new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `actuary-radar-briefing-${state.language}-${date}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderDailyBriefingExportHtml(items) {
  const date = state.data?.report_date || "";
  const generatedAt = new Date().toLocaleString(state.language === "zh" ? "zh-CN" : state.language === "fr" ? "fr-FR" : "en-US");
  const articleHtml = items.map(item => {
    const title = localizedItemTitle(item);
    const takeaway = cardKeyTakeaway(item);
    const why = localizedWhyItMatters(item);
    const bullets = summaryBullets(item);
    const source = displayItemSource(item);
    const originalUrl = originalArticleUrl(item);
    return `
      <article class="briefing-card">
        <div class="meta">${escapeHtml(source)} · ${escapeHtml(item.published || date || "")} · ${escapeHtml(displayOriginalLanguage(item))} · ${escapeHtml(displaySection(item.platform_section))}</div>
        <h2>${escapeHtml(title)}</h2>
        ${takeaway ? `<section class="takeaway"><strong>${escapeHtml(t("exportKeyTakeaway"))}</strong><p>${escapeHtml(takeaway)}</p></section>` : ""}
        ${why ? `<section class="why"><strong>${escapeHtml(t("exportWhyItMatters"))}</strong><p>${escapeHtml(why)}</p></section>` : ""}
        ${bullets.length ? `<section class="summary"><strong>${escapeHtml(t("aiSummary"))}</strong><ul>${bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></section>` : ""}
        <p class="source-line">${escapeHtml(t("exportSource"))}: ${escapeHtml(source)}</p>
        ${originalUrl && originalUrl !== "#" ? `<a class="read-link" href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener">${escapeHtml(t("exportReadOriginal"))}</a>` : ""}
      </article>
    `;
  }).join("");
  return `<!doctype html>
<html lang="${escapeHtml(state.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t("exportTitle"))}${date ? ` · ${escapeHtml(date)}` : ""}</title>
  <style>
    :root { color-scheme: light; --navy:#071a3a; --teal:#0f766e; --ink:#111827; --muted:#52647c; --line:#d8e0ea; --blue:#edf5ff; --amber:#fff7e6; }
    body { margin: 0; background: #f5f7fb; color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 36px 20px 56px; }
    header { margin-bottom: 28px; border-bottom: 2px solid var(--navy); padding-bottom: 18px; }
    h1 { margin: 0 0 8px; color: var(--navy); font-size: 34px; line-height: 1.15; }
    .generated { color: var(--muted); font-size: 13px; }
    .briefing-card { background: #fff; border: 1px solid var(--line); margin: 18px 0; padding: 24px; border-radius: 4px; }
    .meta { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    h2 { margin: 10px 0 16px; color: var(--navy); font-size: 23px; line-height: 1.28; }
    section { margin: 14px 0; padding: 14px 16px; border-radius: 4px; }
    section strong { display:block; margin-bottom: 6px; color: var(--navy); }
    .takeaway { background: #f3f8f7; border-left: 3px solid var(--teal); }
    .why { background: var(--amber); border-left: 3px solid #c98718; }
    .summary { background: var(--blue); border-left: 3px solid #3d6fae; }
    p { margin: 0; }
    ul { margin: 0; padding-left: 20px; }
    .source-line { color: var(--muted); font-size: 13px; margin: 14px 0 10px; }
    .read-link { color: var(--teal); font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(t("exportTitle"))}</h1>
      <div class="generated">${escapeHtml(t("exportDate"))}: ${escapeHtml(date || "-")} · ${escapeHtml(t("exportGeneratedBy"))} · ${escapeHtml(generatedAt)}</div>
    </header>
    ${articleHtml || `<p>${escapeHtml(t("noItems"))}</p>`}
  </main>
</body>
</html>`;
}

function renderBoard(items) {
  if (els.savedCount) els.savedCount.textContent = state.saved.size;
  if (els.doneCount) els.doneCount.textContent = state.done.size;
  if (!els.shareText) return;
  const topItems = [...items].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  els.shareText.value = topItems.map((item, index) => {
    return `${index + 1}. ${localizedItemTitle(item)}\n${t("suggestedActions")}: ${localizedActions(item)[0] || ""}`;
  }).join("\n\n");
}

function reportIssue(item) {
  const options = [
    ["wrong_translation", t("issueWrongTranslation")],
    ["wrong_category", t("issueWrongCategory")],
    ["outdated_link", t("issueOutdatedLink")],
    ["duplicate_news", t("issueDuplicate")],
    ["other", t("issueOther")]
  ];
  const issueText = `${t("reportIssue")}\n${options.map(([, label], index) => `${index + 1}. ${label}`).join("\n")}`;
  const selected = window.prompt(issueText, "1");
  if (selected === null) return;
  const index = Math.max(0, Math.min(options.length - 1, Number(selected || 1) - 1));
  const [issueType] = options[index] || options[0];
  const comment = window.prompt(t("issueComment"), "") || "";
  const record = {
    article_id: itemId(item),
    issue_type: issueType,
    user_comment: comment,
    created_at: new Date().toISOString(),
    title: item.original_title || item.title,
    url: item.url
  };
  const records = JSON.parse(localStorage.getItem("actuaryRadar.issueReports") || "[]");
  records.push(record);
  localStorage.setItem("actuaryRadar.issueReports", JSON.stringify(records));
  window.alert(t("issueSaved"));
}

function flashButtonLabel(button, label, duration = 1400) {
  if (!button) return;
  const originalLabel = button.textContent;
  button.textContent = label;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = originalLabel;
    button.disabled = false;
  }, duration);
}

function saveCurrentDigest() {
  if (!state.data?.report_date) return false;
  state.savedDigests[state.data.report_date] = {
    saved_at: new Date().toISOString(),
    data: state.data
  };
  localStorage.setItem("actuaryDigest.savedDigests", JSON.stringify(state.savedDigests));
  els.saveDailyButton.textContent = "★";
  setTimeout(() => {
    els.saveDailyButton.textContent = "☆";
  }, 1200);
  return true;
}

function saveTodayLearningJournal() {
  const snapshot = createLearningJournalSnapshot();
  state.learningJournal[snapshot.date] = snapshot;
  localStorage.setItem("actuaryRadar.learningJournal", JSON.stringify(state.learningJournal));
  window.alert(t("learningJournalSaved"));
  if (state.activePage === "saved") renderSavedDigests();
}

function createLearningJournalSnapshot() {
  const date = currentLearningDate();
  const selectedTopics = state.knowledgePlan.tracks?.length ? state.knowledgePlan.tracks : defaultKnowledgePlan.tracks;
  const planItems = generateHomeTodaysLearningItems();
  const concepts = currentPersonalizedDailyConcepts().map(({ topicId, concept }) => ({
    topicId,
    topicLabel: learningTopicLabel(topicId),
    term: concept.term,
    definition: concept.definition,
    example: concept.example,
    exercise: concept.exercise,
    sourceUrl: concept.sourceUrl || "",
    openUrl: concept.openUrl || ""
  }));
  const resourcesById = new Map();
  selectedTopics.slice(0, 4).forEach(topicId => {
    openSourceResourcesForTopic(topicId).forEach(resource => resourcesById.set(resource.id, {
      id: resource.id,
      name: resource.name,
      url: resource.github_url,
      language: resource.programming_language || "",
      difficulty: displayRepositoryDifficulty(resource.difficulty),
      summary: localizedRepositorySummary(resource)
    }));
  });
  return {
    date,
    savedAt: new Date().toISOString(),
    language: state.language,
    preferences: {
      careerStage: onboardingCareerLabel(state.knowledgePlan.careerStage || "student"),
      learningGoal: onboardingGoalLabel(state.knowledgePlan.learningGoal || "job_ready"),
      studyTime: state.knowledgePlan.studyTime || 15,
      topics: selectedTopics.map(learningTopicLabel)
    },
    concepts,
    learningItems: planItems.map(item => ({
      id: item.id,
      type: item.type,
      typeLabel: item.typeLabel || learningTypeLabel(item.type),
      topic: learningTopicLabel(item.topicId),
      title: item.title,
      estimatedMinutes: item.estimatedMinutes || 10,
      completed: isLearningItemCompletedToday(item.id),
      sourceUrl: item.sourceUrl || "",
      openUrl: item.openUrl || ""
    })),
    openSourceResources: [...resourcesById.values()].slice(0, 6),
    completedItems: generateCompletedTodayLearningItems().map(item => ({
      title: item.title,
      topic: learningTopicLabel(item.topicId),
      completedAt: item.completedAt || ""
    }))
  };
}

function renderSavedDigests() {
  els.savedTabs?.forEach(button => {
    button.classList.toggle("active", (button.dataset.savedTab || "briefings") === state.savedView);
  });
  if (state.savedView === "learning") {
    renderLearningJournal();
    return;
  }
  const entries = Object.entries(state.savedDigests)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  if (!entries.length) {
    els.savedDigestList.innerHTML = `<div class="empty-state">${escapeHtml(t("noSavedReports"))}</div>`;
    return;
  }
  els.savedDigestList.innerHTML = entries.map(([date, record]) => {
    const digest = record.data || {};
    const theme = digest.focus_profile?.theme || t("untitledTheme");
    const count = digest.items?.length || 0;
    return `
      <article class="saved-digest-card">
        <div>
          <strong>${escapeHtml(date)}</strong>
          <p>${escapeHtml(theme)}</p>
          <span>${count} ${escapeHtml(t("contentItems"))} · ${escapeHtml(t("savedAt"))} ${escapeHtml((record.saved_at || "").slice(0, 10))}</span>
        </div>
        <button class="ghost-button" type="button" data-saved-date="${escapeHtml(date)}">${escapeHtml(t("open"))}</button>
      </article>
    `;
  }).join("");
  els.savedDigestList.querySelectorAll("[data-saved-date]").forEach(button => {
    button.addEventListener("click", () => {
      const record = state.savedDigests[button.dataset.savedDate];
      if (!record?.data) return;
      state.data = record.data;
      state.items = record.data.items || [];
      state.activeSection = "全部";
      state.dailyNavExpanded = false;
      renderScaffold();
      render();
      setActivePage("daily");
    });
  });
}

function renderLearningJournal() {
  const entries = Object.entries(state.learningJournal)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  if (!entries.length) {
    els.savedDigestList.innerHTML = `<div class="empty-state">${escapeHtml(t("noLearningJournal"))}</div>`;
    return;
  }
  els.savedDigestList.innerHTML = entries.map(([date, record]) => {
    const conceptCount = record.concepts?.length || 0;
    const itemCount = record.learningItems?.length || 0;
    const completedCount = (record.learningItems || []).filter(item => item.completed).length;
    const conceptList = (record.concepts || []).map(concept => `<li><strong>${escapeHtml(concept.term)}</strong> · ${escapeHtml(concept.topicLabel || "")}</li>`).join("");
    const learningList = (record.learningItems || []).map(item => `<li>${item.completed ? "✓" : "□"} ${escapeHtml(item.title)} <span>${escapeHtml(item.topic || "")}</span></li>`).join("");
    return `
      <article class="saved-digest-card learning-journal-card">
        <div>
          <strong>${escapeHtml(date)}</strong>
          <p>${escapeHtml((record.preferences?.topics || []).slice(0, 4).join(", "))}</p>
          <span>${conceptCount} ${escapeHtml(t("dailyConcept"))} · ${itemCount} ${escapeHtml(t("contentItems"))} · ${completedCount}/${itemCount} ${escapeHtml(t("progressToday"))}</span>
          <details class="learning-journal-details">
            <summary>${escapeHtml(t("open"))}</summary>
            <div>
              <strong>${escapeHtml(t("dailyConcept"))}</strong>
              <ul>${conceptList}</ul>
              <strong>${escapeHtml(t("todaysLearning"))}</strong>
              <ul>${learningList}</ul>
            </div>
          </details>
        </div>
        <div class="saved-card-actions">
          <button class="ghost-button" type="button" data-learning-md="${escapeHtml(date)}">${escapeHtml(t("exportMarkdown"))}</button>
          <button class="ghost-button" type="button" data-learning-html="${escapeHtml(date)}">${escapeHtml(t("exportHtml"))}</button>
        </div>
      </article>
    `;
  }).join("");
  els.savedDigestList.querySelectorAll("[data-learning-md]").forEach(button => {
    button.addEventListener("click", () => exportLearningJournalMarkdown(button.dataset.learningMd));
  });
  els.savedDigestList.querySelectorAll("[data-learning-html]").forEach(button => {
    button.addEventListener("click", () => exportLearningJournalHtml(button.dataset.learningHtml));
  });
}

function exportLearningJournalMarkdown(date) {
  const record = state.learningJournal[date];
  if (!record) return;
  const markdown = learningJournalMarkdown(record);
  downloadTextFile(`actuary-radar-learning-${date}.md`, markdown, "text/markdown;charset=utf-8");
}

function exportLearningJournalHtml(date) {
  const record = state.learningJournal[date];
  if (!record) return;
  const html = learningJournalHtml(record);
  downloadTextFile(`actuary-radar-learning-${date}.html`, html, "text/html;charset=utf-8");
}

function learningJournalMarkdown(record) {
  const lines = [
    `# ${t("learningJournalTitle")}`,
    "",
    `${t("exportDate")}: ${record.date}`,
    `${t("exportGeneratedBy")}: ${new Date(record.savedAt || Date.now()).toLocaleString()}`,
    "",
    `## ${t("learningPreferences")}`,
    `- ${t("careerStageLabel")}: ${record.preferences?.careerStage || "-"}`,
    `- ${t("learningGoalLabel")}: ${record.preferences?.learningGoal || "-"}`,
    `- ${t("studyTimeLabel")}: ${record.preferences?.studyTime || "-"} ${t("minutesShort")}`,
    `- ${t("studyTopics")}: ${(record.preferences?.topics || []).join(", ")}`,
    "",
    `## ${t("dailyConcept")}`,
    ...(record.concepts || []).flatMap((concept, index) => [
      `${index + 1}. **${concept.term}** (${concept.topicLabel || ""})`,
      `   - ${concept.definition || ""}`,
      concept.example ? `   - ${concept.example}` : "",
      concept.exercise ? `   - ${concept.exercise}` : "",
      concept.sourceUrl ? `   - ${t("sourceWebsite")}: ${concept.sourceUrl}` : ""
    ].filter(Boolean)),
    "",
    `## ${t("todaysLearning")}`,
    ...(record.learningItems || []).map(item => `- [${item.completed ? "x" : " "}] ${item.typeLabel || item.type}: ${item.title} (${item.topic}, ${item.estimatedMinutes} ${t("minutesShort")})`),
    "",
    `## ${t("openSourceResourcesTitle")}`,
    ...(record.openSourceResources || []).map(resource => `- ${resource.name} (${resource.language || "-"}) - ${resource.url || ""}`),
    "",
    `## ${t("completedLabel")}`,
    ...((record.completedItems || []).length ? record.completedItems.map(item => `- ${item.title} (${item.topic})`) : ["-"])
  ];
  return lines.join("\n");
}

function learningJournalHtml(record) {
  const concepts = (record.concepts || []).map(concept => `
    <article>
      <h3>${escapeHtml(concept.term)}</h3>
      <p><strong>${escapeHtml(concept.topicLabel || "")}</strong></p>
      <p>${escapeHtml(concept.definition || "")}</p>
      ${concept.example ? `<p>${escapeHtml(concept.example)}</p>` : ""}
      ${concept.exercise ? `<p>${escapeHtml(concept.exercise)}</p>` : ""}
      ${concept.sourceUrl ? `<p><a href="${escapeHtml(concept.sourceUrl)}">${escapeHtml(t("sourceWebsite"))}</a></p>` : ""}
    </article>
  `).join("");
  const items = (record.learningItems || []).map(item => `
    <li>${item.completed ? "✓" : "□"} ${escapeHtml(item.typeLabel || item.type)} · ${escapeHtml(item.title)} · ${escapeHtml(item.topic)} · ${escapeHtml(String(item.estimatedMinutes))} ${escapeHtml(t("minutesShort"))}</li>
  `).join("");
  const resources = (record.openSourceResources || []).map(resource => `
    <li><a href="${escapeHtml(resource.url || "#")}">${escapeHtml(resource.name)}</a> · ${escapeHtml(resource.language || "")}</li>
  `).join("");
  return `<!doctype html>
<html lang="${escapeHtml(state.language)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t("learningJournalTitle"))} · ${escapeHtml(record.date)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;color:#14213d;line-height:1.6}
    h1,h2{color:#071a3a} article{border:1px solid #d8e0ea;border-radius:10px;padding:16px;margin:12px 0;background:#fbfdff}
    .meta{color:#52647c} a{color:#0f766e}
  </style>
</head>
<body>
  <h1>${escapeHtml(t("learningJournalTitle"))}</h1>
  <p class="meta">${escapeHtml(t("exportDate"))}: ${escapeHtml(record.date)} · ${escapeHtml(t("exportGeneratedBy"))} · ${escapeHtml(new Date(record.savedAt || Date.now()).toLocaleString())}</p>
  <h2>${escapeHtml(t("learningPreferences"))}</h2>
  <ul>
    <li>${escapeHtml(t("careerStageLabel"))}: ${escapeHtml(record.preferences?.careerStage || "-")}</li>
    <li>${escapeHtml(t("learningGoalLabel"))}: ${escapeHtml(record.preferences?.learningGoal || "-")}</li>
    <li>${escapeHtml(t("studyTimeLabel"))}: ${escapeHtml(String(record.preferences?.studyTime || "-"))} ${escapeHtml(t("minutesShort"))}</li>
    <li>${escapeHtml(t("studyTopics"))}: ${escapeHtml((record.preferences?.topics || []).join(", "))}</li>
  </ul>
  <h2>${escapeHtml(t("dailyConcept"))}</h2>
  ${concepts}
  <h2>${escapeHtml(t("todaysLearning"))}</h2>
  <ul>${items}</ul>
  <h2>${escapeHtml(t("openSourceResourcesTitle"))}</h2>
  <ul>${resources}</ul>
</body>
</html>`;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function renderKnowledgeFilter() {
  if (!els.knowledgeFilter) return;
  const tracks = [...new Set(state.knowledge.map(module => module.track).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.knowledgeFilter.innerHTML = [t("allTopics"), ...tracks]
    .map(track => `<option value="${escapeHtml(track)}">${escapeHtml(track)}</option>`)
    .join("");
}

function renderSourceLibrary() {
  if (!els.sourceLibrary) return;
  const selected = new Set(state.sourcePlan || []);
  els.sourceLibrary.innerHTML = sourceLibrary.map(source => {
    const videoLink = source.videoUrl ? `<a href="${escapeHtml(source.videoUrl)}" target="_blank" rel="noopener">${escapeHtml(t("sourceVideo"))}</a>` : "";
    return `
      <article class="source-card${selected.has(source.id) ? " selected" : ""}">
        <label>
          <input type="checkbox" value="${escapeHtml(source.id)}"${selected.has(source.id) ? " checked" : ""}>
          <span>
            <strong>${escapeHtml(source.title)}</strong>
            <small>${escapeHtml(source[state.language] || source.en)}</small>
          </span>
        </label>
        <div class="source-card-actions">
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(t("sourceWebsite"))}</a>
          ${videoLink}
        </div>
      </article>
    `;
  }).join("");
  els.sourceLibrary.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", () => {
      state.sourcePlan = [...els.sourceLibrary.querySelectorAll("input:checked")].map(node => node.value);
      saveSourcePlan();
      renderSourceLibrary();
      renderKnowledge();
    });
  });
}

function renderKnowledge() {
  const selectedTracks = new Set(state.knowledgePlan.tracks || []);
  const plannedModules = state.knowledge.filter(module => {
    const topicMatch = !selectedTracks.size || [...selectedTracks].some(topicId => topicMatchesModule(topicId, module) && moduleSuitableForTopic(topicId, module));
    return topicMatch && difficultyMatchesModule(module);
  });
  const modules = plannedModules.slice(0, Number(state.knowledgePlan.dailyCount || 2));
  const focusedModule = state.knowledgeFocusId
    ? plannedModules.find(module => knowledgeCardAnchor(module) === state.knowledgeFocusId)
    : null;
  const visibleModules = focusedModule && !modules.some(module => module.id === focusedModule.id)
    ? [focusedModule, ...modules]
    : modules;
  if (!visibleModules.length) {
    els.knowledgeGrid.innerHTML = `<div class="empty-state">${escapeHtml(t("noKnowledge"))}</div>`;
    renderOpenSourceLearning([]);
    return;
  }
  els.knowledgeGrid.innerHTML = visibleModules.map(module => `
    <article class="knowledge-card${knowledgeCardAnchor(module) === state.knowledgeFocusId ? " is-focused" : ""}" id="${escapeHtml(knowledgeCardAnchor(module))}">
      <div class="card-meta">
        <span class="chip">${escapeHtml(module.track)}</span>
        <span class="chip">${escapeHtml(displayDifficulty(module.difficulty))}</span>
      </div>
      <h4>${escapeHtml(displayKnowledgeTitle(module))}</h4>
      <p>${escapeHtml(displayKnowledgeSummary(module))}</p>
      <div class="knowledge-section">
        <strong>${escapeHtml(t("coreConcepts"))}</strong>
        <div class="tag-cloud static-tags">
          ${(module.concepts || []).map(concept => `<span>${escapeHtml(concept)}</span>`).join("")}
        </div>
      </div>
      <div class="case-box">
        <strong>${escapeHtml(t("sourceBasedPrompt"))}</strong>
        <p>${escapeHtml(displayKnowledgeQuestion(module))}</p>
        <button class="ghost-button answer-toggle" type="button">${escapeHtml(t("showAnswer"))}</button>
        <div class="reference-answer" hidden>${escapeHtml(displayKnowledgeAnswer(module))}</div>
      </div>
      ${renderCuratedKnowledgeSourceSection(module)}
    </article>
  `).join("");
  renderOpenSourceLearning(visibleModules);
  els.knowledgeGrid.querySelectorAll(".answer-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".knowledge-card");
      const module = visibleModules.find(item => knowledgeCardAnchor(item) === card?.id);
      const answer = button.nextElementSibling;
      answer.hidden = !answer.hidden;
      button.textContent = answer.hidden ? t("showAnswer") : t("hideAnswer");
      if (!answer.hidden && module) {
        analyticsEvent("knowledge_card_opened", {
          knowledge_id: module.id || module.topic_id || "",
          topic_id: module.track || "",
          card_title: displayKnowledgeTitle(module),
          source: "answer_toggle"
        });
      }
    });
  });
}

function renderOpenSourceLearning(modules = []) {
  if (!els.openSourceLearningGrid) return;
  const selectedTopics = state.knowledgePlan.tracks?.length ? state.knowledgePlan.tracks : defaultKnowledgePlan.tracks;
  const byId = new Map();
  selectedTopics.forEach(topicId => {
    openSourceResourcesForTopic(topicId).forEach(resource => byId.set(resource.id, resource));
  });
  modules.forEach(module => {
    openSourceResourcesForModule(module).forEach(resource => byId.set(resource.id, resource));
  });
  const resources = [...byId.values()].slice(0, 6);
  els.openSourceLearningGrid.innerHTML = resources.length
    ? resources.map(resource => renderOpenSourceResourceCard(resource)).join("")
    : `<div class="empty-state">${escapeHtml(t("moreContentSoon"))}</div>`;
}

function renderKnowledgePlanner() {
  if (!els.knowledgePlanner) return;
  const selectedTracks = new Set(state.knowledgePlan.tracks || []);
  if (els.dailyKnowledgeCount) els.dailyKnowledgeCount.value = String(state.knowledgePlan.dailyCount || 2);
  if (els.learningDifficulty) els.learningDifficulty.value = state.knowledgePlan.difficulty || "all";
  if (els.studyTime) els.studyTime.value = String(state.knowledgePlan.studyTime || 15);
  if (els.careerStage) els.careerStage.value = state.knowledgePlan.careerStage || "student";
  if (els.learningGoalSelect) els.learningGoalSelect.value = state.knowledgePlan.learningGoal || "stay_updated";
  if (els.learningPreferencesCard) {
    els.learningPreferencesCard.classList.toggle("is-onboarding", !state.knowledgePlan.setupComplete);
  }
  els.knowledgePlanner.innerHTML = learningTopicOptions.map(item => {
    const checked = selectedTracks.has(item.id) ? " checked" : "";
    return `
      <label class="planner-choice">
        <input type="checkbox" value="${escapeHtml(item.id)}"${checked}>
        <span>
          <strong>${escapeHtml(learningTopicLabel(item.id))}</strong>
          <small>${escapeHtml(learningTopicFocus(item.id))}</small>
        </span>
      </label>
    `;
  }).join("");
  els.knowledgePlanner.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", () => {
      const tracks = [...els.knowledgePlanner.querySelectorAll("input:checked")].map(node => node.value);
      state.knowledgePlan.tracks = tracks;
      saveKnowledgePlan();
      if (state.data) renderScaffold();
      renderKnowledge();
      renderLearningPlan();
    });
  });
}

function handleLearningActionClick(event) {
  const startButton = event.target.closest("[data-learning-start]");
  if (startButton) {
    markLearningItemStarted(startButton.dataset.learningStart, startButton.dataset.learningTopic);
    navigateToLearningTarget(startButton.dataset.learningOpen);
    return;
  }
  const completeButton = event.target.closest("[data-learning-complete]");
  if (completeButton) {
    markLearningItemComplete(completeButton.dataset.learningComplete, completeButton.dataset.learningTopic);
  }
}

function navigateToLearningTarget(openUrl) {
  if (!openUrl) return;
  if (/^https?:\/\//i.test(openUrl)) {
    analyticsEvent("industry_insight_opened", {
      destination_url: openUrl
    });
    window.open(openUrl, "_blank", "noopener");
    return;
  }
  const anchor = openUrl.startsWith("#") ? openUrl.slice(1) : openUrl;
  if (!anchor) return;
  state.knowledgeFocusId = anchor;
  state.dailyNavExpanded = false;
  setActivePage("knowledge");
  render();
  const module = state.knowledge.find(item => knowledgeCardAnchor(item) === anchor);
  if (module) {
    analyticsEvent("knowledge_card_opened", {
      knowledge_id: module.id || module.topic_id || "",
      topic_id: module.track || "",
      card_title: displayKnowledgeTitle(module)
    });
  }
  window.setTimeout(() => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

function resetLearningPreferences() {
  state.knowledgePlan = { ...defaultKnowledgePlan };
  state.onboardingSkipped = false;
  localStorage.removeItem("actuaryRadar.onboardingSkipped");
  saveKnowledgePlan();
  renderOnboardingOptions();
  renderKnowledgePlanner();
  if (state.activePage === "knowledge") renderKnowledge();
  renderLearningPlan();
  renderPortal();
}

function renderLearningPlan() {
  const planItems = generateTodaysLearningItems();
  const recommendedItems = generateRecommendedLearningItems(planItems.map(item => item.id));
  const continueItems = generateContinueLearningItems();
  const todayKey = currentLearningDate();
  const completedToday = state.learningProgress.completed[todayKey] || {};
  const completedCount = planItems.filter(item => completedToday[item.id]).length;

  if (els.completedTodayCount) els.completedTodayCount.textContent = `${completedCount}/${planItems.length}`;
  if (els.learningStreakCount) els.learningStreakCount.textContent = String(calculateLearningStreak());
  if (els.topicsCompletedCount) els.topicsCompletedCount.textContent = String(Object.keys(state.learningProgress.topicCompletions || {}).length);
  if (els.dailyTargetSummary) els.dailyTargetSummary.textContent = `${state.knowledgePlan.studyTime || 15} ${t("minutesShort")}`;

  if (els.learningPlanList) {
    els.learningPlanList.innerHTML = renderLearningItemList(planItems, {
      emptyKey: state.knowledgePlan.setupComplete ? "noLearningPlanItems" : "setupLearningFirst",
      mode: "today"
    });
  }
  if (els.continueLearningList) {
    els.continueLearningList.innerHTML = renderLearningItemList(continueItems, {
      emptyKey: "noStartedLearningItems",
      mode: "continue"
    });
  }
  if (els.recommendedLearningList) {
    els.recommendedLearningList.innerHTML = renderLearningItemList(recommendedItems, {
      emptyKey: "moreContentSoon",
      mode: "recommended"
    });
  }
  renderHomeLearning();
}

function generateTodaysLearningItems() {
  const selectedTopics = state.knowledgePlan.tracks || [];
  const dailyCount = clampNumber(state.knowledgePlan.dailyCount, 2, 1, 5);
  const availableMinutes = clampNumber(state.knowledgePlan.studyTime, 15, 5, 30);
  const items = [];
  const addItem = item => {
    if (!item?.id || items.some(existing => existing.id === item.id)) return;
    if (isLearningItemCompletedBeforeToday(item.id)) return;
    items.push(item);
  };

  addItem(dailyConceptLearningItem(selectedTopics[0] || "Fundamentals"));

  const knowledgeCandidates = state.knowledge
    .filter(module => selectedTopics.some(topicId => topicMatchesModule(topicId, module) && moduleSuitableForTopic(topicId, module)) && difficultyMatchesModule(module));
  knowledgeCandidates.forEach(module => {
    const topicId = selectedTopics.find(topic => topicMatchesModule(topic, module) && moduleSuitableForTopic(topic, module)) || selectedTopics[0] || "Fundamentals";
    addItem(knowledgeLearningItem(module, topicId));
  });

  relatedNewsItems(selectedTopics).forEach(addItem);
  researchLearningItems(selectedTopics).forEach(addItem);
  githubExampleItems(selectedTopics).forEach(addItem);
  officialSourceItems(selectedTopics).forEach(addItem);

  return fitLearningItemsToTime(items, dailyCount, availableMinutes);
}

function generateHomeTodaysLearningItems() {
  const baseItems = generateTodaysLearningItems();
  const selectedTopics = state.knowledgePlan.tracks || [];
  if (baseItems.some(item => item.type === "news")) return baseItems;
  const insight = relatedNewsItems(selectedTopics).find(item => !baseItems.some(existing => existing.id === item.id) && !isLearningItemCompletedBeforeToday(item.id));
  if (!insight) return baseItems;
  if (!baseItems.length) return [insight];
  const next = [...baseItems];
  next[next.length - 1] = insight;
  return next;
}

function knowledgeLearningItem(module, topicId) {
  return {
    id: `knowledge:${module.id}`,
    topicId,
    type: "knowledge",
    typeLabel: t("learningItemKnowledgeCard"),
    title: displayKnowledgeTitle(module),
    detail: displayKnowledgeQuestion(module) || displayKnowledgeSummary(module),
    estimatedMinutes: 12,
    openUrl: `#${knowledgeCardAnchor(module)}`,
    sourceUrl: firstKnowledgeSourceLink(module)
  };
}

function generateRecommendedLearningItems(excludeIds = []) {
  const selectedTopics = state.knowledgePlan.tracks || defaultKnowledgePlan.tracks;
  const excluded = new Set(excludeIds);
  const candidates = [];
  const addItem = item => {
    if (!item?.id || excluded.has(item.id) || candidates.some(existing => existing.id === item.id)) return;
    if (isLearningItemCompleted(item.id)) return;
    candidates.push(item);
  };

  selectedTopics.forEach(topicId => {
    state.knowledge
      .filter(module => topicMatchesModule(topicId, module) && moduleSuitableForTopic(topicId, module) && difficultyMatchesModule(module))
      .slice(0, 3)
      .forEach(module => addItem(knowledgeLearningItem(module, topicId)));
  });
  relatedNewsItems(selectedTopics).forEach(addItem);
  researchLearningItems(selectedTopics).forEach(addItem);
  githubExampleItems(selectedTopics).forEach(addItem);
  officialSourceItems(selectedTopics).forEach(addItem);
  return candidates.slice(0, 4);
}

function generateContinueLearningItems() {
  const started = state.learningProgress.started || {};
  return Object.values(started)
    .filter(item => item?.id && !isLearningItemCompleted(item.id))
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))
    .slice(0, 3)
    .map(item => ({
      ...item,
      typeLabel: item.typeLabel || learningTypeLabel(item.type),
      title: item.title || item.id,
      estimatedMinutes: item.estimatedMinutes || 10
    }));
}

function generateCompletedTodayLearningItems() {
  const completedToday = state.learningProgress.completed?.[currentLearningDate()] || {};
  return Object.entries(completedToday)
    .filter(([, value]) => Boolean(value))
    .sort(([, a], [, b]) => String(completedAtValue(b)).localeCompare(String(completedAtValue(a))))
    .map(([id, value]) => completedLearningItemFromRecord(id, value));
}

function completedAtValue(value) {
  return value && typeof value === "object" ? value.completedAt || "" : "";
}

function completedLearningItemFromRecord(id, value) {
  if (value && typeof value === "object") {
    return {
      id: value.id || id,
      topicId: value.topicId || "Fundamentals",
      type: value.type || "knowledge",
      typeLabel: value.typeLabel || learningTypeLabel(value.type),
      title: value.title || readableLearningId(id),
      estimatedMinutes: value.estimatedMinutes || 10,
      sourceUrl: value.sourceUrl || "",
      openUrl: value.openUrl || "",
      completedAt: value.completedAt || ""
    };
  }
  return {
    id,
    topicId: "Fundamentals",
    type: "knowledge",
    typeLabel: t("completedLabel"),
    title: readableLearningId(id),
    estimatedMinutes: 0,
    sourceUrl: "",
    openUrl: "",
    completedAt: ""
  };
}

function readableLearningId(id) {
  return String(id || "").split(":").filter(Boolean).pop() || String(id || "");
}

function fitLearningItemsToTime(items, dailyCount, availableMinutes) {
  const fitted = [];
  let minutes = 0;
  for (const item of items) {
    if (fitted.length >= dailyCount) break;
    const itemMinutes = Number(item.estimatedMinutes || 10);
    if (fitted.length && minutes + itemMinutes > availableMinutes + 5) continue;
    fitted.push(item);
    minutes += itemMinutes;
  }
  return fitted.length ? fitted : items.slice(0, Math.min(dailyCount, items.length));
}

function renderLearningItemList(items, options = {}) {
  if (!items.length) return options.hideEmpty ? "" : `<div class="empty-state">${escapeHtml(t(options.emptyKey || "noLearningPlanItems"))}</div>`;
  return items.map(item => renderLearningTaskItem(item, options.mode || "today")).join("");
}

function renderLearningTaskItem(item, mode) {
  const completed = mode === "completed" || isLearningItemCompleted(item.id);
  const started = Boolean(state.learningProgress.started?.[item.id]);
  const gardenState = completed ? "garden-bloom" : started ? "garden-sprout" : "garden-seed";
  const titleHtml = item.openUrl
    ? `<a class="learning-plan-title-link" href="${escapeHtml(item.openUrl)}">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const progressText = mode === "completed"
    ? `<small>${escapeHtml(t("completedLabel"))}</small>`
    : mode === "continue"
    ? `<small>${escapeHtml(started ? t("inProgress") : t("notStarted"))}</small>`
    : `<small>${escapeHtml(t("estimated"))}: ${escapeHtml(String(item.estimatedMinutes || 10))} ${escapeHtml(t("minutesShort"))}</small>`;
  const actionHtml = mode === "completed"
    ? `<button class="ghost-button compact-button" type="button" disabled>${escapeHtml(t("completedLabel"))}</button>`
    : `
        <button class="ghost-button compact-button" type="button" data-learning-start="${escapeHtml(item.id)}" data-learning-topic="${escapeHtml(item.topicId)}" data-learning-open="${escapeHtml(item.openUrl || item.sourceUrl || "")}"${started || completed ? " disabled" : ""}>${escapeHtml(started ? t("startedLabel") : t("startLearningItem"))}</button>
        <button class="ghost-button compact-button" type="button" data-learning-complete="${escapeHtml(item.id)}" data-learning-topic="${escapeHtml(item.topicId)}"${completed ? " disabled" : ""}>${escapeHtml(completed ? t("completedLabel") : t("markComplete"))}</button>
      `;
  return `
    <article class="learning-plan-item ${escapeHtml(gardenState)}${completed ? " completed" : ""}">
      <div class="learning-plan-copy">
        <div class="learning-plan-meta">
          <span>${escapeHtml(item.typeLabel || learningTypeLabel(item.type))}</span>
          <span>${escapeHtml(learningTopicLabel(item.topicId))}</span>
        </div>
        <h5>${titleHtml}</h5>
        ${progressText}
      </div>
      <div class="learning-plan-actions">
        ${actionHtml}
      </div>
    </article>
  `;
}

function renderHomeLearningItemList(items, options = {}) {
  if (!items.length) return options.hideEmpty ? "" : `<div class="empty-state">${escapeHtml(t(options.emptyKey || "noLearningPlanItems"))}</div>`;
  return items.map(item => renderHomeLearningTaskItem(item, options.mode || "today")).join("");
}

function renderHomeLearningTaskItem(item, mode) {
  const completed = mode === "completed" || isLearningItemCompleted(item.id);
  const started = Boolean(state.learningProgress.started?.[item.id]);
  const gardenState = completed ? "garden-bloom" : started ? "garden-sprout" : "garden-seed";
  const stageLabel = completed ? t("growthBloom") : started ? t("growthSprout") : t("growthSeed");
  const titleHtml = item.openUrl
    ? `<a class="learning-plan-title-link" href="${escapeHtml(item.openUrl)}">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const reason = learningRecommendationReason(item);
  const actionLabel = started ? t("continueLearning") : t("startLearningItem");
  return `
    <article class="learning-plan-item home-learning-task ${escapeHtml(`learning-type-${item.type || "item"}`)} ${escapeHtml(gardenState)}${completed ? " completed" : ""}">
      <label class="learning-complete-box" aria-label="${escapeHtml(t("markComplete"))}">
        <input type="checkbox" data-learning-complete="${escapeHtml(item.id)}" data-learning-topic="${escapeHtml(item.topicId)}"${completed ? " checked disabled" : ""}>
      </label>
      <div class="learning-plan-copy">
        <div class="learning-plan-meta">
          <span>${escapeHtml(item.typeLabel || learningTypeLabel(item.type))}</span>
          <span>${escapeHtml(learningTopicLabel(item.topicId))}</span>
          <span class="growth-stage-pill">${escapeHtml(t("growthStage"))}: ${escapeHtml(stageLabel)}</span>
        </div>
        <h5>${titleHtml}</h5>
        ${reason ? `<p class="learning-reason">${escapeHtml(reason)}</p>` : ""}
        <small>${escapeHtml(String(item.estimatedMinutes || 10))} ${escapeHtml(t("minutesShort"))}</small>
      </div>
      <div class="learning-plan-actions">
        ${mode === "completed"
          ? `<span class="learning-status-pill">${escapeHtml(t("completedLabel"))}</span>`
          : `<button class="text-link learning-start-link" type="button" data-learning-start="${escapeHtml(item.id)}" data-learning-topic="${escapeHtml(item.topicId)}" data-learning-open="${escapeHtml(item.openUrl || item.sourceUrl || "")}">${escapeHtml(actionLabel)} →</button>`}
      </div>
    </article>
  `;
}

function learningTypeLabel(type) {
  const labels = {
    concept: t("learningItemDailyConcept"),
    knowledge: t("learningItemKnowledgeCard"),
    news: t("learningItemNews"),
    research: t("learningItemResearch"),
    source: t("learningItemOfficialSource"),
    github: t("learningItemGithubExample")
  };
  return labels[type] || type || "";
}

function learningRecommendationReason(item) {
  if (!item) return "";
  const selectedTopics = new Set(state.knowledgePlan.tracks || []);
  if ((item.type === "news" || item.type === "research") && item.topicId && selectedTopics.has(item.topicId)) {
    return t("recommendationIndustryInsight");
  }
  if (item.topicId && selectedTopics.has(item.topicId)) {
    return t("recommendationSelectedTopic").replace("{topic}", learningTopicLabel(item.topicId));
  }
  const goal = state.knowledgePlan.learningGoal;
  if (goal === "regulatory_literacy" && ["Solvency II", "IFRS 17", "Regulation", "Capital Management", "ERM"].includes(item.topicId)) {
    return t("recommendationGoalRegulatory");
  }
  if (goal === "pricing_reserving" && ["Pricing", "Reserving", "Data Analytics"].includes(item.topicId)) {
    return t("recommendationGoalPricing");
  }
  if (goal === "industry_context" && ["Insurance Fundamentals", "Reinsurance", "Life Insurance", "Health Insurance"].includes(item.topicId)) {
    return t("recommendationGoalIndustry");
  }
  if (goal === "exam_ready" && ["Fundamentals", "Insurance Fundamentals", "IFRS 17", "Solvency II"].includes(item.topicId)) {
    return t("recommendationGoalExam");
  }
  if (goal === "job_ready" && ["Fundamentals", "Pricing", "Reserving", "Data Analytics"].includes(item.topicId)) {
    return t("recommendationGoalJob");
  }
  return "";
}

function dailyConceptLearningItem(topicId) {
  const concept = personalizedDailyConceptForTopic(topicId);
  if (!concept) return null;
  return {
    id: `concept:${currentLearningDate()}:${topicId}:${concept.term}`,
    topicId,
    type: "concept",
    typeLabel: t("learningItemDailyConcept"),
    title: concept.term,
    detail: concept.exercise || concept.definition,
    estimatedMinutes: 8,
    openUrl: concept.openUrl || "#dailyConceptBlock",
    sourceUrl: concept.sourceUrl
  };
}

function personalizedDailyConceptForTopic(topicId) {
  const modules = state.knowledge.filter(item => {
    return topicMatchesModule(topicId, item)
      && moduleSuitableForTopic(topicId, item)
      && difficultyMatchesModule(item);
  });
  if (!modules.length) return null;
  const pool = modules.flatMap(module => {
    const concepts = (module.concepts || [displayKnowledgeTitle(module)])
      .filter(concept => !isAdvancedReinsuranceOrCatModule({ concepts: [concept] }));
    return (concepts.length ? concepts : [displayKnowledgeTitle(module)])
      .map(concept => ({ concept, module }));
  });
  const selected = pool[deterministicLearningIndex(`${currentLearningDate()}:${topicId}`, pool.length)];
  const module = selected.module;
  const detail = curatedConceptDetail(selected.concept, module, topicId);
  return {
    term: selected.concept,
    definition: detail.definition,
    example: detail.example,
    exercise: detail.exercise,
    sourceUrl: firstKnowledgeSourceLink(module),
    openUrl: `#${knowledgeCardAnchor(module)}`
  };
}

function curatedConceptDetail(term, module, topicId) {
  const key = String(term || "").toLowerCase();
  const topic = learningTopicLabel(topicId);
  const details = {
    probability: {
      zh: {
        definition: "Probability 描述不确定事件发生的可能性，是死亡、退保、赔付频率和巨灾损失建模的基础语言。",
        example: "通俗例子：如果某年龄段一年死亡概率是 0.2%，精算师会用它估计未来赔付现金流，而不是判断某一个人一定会不会出险。",
        exercise: "练习：选一个保险风险，把它拆成事件、概率、暴露量和预期损失。"
      },
      en: {
        definition: "Probability measures how likely an uncertain event is. It is the basic language behind mortality, lapse, claim frequency and tail-risk modelling.",
        example: "Plain example: if annual mortality at an age is 0.2%, the actuary uses it to estimate portfolio cash flows, not to predict one individual with certainty.",
        exercise: "Exercise: choose one insurance risk and split it into event, probability, exposure and expected loss."
      },
      fr: {
        definition: "La probabilité mesure la vraisemblance d’un événement incertain. C’est le langage de base pour la mortalité, les rachats, la fréquence des sinistres et les risques extrêmes.",
        example: "Exemple simple : si la mortalité annuelle à un âge est de 0,2 %, l’actuaire l’utilise pour estimer les flux d’un portefeuille, pas pour prédire un individu.",
        exercise: "Exercice : choisissez un risque d’assurance et distinguez événement, probabilité, exposition et perte attendue."
      }
    },
    statistics: {
      zh: {
        definition: "Statistics 用历史数据估计风险规律，并判断观察到的变化是随机波动还是真实趋势。",
        example: "通俗例子：赔付率连续上升不一定代表定价失败，要先看样本量、组合变化、季节性和异常大赔案。",
        exercise: "练习：列出判断一个赔付率变化是否显著所需的三个数据检查。"
      },
      en: {
        definition: "Statistics uses historical data to estimate risk patterns and judge whether observed changes are noise or genuine trends.",
        example: "Plain example: a rising loss ratio does not automatically mean pricing failure; check volume, mix, seasonality and large claims first.",
        exercise: "Exercise: list three data checks before calling a loss-ratio movement significant."
      },
      fr: {
        definition: "La statistique utilise les données historiques pour estimer les comportements de risque et distinguer bruit aléatoire et tendance réelle.",
        example: "Exemple simple : une hausse du ratio de sinistralité ne prouve pas immédiatement une erreur tarifaire ; vérifiez volume, mix, saisonnalité et gros sinistres.",
        exercise: "Exercice : citez trois contrôles avant de conclure qu’une variation de sinistralité est significative."
      }
    },
    "survival analysis": {
      zh: {
        definition: "Survival Analysis 研究某个状态持续多久以及何时发生退出事件，在寿险死亡率、退保和长期健康险中非常常用。",
        example: "通俗例子：一张保单不是只看今年是否退保，还要看第 1、2、3 个保单年度的持续率曲线。",
        exercise: "练习：解释为什么退保率假设会影响 BEL、CSM 和流动性。"
      },
      en: {
        definition: "Survival analysis studies how long a state lasts before an exit event. It is central to mortality, lapse and long-duration health modelling.",
        example: "Plain example: for a policy, do not only ask whether it lapses this year; look at persistency across policy years 1, 2 and 3.",
        exercise: "Exercise: explain how lapse assumptions affect BEL, CSM and liquidity."
      },
      fr: {
        definition: "L’analyse de survie étudie la durée avant un événement de sortie. Elle est centrale pour la mortalité, les rachats et les garanties longues.",
        example: "Exemple simple : pour un contrat, on ne regarde pas seulement le rachat cette année, mais la persistance aux années 1, 2 et 3.",
        exercise: "Exercice : expliquez l’effet des hypothèses de rachat sur le BEL, la CSM et la liquidité."
      }
    },
    "monte carlo": {
      zh: {
        definition: "Monte Carlo 通过大量随机情景模拟结果分布，用来评估不确定现金流、资本需求和尾部风险。",
        example: "通俗例子：与其只看一个平均赔付结果，Monte Carlo 会模拟上万次不同赔付路径，观察 95% 或 99.5% 分位数。",
        exercise: "练习：说明 Monte Carlo 在 SCR、嵌入式期权或巨灾损失建模中的一个用途。"
      },
      en: {
        definition: "Monte Carlo simulation generates many random scenarios to estimate the distribution of uncertain cash flows, capital needs and tail losses.",
        example: "Plain example: instead of one average claims outcome, simulate thousands of paths and inspect the 95th or 99.5th percentile.",
        exercise: "Exercise: describe one use of Monte Carlo in SCR, embedded options or catastrophe-loss modelling."
      },
      fr: {
        definition: "La simulation Monte Carlo génère de nombreux scénarios aléatoires pour estimer la distribution des flux incertains, du capital et des pertes extrêmes.",
        example: "Exemple simple : au lieu d’un seul résultat moyen, simulez des milliers de trajectoires et observez le quantile 95 % ou 99,5 %.",
        exercise: "Exercice : décrivez un usage de Monte Carlo pour le SCR, les options incorporées ou les pertes catastrophe."
      }
    },
    "time series": {
      zh: {
        definition: "Time Series 关注数据随时间变化的规律，常用于赔付通胀、保费增长、利率和经验假设监测。",
        example: "通俗例子：医疗赔付每月上升，要区分趋势、季节性、一次性冲击和数据口径变化。",
        exercise: "练习：选一个保险指标，说明如何拆分趋势、季节性和异常点。"
      },
      en: {
        definition: "Time series analysis studies how data evolves over time. It is useful for claims inflation, premium growth, interest rates and experience monitoring.",
        example: "Plain example: if monthly medical claims rise, separate trend, seasonality, one-off shock and data-definition changes.",
        exercise: "Exercise: choose one insurance metric and split its movement into trend, seasonality and outliers."
      },
      fr: {
        definition: "L’analyse de séries temporelles étudie l’évolution des données dans le temps. Elle sert au suivi de l’inflation sinistres, des primes, des taux et de l’expérience.",
        example: "Exemple simple : si les sinistres santé mensuels augmentent, distinguez tendance, saisonnalité, choc ponctuel et changement de périmètre.",
        exercise: "Exercice : choisissez un indicateur d’assurance et séparez tendance, saisonnalité et valeurs atypiques."
      }
    },
    bayesian: {
      zh: {
        definition: "Bayesian 方法把先验判断和新观察数据结合起来，适合样本少、风险新或经验逐步积累的保险问题。",
        example: "通俗例子：一个新险种数据很少，可以先用相近组合经验作为先验，再用新赔付经验逐步更新。",
        exercise: "练习：举一个保险场景，说明先验信息和新数据分别来自哪里。"
      },
      en: {
        definition: "Bayesian methods combine prior judgment with new observations. They are useful when data is scarce, emerging or gradually accumulating.",
        example: "Plain example: for a new product, use similar portfolio experience as a prior and update it as new claims emerge.",
        exercise: "Exercise: name one insurance case and identify the prior information and new evidence."
      },
      fr: {
        definition: "Les méthodes bayésiennes combinent jugement a priori et nouvelles observations. Elles sont utiles lorsque les données sont rares ou émergentes.",
        example: "Exemple simple : pour un nouveau produit, utilisez l’expérience d’un portefeuille proche comme a priori, puis mettez à jour avec les sinistres observés.",
        exercise: "Exercice : choisissez un cas d’assurance et identifiez l’a priori et les nouvelles observations."
      }
    },
    "risk pooling": {
      zh: {
        definition: "Risk Pooling 是把大量相似但不完全同步的风险放在一起，通过大数法则降低组合层面的相对波动。",
        example: "通俗例子：一个人的医疗费用很难预测，但十万人的年度医疗赔付会更接近稳定的组合规律。",
        exercise: "练习：解释为什么风险池规模、同质性和相关性会影响保险定价。"
      },
      en: {
        definition: "Risk pooling combines many similar but not perfectly correlated risks so that portfolio-level volatility becomes more manageable.",
        example: "Plain example: one person’s medical cost is hard to predict, but annual claims for 100,000 people are closer to a stable portfolio pattern.",
        exercise: "Exercise: explain why pool size, homogeneity and correlation matter for insurance pricing."
      },
      fr: {
        definition: "La mutualisation regroupe de nombreux risques similaires mais imparfaitement corrélés afin de réduire la volatilité relative du portefeuille.",
        example: "Exemple simple : la dépense médicale d’une personne est difficile à prévoir, mais celle de 100 000 assurés suit une loi plus stable.",
        exercise: "Exercice : expliquez pourquoi taille du portefeuille, homogénéité et corrélation comptent en tarification."
      }
    },
    underwriting: {
      zh: {
        definition: "Underwriting 是识别、选择和定价风险的过程，决定哪些风险进入组合以及以什么条件承保。",
        example: "通俗例子：同样的保费增长，如果来自更差风险选择，可能会提高赔付率而不是提升盈利。",
        exercise: "练习：列出核保质量恶化会影响的三个精算指标。"
      },
      en: {
        definition: "Underwriting identifies, selects and prices risks, deciding which risks enter the portfolio and under what terms.",
        example: "Plain example: premium growth from weaker risk selection may raise the loss ratio rather than improve profitability.",
        exercise: "Exercise: list three actuarial metrics affected by deteriorating underwriting quality."
      },
      fr: {
        definition: "La souscription identifie, sélectionne et tarifie les risques, en déterminant quels risques entrent au portefeuille et à quelles conditions.",
        example: "Exemple simple : une croissance de primes issue d’une sélection dégradée peut augmenter la sinistralité au lieu d’améliorer la rentabilité.",
        exercise: "Exercice : citez trois indicateurs actuariels affectés par une dégradation de la souscription."
      }
    },
    claims: {
      zh: {
        definition: "Claims 是保险事故发生后的理赔现金流和处理过程，直接影响赔付率、准备金和客户体验。",
        example: "通俗例子：理赔频率不变但案均赔款上升，可能来自通胀、服务成本或责任范围变化。",
        exercise: "练习：把一次赔付率上升拆成频率、严重度和理赔处理三个角度。"
      },
      en: {
        definition: "Claims are post-event payments and handling processes. They directly affect loss ratio, reserving and customer experience.",
        example: "Plain example: if claim frequency is stable but severity rises, the driver may be inflation, service cost or coverage design.",
        exercise: "Exercise: split a loss-ratio increase into frequency, severity and claims-handling effects."
      },
      fr: {
        definition: "Les sinistres regroupent les paiements et la gestion après événement. Ils influencent directement sinistralité, provisionnement et expérience client.",
        example: "Exemple simple : si la fréquence est stable mais le coût moyen augmente, la cause peut être l’inflation, les coûts de service ou les garanties.",
        exercise: "Exercice : décomposez une hausse de sinistralité entre fréquence, coût moyen et gestion des sinistres."
      }
    },
    distribution: {
      zh: {
        definition: "Distribution 指保险产品触达客户的渠道和销售方式，会影响获客成本、风险选择、续保和投诉风险。",
        example: "通俗例子：同样是车险，直销、经纪和嵌入式渠道可能带来完全不同的客户结构和赔付表现。",
        exercise: "练习：比较两个渠道，说明它们对费用率和赔付率可能产生的影响。"
      },
      en: {
        definition: "Distribution is how insurance products reach customers. It affects acquisition cost, risk selection, retention and conduct risk.",
        example: "Plain example: direct, broker and embedded motor insurance channels can bring very different customer mix and claims performance.",
        exercise: "Exercise: compare two channels and explain their possible impact on expense ratio and loss ratio."
      },
      fr: {
        definition: "La distribution désigne les canaux de commercialisation des produits d’assurance. Elle influence coût d’acquisition, sélection du risque, rétention et risque de conduite.",
        example: "Exemple simple : en auto, vente directe, courtage et assurance embarquée peuvent produire des profils clients et sinistres très différents.",
        exercise: "Exercice : comparez deux canaux et expliquez leur effet possible sur ratio de frais et sinistralité."
      }
    },
    reinsurance: {
      zh: {
        definition: "Reinsurance 是保险公司把部分风险转移给再保险人的机制，用于管理波动、资本、巨灾暴露和承保能力。",
        example: "通俗例子：保险公司保留前一部分损失，把极端大额损失的一部分转给再保险人，以降低利润和资本波动。",
        exercise: "练习：解释再保险如何同时影响净赔付、资本需求和定价策略。"
      },
      en: {
        definition: "Reinsurance lets an insurer transfer part of its risk to a reinsurer. It helps manage volatility, capital, catastrophe exposure and underwriting capacity.",
        example: "Plain example: an insurer retains ordinary losses but cedes part of severe losses to reduce earnings and capital volatility.",
        exercise: "Exercise: explain how reinsurance affects net claims, capital needs and pricing strategy."
      },
      fr: {
        definition: "La réassurance permet à un assureur de transférer une partie de ses risques à un réassureur. Elle aide à gérer volatilité, capital, exposition catastrophe et capacité.",
        example: "Exemple simple : l’assureur conserve les pertes ordinaires mais cède une partie des pertes sévères pour réduire la volatilité du résultat et du capital.",
        exercise: "Exercice : expliquez l’effet de la réassurance sur les sinistres nets, le besoin en capital et la tarification."
      }
    },
    capital: {
      zh: {
        definition: "Capital 是保险公司吸收不利偏差和维持偿付能力的缓冲，连接风险、监管和经营战略。",
        example: "通俗例子：一个产品利润率高但资本占用很重，RAROC 可能并不优秀。",
        exercise: "练习：解释为什么同样利润的两个产品可能有不同资本吸引力。"
      },
      en: {
        definition: "Capital is the buffer that allows an insurer to absorb adverse deviations and remain solvent. It links risk, regulation and strategy.",
        example: "Plain example: a product with high accounting margin but heavy capital usage may have weak RAROC.",
        exercise: "Exercise: explain why two products with the same profit can have different capital attractiveness."
      },
      fr: {
        definition: "Le capital est le coussin permettant d’absorber les écarts défavorables et de maintenir la solvabilité. Il relie risque, réglementation et stratégie.",
        example: "Exemple simple : un produit très rentable comptablement mais consommateur de capital peut avoir un RAROC faible.",
        exercise: "Exercice : expliquez pourquoi deux produits au même résultat peuvent avoir une attractivité capital différente."
      }
    }
  };
  const detail = details[key]?.[state.language] || details[key]?.en;
  if (detail) return detail;
  const fallbackDefinition = state.language === "zh"
    ? `${term} 是「${topic}」主题下的学习概念。${displayKnowledgeSummary(module)}`
    : state.language === "fr"
    ? `${term} est un concept du thème « ${topic} ». ${displayKnowledgeSummary(module)}`
    : `${term} is a concept within ${topic}. ${displayKnowledgeSummary(module)}`;
  return {
    definition: fallbackDefinition,
    example: personalizedConceptExample({ term }, topicId),
    exercise: displayKnowledgeQuestion(module)
  };
}

function deterministicLearningIndex(seed, length) {
  if (!length) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % length;
}

function relatedNewsItems(selectedTopics) {
  const topicSet = selectedTopics.length ? selectedTopics : defaultKnowledgePlan.tracks;
  return languageMatchedItems(state.items)
    .filter(item => topicSet.some(topicId => topicMatchesArticle(topicId, item) && articleSuitableForTopic(topicId, item)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 4)
    .map(item => {
      const topicId = topicSet.find(topic => topicMatchesArticle(topic, item) && articleSuitableForTopic(topic, item)) || topicSet[0];
      return {
        id: `news:${itemId(item)}`,
        topicId,
        type: "news",
        typeLabel: t("learningItemNews"),
        title: localizedItemTitle(item),
        detail: localizedItemSummary(item) || localizedWhyItMatters(item),
        estimatedMinutes: 6,
        sourceUrl: originalArticleUrl(item)
      };
    });
}

function researchLearningItems(selectedTopics) {
  const topicSet = selectedTopics.length ? selectedTopics : defaultKnowledgePlan.tracks;
  return languageMatchedItems(state.items)
    .filter(item => normalizeSection(item.platform_section) === "research" || /research|report|sigma|institute|publication/i.test(`${item.source || ""} ${item.title || ""}`))
    .filter(item => !topicSet.length || topicSet.some(topicId => topicMatchesArticle(topicId, item) && articleSuitableForTopic(topicId, item)))
    .slice(0, 2)
    .map(item => {
      const topicId = topicSet.find(topic => topicMatchesArticle(topic, item) && articleSuitableForTopic(topic, item)) || "Research";
      return {
        id: `research:${itemId(item)}`,
        topicId,
        type: "research",
        typeLabel: t("learningItemResearch"),
        title: localizedItemTitle(item),
        detail: localizedWhyItMatters(item) || localizedItemSummary(item),
        estimatedMinutes: 15,
        sourceUrl: originalArticleUrl(item)
      };
    });
}

function githubExampleItems(selectedTopics) {
  return selectedTopics.flatMap(topicId => {
    return openSourceResourcesForTopic(topicId).slice(0, 2).map(resource => ({
      id: `github:${topicId}:${resource.id}`,
      topicId,
      type: "github",
      typeLabel: t("learningItemGithubExample"),
      title: resource.name,
      detail: localizedRepositorySummary(resource),
      estimatedMinutes: resource.difficulty === "advanced" ? 18 : 12,
      sourceUrl: resource.github_url
    }));
  }).slice(0, 4);
}

function officialSourceItems(selectedTopics) {
  return selectedTopics.flatMap(topicId => {
    const topic = learningTopicOptions.find(item => item.id === topicId);
    const tracks = topic?.tracks || [topicId];
    return tracks.flatMap(track => resourcesForTrack(track).map(source => ({
      id: `source:${topicId}:${source.id || source.title}`,
      topicId,
      type: "source",
      typeLabel: t("learningItemOfficialSource"),
      title: source.title,
      detail: source[state.language] || source.en || source.type || "",
      estimatedMinutes: 12,
      sourceUrl: source.url
    })));
  }).slice(0, 4);
}

function renderTopicProgress(planItems) {
  if (!els.topicProgressList) return;
  const selectedTopics = state.knowledgePlan.tracks || [];
  els.topicProgressList.innerHTML = selectedTopics.map(topicId => {
    const total = Math.max(1, state.knowledge.filter(module => topicMatchesModule(topicId, module)).length);
    const completed = Math.min(total, Number(state.learningProgress.topicCompletions?.[topicId] || 0));
    const percent = Math.round((completed / total) * 100);
    return `
      <div class="topic-progress">
        <div><span>${escapeHtml(learningTopicLabel(topicId))}</span><strong>${completed}/${total}</strong></div>
        <span class="progress-track"><span style="width:${percent}%"></span></span>
      </div>
    `;
  }).join("");
}

function markLearningItemComplete(itemIdValue, topicId) {
  const todayKey = currentLearningDate();
  const snapshot = learningCompletionSnapshot(itemIdValue, topicId);
  state.learningProgress.completed[todayKey] = state.learningProgress.completed[todayKey] || {};
  state.learningProgress.completed[todayKey][itemIdValue] = snapshot;
  delete state.learningProgress.started?.[itemIdValue];
  if (topicId) {
    state.learningProgress.topicCompletions[topicId] = (state.learningProgress.topicCompletions[topicId] || 0) + 1;
  }
  saveLearningProgress();
  analyticsEvent("learning_completed", learningAnalyticsPayload(snapshot, {
    item_id: itemIdValue
  }));
  renderLearningPlan();
}

function learningCompletionSnapshot(itemIdValue, topicId) {
  const items = [
    ...generateTodaysLearningItems(),
    ...generateContinueLearningItems(),
    ...generateRecommendedLearningItems()
  ];
  const item = items.find(candidate => candidate.id === itemIdValue) || state.learningProgress.started?.[itemIdValue] || { id: itemIdValue, topicId };
  return {
    id: item.id || itemIdValue,
    topicId: item.topicId || topicId || "Fundamentals",
    type: item.type || "knowledge",
    typeLabel: item.typeLabel || learningTypeLabel(item.type),
    title: item.title || readableLearningId(itemIdValue),
    estimatedMinutes: item.estimatedMinutes || 10,
    sourceUrl: item.sourceUrl || "",
    openUrl: item.openUrl || "",
    completedAt: new Date().toISOString()
  };
}

function markLearningItemStarted(itemIdValue, topicId) {
  const items = [
    ...generateTodaysLearningItems(),
    ...generateRecommendedLearningItems()
  ];
  const item = items.find(candidate => candidate.id === itemIdValue) || { id: itemIdValue, topicId };
  state.learningProgress.started = state.learningProgress.started || {};
  state.learningProgress.started[itemIdValue] = {
    id: item.id,
    topicId: item.topicId || topicId || "Fundamentals",
    type: item.type || "knowledge",
    typeLabel: item.typeLabel || learningTypeLabel(item.type),
    title: item.title || itemIdValue,
    estimatedMinutes: item.estimatedMinutes || 10,
    sourceUrl: item.sourceUrl || "",
    openUrl: item.openUrl || "",
    startedAt: new Date().toISOString()
  };
  saveLearningProgress();
  analyticsEvent("learning_started", learningAnalyticsPayload(item, {
    item_id: itemIdValue
  }));
  renderLearningPlan();
}

function learningAnalyticsPayload(item, extra = {}) {
  return {
    item_type: item?.type || "knowledge",
    topic_id: item?.topicId || extra.topic_id || "",
    item_title: item?.title || "",
    estimated_minutes: item?.estimatedMinutes || "",
    ...extra
  };
}

function isLearningItemCompleted(itemIdValue) {
  return Object.values(state.learningProgress.completed || {}).some(day => Boolean(day?.[itemIdValue]));
}

function isLearningItemCompletedToday(itemIdValue) {
  const today = state.learningProgress.completed?.[currentLearningDate()] || {};
  return Boolean(today[itemIdValue]);
}

function isLearningItemCompletedBeforeToday(itemIdValue) {
  const today = currentLearningDate();
  return Object.entries(state.learningProgress.completed || {}).some(([date, day]) => date !== today && Boolean(day?.[itemIdValue]));
}

function calculateLearningStreak() {
  let streak = 0;
  const cursor = new Date(`${currentLearningDate()}T00:00:00`);
  while (streak < 365) {
    const key = formatDateKey(cursor);
    const day = state.learningProgress.completed[key] || {};
    if (!Object.values(day).some(Boolean)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function currentLearningDate() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function learningTopicLabel(topicId) {
  const topic = learningTopicOptions.find(item => item.id === topicId);
  return topic?.labels?.[state.language] || topic?.labels?.en || topicId;
}

function learningTopicFocus(topicId) {
  const topic = learningTopicOptions.find(item => item.id === topicId);
  return topic?.focus?.[state.language] || topic?.focus?.en || "";
}

function topicMatchesModule(topicId, module) {
  const topic = learningTopicOptions.find(item => item.id === topicId);
  if (!topic) return false;
  const haystack = [
    module.track,
    module.title,
    module.summary,
    displayKnowledgeTitle(module),
    displayKnowledgeSummary(module),
    ...(module.concepts || [])
  ].join(" ").toLowerCase();
  return (topic.tracks || []).some(track => module.track === track || haystack.includes(track.toLowerCase()))
    || (topic.keywords || []).some(keyword => haystack.includes(String(keyword).toLowerCase()));
}

function moduleSuitableForTopic(topicId, module) {
  const moduleId = String(module?.id || module?.topic_id || "").toLowerCase();
  const track = String(module?.track || "").toLowerCase();
  if (topicId === "Fundamentals") {
    return track === "fundamentals" || moduleId.startsWith("fundamentals");
  }
  if (topicId === "Insurance Fundamentals") {
    return (track === "insurance fundamentals" || moduleId.startsWith("insurance-fundamentals"))
      && !isAdvancedReinsuranceOrCatModule(module);
  }
  if (!["Reinsurance", "Catastrophe Risk"].includes(topicId) && isAdvancedReinsuranceOrCatModule(module)) {
    return false;
  }
  return true;
}

function isAdvancedReinsuranceOrCatModule(module) {
  const text = [
    module?.id,
    module?.topic_id,
    module?.track,
    module?.title,
    module?.summary,
    ...(module?.concepts || [])
  ].join(" ").toLowerCase();
  return text.includes("xol")
    || text.includes("excess of loss")
    || text.includes("catastrophe")
    || text.includes("cat bond")
    || text.includes("ils")
    || text.includes("pml")
    || text.includes("retrocession")
    || text.includes("巨灾")
    || text.includes("超赔");
}

function topicMatchesArticle(topicId, item) {
  const topic = learningTopicOptions.find(option => option.id === topicId);
  if (!topic) return false;
  const haystack = [
    item.title,
    item.original_title,
    item.summary,
    item.source,
    item.category,
    item.line_of_business,
    item.taxonomy_category,
    ...(item.taxonomy_tags || []),
    ...(item.tags || [])
  ].join(" ").toLowerCase();
  return (topic.keywords || []).some(keyword => haystack.includes(String(keyword).toLowerCase()))
    || (topic.tracks || []).some(track => haystack.includes(track.toLowerCase()));
}

function articleSuitableForTopic(topicId, item) {
  if (["Reinsurance", "Catastrophe Risk"].includes(topicId)) return true;
  const text = [
    item?.title,
    item?.original_title,
    item?.summary,
    item?.source,
    item?.category,
    item?.line_of_business,
    item?.branch,
    item?.platform_section,
    item?.taxonomy_category,
    ...(item?.taxonomy_tags || []),
    ...(item?.tags || [])
  ].join(" ").toLowerCase();
  const advancedReinsuranceOrCat = text.includes("reinsurance")
    || text.includes("reinsurer")
    || text.includes("catastrophe")
    || text.includes("cat bond")
    || text.includes("ils")
    || text.includes("xol")
    || text.includes("excess of loss")
    || text.includes("pml")
    || text.includes("再保险")
    || text.includes("再保")
    || text.includes("巨灾")
    || text.includes("超赔");
  if (topicId === "Fundamentals" || topicId === "Insurance Fundamentals") {
    return !advancedReinsuranceOrCat;
  }
  return !advancedReinsuranceOrCat;
}

function difficultyMatchesModule(module) {
  const selected = state.knowledgePlan.difficulty || "all";
  if (selected === "all") return true;
  return difficultyKey(module.difficulty) === selected;
}

function difficultyKey(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("基础") || normalized.includes("beginner") || normalized.includes("début")) return "beginner";
  if (normalized.includes("进阶") || normalized.includes("advanced") || normalized.includes("avancé")) return "advanced";
  return "intermediate";
}

function saveKnowledgePlan() {
  localStorage.setItem("actuaryRadar.knowledgePlan", JSON.stringify(state.knowledgePlan));
}

function saveLearningProgress() {
  localStorage.setItem("actuaryRadar.learningProgress", JSON.stringify(state.learningProgress));
}

function saveSourcePlan() {
  localStorage.setItem("actuaryRadar.sourcePlan", JSON.stringify(state.sourcePlan || []));
}

function sourcesForTrack(track) {
  const selectedSources = new Set(state.sourcePlan || sourceLibrary.map(source => source.id));
  const pool = sourceLibrary.filter(source => selectedSources.has(source.id));
  const exact = pool.filter(source => (source.tracks || []).includes(track));
  if (exact.length) return exact.slice(0, 3);
  return pool.filter(source => (source.tracks || []).some(sourceTrack => track?.includes(sourceTrack) || sourceTrack.includes(track))).slice(0, 3);
}

function resourcesForTrack(track) {
  const selectedSources = new Set(state.sourcePlan || sourceLibrary.map(source => source.id));
  const exact = specificResources.filter(resource => {
    return selectedSources.has(resource.sourceId) && (resource.tracks || []).includes(track);
  });
  if (exact.length) return exact.slice(0, 4);
  const fuzzy = specificResources.filter(resource => {
    if (!selectedSources.has(resource.sourceId)) return false;
    return (resource.tracks || []).some(resourceTrack => track?.includes(resourceTrack) || resourceTrack.includes(track));
  });
  if (fuzzy.length) return fuzzy.slice(0, 4);
  return sourcesForTrack(track).map(source => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    type: t("sourcePack")
  }));
}

function displayCatalogFocus(item) {
  const source = sourceLibrary.find(entry => (entry.tracks || []).includes(item.title));
  if (state.language !== "zh" && source) return source[state.language] || source.en;
  if (state.language === "zh") return item.focus || "";
  return source?.en || item.title;
}

function displayKnowledgeTitle(module) {
  return knowledgeField(module, "title") || module.title || module.topic_id || "";
}

function knowledgeCardAnchor(module) {
  return `knowledge-card-${String(module.id || module.topic_id || displayKnowledgeTitle(module)).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function displayKnowledgeSummary(module) {
  return knowledgeField(module, "description") || module.summary || "";
}

function displayKnowledgeQuestion(module) {
  return knowledgeField(module, "learning_question") || module.case?.question || "";
}

function displayKnowledgeAnswer(module) {
  const translation = module.translations?.[state.language] || {};
  if (translation?.generated_answer) return translation.generated_answer;
  if (state.language === "zh") return module.case?.reference_answer || noVerifiedSourceText();
  return noVerifiedSourceText();
}

function knowledgeField(module, field, locale = state.language) {
  const selected = module.translations?.[locale] || {};
  const zh = module.translations?.zh || {};
  return selected[field] || zh[field] || "";
}

function knowledgeTranslation(module, locale = state.language, allowZhFallback = true) {
  const translations = module.translations || {};
  const selected = translations[locale] || {};
  if (hasKnowledgeText(selected)) return selected;
  if (allowZhFallback && translations.zh) return translations.zh;
  return selected;
}

function hasKnowledgeText(value) {
  return Boolean(value?.title || value?.description || value?.learning_question || value?.generated_answer);
}

function knowledgeGrounding(module, locale = state.language) {
  const grounding = module.grounding || {};
  return grounding[locale] || grounding.zh || {};
}

function firstKnowledgeSourceLink(module) {
  return firstCuratedSourceForKnowledgeId(module.id || module.topic_id)?.url || "";
}

function renderKnowledgeSourceLinks(module) {
  return curatedKnowledgeSourcesForModule(module)
    .flatMap(group => group.sources.map(source => {
      const domain = source.domain ? ` · ${source.domain}` : "";
      return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}${escapeHtml(domain)}</a>`;
    }))
    .join("");
}

function renderCuratedKnowledgeSourceSection(module) {
  const groups = curatedKnowledgeSourcesForModule(module);
  if (!groups.length) return "";
  return `
    <div class="knowledge-section">
      <strong>${escapeHtml(t("referenceSources"))}</strong>
      <div class="curated-source-groups">
        ${groups.map(group => `
          <div class="curated-source-group">
            <small>${escapeHtml(sourceGroupLabel(group.group))}</small>
            <div class="source-link-list">
              ${group.sources.map(source => {
                const domain = source.domain ? ` · ${source.domain}` : "";
                return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}${escapeHtml(domain)}</a>`;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function curatedKnowledgeSourcesForModule(module) {
  const mapping = state.knowledgeSources.items?.[module.id || module.topic_id] || null;
  if (!mapping) return [];
  return ["official", "industry", "open_source", "research"]
    .map(group => ({
      group,
      sources: (mapping[group] || []).filter(source => source?.url && source?.title)
    }))
    .filter(group => group.sources.length);
}

function firstCuratedSourceForKnowledgeId(knowledgeId) {
  const mapping = state.knowledgeSources.items?.[knowledgeId] || null;
  if (!mapping) return null;
  for (const group of ["official", "industry", "open_source", "research"]) {
    const source = (mapping[group] || []).find(item => item?.url && item?.title);
    if (source) return { ...source, group };
  }
  return null;
}

function sourceGroupLabel(group) {
  const labels = {
    official: { zh: "官方来源", en: "Official Sources", fr: "Sources officielles" },
    industry: { zh: "行业来源", en: "Industry Sources", fr: "Sources sectorielles" },
    open_source: { zh: "开源案例", en: "Open Source Examples", fr: "Exemples open source" },
    research: { zh: "研究资料", en: "Research", fr: "Recherche" }
  };
  return labels[group]?.[state.language] || labels[group]?.en || group;
}

function renderOpenSourceResources(module) {
  const resources = openSourceResourcesForModule(module).slice(0, 3);
  if (!resources.length) return "";
  return `
    <div class="knowledge-section open-source-section">
      <div class="section-heading-row">
        <strong>${escapeHtml(t("openSourceResourcesTitle"))}</strong>
        <small>${escapeHtml(t("openSourceResourcesHint"))}</small>
      </div>
      <div class="open-source-grid">
        ${resources.map(resource => renderOpenSourceResourceCard(resource)).join("")}
      </div>
    </div>
  `;
}

function renderOpenSourceResourceCard(resource) {
  const summary = localizedRepositorySummary(resource);
  const useCases = (resource.use_cases || []).slice(0, 2).join(", ");
  const recommendedFor = (resource.recommended_for || []).slice(0, 2).join(", ");
  return `
    <article class="open-source-card">
      <div class="open-source-card-top">
        <strong>${escapeHtml(resource.name)}</strong>
        <span>${escapeHtml(resource.programming_language || "")}</span>
      </div>
      <p>${escapeHtml(summary)}</p>
      <dl>
        <div><dt>${escapeHtml(t("repositoryLicense"))}</dt><dd>${escapeHtml(resource.license || "-")}</dd></div>
        <div><dt>${escapeHtml(t("repositoryDifficulty"))}</dt><dd>${escapeHtml(displayRepositoryDifficulty(resource.difficulty))}</dd></div>
        ${useCases ? `<div><dt>${escapeHtml(t("repositoryUseCase"))}</dt><dd>${escapeHtml(useCases)}</dd></div>` : ""}
        ${recommendedFor ? `<div><dt>${escapeHtml(t("repositoryFor"))}</dt><dd>${escapeHtml(recommendedFor)}</dd></div>` : ""}
      </dl>
      <div class="open-source-actions">
        <a href="${escapeHtml(resource.github_url)}" target="_blank" rel="noopener">${escapeHtml(t("viewRepository"))} →</a>
        ${resource.official_website ? `<a href="${escapeHtml(resource.official_website)}" target="_blank" rel="noopener">${escapeHtml(t("sourceWebsite"))} →</a>` : ""}
      </div>
    </article>
  `;
}

function openSourceResourcesForModule(module) {
  const moduleText = [
    module.track,
    module.title,
    module.summary,
    displayKnowledgeTitle(module),
    displayKnowledgeSummary(module),
    displayKnowledgeQuestion(module),
    ...(module.concepts || [])
  ].join(" ").toLowerCase();
  return state.openSourceResources
    .map(resource => ({
      resource,
      score: openSourceResourceScore(resource, module, moduleText)
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.resource);
}

function openSourceResourcesForTopic(topicId) {
  const topic = learningTopicOptions.find(option => option.id === topicId);
  if (!topic) return [];
  const topicTerms = [
    topicId,
    ...(topic.tracks || []),
    ...(topic.keywords || [])
  ].map(value => String(value).toLowerCase());
  return state.openSourceResources
    .map(resource => {
      const haystack = [
        resource.id,
        resource.name,
        resource.owner,
        resource.programming_language,
        ...(resource.tracks || []),
        ...(resource.topics || []),
        ...(resource.business_lines || []),
        ...(resource.use_cases || [])
      ].join(" ").toLowerCase();
      const score = topicTerms.reduce((sum, term) => sum + (term && haystack.includes(term) ? 1 : 0), 0);
      return { resource, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.resource.curation?.quality_score || 0) - (a.resource.curation?.quality_score || 0))
    .map(entry => entry.resource);
}

function openSourceResourceScore(resource, module, moduleText) {
  const terms = [
    resource.id,
    resource.name,
    ...(resource.tracks || []),
    ...(resource.topics || []),
    ...(resource.business_lines || []),
    ...(resource.use_cases || [])
  ].map(value => String(value).toLowerCase());
  let score = Number(resource.curation?.quality_score || 0);
  terms.forEach(term => {
    if (term && moduleText.includes(term)) score += 1;
  });
  if ((resource.tracks || []).includes(module.track)) score += 3;
  return score;
}

function localizedRepositorySummary(resource) {
  return resource.summary?.[state.language] || resource.summary?.en || resource.name || "";
}

function displayRepositoryDifficulty(value) {
  const labels = {
    beginner: { zh: "入门", en: "Beginner", fr: "Débutant" },
    intermediate: { zh: "中级", en: "Intermediate", fr: "Intermédiaire" },
    advanced: { zh: "进阶", en: "Advanced", fr: "Avancé" }
  };
  return labels[value]?.[state.language] || value || "";
}

function displayKnowledgeGroundingStatus(module) {
  const grounding = knowledgeGrounding(module);
  const status = grounding.status || "pending";
  const retrieved = grounding.retrieved_at ? ` · ${grounding.retrieved_at.slice(0, 10)}` : "";
  const labels = {
    legacy_manual: { zh: "中文内容暂保留原人工答案，来源待逐卡验证", en: "Chinese legacy manual answer retained; card-level sources pending", fr: "Réponse d’origine conservée ; sources à vérifier fiche par fiche" },
    pending: { zh: "来源待检索", en: "Source retrieval pending", fr: "Sources en cours d’identification" },
    no_verified_source: { zh: "暂未找到可靠来源", en: "No verified source available yet", fr: "Aucune source vérifiée disponible pour l'instant" },
    seeded_trusted_source: { zh: "已匹配可信来源，答案待基于来源生成", en: "Trusted sources seeded; source-grounded answer pending", fr: "Sources de confiance associées ; réponse à finaliser" },
    source_supported_manual: { zh: "答案已结合可信来源整理", en: "Answer prepared with trusted source support", fr: "Réponse préparée à partir de sources de confiance" },
    sources_retrieved_answer_pending: { zh: "已检索来源，答案待生成", en: "Sources retrieved; answer pending", fr: "Sources identifiées ; réponse à rédiger" },
    verified: { zh: "来源已验证", en: "Sources verified", fr: "Sources vérifiées" }
  };
  return `${labels[status]?.[state.language] || status}${retrieved}`;
}

function noVerifiedSourceText() {
  const labels = {
    zh: "No verified source available yet.",
    en: "No verified source available yet.",
    fr: "Aucune source vérifiée disponible pour le moment."
  };
  return labels[state.language] || labels.en;
}

function displayDifficulty(value) {
  const labels = {
    "基础": { zh: "基础", en: "Foundation", fr: "Fondamentaux" },
    "中级": { zh: "中级", en: "Intermediate", fr: "Intermédiaire" },
    "进阶": { zh: "进阶", en: "Advanced", fr: "Avancé" }
  };
  return labels[value]?.[state.language] || value;
}

function renderAiAnswer(questionRaw) {
  const question = (questionRaw || "").trim();
  if (!question) {
    const prompts = {
      zh: "点击“总结3条新闻”，快速提炼今日最重要内容。",
      en: "Click “Summarize Top 3” to extract the most important items from the current briefing.",
      fr: "Cliquez sur « Résumer les 3 principales actualités » pour extraire les contenus essentiels de la veille."
    };
    els.aiAnswer.innerHTML = `<p>${escapeHtml(prompts[state.language] || prompts.en)}</p>`;
    return;
  }
  const answer = answerFromDigest(question, getFilteredItems());
  els.aiAnswer.innerHTML = answer;
}

function answerFromDigest(question, items) {
  const lower = question.toLowerCase();
  let pool = items.filter(item => item.ai_enriched && itemLanguage(item) === state.language);
  if (lower === "top3") {
  } else
  if (lower.includes("监管") || lower.includes("regulation") || lower.includes("solvency")) {
    pool = pool.filter(isRegulatoryItem);
  } else if (lower.includes("健康") || lower.includes("health") || lower.includes("santé") || lower.includes("sante")) {
    pool = pool.filter(item => item.line_of_business.includes("健康"));
  } else if (lower.includes("寿险") || lower.includes("life")) {
    pool = pool.filter(item => item.line_of_business.includes("寿险"));
  } else if (lower.includes("再保险") || lower.includes("reinsurance")) {
    pool = pool.filter(item => item.line_of_business.includes("再保险") || item.branch.includes("再保险"));
  } else if (lower.includes("科技") || lower.includes("ai") || lower.includes("insurtech")) {
    pool = pool.filter(item => item.platform_section.includes("科技"));
  }

  const top = [...pool].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
  if (!top.length) {
    return `<p>${escapeHtml(t("aiSummaryUnavailable"))}</p>`;
  }
  const intro = {
    zh: `AI 已总结 ${top.length} 条重点新闻：`,
    en: `AI-generated summary of the top ${top.length} items:`,
    fr: `Résumé IA des ${top.length} principales actualités :`
  };
  return [
    `<p><strong>${escapeHtml(intro[state.language] || intro.en)}</strong></p>`,
    `<ol class="ai-summary-list">`,
    ...top.map(item => {
      const bullets = summaryBullets(item);
      const takeaway = cardKeyTakeaway(item);
      const why = localizedWhyItMatters(item);
      const body = bullets.length
        ? `<ul>${bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
        : `<p>${escapeHtml(takeaway || why || localizedItemTitle(item))}</p>`;
      return [
        `<li>`,
        `<strong>${escapeHtml(localizedItemTitle(item))}</strong>`,
        takeaway ? `<p>${escapeHtml(takeaway)}</p>` : "",
        body,
        why ? `<small>${escapeHtml(why)}</small>` : "",
        `</li>`
      ].join("");
    }),
    `</ol>`
  ].join("");
}

function isRegulatoryItem(item) {
  const text = [
    item.title,
    item.source,
    item.category,
    item.platform_section,
    item.actuarial_angle
  ].join(" ").toLowerCase();
  return normalizeSection(item.platform_section) === "regulation"
    || item.category.includes("监管")
    || text.includes("eiopa")
    || text.includes("naic")
    || text.includes("solvency")
    || text.includes("监管")
    || text.includes("偿付");
}

function toggleSet(type, id) {
  const set = state[type];
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  localStorage.setItem(`actuaryDigest.${type}`, JSON.stringify([...set]));
  render();
}

function unique(key) {
  return [...new Set(state.items.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function itemId(item) {
  return item.url || `${item.title}-${item.published}`;
}

function t(key) {
  return pageCopy[state.language]?.[key] || pageCopy.zh[key] || key;
}

function displaySection(section) {
  const normalized = normalizeSection(section);
  return sectionLabels[normalized]?.[state.language] || sectionLabels[normalized]?.en || section;
}

function taxonomyGroup(groupName) {
  return taxonomy[groupName] || { allLabel: { en: "All", zh: "全部", fr: "Tous" }, options: [] };
}

function taxonomyOption(groupName, key) {
  return (taxonomyGroup(groupName).options || []).find(option => option.key === key);
}

function taxonomyLabel(groupName, key) {
  const group = taxonomyGroup(groupName);
  if (key === "all") return group.allLabel?.[state.language] || group.allLabel?.en || "All";
  const option = taxonomyOption(groupName, key);
  return option?.label?.[state.language] || option?.label?.en || key;
}

function taxonomyLabelForAnyGroup(key) {
  const groupNames = ["insuranceLine", "topic", "industry", "organizationType"];
  const groupName = groupNames.find(name => taxonomyOption(name, key));
  return groupName ? taxonomyLabel(groupName, key) : "";
}

function navIcon(name) {
  const icons = {
    home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/>',
    book: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H21v17H7.5A3.5 3.5 0 0 0 4 22.5v-17Z"/><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H21"/>',
    brief: '<path d="M7 7h10v14H7z"/><path d="M9 3h6v4H9z"/><path d="M10 12h4M10 16h4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    shield: '<path d="M12 3 20 6v6c0 5.5-3.2 8.8-8 10-4.8-1.2-8-4.5-8-10V6l8-3Z"/><path d="m8 12 2.6 2.6L16 9"/>',
    chip: '<path d="M8 8h8v8H8z"/><path d="M4 10h4M4 14h4M16 10h4M16 14h4M10 4v4M14 4v4M10 16v4M14 16v4"/>',
    network: '<circle cx="6" cy="8" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="18" r="2"/><path d="m8 9 3 7m5-7-3 7M8 8h8"/>',
    building: '<path d="M4 21V6l8-3 8 3v15"/><path d="M9 21v-5h6v5M8 9h1M12 9h1M16 9h1M8 13h1M12 13h1M16 13h1"/>',
    chart: '<path d="M4 20h16"/><path d="M7 17V9M12 17V5M17 17v-7"/><path d="m5 13 5-5 4 3 5-7"/>',
    folder: '<path d="M3 6h7l2 3h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/><path d="M3 10h18"/>',
    trend: '<path d="M4 17 9 12l4 4 7-9"/><path d="M15 7h5v5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.brief}</svg>`;
}

function displayValue(value) {
  if (!value) return "";
  if (sectionLabels[value]) return displaySection(value);
  const taxonomyLabel = taxonomyLabelForAnyGroup(value);
  if (taxonomyLabel) return taxonomyLabel;
  if (valueLabels[value]) return valueLabels[value][state.language] || value;
  if (state.language === "zh") return value;
  let translated = String(value);
  const entries = Object.entries(valueLabels)
    .filter(([source]) => source.length > 1)
    .sort(([a], [b]) => b.length - a.length);
  entries.forEach(([source, labels]) => {
    const label = labels[state.language];
    if (label) translated = translated.replaceAll(source, label);
  });
  return translated;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.ActuaryRadarDebug = {
  renderExportHtml: () => renderDailyBriefingExportHtml(getFilteredItems())
};

init();
