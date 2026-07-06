# 保险精算人每日情报与行动系统 MVP

这个原型会每天抓取保险/精算相关 RSS 信息，并生成两份日报。它现在按“自我学习平台”的方向组织内容，而不是只做新闻摘要：

- Markdown：适合沉淀到知识库、Notion、公众号草稿
- HTML：适合直接打开阅读和分享

日报不是单纯摘要，而是每条信息都包含：

- 摘要
- 精算影响
- 风险等级
- 建议行动
- 今日学习点
- 可分享版本
- 地区：欧洲 / 美国 / 中国 / 全球
- 险种：寿险、健康险、财险、车险、再保险等
- 分支：保险公司、再保险、经纪中介、监管/协会、跨行业生态
- 平台板块：法规资本、科技前沿、跨行业联动、公司财报战略、咨询研究

## 快速运行

```bash
python3 work/actuary_digest_mvp/src/digest.py
```

也可以用封装脚本：

```bash
work/actuary_digest_mvp/run_daily.sh
```

如果当前网络不可用，可以强制使用样例数据：

```bash
python3 work/actuary_digest_mvp/src/digest.py --sample-only
```

或：

```bash
work/actuary_digest_mvp/run_daily.sh --sample-only
```

输出会写入：

```text
outputs/insurance_actuary_digest_YYYY-MM-DD.md
outputs/insurance_actuary_digest_YYYY-MM-DD.html
outputs/insurance_actuary_digest_YYYY-MM-DD.json
```

同时会同步一份给 UI：

```text
work/actuary_digest_mvp/ui/data/digest.json
```

## 启动 UI

本地启动静态服务：

```bash
python3 -m http.server 8787
```

浏览器打开：

```text
http://localhost:8787/work/actuary_digest_mvp/ui/
```

当前 UI 已支持：

- 今日主题和每周学习任务
- 每日精算概念复习
- 地区、险种、联动行业、风险、分支筛选
- 平台板块导航
- 关键词搜索
- Action 标记和完成状态
- 分享摘要复制
- 按日期加载 `outputs/insurance_actuary_digest_YYYY-MM-DD.json`
- 监管更新提醒
- Top 5 精选情报
- 本地 AI 学习助手：基于当前日报内容回答问题、生成复习题、总结监管提醒

## 构建可部署网站

生成独立静态网站：

```bash
python3 work/actuary_digest_mvp/src/build_site.py
```

正式部署前建议带上你的真实域名，这样 `sitemap.xml`、`robots.txt`、canonical URL 才是正确的：

```bash
python3 work/actuary_digest_mvp/src/build_site.py --base-url https://your-domain.com
```

输出目录：

```text
outputs/actuary_radar_site/
```

本地预览：

```bash
python3 -m http.server 8787
```

打开：

```text
http://localhost:8787/outputs/actuary_radar_site/
```

部署时把整个 `outputs/actuary_radar_site/` 文件夹上传到 GitHub Pages、Netlify、Vercel 或任意静态托管服务即可。

构建器会生成：

```text
robots.txt
sitemap.xml
SEO meta tags
Open Graph meta tags
Schema.org WebApplication structured data
```

## 每日自动更新

生产 MVP 使用 GitHub Actions 做每日自动化：

```text
.github/workflows/daily-digest.yml
```

工作流会：

1. 在 Europe/Paris 每天 08:00 生成当天日报。
2. 运行 `digest.py` 抓取 RSS 并生成 JSON / HTML / Markdown。
3. 运行 `build_site.py` 重建 `outputs/actuary_radar_site/`。
4. 验证 `outputs/actuary_radar_site/data/digest.json` 的日期是否等于当天。
5. 自动提交更新文件。

GitHub cron 使用 UTC，所以 workflow 同时在 `06:00 UTC` 和 `07:00 UTC` 触发，并在脚本里判断 Paris 当前小时。只有 Paris 时间 08:00 的那一次会真正更新，避免夏令时/冬令时偏移。

如果 Netlify 或 Vercel 已经连接这个 GitHub 仓库，新的自动提交会触发重新部署。

当前自动化仍然是静态站 MVP：它会持久更新 JSON/HTML 文件，但还没有数据库、后台队列、用户账户和服务器端学习进度。完整生产架构见：

```text
work/actuary_digest_mvp/docs/production_automation_architecture.md
```

## 每周主题安排

编辑：

```text
work/actuary_digest_mvp/config/preferences.json
```

默认安排：

