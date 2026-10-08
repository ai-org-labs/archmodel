# 対話でArchModelを作る

Phase A〜Cを実装しています（repository-based Agent + Question Planner + CLI）。LLM接続や新しい画面の導入は不要です。
Agentがリポジトリの正本を読み、YAMLを編集します。Question Plannerは次質問を選びます。回答からのモデル更新はAgentが担当します。

## 開始

このリポジトリを編集できる環境で開きます。Codex等にはルートの[AGENTS.md](../AGENTS.md)を読ませます。
Copilotでは`.github/agents/archmodel-designer.md`の **ArchModel Designer** を選択します。
アダプタは[GitHubの設定形式](https://docs.github.com/en/copilot/reference/custom-agents-configuration)に従い、
[VS Codeで検出される配置](https://code.visualstudio.com/docs/agent-customization/custom-agents)を使っています。
利用環境によるAgentの検出・対話の品質は、実際のセッションで確認してください。

開始例:

> AGENTS.mdに従ってdesign/my-system.archmodel.yamlを新規作成してください。
> 社内向けにPDFをアップロードしてAI解析するシステムを作りたい。
> まず広く全体像を作り、決まった内容をDraftとして保存してください。

既存設計では対象YAMLを指定します。ファイルが複数あり対象が不明な場合は、選択してから編集します。
独自プロジェクトで利用するときはArchModelリポジトリの正本を参照できるようにしてください。
`@archmodel/core@0.1.1`のnpm配布物には、このAgent文書は含まれていません。

## 検証

リポジトリルートで実行します。

```sh
npm ci
npm run build:library
npm run cli -- validate design/my-system.archmodel.yaml
npm run cli -- question design/my-system.archmodel.yaml
npm run cli -- why design/my-system.archmodel.yaml existing-component-id
```

`why`のIDは実在する要素へ置き換えます。`question`は既存の優先度で一つの候補を返します。
Agentは対話プロトコルに従って、その候補を今聞くか判断します。
Draftの不足warningは許容し、構造エラーは修正します。`--strict`はwarningも失敗にするためDraftの保存条件にはしません。
コード変更を伴う場合は`npm run verify`を実行します。

フェーズと焦点を指定した進行制御:

```sh
npm run cli -- plan examples/agent-landscape.archmodel.yaml
npm run cli -- plan examples/agent-landscape.archmodel.yaml --phase shape --focus review-analysis --format markdown
npm run cli -- question examples/agent-landscape.archmodel.yaml --phase landscape
npm run cli -- plan examples/agent-landscape.archmodel.yaml --depth overview --locale en
```

`plan`はphase / primary / related / deferred / rationaleCodesを返します。
`question`はフラグなしなら従来のQuestion、フラグありならPlannerのprimary（DesignQuestion）を返します。
JSONが既定で、`--format markdown`で可読形式を出力できます。
phaseはlandscape / shape / depth / realization / assurance、depthはoverview / normal / deep、localeはja / enです。
focusは複数回またはカンマ区切りで指定できます。不明なID・値・オプションは終了コード1になります。
primaryがnullの場合は正常終了0。ALL_DEFERREDは完了ではなく保留、INVALID_MODELは構造修正が必要という意味です。
CLIでは構造エラーは終了コード1として報告します。

APIで会話状態を渡す例（現在のソースからビルドしたcoreを使用）:

```ts
import { parseModel, planNextQuestions } from '@archmodel/core';
const model = parseModel(yamlText);
const plan = planNextQuestions(model, {
  phase: 'shape',
  focusIds: ['review-analysis'],
  recentQuestionTypes: ['CAPABILITY_SHAPE:review-analysis'],
  locale: 'ja'
});
```

Plannerはモデルを変更しません。InferもDraft案の提示であり自動の関連付けではありません。
会話履歴はadapter側で保持し、必要なcontextだけを渡します。npm公開済み0.1.1にはPlannerはまだありません。

## 対話を試すシナリオ

以下はAgent/adapterの手動評価手順です。自動で合格を保証するテストではありません。

| 入力・操作 | 確認する結果 |
| --- | --- |
| 新規PDF解析サービスを依頼 | 利用者・価値・主要能力から始め、Cloud Run選定を要求しない |
| 「社員がPDFを渡し、要約と注意点を受け取る。管理者は履歴を監査する」 | 利用者・入力・出力・複数Capabilityへ分解し、同じ質問を繰り返さない |
| 一つの能力だけ詳細化し、他は名前のみ | 全体バランスを見て、Scenario/Verificationだけを連続質問しない |
| 「既存Cloud Runを起点にしたい」 | 技術を残し、その責務と上位価値へ逆引きする |
| 「可用性99.99%が必要」 | 対象と測定条件を確認し、方式検討時に冗長化の選択肢と検証を扱う。方式を無断採用しない |
| 「このCapabilityを深掘り」「方式設計へ進む」 | 指定範囲へ進み、未確定の前提を伝える |
| UNCOVERED warningのある初期Draft | warningを維持しつつ、今聞く質問とは分離する |
| 「ここまでで保存して」 | 質問を止め、保存先・保留・検証実施状況を示す |

各試行では質問数、テーマ、推論箇所、無断acceptedの有無、YAMLの検証結果を確認します。
会話全文や評価ログを意味モデルに入れないでください。
例として[LandscapeのDraft](../examples/agent-landscape.archmodel.yaml)と
[技術起点](../syntax/examples/bottom-up.archmodel.yaml)を利用できます。

設計マップの「開く」で保存したYAMLを読み込めます。会話とマップが別のモデルを持つ運用にせず、同じファイルを受け渡してください。

## 観点の判断記録

対象のreview_scopesを開始すると、記録のない観点は未検討として質問候補になります。reviewsで対象・対象外・保留と根拠を保存し、`archmodel reviews model.yaml [target-id]` で一覧を取得できます。独自観点はreview_catalogで追加します。未開始の既存文書には追加の観点警告を出しません。構文リファレンスの「観点の検討記録」に従い、対象外の理由や前提を推測で確定させず、未合意ならin_reviewにしてください。

## 観点を結論へつなぐ操作

必須の進行手順は[対話プロトコル](../prompts/conversational-design.md#観点から結論までの必須作業)を正本とします。

```sh
archmodel coverage model.yaml
archmodel focus model.yaml capability-id contracts
archmodel review-start model.yaml capability-id
archmodel review-set model.yaml review-record.json
archmodel plan model.yaml --focus capability-id
```

review-start / review-setは更新後のYAMLを標準出力します。出力を別の一時ファイルに保存・検証してから元のファイルへ反映してください。同じ入力ファイルへ直接リダイレクトしないでください。review-record.jsonにはDSLのreviewsの1件分を渡します。coverageは未開始のProduct/Capabilityも含むため、旧reviewsコマンドで記録がない場合も未結論が見えます。
