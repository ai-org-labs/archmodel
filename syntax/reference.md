# ArchModel v0.1 構文

ArchModelは価値・振る舞い・品質・契約・論理責務・技術実現・検証を結ぶYAML DSLです。Design Modelを正本にし、図の座標や線形状はView側で決めます。

## 文書と識別子

`version: '0.1'`が必須です。IDは設計要素・接続・検討記録で共通の名前空間を使い、文書全体で一意です。`^[A-Za-z][A-Za-z0-9_.-]*$`に従います。参照は完全一致のIDで、前方参照できます。

トップレベルのproducts / capabilities / behaviors / scenarios / qualities / policies / decisions / components / realizations / contracts / verifications / evidenceは定義の配列です。productは単数形の略記です。
構造上の必須項目はSchemaのrequired、設計完成に必要な項目はx-design-requiredで定義します。未完成モデルはwarningとして保持し、不正な型・参照切れ・不正な関連はerrorにします。

## 観点の検討記録

設計に含めない項目も、検討したうえで外したのかを残します。設計要素を増やさず、文書直下のメタデータとして扱います。

- `review_scopes`: 検討する対象要素IDの配列。記録がなくても、その対象の全観点を未検討として診断します。
- `reviews`: 対象 `target` と観点 `perspective` ごとの判断。組み合わせは一意です。記録を作ると対象の検討を開始します。
- `review_catalog`: 独自観点の追加定義（id / name / description）。組み込み観点は上書きできません。観点IDは設計要素IDとは別の名前空間です。

組み込み観点は `behavior_specification` / `scenario_coverage` / `contracts` / `logical_responsibilities` / `technical_realization` / `verification_evidence` / `policies` / `design_decisions` / `system_boundary` / `actors` / `data_lifecycle` / `external_dependencies` / `assumptions` / `failure_modes` と、Quality.attributeの各値に `quality.` を付けたものです。品質要求を全種類作ることを求めるものではありません。

| status | 意味 | 判断に必要な記録 |
| --- | --- | --- |
| unreviewed | 未検討（未記入時も同じ） | まだ判断していない |
| in_review | 検討中 | 確認途中の内容をrationaleに残す |
| applicable | 対象 | rationale・owner・addresses（設計要素IDの配列） |
| not_applicable | 対象外 | rationale・owner・assumptions（前提の配列）・revisit_when |
| deferred | 保留 | rationale・owner・residual_risk・revisit_when |

```yaml
review_scopes: [converter]
reviews:
  - id: review-converter-availability
    target: converter
    perspective: quality.availability
    status: not_applicable
    owner: product-team
    rationale: ローカル実行のみで常時稼働サービスを提供しない
    assumptions: [利用者の端末でオフライン実行する]
    revisit_when: サーバー経由の提供や稼働時間の保証を求められたとき
```

上記のconverterは同じ文書で定義する必要があります。全体例は `syntax/examples/perspective-review.archmodel.yaml` を参照してください。

未記入は対象外を意味しません。親の判断を子へ継承しません。対象外のaddressesは矛盾として診断します。根拠不足でもDraftとして保存できますが判断完了には数えません。保留は条件を記録しても未解決です。既存文書でreview_scopesもreviewsもなければ検討は未開始で、追加の観点警告は出しません。

観点の判断完了と、設計・実装・検証の完了は別です。対象外の記録で既存QualityやVerificationの不足を消しません。前提変更を自動判断しないため、変更時には担当者がrevisit_whenと照合します。UIでaddressesの参照先を削除すると、その記録をin_reviewへ戻します。

Playgroundは全体マップを初期表示します。各要素を選ぶと全属性・関係・実接続と既存の観点記録を読めます。機能の隣には共通順序の品質観点を表示し、観点名から適用判断・根拠・未検討を確認できます。内容はDSLエディタで編集・保存します。CLIの `archmodel reviews model.yaml [target-id]` でも記録を取得でき、YAML・Markdown出力にも残ります。

`archmodel coverage model.yaml [target-id]` は未開始も含むカバレッジを取得します。根拠の揃ったapplicable / not_applicable / deferredを「結論あり」と数え、deferredを除くものを「解決済み」と数えます。`archmodel focus model.yaml target-id [perspective-id]` は対象の設計内容・関連・範囲外接続を返します。これらは読み取り専用です。`review-start`と`review-set`は更新後YAMLを標準出力します。

