# Exampleの読み方と網羅範囲

以下の3つの詳細設計Exampleはすべて、Product / Capability / Behavior / Scenario / Quality / Policy / Decision / Component / Realization / Contract / Verification / Evidenceの12種類を含む架空の設計です。
設計の成立条件と具体的な検証方法を記載し、構文・参照・設計上の不足の診断が出ない状態にしています。これは設計対象のシステムが実装・検証済みであることを意味しません。

## 認証とプロフィール管理

2 Capability・4 Behavior・8 Scenarioを軸にした、要求から技術実現への追跡例です。
- actor / inputs / outputs / guarantees / constraintsを具体化。
- Behaviorのpreconditions / failure_behaviors / side_effectsを記載。
- 品質は可用性・セキュリティ・可観測性・性能・監査・プライバシー・使用性・アクセシビリティ・テスト容易性。SLI、RTO、RPO、目標値と測定条件を記載。
- 本人性確認・監査・プロフィールの責務分担、API・Event・外部I/F、構成判断の代替案とトレードオフを記載。
- VerificationからEvidenceの保存先まで辿れます。Evidenceは予定のレポートパスです。

## 既存の技術構成から設計する

既存の設備監視APIを、受信・異常対応・日次照合の3 Capabilityへ関連付けた54要素の設計です。技術から始めても利用者の価値へ逆引きできます。
- Scenarioの全8形式：gherkin / state_transition / timing / example / batch / iot / async_event / text。
- Realization.kindの全9種類：runtime / resource / network / data / directory / module / source / iac / deployment。
- relations.typeの全7種類：depends_on / calls / publishes / subscribes / reads / writes / routes_to。
- Contract.kindの全4種類とComponent.kindの全5種類を記載。
- 欠番、重複、順序逆転、再実行、端末認証、計測期限切れ、人の安全判断への引継ぎを具体化。
- 設備の自動停止や安全装置の代替は明示的に対象外です。

## 顧客プラットフォーム

セッションの業務ルール、データ保持、顧客ディレクトリとの境界、配備・運用・移行を補った54要素の設計です。
- 3つのComponent.template：hexagonal / ddd / vertical-slice。
- 4種類のContractをuses / provides / consumesで関連付け。
- 信頼性・耐障害性・復旧性・拡張性・運用性・保守性・互換性・相互運用性・移植性・移行・配備を定義。
- entityごとのowner / status / description、業務上の補足を入れるextensionsを記載。
- 数値目標と文字列目標、配列、真偽値、オブジェクトの記述を確認できます。

## 3件全体の網羅範囲

| 対象 | 網羅範囲 |
| --- | --- |
| 設計要素 | 12種類すべてを各Exampleに含む |
| 編集フォームのフィールド | Schema由来のeditableFieldsを全項目網羅。idも各要素に記載 |
| Scenario.type | 全8値 |
| Quality.attribute | 全21値 |
| Component.kind / template | 全5値 / 全3値 |
| Realization.kind | 全9値 |
| Contract.kind | 全4値 |
| Verification.level | 全10値 |
| relations.type | 全7値。protocol / contract / label / description / extensionsも使用 |
| 意味付き関連 | has / realized_by / implemented_by / verified_by / applies_to / affects / evidenced_by / uses / provides / consumes、逆方向のrealizes / verifies |
| 品質の書き方 | Capability.qualityの定義、Capability.qualitiesのID参照、トップレベルqualities |
| 構造 | ネスト定義、トップレベル定義、前方ID参照、多対多の責務分担 |

全要素へ無関係なフィールドを埋めるのではなく、それぞれの意味がある箇所へ配置しています。全Enum値の網羅対象は上表の分類項目です。status / decision_status / risk / resultのすべての値を並べるサンプルではありません。

## 検証結果と証跡の扱い

すべてのVerification.resultとEvidence.resultはunknownです。Evidence.locationは実行後の保存先の例であり、ファイルの実在を保証しません。
bottom-upのcollected_atは、extensions.synthetic: trueを付けたメタデータの記述例です。実際の実施日時や成功結果ではありません。
Decisionのacceptedは、この架空設計の前提として採用した案を表します。

## 更新したExampleを開く

Examplesページで選び、PlaygroundでYAMLとマップを確認してください。保存済みの下書きがある場合はそちらが復元されます。「最新のExampleに戻す」で更新版へ切り替えられます。編集中の内容は先にYAML保存してください。

## 各観点の検討と対象外の理由

`perspective-review.archmodel.yaml` は詳細設計に入る前の小さなモデルです。従来の3例の項目網羅とは別に、5種類の検討状態を示します。未検討・検討中・保留と設計不足の警告が残るのは意図した状態です。

Productの可用性は前提付きで対象外、データのライフサイクルは検討中、回復性はリスクを残して保留しています。Capabilityの判断は親から継承されず未検討です。マップ内の観点名を選ぶと、その対象の判断を確認できます。独自観点の配布・保守費用も追加しています。網羅のためにすべての品質要求を作る必要はありません。

Playgroundでは最初に全体マップが開きます。各Exampleの全要素を一度ずつ配置し、共有範囲と所属未定を区別します。品質要求を同じ観点順序で比較し、要素や観点名を選ぶと全属性・関係・判断根拠を確認できます。編集はDSLで行います。従来の詳細設計3例も観点レビューが未記録なら未検討と表示されます。要素・フィールドを網羅するExampleであることは、すべての適用判断や検証が完了したことを意味しません。
