# ADR-0004 リポジトリを Cor-Incorporated へ移管する

## ステータス: Accepted (2026-07-10) / Implemented (2026-07-10) / Docs sync (2026-07-12)

## 背景

- 移管前は `terisuke/3d-emotional-chat-ai`（個人所有）だった。
- Cor. の Contact 本線・Cloudflare 運用・corsweb 統合を進めるには org 配下に置く必要がある。
- 製品名は Cloudia。旧パッケージ名 `3d-emotional-chat-ai` は 3D 廃止後に陳腐。

## 決定

1. GitHub **Transfer** で `Cor-Incorporated/<name>` へ移管する。
2. **リポ名: `cloudia`**（確定）。
3. Transfer 実行者は **org admin**。
4. 移管後チェックリスト:
   - [x] 旧 URL が GitHub リダイレクトすることを確認（`terisuke/3d-emotional-chat-ai` → `Cor-Incorporated/cloudia`）
   - [x] Collaborators 確認（terisuke, yama, nagi0705, kisayama0725, cloudia-Cor）/ main branch protection 設定済み
   - [ ] Secrets（API キー）を再登録。個人アカウント依存を排除（デプロイ側設定・#9 連携）
   - [ ] Netlify 連携を切断、Cloudflare プロジェクトを org アカウントで作成（#9）
   - [x] README / package.json の `name` / `repository` を更新（`cloudia`）
   - [x] corsweb Issue / ADR のリポ URL 参照を更新
   - [x] ローカル clone（`_archive/3d-emotional-chat-ai` 等）の `git remote` を更新
   - [x] open Issue / PR が維持されていることを確認
5. Transfer は 2026-07-10 に実行済み。**正本 URL: https://github.com/Cor-Incorporated/cloudia**

## 理由

- コード所有・権限・請求・CI を Cor. に集約する。
- 個人リポのまま Contact 本線にすると、退職・権限変更時に障害になる。

## 影響

- Issue / PR は Transfer により新 URL へ追随済み。
- corsweb ADR-0012 と相互参照。
- 残作業はホスティング移行（#9）と Secrets の org 側再登録のみ。

## 代替案

- **フォークを org に作って個人リポを archive**: 履歴・Issue が分断されるため Transfer を優先（採用済み）。
