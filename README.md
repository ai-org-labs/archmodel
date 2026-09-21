# ArchModel

ProductからCapability、Behavior、Scenario、Quality、Component、技術実現、検証までをつなぐYAML DSLと設計マップです。

主画面は7つの縦列で設計全体を表示します。Capabilityの中にBehavior、その中にScenarioを置き、Quality Profileを対応するCapabilityと同じ行に揃えます。Product、Policies、Design Decisions、Logical Components、Technical Realizationは全体を通した列です。

[archmap-mermaid](https://github.com/ai-org-labs/archmap-mermaid)から描画・配線・SVG基盤を引き継いだ独立リポジトリです。元リポジトリへの実行時依存はありません。DSLの意味モデルとレーン配置は新規実装です。

## 公開版

- [設計マップを開く](https://ai-org-labs.github.io/archmodel/)
- [スタンドアロンHTML](https://ai-org-labs.github.io/archmodel/standalone.html)
- [v0.1.0リリース・HTMLダウンロード](https://github.com/ai-org-labs/archmodel/releases/tag/v0.1.0)

公開版も単体HTMLで動作します。リリースの `archmodel-v0.1.0.html` を保存するとオフラインで開けます。モデルはブラウザー内に保存されるため、環境を移す際はYAML保存をご利用ください。

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

モデル本体は意味付きグラフです。UIは7レーンのDesign Mapに集約しています。関連線の深さ・方向・種類を指定でき、共有ノードは同じIDとして扱います。

## 設計マップ

- 通常は概要表示。「本文を展開」でGherkin、Trigger、Outcomesなどの詳細をマップ上に表示。
- 要素を選択すると本文・関連先を表示。関連する設計要素をハイライト。
- 関連線は選択した要素について必要な場合だけ表示。
- ポインタ中心の滑らかなピンチズーム・100%表示・全体表示・ドラッグ移動。通常のトラックパッドスクロールで上下左右へ移動。SVGも同じレーン構造で保存。
- 共有Behaviorは各Capability内に配置し、Componentは同じIDのまま共有。内部モデルは多対多グラフを保持。
- 未所属のBehavior / Scenario / Qualityは未所属行に表示し、未完成の入力を隠さない。
- 検証結果unknownは「未実施」と表示。検証リンクとテスト成功を区別。

- Capability / Behaviorは個別または一括で開閉。閉じたCapabilityには編集可能な品質要約を表示。
- 要素の削除、作成・編集・関連付けのUndo / Redoに対応（履歴は再読み込みまで）。
- 警告から入力や関連付けへ移動。検証は既存の割り当て・新規作成に対応。

## DSLと例

- [構文リファレンス](syntax/reference.md)
- [設計マップ用サンプル：2 Capability・4 Behavior・8 Scenario](syntax/examples/design-map.archmodel.yaml)
- [基本サンプル](syntax/examples/customer-platform.archmodel.yaml)
- [技術から始めるサンプル](syntax/examples/bottom-up.archmodel.yaml)
- [JSON Schema](schema/archmodel.schema.json)
- [要件対応と実装範囲](docs/ACCEPTANCE.md)
- [AI向け設計ガイド](prompts/system.md)

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
import {parseModel, validateModel, nextQuestion, renderDesignMap, traceWhy} from './dist/archmodel.js';
const model = parseModel(yaml);
console.log(validateModel(model), nextQuestion(model));
console.log(traceWhy(model, 'auth-runtime'));
const {svg, layout} = renderDesignMap(model, {expanded: false});
```

`computeDesignMap(model)`でレーン・要素の座標を取得できます。座標はView側で決まり、DSLへ追加しません。従来の`renderView`は補助図生成APIとして利用可能です。
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
