# ArchModel

ProductからCapability、Behavior、Scenario、Quality、Component、技術実現、検証までをつなぐYAML DSLと設計マップです。

主画面は全体マップです。Productの目的と範囲を上部に置き、Capability → Behavior → Scenarioを入れ子に、その横に品質要求を配置します。方針・判断・構成・技術実現・検証は適用範囲ごとに整理し、共有要素や所属未定も一度ずつ表示します。内容の編集はDSLで行います。

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

- すべての要素を同じマップに配置します。選択で関連を強調しても位置は変わりません。接続線は常時表示しません。
- 機能の所属と共有範囲は宣言された設計関係から求めます。通信先を所属とみなさず、共通ポリシーの実装だけで全機能の共有構成にしません。
- 品質要求は同じ順序の観点群で表示します。可用性・性能・運用保守・移行・セキュリティ・環境と、使用性・互換性・安全性を扱います。これは表示上の分類で、正式な非機能要求グレードの全下位項目・レベル表ではありません。環境の観点は現行の標準カタログにないため「観点未定義」と表示します。
- 未検討・保留・対象外を区別し、品質要素が存在するだけで検討済みにしません。観点を選ぶと記録された理由・前提・残るリスク・再検討条件を読めます。親の判断は子へ継承しません。
- 要素を選ぶと、改行を保った全属性・関係・実接続・既存の判断記録を表示します。本文を編集する場合は「DSL」を開きます。構築用ボタン列や関係カードはありません。
- Verificationの結果はその検証の対象に対するDSL上の宣言です。要求全体の完了や、現在の要求・実装版との一致を自動認定しません。
- 初期表示は読み取り可能な倍率です。「全体表示」で俯瞰、「名前で移動」で要素を探せます。1本指で移動、2本指のピンチやトラックパッドでズームできます。
- YAMLの読み込み・自動保存・Undo/Redo・SVG保存・オフライン版、SyntaxとAIプロンプトを利用できます。座標や表示状態はDSLへ保存しません。

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
import {parseModel, validateModel, nextQuestion, renderStructuredMap, traceWhy} from './dist/archmodel.js';
const model = parseModel(yaml);
console.log(validateModel(model), nextQuestion(model));
console.log(traceWhy(model, 'auth-runtime'));
const {svg, layout} = renderStructuredMap(model);
```

`renderStructuredMap(model)`は現在の全体マップのSVGと配置情報を返します。`structuredScopes(model)`は各要素の対応するCapability集合を返します。従来の`projectModelMap` / `renderModelMap`、`computeDesignMap` / `renderDesignMap`も互換APIとして保持しています。
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
