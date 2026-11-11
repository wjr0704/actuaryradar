import assert from "node:assert/strict";
import test from "node:test";

import {
  newsletterKeyTakeaway,
  pickNewsletterStories
} from "../netlify/functions/shared/newsletter-service.mjs";

test("prefers a source-grounded localized takeaway", () => {
  const item = {
    key_takeaway: { zh: "新规细化了保险公司高管任职条件和监管分工。" },
    summary: "原标题 - 媒体",
    original_url: "https://example.com/article",
    summary_basis: "article_text"
  };
  assert.equal(
    newsletterKeyTakeaway(item, "zh", "保险公司高管任职资格新规征求意见"),
    "新规细化了保险公司高管任职条件和监管分工。"
  );
});

test("rejects title-like Google News RSS descriptions", () => {
  const title = "保险公司高管任职资格新规征求意见";
  const item = {
    key_takeaway: { zh: "" },
    summary: `${title} - 东方财富`,
    original_url: "https://news.google.com/rss/articles/example",
    summary_basis: "rss_excerpt"
  };
  assert.equal(newsletterKeyTakeaway(item, "zh", title), "");
});

test("rejects non-grounded localized copy on Google News items", () => {
  const item = {
    key_takeaway: { zh: "这是一条看似合理但没有原文依据的概括。" },
    original_url: "https://news.google.com/rss/articles/example",
    summary_basis: "title_only"
  };
  assert.equal(newsletterKeyTakeaway(item, "zh", "保险市场出现新动态"), "");
});

test("omits the takeaway while retaining why it matters", () => {
  const title = "保险公司高管任职资格新规征求意见";
  const digest = {
    daily_picks: { ids_by_language: { zh: ["google-item"] } },
    items: [{
      url: "google-item",
      original_url: "https://news.google.com/rss/articles/example",
      original_title: title,
      source_language: "zh",
      source_name: "东方财富",
      key_takeaway: { zh: title },
      why_it_matters: { zh: "该规则会影响保险公司治理和高管准入。" },
      summary: `${title} - 东方财富`
    }]
  };
  const [story] = pickNewsletterStories(digest, "zh", 1);
  assert.equal(story.keyTakeaway, "");
  assert.equal(story.whyItMatters, "该规则会影响保险公司治理和高管准入。");
});