## アーキテクチャの接続

`relations`はComponent / Realization同士の接続です。要件の対応関係と区別して保持し、`connections` Viewに射影します。

```yaml
version: '0.1'
components:
  - id: auth-service
    name: Auth API
    kind: application
    responsibilities: [認証]
    consumes: [identity-api]
realizations:
  - id: identity-platform
    name: Identity Platform
    kind: resource
    provider: gcp
contracts:
  - id: identity-api
    name: Identity API
    kind: external
    specification: contracts/identity.md
relations:
  - id: auth-to-idp
    from: auth-service
    to: identity-platform
    type: calls
    protocol: https
    contract: identity-api
```

| type | from → to |
| --- | --- |
| depends_on | 依存する要素 → 依存先 |
| calls | 呼び出し元 → 呼び出し先 |
| publishes | 発行元 → 配信先・Topic |
| subscribes | 購読者 → 購読するTopic |
| reads | 読み手 → データソース |
| writes | 書き手 → 保存先 |
| routes_to | ルーティング元 → 転送先 |

id / from / to / typeは構造上必須。protocol / contract / label / descriptionは任意です。contractはContract IDを1件指定します。同じ端点でも異なるIDで複数の接続を記述できます。接続サイクルも許容します。自己接続は再入・自己呼び出しなどを表現できます。実環境との照合や通信の実行は行いません。

## Contract

ContractはBehaviorでもComponentでもなく、API・Event・Message・外部インターフェースの契約です。kindはhttp / event / message / external。specificationは仕様への文字列参照です。OpenAPI等の内容は自動取得・検証しません。

- Behavior.uses: 利用するContract IDの配列。
- Component.provides: 提供するContract IDの配列。
- Component.consumes: 消費するContract IDの配列。
- Contract.verified_by: 契約を保証するVerification IDの配列。
- Component.interfacesはRESTなどの補足文字列です。接続先や契約を表す場合は上記の参照を使います。

マップではContractをComponent列に併記します。API / Event契約Viewではuses / provides / consumes / verifiedByを表示します。Whyではこれらの参照から価値の根拠を逆引きします。

## Scenario

```yaml
scenarios:
  - id: login-success
    name: 正常ログイン
    type: gherkin
    specification: |
      Given 有効なユーザーが存在する
      When ログインする
      Then トークンが返る
```

type / specificationを正規形とします。typeはgherkin / state_transition / timing / example / batch / iot / async_event / textから選択できます。未記入は設計上の不足、未知のtypeは構造エラーです。将来の表現方式はtypeの追加として扱えます。gherkinの場合だけGiven / When / Thenの存在を検査します。他の形式は本文の保存・表示に対応し、形式固有の構文解析や実行は行いません。フルGherkin実行系ではありません。ScenarioをE2Eに固定しません。

## Quality ProfileとQuality参照

Capability.qualityは属性名をキーとする正式なProfile糖衣構文です。キーはQuality.attributeと同じEnumです（下記の全フィールド一覧を参照）。costは品質属性ではなく、Decision.categoryなどで扱います。
Capability.qualitiesは既存Quality IDへの通常参照（文字列配列）です。トップレベルqualitiesはQuality定義の配列です。

```yaml
capabilities:
  - id: authentication
    quality:
      availability:
        id: auth-availability
        requirement: 月間の認証成功率
        target: 99.99
        unit: '%'
    qualities: [auth-security]
qualities:
  - id: auth-security
    name: 認証情報保護
    attribute: security
    requirement: 認証情報を暗号化する
```

Profile内のattributeはキーから補完します。明示する場合はキーとの一致が必要です。name省略時は`Capabilityのname（未定義ならid） / 属性名`を自動生成します。IDは自動生成せず、必須です。糖衣構文と通常参照はともにCapability → has → Qualityへ正規化します。

## 型と複数値

全フィールドの型・Enum・必須性の正本はschema/archmodel.schema.jsonです。この文書末尾の一覧はSchemaから自動生成します。

`guarantees / constraints / preconditions / failure_behaviors / side_effects / commands / events / use_cases / alternatives / trade_off / rules`はいずれも文字列配列です。単数値でも配列にします。Behaviorはuse_cases、Policyはrulesを用います。

