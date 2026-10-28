# ADR-0009 ローカル LLM による contact intake（スパイク）

## ステータス: Proposed（スパイク。本番切替は未決定）

## 背景

- Epic [#2](https://github.com/Cor-Incorporated/cloudia/issues/2) の Phase 1 は、会話 API の正本を corsweb `workers/contact-chat` に置く（ADR-0003）。現行 Worker の既定プロバイダは Vertex Gemini で、fail closed である。
- 要件は「LLM プロバイダ交換可能な Gateway」を Phase 1 に含む。Cor のローカル推論は、ブラウザや Cloudia がノードを直接選ばず、ai-cluster の llm-gateway 論理名だけを使う（[cor-os#119](https://github.com/Cor-Incorporated/cor-os/issues/119)、[ai-cluster#188](https://github.com/Cor-Incorporated/ai-cluster/issues/188)）。
- セキュリティの優先順位は ADR-0006。spam 撃退の中心は LLM ではない。Turnstile は submit で必須、chat は単回トークンを壊さないため任意。PII は `/api/contact/submit` のみで、chat ログに残さない。

## 決定

1. **本番の既定は変えない。** `CLOUDIA_INTAKE_PROVIDER` が未設定、または `local` 以外のとき、ブラウザは今までどおり同一オリジンの `/api/contact/chat` を呼ぶ。応答は corsweb Worker（Vertex）が作る。このスパイクは本番の Turnstile・同一オリジン・レート制限を置き換えない。
2. **ローカル経路はサーバ側だけ。** Vite の dev middleware が `CLOUDIA_INTAKE_PROVIDER=local` のときだけ `POST /api/contact/chat` と `/chat/start` を受ける。資格情報は `CLOUDIA_LOCAL_LLM_BASE_URL` と `CLOUDIA_LOCAL_LLM_TOKEN`（`VITE_` にしない）。モデルは公開 alias のみ。既定は `cor-qwen3.6-35b`。許可は P0 会話 alias `cor-qwen3.6-35b` と `gemma4-12b`。`uncensored` / `abliterated` は拒否する。
3. **暗黙フォールバックをしない。** 設定不足、未知 alias、gateway の非成功、`x-cluster-fallback: true`、要求 alias と `x-cluster-served-model` の不一致は 503 にする。Vertex や別モデルへ切り替えない。`/api/contact/submit` はこの middleware で扱わない。
4. **Turnstile は contact-chat に合わせ、必須化は厳しくする。**
   - `CLOUDIA_LOCAL_TURNSTILE` の既定 `optional`: トークンが無ければ chat を止めない（ADR-0006 / Worker の handleChat）。トークンがあり `TURNSTILE_SECRET` もあるときだけ siteverify する。失敗は拒否。
   - `required`: 秘密が無い、トークンが無い、検証に失敗した、のいずれも LLM を呼ばず拒否する。秘密未設定でのスキップはしない。
   - トークンは LLM に渡さない。ログにも残さない。
5. **ログは件数と分類だけ。** メッセージ本文、メール、電話、Bearer、gateway URL、Turnstile 秘密を書かない。LLM に渡す前に contact-chat と同じ系統のマスクを掛ける。モデルがマーカー、秘密、連絡先を reply に返した場合は定型文へ落とす。

`VITE_CONTACT_API_BASE` が空でないとき、ブラウザは dev server を経由しない。ローカル経路を使う開発ではこの変数を空にする。

## 理由

- プロバイダ名、モデル ID、資格情報、プロンプトをブラウザへ出さない（CLAUDE.md）。
- Worker の本番認証をこのリポジトリから弱めずに、Cor ローカル gateway の契約を先にコードで固定できる。
- 会社ナレッジと本番システムプロンプトの正本は Worker に残す。スパイクのプロンプトは JSON 契約と PII 禁止だけを持つ。

## 影響

- 開発時にフラグを付けると、intent 選択直後の開始文と、その後の 1 往復をローカル gateway で返せる。
- 本番ビルドの middleware は dev server にしか載らない。`scripts/scan-bundle-secrets.mjs` がクライアント成果物への混入を拒否する。

## Phase 1 で残っていること

- corsweb Worker の `LLM_PROVIDER` に local gateway を足し、本番の切替判断を Worker 側で行うこと。この ADR は Accepted ではない。
- ブラウザの Turnstile ウィジェットと、submit リクエストへの `turnstileToken` 付与。クライアントは任意トークンを転送できるだけである。
- 本番と同等のシステムプロンプト、会社ナレッジ、セッション保存、メール送信。submit は Worker のまま。
- gateway の routeReady、容量、drain の live evidence（cor-os#119）。alias 許可はクライアント側の閉じたリストであり、経路の健全性そのものは gateway が返す。

## 代替案

- **ブラウザからローカルエンドポイントへ直接投げる**: 資格情報が公開設定になるため却下。
- **フラグ無しで Vertex をローカルへ置き換える**: 本番認証と障害時の挙動を変えるため却下。
- **秘密が無い Turnstile を required でも成功させる**: Worker の chat は検証自体をしないが、submit の fail open をこのスパイクの必須ポリシーへコピーすると「検証した」ことになり、ここには採用しない。
