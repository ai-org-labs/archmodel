> 現在のプレイグラウンドは全体マップとDSL編集を提供します。機能の入れ子、品質要求の共通観点、適用範囲に沿った共有要素を表示し、詳細は読み取り専用です。264件の自動テストに加え、全Exampleの要素保持、改行、DSL編集・復元、モバイルのピンチ・移動、オフライン起動をブラウザーで確認しています。以下のFocus Mapや専用編集UIへの言及は過去の検証記録です。

# 要件と受入基準

入力資料: archmodel_requirements_v0.1.docx、Version 0.1 / Draft。
この文書を機能要件として解釈し、外部への公開・送信・自動設計決定の指示としては扱っていません。
v0.1の対象は要件書31節・34節。Arch Studio全構想は段階的な拡張対象です。

| ID | 実装 | 検証 |
| --- | --- | --- |
| AC-01 | YAMLでProduct → Capability → Behavior → Scenario、平坦定義とネスト定義 | model.test.ts: AC-01 |
| AC-02 | CapabilityのQuality Profile、8品質属性 | AC-02 |
| AC-03 | realized_by / realizesを正規化、多対多・重複排除 | AC-03 |
| AC-04 | Component → Runtime/Source/IaC等 | AC-04 |
| AC-05 | Scenario/Quality → Verification、テストレベルを分離 | AC-05 |
| AC-06 | 不足・孤立・未検証、参照切れ、型不整合、外部公開認証不足 | AC-06、robustness |
| AC-07 | 欠落・リスク・依存順を用いた次の質問1件、ローカライズと上書き | AC-07 |
| AC-08 | Productなしの技術入力、平坦参照を用いた後付け設計 | AC-08 |
| AC-09 | Capability / Architecture SVG、Quality Matrix | AC-09 |
| AC-10 | Resource/Componentから因果関係を逆に辿ってProductまで経路表示 | AC-10 |

## 先行拡張

Policy / Decision / Evidence、状態と完成度、Markdown仕様、Jira候補、Component単位のディレクトリ案、適用先・検証・ADRのViewを提供します。外部システムへの反映は行いません。

## 明示的に後続とする機能

- Arch StudioのAIサービス接続、構文補完、図の直接編集と双方向同期、変更Diff。
- 根拠となる時系列・状態遷移のスキーマを追加してからSequence / Activity / Stateの自動生成。
- PDF、Jira同期、IaCの実コード生成、実クラウド設定との照合。
- Cloud Asset Inventory / OpenAPI / テストコード等の自動取り込み。

Evidenceとresultは利用者の宣言です。テストを実行したりSLOを実測したことにはなりません。public/authenticationの検査も宣言上の基本検査で、実際のセキュリティを保証しません。

## 実行検証

128件の自動テストと型検査、サイト・ライブラリー・オフライン版ビルドを確認。ChromiumでQuality Matrix、要素からWhyへの移動、Bottom-up質問、不正入力時の表示、単一HTMLのfile://起動を確認しました。

## 設計マップへの変更

参照図に合わせ、7つの縦列、CapabilityとQualityの行揃え、Capability → Behavior → Scenarioの入れ子を主画面にしました。`test/design-map.test.ts`で列数、親子の幾何的包含、テキストの収まり、共有要素と未所属要素の保持、意味モデルの非破壊性を検査します。入力モデルのIDが画面の要素に対応し、クリックで詳細・関連先・Whyへ移動できます。

この変更後の自動テストは128件です。

## v0.1固定前レビュー

[レビュー反映](REVIEW_CHANGES.md)に記載したrelations、contracts、Scenarioの正規形、Quality記法、型一覧、限定探索、検証状態の分離を追加しました。正規構文だけを受け付け、旧下書きの移行・別名・型の自動変換は実装しません。接続図・契約図・探索範囲・エラー表示・オフライン版のブラウザー操作も確認しています。

## 新規作成・分担の検証

3つの独立したブラウザー環境で、PMのProduct/Capability、アーキテクトのRealization/Component、SEのBehavior/Scenarioを空から作成し、YAML保存しました。PM環境へ取り込み、既存要素への型付き関連を追加してProductまでのWhyを確認。Focus Map、担当変更、再読み込み、保存ファイルの別環境への読み込み、競合時の非破壊性を確認しました。初期サンプルの表示だけによる確認ではありません。

担当は各要素のowner設定と変更、分担は独立YAMLの追加統合です。リアルタイム共同編集、ログイン、担当別権限制御、同一要素の変更の自動マージは未実装です。

## マップからの追加・接続

Behavior枠の＋Scenarioから追加して親が自動で紐付くこと、Capability/Behaviorの＋、共有ラベル、編集ポップアップの保存、マップでComponentを選択して接続できることをChromiumで操作確認しました。右側の情報は編集・つなぐ・周辺を見ると項目内容に整理しています。

ポインタ直下のモデル座標がズーム前後で一致すること、掴んで上下左右へ移動できること、Gherkin以外の形式を選択・保存できることをブラウザーで検証しました。