- 周一：寿险与年金
- 周二：健康险与医疗趋势
- 周三：财险、车险与巨灾风险
- 周四：再保险、经纪与风险转移
- 周五：IFRS 17、财报与资本管理
- 周六：保险科技与跨行业联动
- 周日：研究报告、战略复盘与下周计划

默认个人关注标签：

```text
寿险、健康险、财险、再保险、IFRS 17、资本管理
```

系统会根据当天主题给相关内容加权排序，但不会完全屏蔽其他重要信息。

## Gmail 邮件推送

脚本支持用 Gmail SMTP 发送日报。不要把密码写进代码，使用 Gmail App Password：

```bash
export GMAIL_ADDRESS="user@example.com"
export GMAIL_APP_PASSWORD="gmail_app_password_placeholder"
```

发送给一个收件人：

```bash
python3 work/actuary_digest_mvp/src/digest.py --send-email --email-to user@example.com
```

发送给多个收件人：

```bash
python3 work/actuary_digest_mvp/src/digest.py --send-email --email-to user@example.com --email-to team@example.com
```

也可以把默认收件人写入：

```text
work/actuary_digest_mvp/config/preferences.json
```

对应字段：

```json
"email": {
  "subject_prefix": "保险精算每日学习简报",
  "default_recipients": ["user@example.com"]
}
```

邮件正文会包含 HTML 日报，并附带 Markdown 和 JSON 文件，方便你继续沉淀知识库或接 UI。

## 配置数据源

编辑：

```text
work/actuary_digest_mvp/config/sources.json
```

当前配置分两层：

- `rss_sources`：可以直接抓取的 RSS/Search feed。
- `official_watchlist`：监管网站、协会、上市公告、专业机构、咨询公司和再保研究入口，后续逐个做定制抓取器。

已覆盖方向：

- 国家金融监督管理总局
- 中国保险行业协会
- 港交所披露易 / 上交所公告
- EIOPA / NAIC
- Insurance Europe / L'Argus de l'assurance / News Assurances Pro / Institut des Actuaires
- 上市保险公司公告
- SOA / IFoA / CAS
- IFRS Foundation
- Insurance Journal / Reinsurance News / Artemis.bm / Commercial Risk Online
- 财险细分：责任险、网络安全保险、工程险/能源险、特殊险/政治风险、金融险/专业责任、信用/保证保险
- Swiss Re / Munich Re / Hannover Re / SCOR
- Coverager / InsurTech Insights / The Digital Insurer
- AM Best / Fitch / Moody's / S&P Global Ratings
- National Hurricane Center / ECMWF / NOAA / IPCC / Verisk / Moody's RMS
- McKinsey / BCG / Bain / Deloitte / PwC / KPMG / EY / Oliver Wyman / Milliman / WTW
- Reuters / Morningstar / Seeking Alpha / MarketScreener / Yahoo Finance
- 大公司财报/战略池：Allianz、AXA、Zurich、Generali、Aviva、Prudential、AIG、Chubb、Travelers、Progressive、MetLife、Manulife、Sun Life、中国平安、中国人寿、中国太保、中国人保、新华保险、中国再保险

更完整的数据源策略见：

```text
work/actuary_digest_mvp/docs/source_strategy.md
```

## 后续产品化建议

1. UI 首页：今日简报、地区切换、险种切换、板块筛选。
2. 知识库：每天的 Markdown 入库，按概念、公司、地区、险种自动打标签。
3. Action 看板：把“建议行动”转成待办、复盘和学习记录。
4. 财报模块：大保险公司财报 PDF 解析，生成 IFRS 17、EV/NBV、资本策略解读。
5. 报告模块：咨询公司/再保/协会报告摘要，提炼研究方向和方法论。
6. 分享模块：生成公众号版、微信群三句话版、内部 briefing 版。
7. 反馈层：对 action 标注“有用/无用”，逐步训练个人偏好。

## 本地定时运行

macOS 可以用 `crontab -e` 加一行，例如每天早上 8 点生成：

```cron
0 8 * * * cd /path/to/insuranceactuaryhub && ./work/actuary_digest_mvp/run_daily.sh
```

每天早上 8 点生成并用 Gmail 推送：

```cron
0 8 * * * cd /path/to/insuranceactuaryhub && ./work/actuary_digest_mvp/run_daily.sh --send-email --email-to user@example.com
```

如果你要分享给别人，最简单的方式是把当天的 HTML 文件发给对方；更进一步可以把 `outputs/` 部署到 GitHub Pages、Notion 或一个轻量网站。
