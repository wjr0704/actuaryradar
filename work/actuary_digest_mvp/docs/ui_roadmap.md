# UI 产品路线

目标：把当前脚本封装成一个可分享的精算人自我学习平台。

## 第一版界面

- 顶部：日期、地区切换、险种筛选、板块筛选。
- 左侧导航：
  - 今日简报
  - 法规与资本雷达
  - 科技前沿与落地
  - 跨行业联动
  - 再保险与经纪
  - 财报与战略
  - 研究报告
  - 每日精算概念
  - Action 看板
- 主内容：信息卡片，每张卡包含摘要、精算影响、行动建议、学习点、可分享版本。
- 右侧：今日概念、关注公司、关注主题、待复盘 action。

已实现的静态 MVP：

```text
work/actuary_digest_mvp/ui/index.html
work/actuary_digest_mvp/ui/styles.css
work/actuary_digest_mvp/ui/app.js
```

启动：

```bash
python3 -m http.server 8787
```

访问：

```text
http://localhost:8787/work/actuary_digest_mvp/ui/
```

## 数据模型

每条内容应结构化为：

```json
{
  "title": "标题",
  "url": "原文链接",
  "source": "来源",
  "region": "中国/欧洲/美国/全球",
  "source_type": "监管/协会/公告/咨询/新闻",
  "platform_section": "平台板块",
  "line_of_business": "险种",
  "branch": "保险公司/再保险/经纪/跨行业",
  "summary": "摘要",
  "actuarial_angle": "精算人视角",
  "actions": ["行动 1", "行动 2"],
  "learning_prompt": "学习问题",
  "shareable": "可分享版本"
}
```

## 技术建议

- MVP UI：Next.js 或 Vite + React，本地读取 `outputs/*.json` 或 Markdown。
- 后端：Python FastAPI，复用现有 `digest.py` 的采集和分类逻辑。
- 存储：先用 SQLite，后续迁移 PostgreSQL。
- 定时任务：本地 cron，部署后用 GitHub Actions、Cloudflare Workers 或服务器 cron。
- 分享：HTML 静态页、邮件、飞书/企业微信 webhook、微信公众号草稿。

## UI 迭代顺序

1. 已完成：生成结构化 JSON 输出。
2. 已完成：本地静态 HTML dashboard。
3. 下一步：迁移到 React 交互界面，支持更强的筛选、收藏和学习笔记。
4. 下一步：加 Action 看板、复盘记录和用户偏好。
5. 下一步：加用户订阅、分享链接和多用户权限。