任意の追加データはextensionsオブジェクトに置きます。未知の通常フィールドは誤記としてエラーにします。共通statusはdraft / designed / implemented / verified / operational。Decision.decision_statusはproposed / accepted / deprecated / supersededであり、共通statusとは別です。

## 意味付き関連

| 入力キー | 正規化された関連 | 始点 → 終点 |
| --- | --- | --- |
| has、ネスト | has | Product → Capability/Policy/Decision/Component/Realization/Verification、Capability → Behavior/Quality、Behavior → Scenario |
| realized_by | realizedBy | Behavior/Quality/Policy → Component |
| realizes | realizedByへ反転 | Component → Behavior/Quality/Policy |
| implemented_by | implementedBy | Component → Realization |
| verified_by | verifiedBy | Scenario/Quality/Policy/Behavior/Component/Realization/Contract → Verification |
| verifies | verifiedByへ反転 | Verification → 上記の検証対象 |
| applies_to | appliesTo | Policy → Product/Capability/Behavior/Component/Realization |
| affects | affects | Decision → Product/Capability/Quality/Behavior/Policy/Component/Realization |
| evidenced_by | evidencedBy | Verification/Quality → Evidence |
| uses | uses | Behavior → Contract |
| provides / consumes | 同名 | Component → Contract |

ネストはhasの糖衣構文です。Productはcapabilities等、Capabilityはbehaviors、Behaviorはscenariosを内包でき、定義の代わりにID参照も利用できます。Capability.qualitiesは参照専用です。重複した意味付き関連は統合し、多対多を保ちます。ResourceはRealization(kind: resource)です。Productとクラウドプロジェクトを同一視しません。

## 関連範囲の探索

`relatedIds(model, id, {depth, direction, relationTypes})`で探索します。既定値は深さ2、forward、has / realizedBy / implementedBy / verifiedBy / uses / provides / consumesです。深さ0は自身のみ。directionはforward / reverse / both。relationTypesは正規化された意味付き関連名または接続typeの配列です。空配列は自身だけを返します。

探索は幅優先で、訪問済みIDを再訪しません。有限の非負整数の深さだけを許可します。Policy / Decisionや接続の関係は明示指定時だけ辿ります。無制限の無向探索を既定にしません。

マップのハイライトは深さ3・forwardを初期値とし、「関連範囲」で深さ・方向・関連種別を変更できます。選択した関連線にも同じフィルターを適用します。Whyは別の目的の機能で、接続エッジを辿らず、設計の根拠をProductまで逆引きします。システム接続Viewは全接続の構成図で、マップの選択ハイライトとは別です。

## Coverageと検証結果

`verificationSummary(model, id)`はcoverage / verification_status / status / verificationIdsを返します。

| 状態 | 定義 |
| --- | --- |
| uncovered | 必要な検証リンクがない。0件のVerificationを成功扱いしない |
| covered_unknown | 全対象に検証リンクがあり、結果未記入またはunknownを含む |
| verified | 全対象に検証リンクがあり、1件以上の対象Verificationがすべてpassed |
| failed | 対象Verificationに1件以上failedがある。未カバー箇所の有無より優先 |

coverageはuncovered / covered。verification_statusはunknown / passed / failed。部分カバーで既存テストがすべて成功した場合、coverage=uncovered、verification_status=passed、status=uncoveredです。

Capability等の集計対象はhas / usesで到達するScenario・Quality・Policy・Contractと、明示的にverified_byを持つ要素です。共有Componentから別能力の検証を巻き込みません。Verification自体を選択した場合はその1件の結果を表示します。completeness.coverageも同じEnumを返し、verifiedはstatusがverifiedであることから導出するbooleanです。

passedは利用者の宣言です。実際のテスト実行やSLO計測は行いません。Evidenceがない成功宣言には警告を出します。公開リソースの認証定義も宣言上の検査です。

## 正規構文のみを受け付ける

別名や旧記法の互換処理は提供しません。gherkinフィールド、usecases、Policy.rule、文字列のtrade_off、Capability.qualitiesへの定義オブジェクトはエラーです。
Scenarioはtype / specification、Behaviorはuse_cases、Policyはrules、Decision.trade_offは文字列配列を使います。Qualityの定義はCapability.qualityまたはトップレベルqualitiesに置き、Capability.qualitiesはIDだけを参照します。

## Runtime limits of reference implementation v0.1

これらは参照実装の保護上限で、DSL文法の制限ではありません。

