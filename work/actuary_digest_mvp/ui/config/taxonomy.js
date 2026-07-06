window.ActuaryRadarTaxonomy = {
  insuranceLine: {
    allLabel: { en: "All Lines", zh: "全部险种", fr: "Toutes les branches" },
    options: [
      {
        key: "life_insurance",
        label: { en: "Life Insurance", zh: "寿险", fr: "Assurance vie" },
        aliases: ["life_insurance"],
        keywords: ["life", "annuity", "mortality", "assurance vie", "寿险", "年金"]
      },
      {
        key: "health_insurance",
        label: { en: "Health Insurance", zh: "健康险", fr: "Santé & prévoyance" },
        aliases: ["health_insurance"],
        keywords: ["health", "medical", "prévoyance", "protection", "complémentaire santé", "健康", "医疗"]
      },
      {
        key: "property_casualty",
        label: { en: "Property & Casualty (P&C)", zh: "财产险", fr: "Assurance dommages" },
        aliases: ["non_life_insurance"],
        keywords: ["p&c", "property", "casualty", "non-life", "assurance dommages", "liability", "claims", "财险", "财产", "责任险", "理赔"]
      },
      {
        key: "commercial_insurance",
        label: { en: "Commercial Insurance", zh: "商业保险", fr: "Risques d'entreprise" },
        aliases: [],
        keywords: ["commercial insurance", "corporate insurance", "business insurance", "enterprise risk", "commercial risk", "企业保险", "商业保险"]
      },
      {
        key: "specialty_insurance",
        label: { en: "Specialty Insurance", zh: "特殊险", fr: "Risques spéciaux" },
        aliases: ["cyber_risk", "catastrophe_risk", "climate_risk"],
        keywords: ["specialty", "cyber", "marine", "aviation", "energy insurance", "political risk", "financial lines", "d&o", "trade credit", "surety", "特殊险", "网络风险", "金融险", "信贷保险", "董责险"]
      },
      {
        key: "reinsurance",
        label: { en: "Reinsurance", zh: "再保险", fr: "Réassurance" },
        aliases: ["reinsurance"],
        keywords: ["reinsurance", "reinsurer", "retrocession", "cat bond", "ils", "réassurance", "再保险", "再保"]
      }
    ]
  },
  topic: {
    allLabel: { en: "All Topics", zh: "全部主题", fr: "Tous les thèmes" },
    options: [
      { key: "regulation", label: { en: "Regulation", zh: "监管", fr: "Réglementation" }, aliases: ["regulation"], keywords: ["regulation", "regulator", "supervision", "eiopa", "naic", "acpr", "nfra", "监管", "合规"] },
      { key: "pricing", label: { en: "Pricing", zh: "定价", fr: "Tarification" }, aliases: ["pricing"], keywords: ["pricing", "tariff", "premium", "rate change", "tarification", "定价", "费率", "保费"] },
      { key: "reserving", label: { en: "Reserving", zh: "准备金", fr: "Provisionnement" }, aliases: ["reserving"], keywords: ["reserving", "reserve", "claims reserve", "ibnr", "provisionnement", "准备金"] },
      { key: "claims", label: { en: "Claims", zh: "理赔", fr: "Gestion des sinistres" }, aliases: ["claims"], keywords: ["claims", "claim", "sinistre", "loss ratio", "理赔", "赔付"] },
      { key: "underwriting", label: { en: "Underwriting", zh: "核保/承保", fr: "Souscription" }, aliases: [], keywords: ["underwriting", "underwriter", "承保", "核保", "souscription"] },
      { key: "risk_management", label: { en: "Risk Management", zh: "风险管理", fr: "Gestion des risques" }, aliases: ["risk_management"], keywords: ["risk management", "erm", "orsa", "risk appetite", "风险管理"] },
      { key: "capital_management", label: { en: "Capital Management", zh: "资本管理", fr: "Gestion du capital" }, aliases: [], keywords: ["capital", "own funds", "rbc", "capital management", "资本"] },
      { key: "investment", label: { en: "Investment & ALM", zh: "投资与 ALM", fr: "Investissements & ALM" }, aliases: ["investment"], keywords: ["investment", "alm", "asset liability", "yield", "duration", "投资", "资产负债"] },
      { key: "ifrs17", label: { en: "IFRS 17", zh: "IFRS 17", fr: "IFRS 17" }, aliases: ["ifrs17"], keywords: ["ifrs 17", "ifrs17", "csm", "insurance contract accounting", "合同服务边际"] },
      { key: "solvency2", label: { en: "Solvency II", zh: "Solvency II", fr: "Solvabilité II" }, aliases: ["solvency_ii"], keywords: ["solvency ii", "scr", "mcr", "solvabilité ii", "偿付能力"] },
      { key: "ai", label: { en: "AI & InsurTech", zh: "AI 与保险科技", fr: "InsurTech & IA" }, aliases: ["data_ai", "insurtech"], keywords: ["ai", "artificial intelligence", "machine learning", "insurtech", "digital insurer", "人工智能", "保险科技"] },
      { key: "climate", label: { en: "Climate Risk", zh: "气候风险", fr: "Risque climatique" }, aliases: ["climate_risk"], keywords: ["climate", "transition risk", "physical risk", "气候"] },
      { key: "catastrophe", label: { en: "Catastrophe Risk", zh: "巨灾风险", fr: "Risque catastrophe" }, aliases: ["catastrophe_risk"], keywords: ["catastrophe", "nat cat", "hurricane", "earthquake", "flood", "wildfire", "巨灾", "洪水", "地震"] },
      { key: "esg", label: { en: "ESG", zh: "ESG", fr: "ESG" }, aliases: [], keywords: ["esg", "sustainability", "sustainable", "可持续"] },
      { key: "ma", label: { en: "M&A", zh: "并购", fr: "M&A" }, aliases: [], keywords: ["m&a", "merger", "acquisition", "deal", "并购", "收购"] },
      { key: "digital", label: { en: "Digital Transformation", zh: "数字化转型", fr: "Transformation digitale" }, aliases: [], keywords: ["digital transformation", "automation", "platform", "数字化", "自动化"] },
      { key: "market", label: { en: "Market Outlook", zh: "市场展望", fr: "Tendances de marché" }, aliases: [], keywords: ["outlook", "market", "renewal", "forecast", "trend", "展望", "趋势", "市场"] }
    ]
  },
  industry: {
    allLabel: { en: "All Industries", zh: "全部行业", fr: "Tous secteurs" },
    options: [
      { key: "insurance", label: { en: "Insurance", zh: "保险", fr: "Assurance" }, aliases: [], keywords: ["insurance", "insurer", "reinsurance", "保险", "再保险"] },
      { key: "financial_services", label: { en: "Financial Services", zh: "金融服务", fr: "Services financiers" }, aliases: [], keywords: ["bank", "capital markets", "investment bank", "asset management", "private credit", "rating", "银行", "投行", "资本市场", "信贷"] },
      { key: "technology_ai", label: { en: "Technology & AI", zh: "科技与 AI", fr: "Technologies & IA" }, aliases: [], keywords: ["technology", "ai", "cloud", "data", "cyber", "科技", "人工智能", "云"] },
      { key: "healthcare", label: { en: "Healthcare", zh: "医疗健康", fr: "Santé" }, aliases: [], keywords: ["healthcare", "hospital", "medical", "pharma", "医疗", "健康"] },
      { key: "energy", label: { en: "Energy", zh: "能源", fr: "Énergie" }, aliases: [], keywords: ["energy", "renewable", "power", "oil", "gas", "能源", "电力"] },
      { key: "mobility", label: { en: "Mobility & Automotive", zh: "出行与汽车", fr: "Mobilité & automobile" }, aliases: [], keywords: ["auto", "motor", "vehicle", "ev", "mobility", "汽车", "车企", "出行"] },
      { key: "real_estate", label: { en: "Real Estate & Infrastructure", zh: "房地产与基建", fr: "Immobilier & infrastructure" }, aliases: [], keywords: ["real estate", "infrastructure", "construction", "房地产", "基建", "工程"] },
      { key: "agriculture", label: { en: "Agriculture", zh: "农业", fr: "Agriculture" }, aliases: [], keywords: ["agriculture", "crop", "food", "农业", "农险", "食品"] },
      { key: "retail", label: { en: "Retail & E-commerce", zh: "零售与电商", fr: "Distribution & e-commerce" }, aliases: [], keywords: ["retail", "e-commerce", "ecommerce", "零售", "电商"] },
      { key: "government", label: { en: "Government & Public Sector", zh: "政府与公共部门", fr: "Secteur public" }, aliases: [], keywords: ["government", "public sector", "政府", "公共部门"] },
      { key: "consulting", label: { en: "Consulting & Professional Services", zh: "咨询与专业服务", fr: "Conseil & services professionnels" }, aliases: [], keywords: ["consulting", "professional services", "milliman", "wtw", "deloitte", "pwc", "kpmg", "ey", "mckinsey", "咨询"] },
      { key: "other", label: { en: "Other", zh: "其他", fr: "Autre" }, aliases: [], keywords: [] }
    ]
  },
  organizationType: {
    allLabel: { en: "All Organizations", zh: "全部机构", fr: "Tous les acteurs" },
    options: [
      { key: "insurer", label: { en: "Insurers", zh: "保险公司", fr: "Assureurs" }, aliases: [], keywords: ["insurer", "insurance company", "axa", "allianz", "zurich", "generali", "aviva", "保险公司", "险企"] },
      { key: "reinsurer", label: { en: "Reinsurers", zh: "再保险公司", fr: "Réassureurs" }, aliases: [], keywords: ["reinsurer", "reinsurance", "swiss re", "munich re", "hannover re", "scor", "再保险"] },
      { key: "broker", label: { en: "Brokers", zh: "经纪公司", fr: "Courtiers" }, aliases: [], keywords: ["broker", "brokerage", "marsh", "aon", "wtw", "courtage", "经纪"] },
      { key: "mga_agent", label: { en: "MGAs & Agents", zh: "MGA 与代理", fr: "MGA & agents généraux" }, aliases: [], keywords: ["mga", "agent", "agency", "代理"] },
      { key: "regulator", label: { en: "Regulators", zh: "监管机构", fr: "Superviseurs" }, aliases: [], keywords: ["regulator", "supervisor", "eiopa", "naic", "acpr", "nfra", "监管"] },
      { key: "association", label: { en: "Associations", zh: "协会", fr: "Associations" }, aliases: [], keywords: ["association", "soa", "ifoa", "cas", "insurance europe", "协会"] },
      { key: "consulting", label: { en: "Consulting Firms", zh: "咨询公司", fr: "Cabinets de conseil" }, aliases: [], keywords: ["consulting", "milliman", "wtw", "deloitte", "pwc", "kpmg", "ey", "mckinsey", "咨询"] },
      { key: "rating_agency", label: { en: "Rating Agencies", zh: "评级机构", fr: "Agences de notation" }, aliases: [], keywords: ["rating", "am best", "fitch", "moody", "s&p", "评级"] },
      { key: "other", label: { en: "Other", zh: "其他", fr: "Autre" }, aliases: [], keywords: [] }
    ]
  }
};
