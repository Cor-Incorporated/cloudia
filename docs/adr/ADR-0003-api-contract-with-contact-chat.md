# ADR-0003 contact-chat API 契約（corsweb）

## ステータス: Accepted (2026-07-10)

## 背景
- 現状 Gemini / Netlify Functions で会話しており、corsweb のリード基盤と分断されている。
- Contact フォーム代用にするには、PII 境界と通知経路を corsweb と統一する必要がある。

## 決定

### API 正本
corsweb `workers/contact-chat`:

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/contact/chat` | 会話・分類。PII を要求・保存しない |
| POST | `/api/contact/submit` | 氏名・メール等。PII はメールのみ。LLM に渡さない |
| GET | `/api/contact/health` | 死活 |

### クライアント方針
1. 本番埋め込み時は **同一オリジン**（`cor-jp.com`）で呼ぶ。
2. `intent` / `source` / UTM / 会話要約を submit に載せる（Worker 側スキーマ拡張が必要なら corsweb Issue）。
3. 表示上の `reply` は **textContent のみ**（XSS 防止。corsweb ContactChat と同方針）。
4. 最終形は **handoff リダイレクトのみにしない**。API 直結で送信完了まで Cloudia 内で行う。
5. 障害時は corsweb の最小フォーム / 電話へフォールバック。

### 段階
| 段階 | 内容 |
|---|---|
| P1 | API 直結（chat + submit）。必要なら Worker に intent フィールド追加 |
| P2 | 構造化フィールドを Worker と型共有。計測イベント連携 |

## 理由
- PII を LLM に渡さない既存設計を再利用する。
- 二重のメール通知経路を避ける。

## 影響
- `services/geminiService.ts` 等を contact-chat クライアントに置換または分岐。
- corsweb Worker のスキーマ拡張 Issue と同時進行。

## 代替案
- **常に `/contact/?intent=` へ飛ばすだけ**: フォーム代用にならないため最終形としては却下。
