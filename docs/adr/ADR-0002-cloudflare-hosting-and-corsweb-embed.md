# ADR-0002 Cloudflare ホスティングと corsweb 埋め込み

## ステータス: Accepted (2026-07-10)

## 背景
- 現行は Netlify（`netlify.toml` / Netlify Functions）想定。
- 監査で 3D 領域が緑一色になり、フォールバックが確認できなかった。
- 最終的に corsweb 同一オリジンで Contact 代用 UI として使う。

## 決定
1. **ホスティング正本を Cloudflare とする**（Pages または Workers 静的 + 必要なら Functions/Workers）。
2. Netlify は移行完了後に停止する。
3. **corsweb 埋め込み**:
   - 推奨: `/contact/` 内に widget mount（同一オリジン資産）
   - 許容: iframe（CSP・高さ・a11y に注意）
4. `?intent=` を受け取り初期選択肢をプリセット。
5. **3D 失敗時**:
   - チャット UI は必ず操作可能
   - 緑画面・WebGL エラー時はアバター領域を隠し、テキストのみ
   - 原因調査 Issue を P0 とする
6. a11y: キーボード操作、ARIA live、フォーム fallback（corsweb 側）との併用。

## 理由
- contact-chat Worker と同一ベンダーで運用を揃える。
- 同一オリジンは cookie・CORS・信頼境界が単純。

## 影響
- `netlify.toml` は移行 Issue で置換。
- VRM アセット配信・MIME・キャッシュを CF で確認。

## 代替案
- **Netlify 継続**: 最終ゴールと不一致のため却下。
