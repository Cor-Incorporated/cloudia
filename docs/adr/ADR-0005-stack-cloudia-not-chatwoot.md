# ADR-0005 スタック選定 — Cloudia + contact-chat（Chatwoot 不採用）

## ステータス: Accepted (2026-07-10)

## 背景

OSS 調査により、企業 HP 向けチャットとして次が候補に挙がった。

- **Chatwoot**（ウィジェット + Inbox + Agent Bot Webhook）
- **Tiledesk** / **Papercups**
- UI のみ: **chatscope/chat-ui-kit-react**, **assistant-ui**
- 会話制御: LangGraph / Rasa / n8n

一方、Cor では既に次が存在する。

- corsweb `workers/contact-chat`（chat / submit / Turnstile / Resend / rate limit）
- Cloudia（表情アバター・intake トーン・intent 連携予定）
- corsweb ADR-0012（Cloudia = フォーム代用 UI）

## 決定

### 採用スタック

| 層 | 正本 |
|---|---|
| UI | **Cloudia**（LINE 風吹き出し + 8 表情 PNG） |
| API | **corsweb contact-chat Worker** |
| 通知 | Resend メール（初期）。Slack は後続 |
| ホスト | Cloudflare |
| 会話状態 | Cloudia クライアント + Worker（必要なら拡張）。LangGraph は設計参考のみ |

### 不採用

| 候補 | 判定 | 理由 |
|---|---|---|
| **Chatwoot** | Rejected（Contact 本線） | 運用が Contact 1 導線に過剰。PII・ブランド・同一オリジン設計が contact-chat と二重化 |
| Tiledesk / Papercups | Rejected | 同上（プラットフォーム依存） |
| chatscope / assistant-ui | **任意** | LINE 風実装の部品として評価可。必須ではない |
| LangGraph 必須化 | Rejected | TS/Worker 中心の既存資産と不整合。状態機械の概念は取り入れる |

### 将来

オムニチャネル（LINE / WhatsApp 等）が本格要件になった場合は **別 Epic** で Chatwoot 等を再評価する。現在のフォーム代用スコープでは対象外。

## 理由

- 要件は「審査付きお問い合わせ受付」であり汎用サポート Inbox ではない。
- 既存 Worker の PII 境界を壊さない。
- Cloudia ブランド（表情・トーン）を Cor の Contact 本線に載せられる。

## 影響

- 実装 Issue は Cloudia UI + contact-chat 直結を前提に切る。
- 調査メモの「Chatwoot + LangGraph 推奨」は本 ADR により **Cor Contact では採用しない**。

## 代替案

- **Chatwoot を UI だけ使い Bot は自前**: それでも Inbox 運用とデプロイが増えるため却下。
