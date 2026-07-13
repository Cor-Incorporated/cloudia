# ADR-0003 contact-chat API 契約（corsweb）

## ステータス: Accepted (2026-07-10) / Revised (2026-07-10)

## 背景

- 決定前は Cloudia 固有の会話経路が corsweb のリード基盤と分断されていた。
- 要件: 要約確認、PII 最終収集、spam 分類、メール認証、Turnstile、レート制限。
- corsweb に `workers/contact-chat` が既に存在し、PII 境界が設計済み。

## 決定

### API 正本

corsweb `workers/contact-chat`（本番は同一オリジン `cor-jp.com/api/contact/*`）:

| Method | Path | 用途 | PII |
|---|---|---|---|
| POST | `/api/contact/chat` | 会話・分類。構造化ヒアリング | **要求・保存しない** |
| POST | `/api/contact/submit` | 氏名・メール等の確定送信 | メール本文のみ。**LLM に渡さない** |
| GET | `/api/contact/health` | 死活 | なし |

### クライアント方針

1. 本番埋め込み / 同一オリジン時は **相対パス**で呼ぶ。
2. 表示上の `reply` は **textContent のみ**（XSS 防止。Markdown HTML 化しない）。
3. 最終形は handoff リダイレクトのみにしない。**Cloudia 内で送信完了**まで行う。
4. 障害時は corsweb 最小フォーム / 電話へフォールバック。

### 現行 Worker レスポンス（chat）

```ts
{ reply: string; classification: 'genuine' | 'sales' | 'spam'; readyForContact: boolean }
```

### 拡張計画（corsweb #250 と同時）

| 段階 | 内容 |
|---|---|
| **P1a** | 既存 chat + submit 直結。intent / source / UTM / conversationSummary を submit に載せる |
| **P1b** | spam risk score、営業 3 段階キューヒント、structured fields |
| **P1c** | メールアドレス認証（magic link / OTP）エンドポイント |
| **P2** | 受付番号、管理 API、計測イベント |

### submit に載せる情報（目標）

- name, email, company, message
- conversationSummary（要約・利用者修正後）
- classification / spamRiskScore（サーバ再計算可）
- intent, source, UTM
- turnstileToken, website（ハニーポット）

### LLM 権限

- LLM は `/chat` の会話応答と分類ヒントのみ。
- **メール送信・永続化は Worker の決定論的コード**が実行（要件原則 2）。

## 理由

- 二重のメール通知経路を避ける。
- 既存の PII 境界を再利用する。
- Chatwoot 等の外部 Inbox を挟まない（ADR-0005）。

## 影響

- Cloudia: intake / ambassador とも contact-chat クライアントへ統一済み。AIプロバイダー認証はWorker側だけで扱う。
- corsweb Worker スキーマ拡張は #250。

## 代替案

- **常に `/contact/?intent=` へ飛ばすだけ**: フォーム代用にならないため最終形として却下。
- **Chatwoot Agent Bot 経由**: 運用・PII・ブランド分断のため却下（ADR-0005）。
