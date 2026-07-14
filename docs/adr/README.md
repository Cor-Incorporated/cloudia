# Architecture Decision Records (ADR) — Cloudia

本リポジトリ（`Cor-Incorporated/cloudia`、旧: `terisuke/3d-emotional-chat-ai`）の決定記録。

## 最終ゴール（固定）

1. **お問い合わせフォームの代用チャットボット**として `Cor-Incorporated/corsweb2024` に統合する（専用 URL または `/contact/` 主 UI）
2. GitHub リポジトリを **`Cor-Incorporated` org へ移管**する（**完了**: `cloudia`）
3. ホスティングを **Netlify → Cloudflare** に寄せる
4. バックエンド API 正本は corsweb の **`workers/contact-chat`**（`cor-jp.com/api/contact/*`）
5. UI は **LINE 風吹き出し + Cloudia 8 表情**（3D/VRM 不採用、Chatwoot 不採用）

## 一覧

| ADR | タイトル | ステータス |
|---|---|---|
| [ADR-0001](./ADR-0001-b2b-intake-role-and-modes.md) | B2B 受付モードと SNS モードの分離 | Accepted / Revised 2026-07-10 |
| [ADR-0002](./ADR-0002-cloudflare-hosting-and-corsweb-embed.md) | CF ホスティング・LINE 風 UI・公開形態 | Accepted / Revised 2026-07-10 |
| [ADR-0003](./ADR-0003-api-contract-with-contact-chat.md) | contact-chat API 契約 | Accepted / Revised 2026-07-10 |
| [ADR-0004](./ADR-0004-repo-transfer-to-cor-incorporated.md) | Cor-Incorporated へのリポ移管 | Accepted / Revised 2026-07-10 |
| [ADR-0005](./ADR-0005-stack-cloudia-not-chatwoot.md) | スタック選定（Chatwoot 不採用） | Accepted 2026-07-10 |
| [ADR-0006](./ADR-0006-security-and-spam-layers.md) | セキュリティと spam レイヤ | Accepted 2026-07-10 |
| [ADR-0007](./ADR-0007-phased-delivery.md) | Phase 1–3 デリバリー | Accepted 2026-07-10 |
| [ADR-0008](./ADR-0008-cross-repo-canon-reference.md) | クロスリポジトリ契約の正本参照（Cloudia 4 intent / outbound `contract-dev` 境界） | Accepted / Revised 2026-07-14 |

## 要件との対応

| 要件 Phase | ADR | Epic |
|---|---|---|
| Phase 1 最小実用 | 0001–0003, 0005–0007 | Issue #2 |
| org 移管・CF | 0002, 0004 | #9, #10 |
| Phase 2+ | 0007, 0008 | #11, #12, #25 |

要件要約: [../requirements/AI-CONTACT-RECEPTION.md](../requirements/AI-CONTACT-RECEPTION.md)

## 参照

- corsweb ADR-0005 / ADR-0010 / ADR-0012 / ADR-0016
- corsweb Issues: #59, #243, #250, #254, #255
- 監査資料 `Cor_Grift_サイト刷新提案_2026-07-10.md` §6
