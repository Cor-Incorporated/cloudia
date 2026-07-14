# ADR-0008 クロスリポジトリ契約の正本参照

## ステータス: Accepted (2026-07-11) / Revised (2026-07-14)

## 決定

- クロスリポジトリ契約（intent キー正本・導線設計・公開順序）の**正本は corsweb** に置く（corsweb ADR-0015 の決定に従う）
- 本リポジトリは以下の正本 ADR に従う。内容のコピーは置かない:
  - corsweb ADR-0010: intent/env/noindex 初版 — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0010-cross-site-cta-env-and-intent.md
  - corsweb ADR-0013: 問い合わせ一極集中（Cloudia UI + workers/contact-chat、fallback フォーム維持） — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0013-contact-consolidation-cloudia.md
  - corsweb ADR-0014: intent 7キー化（contract-dev 新設）とルーティング — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0014-intent-7keys-and-routing.md
  - corsweb ADR-0015: 正本配置と参照方式 — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0015-cross-repo-adr-canon.md
  - corsweb ADR-0016: Cloudia–Grift 顧客セッション引継ぎ契約 — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0016-cloudia-grift-customer-session-handoff.md
- 実装との対応: `constants/intents.ts` の intent キーは corsweb ADR-0014 の 7 キー表に追従する
- monorepo カットオーバー（#11）時に正本配置を再検討（corsweb ADR-0015）

## Cloudia eligibility と outbound intent の境界

Cloudia が browser で引継ぎ対象として扱う intent と、corsweb Worker が Grift へ送る outbound intent は同じ集合ではない。Cloudia は下表の4 intentを受け付け、正本である corsweb Worker が Grift 向けの outbound intent を `contract-dev` に正規化する。Cloudia はこの正規化やテナントルーティングを担当しない。

| 境界 | intent |
|---|---|
| Cloudia browser -> corsweb handoff | `contract-dev`, `grift-team-beta`, `grift-paid-trial`, `estimate-audit` |
| corsweb Worker -> Grift outbound | `contract-dev` |

この2行は `.github/workflows/ci.yml` の ADR parity check で検証し、1 intentのみの古い説明への後退を防ぐ。

## corsweb ADR-0016 と Cloudia 実装ガードの対応

契約本文は corsweb ADR-0016 を正本とし、ここには Cloudia が担当するガードの所在だけを記録する。

| Cloudia 実装ガード | 実装・負テスト |
|---|---|
| 引継ぎ対象・確認済み要約・明示同意 | `constants/intents.ts`, `App.tsx`, `components/HandoffForm.tsx`, `services/contactChatClient.ts` |
| reload を跨ぐ送信冪等性 | `utils/submissionIdempotency.ts` |
| 公開 URL allowlist・standalone / embed 遷移境界 | `utils/griftHandoff.ts` |
| 生トランスクリプト非送信・旧応答互換・fallback | `services/contactChatClient.test.ts`, `components/HandoffForm.test.tsx` |
| 親 origin・targetOrigin・open redirect の拒否 | `utils/griftHandoff.test.ts` |
| 日英表示・同意 UI・a11y | `translations.ts`, `constants.test.ts`, `components/HandoffForm.test.tsx` |
