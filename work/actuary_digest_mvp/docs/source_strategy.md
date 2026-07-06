# 数据源扩展策略

这个平台的数据源分为两类：

1. **可自动抓取源**：RSS、搜索 RSS、公开 API。当前 MVP 优先用 Google News RSS 搜索做跨区域聚合。
2. **官方观察源**：监管网站、协会、上市公告、咨询报告入口。第一版先进入 `official_watchlist`，后续逐个做定制抓取器。

## 欧洲

- EIOPA：Solvency II、风险利率曲线、保险统计、数字化、可持续金融、消费者保护。
- IFoA：精算研究、气候风险、长寿风险、风险管理、职业学习。
- 欧洲上市保险公司公告：Allianz、AXA、Generali、Zurich、Aviva、Prudential 等。

## 美国

- NAIC：州监管、RBC、Life/Health/P&C、Innovation/AI、Private Credit、Climate。
- SOA：寿险、健康险、养老金、长寿风险、研究报告、继续教育。
- CAS：财险、车险、巨灾、责任险、数据科学。
- SEC EDGAR：MetLife、Prudential Financial、AIG、Chubb、Travelers、Progressive、Marsh McLennan、Aon、Arthur J. Gallagher 等财报。

## 中国

- 国家金融监督管理总局：监管政策、行政处罚、偿付能力、消费者保护、公司治理。
- 中国保险行业协会：行业要闻、保险科技、车险、研究报告、信息披露。
- 港交所披露易 / 上交所公告：上市险企财报、债券、分红、资本补充、战略公告。
- 公司官网投资者关系：中国平安、中国人寿、中国太保、新华保险、中国人保、中国再保险、众安在线等。

## 全球专业源

- IFRS Foundation：IFRS 17、IFRS 9、保险合同会计、可持续披露。
- Swiss Re Institute / Munich Re：再保险、巨灾、网络风险、气候风险、保护缺口。
- Milliman / WTW / Mercer / Deloitte / PwC / EY / KPMG / McKinsey：精算咨询、保险战略、资本管理、科技转型、行业报告。

## 每日必看新闻和市场源

- Insurance Journal：北美 P&C、Pricing、Underwriting、Claims、MGA、Cyber、Commercial Insurance。
- Reinsurance News：Cat losses、renewals、Lloyd's、Hannover Re、Munich Re、SCOR、Swiss Re、ILS。
- Artemis.bm：ILS、Cat Bond、Hurricane、Earthquake、Alternative Capital。
- Insurance Insider：Lloyd's、major deals、CEO 变动、并购、再保险市场；收费源，先纳入 watchlist。
- Commercial Risk Online：Captive、Corporate Insurance、Cyber、ESG、Climate。

## 法国和欧洲补充源

- Insurance Europe：Solvency II、Sustainability、Climate、Digital、AI Act。
- L'Argus de l'assurance：法国保险媒体，覆盖 AXA、CNP、Covéa、Allianz France、Generali France。
- News Assurances Pro：法国专业保险新闻和市场分析。
- Institut des Actuaires：Working Party、seminar、AI、climate、法国精算动态。

## 风险管理和评级源

- The Geneva Association：全球保险 CEO 智库，适合研究气候、保护缺口、系统性风险。
- FERMA / RIMS：欧洲和美国风险管理协会，适合企业风险和保险采购视角。
- AM Best / Fitch / Moody's / S&P Global Ratings：评级、capital、outlook、credit research。

## 保险科技、资本市场、巨灾气候

- Coverager / InsurTech Insights / The Digital Insurer：InsurTech、AI、Digital、Startups。
- Reuters / Morningstar / Seeking Alpha / MarketScreener / Yahoo Finance：IR、财报、估值、投资者观点。
- National Hurricane Center / ECMWF / NOAA / IPCC / Verisk / Moody's RMS：巨灾、气候、模型和数据。

## 平台板块映射

- 法规与资本雷达：监管网站、NAIC、EIOPA、NFRA、偿付能力、资本补充、处罚。
- 科技前沿与落地：保险科技、AI、数据、车联网、网络安全、自动化理赔、模型治理。
- 跨行业联动：银行、投行、车企、能源、医疗、数据中心、养老生态。
- 行业分支观察：再保险、保险经纪、代理渠道、财险、寿险、健康险、车险。
- 公司财报与战略：IFRS 17、CSM、EV/NBV、战略转型、资本政策、大保险公司公告。
- 研究方向与咨询报告：专业协会、再保研究、咨询公司报告和可复用方法论。
- 监管更新提醒：UI 会把 EIOPA、NAIC、Solvency、监管、偿付能力等相关内容提出来，优先提醒。

## 后续抓取器优先级

1. RSS/Search feeds：稳定、快速覆盖。
2. 官方公告列表 HTML：NFRA、IAChina、EIOPA、NAIC、HKEX、SSE。
3. 公司 Investor Relations：财报 PDF、业绩演示、战略日材料。
4. PDF 抽取与结构化：把财报、监管报告、咨询报告提取成摘要、指标和 action。
5. 用户偏好层：按地区、险种、分支、研究方向订阅。
