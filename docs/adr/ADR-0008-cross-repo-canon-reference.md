# ADR-0008 クロスリポジトリ契約の正本参照

## ステータス: Accepted (2026-07-11)

## 決定

- クロスリポジトリ契約（intent キー正本・導線設計・公開順序）の**正本は corsweb** に置く（corsweb ADR-0015 の決定に従う）
- 本リポジトリは以下の正本 ADR に従う。内容のコピーは置かない:
  - corsweb ADR-0010: intent/env/noindex 初版 — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0010-cross-site-cta-env-and-intent.md
  - corsweb ADR-0013: 問い合わせ一極集中（Cloudia UI + workers/contact-chat、fallback フォーム維持） — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0013-contact-consolidation-cloudia.md
  - corsweb ADR-0014: intent 7キー化（contract-dev 新設）とルーティング — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0014-intent-7keys-and-routing.md
  - corsweb ADR-0015: 正本配置と参照方式 — https://github.com/Cor-Incorporated/corsweb2024/blob/develop/docs/adr/ADR-0015-cross-repo-adr-canon.md
- 実装との対応: `constants/intents.ts` の intent キーは corsweb ADR-0014 の 7 キー表に追従する（`contract-dev` の追加は Phase 3 ルーター実装 issue で行う）
- ルーティング原則: `contract-dev` のみ Grift Cor テナントへ自動ハンドオフ。`grift-team-beta` / `grift-paid-trial` / `estimate-audit` は製品販売リードのため人間対応（contact-chat → メール通知）を維持
- monorepo カットオーバー（#11）時に正本配置を再検討（corsweb ADR-0015）
