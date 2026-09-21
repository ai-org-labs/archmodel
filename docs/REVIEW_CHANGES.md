# v0.1固定前レビューの反映

## 構文と意味モデル

| 指摘 | 変更 |
| --- | --- |
| 実アーキテクチャの接続がない | relationsを追加。7種の接続、protocol、Contract参照、グローバル一意ID、端点型検査 |
| Interface / Contractが弱い | contractsを一級要素化。uses / provides / consumes / verified_by、契約View |
| ScenarioがGherkinに固定 | type / specificationへ正規化。Gherkin、状態遷移、タイミング、データ例、バッチ、IoT、非同期イベント、自由記述に対応 |
| quality / qualitiesが曖昧 | Capability.quality=Profile、Capability.qualities=ID配列、トップレベルqualities=定義。Profileのnameとattribute補完を規定 |
| field型が不明 | use_cases・rules・trade_off等を文字列配列へ。全フィールド表をSchemaから自動生成 |
| Decision.affectsにProductがない | Productを許可 |
| 無向到達集合が広すぎる | depth / direction / relationTypes付き幅優先探索。UIも同じ範囲を使用 |
| verified判定が曖昧 | coverage / verification_status / statusを分離。0件、部分カバー、unknown、passed、failedを明文化 |
| Policyが単一rule | rules配列へ。単数ruleは不許可 |
| 実装制限が文法制限に見える | Runtime limits節として分離 |

## 構文の一貫性

固定前のv0.1として、正規構文だけを実装します。旧名の別名、暗黙の型変換、旧下書きの移行処理は持ちません。公開Schemaとパーサーは同じ構文を受け付けます。Quality Profileのname / attribute補完だけは定義された糖衣構文として扱います。

Model.connectionsは接続の明示IDとメタデータを保持します。verificationSummaryはcoverageとverification_statusを分離します。relatedIdsの既定値は深さ2の順方向探索です。

## 検証

test/refinements.test.tsが実接続・契約の型、並行接続、参照切れ、ID重複、旧記法の拒否、Qualityの正規化、循環を含む限定探索、0件・未実施・成功・失敗・部分カバーを検証します。既存の受入テストとレーン配置テストも維持しています。