- 要素400件、意味付き関連と接続の合計2000件、ソース500,000文字。
- 入力構造の深さ20、オブジェクト20,000件。共有・循環YAMLエイリアスは非対応。
- Whyの出力は最大1000経路。UIの関連探索は深さ0〜20で設定。

将来の上限変更だけでDSLバージョンを変更する必要はありません。

## View

`renderStructuredMap(model, {selectedId})` はProductの目的と範囲、Capability → Behavior → Scenarioの入れ子、対応する品質要求、方針・判断・構成・技術実現・検証を同じ全体マップに配置します。共有要素と所属未定も一度ずつ表示し、選択で配置を変えません。全属性と関係は詳細表示に保持します。

品質の分類見出しは表示上の整理で、IPA非機能要求グレードの全下位項目やレベルの実装ではありません。観点未定義・未検討・保留・対象外を区別し、親の判断を継承しません。要求水準、検討の結論、検証結果を別々に表示します。

従来の `projectModelMap` / `renderModelMap` は全属性・関係・観点の射影、展開と絞り込みを持つ互換APIとして保持します。座標は意味モデルから自動生成しDSLへ保存しません。
旧`renderDesignMap`は互換用の7列マップAPIです。`renderView(model, 'connections')`は実接続の構成図、`renderView(model, 'contracts')`は契約関係図です。元のarchitecture Viewは要求・Component・Realizationのトレーサビリティです。

<!-- GENERATED FIELD TYPES -->

## 全フィールドの型（Schemaから生成）

### Document

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| version | "0.1" | 構造上必須 |
| product | product | 任意 |
| extensions | object | 任意 |
| products | 配列<product> | 任意 |
| capabilities | 配列<capability> | 任意 |
| behaviors | 配列<behavior> | 任意 |
| scenarios | 配列<scenario> | 任意 |
| qualities | 配列<quality> | 任意 |
| policies | 配列<policy> | 任意 |
| decisions | 配列<decision> | 任意 |
| components | 配列<component> | 任意 |
| realizations | 配列<realization> | 任意 |
| verifications | 配列<verification> | 任意 |
| evidence | 配列<evidence> | 任意 |
| contracts | 配列<contract> | 任意 |
| relations | 配列<architectureRelation> | 任意 |
| review_catalog | 配列<reviewPerspective> | 任意 |
| review_scopes | 配列<string> | 任意 |
| reviews | 配列<designReview> | 任意 |

### product

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| purpose | string | 設計上必須（不足はwarning） |
| primary_users | 配列<string> | 設計上必須（不足はwarning） |
| user_value | string | 設計上必須（不足はwarning） |
| scope | 配列<string> | 設計上必須（不足はwarning） |
| out_of_scope | 配列<string> | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| capabilities | 配列<string または capability> | 任意 |
| policies | 配列<string または policy> | 任意 |
| decisions | 配列<string または decision> | 任意 |
| components | 配列<string または component> | 任意 |
| realizations | 配列<string または realization> | 任意 |
| verifications | 配列<string または verification> | 任意 |

### capability

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| purpose | string | 設計上必須（不足はwarning） |
| actor | 配列<string> | 設計上必須（不足はwarning） |
| inputs | 配列<string> | 設計上必須（不足はwarning） |
| outputs | 配列<string> | 設計上必須（不足はwarning） |
| guarantees | 配列<string> | 任意 |
| constraints | 配列<string> | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| behaviors | 配列<string または behavior> | 設計上必須（不足はwarning） |
| qualities | 配列<string> | 任意 |
| quality | object | 任意 |

### behavior

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| actor | 配列<string> | 任意 |
| trigger | string | 設計上必須（不足はwarning） |
| preconditions | 配列<string> | 任意 |
| outcomes | 配列<string> | 設計上必須（不足はwarning） |
| failure_behaviors | 配列<string> | 任意 |
| side_effects | 配列<string> | 任意 |
| commands | 配列<string> | 任意 |
| events | 配列<string> | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| scenarios | 配列<string または scenario> | 任意 |
| use_cases | 配列<string> | 任意 |
| uses | 配列<string> | 任意 |

### scenario

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| type | `gherkin` / `state_transition` / `timing` / `example` / `batch` / `iot` / `async_event` / `text` | 設計上必須（不足はwarning） |
| specification | string | 設計上必須（不足はwarning） |

