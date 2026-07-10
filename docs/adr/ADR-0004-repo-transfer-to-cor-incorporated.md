# ADR-0004 リポジトリを Cor-Incorporated へ移管する

## ステータス: Accepted (2026-07-10) / Revised (2026-07-10)

## 背景

- 現リポジトリは `terisuke/3d-emotional-chat-ai`（個人所有）。
- Cor. の Contact 本線・Cloudflare 運用・corsweb 統合を進めるには org 配下に置く必要がある。
- 製品名は Cloudia。パッケージ名 `3d-emotional-chat-ai` は 3D 廃止後に陳腐。

## 決定

1. GitHub **Transfer** で `Cor-Incorporated/<name>` へ移管する。
2. **推奨リポ名: `cloudia`**（代替: `3d-emotional-chat-ai` のまま。Transfer 時に org 方針で確定）。
3. Transfer 実行者は **org admin**（権限がない場合は admin 依頼をブロッカーとする）。
4. 移管後チェックリスト:
   - [ ] 旧 URL が GitHub リダイレクトすることを確認
   - [ ] Collaborators / Teams / branch protection を再設定
   - [ ] Secrets（API キー）を再登録。個人アカウント依存を排除
   - [ ] Netlify 連携を切断、Cloudflare プロジェクトを org アカウントで作成
   - [ ] README / package.json の `name` / `repository` を更新（`cloudia`）
   - [ ] corsweb Issue / ADR のリポ URL 参照を更新
   - [ ] ローカル clone（`_archive/3d-emotional-chat-ai` 等）の `git remote` を更新
   - [ ] open Issue / PR が維持されていることを確認
5. Transfer 自体はこの ADR の「決定」であり、**実行は Issue #10 で承認後に行う**（破壊的・権限操作のため）。

## 理由

- コード所有・権限・請求・CI を Cor. に集約する。
- 個人リポのまま Contact 本線にすると、退職・権限変更時に障害になる。

## 影響

- 移管完了まで Issue は現行リポに作成し、移管後は GitHub Transfer により新 URL へ追随。
- corsweb ADR-0012 と相互参照。

## 代替案

- **フォークを org に作って個人リポを archive**: 履歴・Issue が分断されるため Transfer を優先。
