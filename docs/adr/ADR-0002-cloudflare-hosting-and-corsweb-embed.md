# ADR-0002 Cloudflare ホスティング・UI・corsweb 公開形態

## ステータス: Accepted (2026-07-10) / Revised (2026-07-10)

## 背景

- 現行は Netlify（`netlify.toml` / Netlify Functions）想定。
- 3D/VRM は緑一色障害と運用コストが大きく、Contact 代用に必須ではない。
- 要件: LINE 風の左右アバター + 吹き出し、フォーム完全廃止は危険、専用 URL で公開可能であること。

## 決定

### ホスティング

1. **正本を Cloudflare**（Pages または Workers 静的 + 必要なら Functions/Workers）。
2. Netlify は移行完了後に停止する。
3. Preview は noindex（corsweb ADR-0010 と同様の方針）。

### 公開形態（フォーム代用）

| 方式 | 扱い |
|---|---|
| **同一オリジン mount**（`/contact/` 内） | 推奨最終形 |
| **専用 URL**（例: `/cloudia/` または CF を cor-jp.com 配下に統合） | 許容。URL のみでフォーム代わりに使えること |
| **iframe** | 許容（CSP・高さ・a11y・postMessage origin 検証に注意） |

- `?intent=` で初期選択肢をプリセット（ADR-0010 キー）。
- SSGFORM / 最小 ContactForm は **fallback のみ**（JS 無効・AI 障害・a11y）。常時目立つ位置に出さない。fallback にも Turnstile・rate limit 相当を適用。

### UI（LINE 風 + 表情）

1. **3D / VRM / WebGL は採用しない**（廃止確定）。
2. **8 表情 PNG** アイコン（喜び/怒り/悲しみ/楽しみ/驚き/照れ/考え中/ドヤ顔）。
   - パス: `public/assets/avatar/cloudia-{emotion}.png`
3. メッセージは **左右吹き出し**（左: Cloudia + 表情、右: ユーザー）。
4. chatscope 等の UI キットは任意の実装手段。必須ではない。
5. a11y: キーボード、ARIA live、コントラスト、フォーカス可視。

### アバター失敗時

- 画像欠落でもチャット入力・送信は常に可能（CSS プレースホルダ）。

## 理由

- contact-chat Worker と同一ベンダーで運用を揃える。
- 同一オリジンは cookie・CORS・信頼境界が単純。
- 表情アイコンはブランドを残しつつ Contact 本線の信頼性を損なわない。

## 影響

- `netlify.toml` は移行 Issue で置換。
- `ExpressionAvatar` + LINE 風 MessageList が UI 正本。
- corsweb #254 と同期。

## 代替案

- **Netlify 継続**: 最終ゴールと不一致のため却下。
- **Chatwoot ウィジェット**: ADR-0005 で却下。
- **3D 必須**: 監査・障害実績により却下。