### quality

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| attribute | `reliability` / `availability` / `resilience` / `recoverability` / `performance` / `scalability` / `security` / `privacy` / `operability` / `observability` / `audit` / `maintainability` / `testability` / `usability` / `accessibility` / `compatibility` / `interoperability` / `portability` / `migration` / `deployment` / `safety` | 設計上必須（不足はwarning） |
| target | string / number | 任意 |
| unit | string | 任意 |
| level | string | 任意 |
| requirement | string | 設計上必須（不足はwarning） |
| sli | string | 任意 |
| rto | string | 任意 |
| rpo | string | 任意 |
| risk | `normal` / `high` / `critical` | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |

### policy

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| category | string | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| rules | 配列<string> | 設計上必須（不足はwarning） |

### decision

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| title | string | 任意 |
| category | string | 任意 |
| context | string | 設計上必須（不足はwarning） |
| decision | string | 設計上必須（不足はwarning） |
| alternatives | 配列<string> | 任意 |
| reason | string | 設計上必須（不足はwarning） |
| trade_off | 配列<string> | 任意 |
| decision_status | `proposed` / `accepted` / `deprecated` / `superseded` | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |

### component

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| kind | `application` / `domain` / `data` / `interface` / `platform` | 設計上必須（不足はwarning） |
| responsibilities | 配列<string> | 設計上必須（不足はwarning） |
| interfaces | 配列<string> | 任意 |
| data | 配列<string> | 任意 |
| template | `hexagonal` / `ddd` / `vertical-slice` | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |
| provides | 配列<string> | 任意 |
| consumes | 配列<string> | 任意 |

### realization

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| kind | `runtime` / `resource` / `network` / `data` / `directory` / `module` / `source` / `iac` / `deployment` | 設計上必須（不足はwarning） |
| provider | string | 任意 |
| service | string | 任意 |
| location | string | 任意 |
| environment | string | 任意 |
| public | boolean | 任意 |
| authentication | string | 任意 |
| deployment_strategy | string | 任意 |
| observability | 配列<string> | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |

### verification

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| level | `unit` / `domain` / `contract` / `integration` / `acceptance` / `e2e` / `iac` / `policy` / `resilience` / `telemetry` | 設計上必須（不足はwarning） |
| method | string | 設計上必須（不足はwarning） |
| location | string | 任意 |
| result | `unknown` / `passed` / `failed` | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |

### evidence

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| location | string | 設計上必須（不足はwarning） |
| collected_at | string | 任意 |
| result | `passed` / `failed` / `unknown` | 任意 |
| has | 配列<string> | 任意 |
| realizes | 配列<string> | 任意 |
| realized_by | 配列<string> | 任意 |
| implemented_by | 配列<string> | 任意 |
| verified_by | 配列<string> | 任意 |
| verifies | 配列<string> | 任意 |
| applies_to | 配列<string> | 任意 |
| affects | 配列<string> | 任意 |
| evidenced_by | 配列<string> | 任意 |

### contract

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 設計上必須（不足はwarning） |
| description | string | 任意 |
| owner | string | 任意 |
| status | `draft` / `designed` / `implemented` / `verified` / `operational` | 任意 |
| extensions | object | 任意 |
| kind | `http` / `event` / `message` / `external` | 設計上必須（不足はwarning） |
| specification | string | 設計上必須（不足はwarning） |
| verified_by | 配列<string> | 任意 |

### architectureRelation

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| from | string | 構造上必須 |
| to | string | 構造上必須 |
| type | `depends_on` / `calls` / `publishes` / `subscribes` / `reads` / `writes` / `routes_to` | 構造上必須 |
| protocol | string | 任意 |
| contract | string | 任意 |
| label | string | 任意 |
| description | string | 任意 |
| extensions | object | 任意 |

### reviewPerspective

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| name | string | 構造上必須 |
| description | string | 任意 |

### designReview

| フィールド | 型・Enum | 必須性 |
| --- | --- | --- |
| id | string | 構造上必須 |
| perspective | string | 構造上必須 |
| target | string | 構造上必須 |
| status | `unreviewed` / `in_review` / `applicable` / `not_applicable` / `deferred` | 任意 |
| rationale | string | 任意 |
| assumptions | 配列<string> | 任意 |
| residual_risk | string | 任意 |
| revisit_when | string | 任意 |
| owner | string | 任意 |
| addresses | 配列<string> | 任意 |

