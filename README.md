# ArchModel

ProductからCapability、Behavior、Scenario、Quality、Component、技術実現、検証までをつなぐYAML DSLと設計マップです。

主画面は全体マップです。価値・能力、振る舞い、品質・制約、責務・契約・判断、技術実現、検証・証跡の6領域に全要素を配置し、同じマップ内で属性・設計観点・判断根拠・関係を展開して編集できます。

[archmap-mermaid](https://github.com/ai-org-labs/archmap-mermaid)から描画・配線・SVG基盤を引き継いだ独立リポジトリです。元リポジトリへの実行時依存はありません。DSLの意味モデルとレーン配置は新規実装です。

## 公開版

- [Overview](https://ai-org-labs.github.io/archmodel/)
- [Playground — YAMLと設計マップを編集](https://ai-org-labs.github.io/archmodel/playground/)
- [Syntax — 構文・AIプロンプト](https://ai-org-labs.github.io/archmodel/syntax/)
- [Examples](https://ai-org-labs.github.io/archmodel/examples/)
- [スタンドアロンHTML](https://ai-org-labs.github.io/archmodel/standalone.html)
- [v0.1.0リリース・HTMLダウンロード](https://github.com/ai-org-labs/archmodel/releases/tag/v0.1.0)

GitHub PagesはOverview / Playground / Syntax / Examplesの4ページ構成です。SyntaxのAIプロンプトは構文リファレンス全文を含み、コピー・テキスト保存できます。Playgroundはブラウザー内でYAMLを検証・描画し、サンプル別の下書きを保存します。AIへの送信は行いません。

オフライン版は単体HTMLで動作し、構文とAIプロンプトも含みます。リリースの `archmodel-v0.1.0.html` を保存するとオフラインで開けます。モデルはブラウザー内に保存されるため、環境を移す際はYAML保存をご利用ください。

## 対話で設計する

自然言語の回答をArchModel YAMLへ反映する、repository-based設計Agentを追加しています（Phase A〜C）。
[利用手順](docs/AGENT_USAGE.md)から開始できます。[設計書と今後の実装範囲](docs/AGENT_DESIGN.md)も参照してください。

## 起動

Node.js 22.12以上。

```sh
npm ci
npm run dev
```

表示されたURLで設計マップを開けます。「DSL」でYAMLを変更すると、各列へ反映されます。ブラウザー内で処理し、YAML / JSON / Markdown / SVGを保存できます。`npm run build`の`site-dist/standalone.html`はオフラインで開けます。

## 新規作成と分担

初回は空のマップを直接表示します。各列の＋から、決まっている要素を追加できます。役割を選ぶ開始メニューはありません。

- **PM**: Product → Capability → Behaviorの順で、価値から具体化。
- **アーキテクト**: Realization → Component → Behaviorの順で、技術から根拠を接続。
- **SE**: Behavior → Scenarioから作り、上位Capabilityと実装Componentを接続。

各要素のフォームで担当者・チームと設計状態を設定できます。未完成でも保存でき、不足は設計の確認に残ります。担当は各要素で変更でき、画面下の「YAMLを追加」で別々に作成したモデルを統合できます。既存IDの内容が異なる場合は取り込み全体を止め、上書きしません。役割は入口であり編集権限ではありません。リアルタイム共同編集は未実装です。

[分担作成の手順とサンプル](docs/AUTHORING.md)には、各役割の作成分と統合後のモデルを用意しています。

モデル本体は意味付きグラフです。全体・対象・観点への絞り込みは同じマップの射影です。共有ノードは同じIDの一つの実体として扱い、絞り込みでも範囲外への接続を残します。

## 設計マップ

- 全要素と関係を配置し、各要素の「属性を展開」で全属性と関係の詳細を表示します。
- 「観点」で未検討を含む観点を展開し、その観点を選んで判断・理由・前提・リスク・再検討条件を記録します。
- 「絞る」「この観点に絞る」は同じマップを局所表示します。点線のカードは範囲外への接続です。
- マップ内から関連する要素を作成し、参照を付けて保存できます。要素・関係・実接続・文書情報の編集は選択した対象から開きます。
- 文書・観点定義を展開すると、version、extensions、検討範囲と観点カタログを確認できます。
- 概要は読み取り可能な倍率で開きます。「全体表示」で全体を俯瞰し、「対象へ移動」で任意の要素へ移動できます。ピンチズーム、パン、100%表示にも対応します。
- 結論ありには根拠の揃った保留を含みます。未解決・設計不足・検証結果は別に扱い、空欄を対象外とは扱いません。
- SVG保存も同じ射影です。DSLにビューの座標・展開状態は保存しません。

## DSLと例

- [構文リファレンス](syntax/reference.md)
- [設計マップ用サンプル：2 Capability・4 Behavior・8 Scenario](syntax/examples/design-map.archmodel.yaml)
- [Exampleの読み方・網羅範囲](docs/EXAMPLES.md)
- [顧客プラットフォーム詳細サンプル](syntax/examples/customer-platform.archmodel.yaml)
- [技術から始めるサンプル](syntax/examples/bottom-up.archmodel.yaml)
- [JSON Schema](schema/archmodel.schema.json)
- [要件対応と実装範囲](docs/ACCEPTANCE.md)
- [AI向け設計ガイド](prompts/system.md)

## npmパッケージ

```sh
npm install @archmodel/core
```

```js
import { parseModel, renderDesignMap } from "@archmodel/core";
const model = parseModel("version: '0.1'\nproducts: [{ id: p, name: Example }]");
const { svg } = renderDesignMap(model);
```

ESMとTypeScript型定義、JSON Schema、`archmodel` CLIを同梱します。実行時依存はバンドル済みです。Web UIも同じパッケージの公開エントリから読み込み、スタンドアロンHTMLへ埋め込みます。

## API / CLI

```sh
npm run build:library
npm run cli -- validate syntax/examples/design-map.archmodel.yaml --strict
npm run cli -- question syntax/examples/bottom-up.archmodel.yaml
npm run cli -- why syntax/examples/design-map.archmodel.yaml auth-runtime
npm run cli -- view syntax/examples/design-map.archmodel.yaml map > design-map.svg
npm run cli -- view syntax/examples/design-map.archmodel.yaml architecture > architecture.svg
npm run cli -- matrix syntax/examples/design-map.archmodel.yaml
```

```js
import {parseModel, validateModel, nextQuestion, renderModelMap, traceWhy} from './dist/archmodel.js';
const model = parseModel(yaml);
console.log(validateModel(model), nextQuestion(model));
console.log(traceWhy(model, 'auth-runtime'));
const {svg, layout} = renderModelMap(model, {expanded: false});
```

`projectModelMap(model)`で全体マップの射影、`renderModelMap(model)`でSVGを取得できます。旧`computeDesignMap` / `renderDesignMap`は互換用APIとして保持しています。座標はView側で決まり、DSLへ追加しません。従来の`renderView`は補助図生成APIとして利用可能です。
CLIはmarkdown / yaml / json / backlog / directoriesにも対応。Jira候補やディレクトリ案はローカルの提案出力です。
型定義は`src/index.ts`、スキーマは`schema/`にあります。npm公開はしていません。

## 検証

```sh
npm run verify
```

型検査、AC-01〜10、親子要素の包含、CapabilityとQualityの行揃え、テキストの収まり、共有要素と未所属要素の保持、Mermaid回帰テスト、サイト・ライブラリー・オフライン版のビルドを実行します。CIは検証のみです。

## v0.1の境界

Policy / Decision / Evidence、ルールベースの質問、設計上の不足検出を提供します。LLM接続、図の直接編集、Jira同期、実環境の検証、PDF出力、Sequence/Activity/Stateの意味モデルからの自動推論は将来範囲です。

Apache-2.0。派生元と第三者の帰属は[PROVENANCE](docs/PROVENANCE.md)、[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)を参照してください。

## v0.1固定前の構文整理

`relations`でComponent / Realizationの実接続とprotocolを記述し、`contracts`でAPI・Event・Messageを一級要素として管理します。画面の「システム接続」「API / Event契約」でそれぞれの図を確認できます。

Scenarioの正規形はtype / specification、Capability.qualityはProfile糖衣構文、Capability.qualitiesはID参照です。use_cases / rules / trade_off等の型を確定し、[全フィールド一覧](syntax/reference.md)をSchemaから生成します。`npm run reference`で更新し、verifyで同期を検査します。

別名・旧記法の互換処理は持たず、正規構文のみを受け付けます。関連探索は深さ・方向・種別を指定し、検証のカバレッジと結果は別々に表示します。詳細は[レビュー反映](docs/REVIEW_CHANGES.md)を参照してください。
