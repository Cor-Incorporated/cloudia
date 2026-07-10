# Architecture Decision Records (ADR) — Cloudia

本リポジトリ（現: `terisuke/3d-emotional-chat-ai`）の Cloudia に関する決定記録。

## 最終ゴール（固定）

1. **お問い合わせフォームの代用チャットボット**として `Cor-Incorporated/corsweb2024` に統合する  
2. GitHub リポジトリを **`Cor-Incorporated` org へ移管**する  
3. ホスティングを **Netlify → Cloudflare** に寄せる  
4. バックエンド API 正本は corsweb の **`workers/contact-chat`**（`cor-jp.com/api/contact/*`）

## 一覧

| ADR | タイトル | ステータス |
|---|---|---|
| [ADR-0001](./ADR-0001-b2b-intake-role-and-modes.md) | B2B 受付モードと SNS モードの分離 | Accepted (2026-07-10) |
| [ADR-0002](./ADR-0002-cloudflare-hosting-and-corsweb-embed.md) | Cloudflare ホスティングと corsweb 埋め込み | Accepted (2026-07-10) |
| [ADR-0003](./ADR-0003-api-contract-with-contact-chat.md) | contact-chat API 契約 | Accepted (2026-07-10) |
| [ADR-0004](./ADR-0004-repo-transfer-to-cor-incorporated.md) | Cor-Incorporated へのリポ移管 | Accepted (2026-07-10) |

## 参照

- corsweb ADR-0005 / ADR-0012
- 監査資料 `Cor_Grift_サイト刷新提案_2026-07-10.md` §6
