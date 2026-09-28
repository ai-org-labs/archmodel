# ArchModel Conversational Design Protocol

この文書は対話の進行制御の正本。DSLの構造はSchema、基本的な安全原則は
[system.md](system.md)、既存の質問候補は[questioning.json](../rules/questioning.json)に従う。
質問テンプレートは候補であり、フィールドを順に埋める固定質問票ではない。

## 開始と保存

1. 対象YAMLを読み、既存の要素・ID・回答済みの内容を把握する。新規の場合はユーザーの説明から最小Draftを作る。
2. 明示された事実、推論した案、人に判断してもらう点を区別する。高確度の補完は変更点を伝えて`status: draft`で保存する。低確度の仮説は事実として保存しない。
3. 高影響な判断（セキュリティ境界、データ保持、費用や運用を拘束する方式等）は選択肢とトレードオフを提示する。Decisionは`decision_status: proposed`とし、人が採用した場合だけ`accepted`にする。共通`status`とは別のフィールドである。
4. 会話全文・内部推論・質問番号・疲労値・現在フェーズ・保留質問・UI選択は意味モデルへ保存しない。必要ならadapterのセッション状態に保持する。
5. 既存のIDを再利用し、参照を維持する。設計変更の指示がない内容を削除しない。不明な必須情報は捏造せず不足として残す。

## Broad → Deep

| フェーズ | 今明らかにすること | 次へ進める目安 |
| --- | --- | --- |
| Landscape | Productの目的・利用者・価値・scope、主要Capability、明白に重要なQuality | 価値と責任範囲が理解でき、主要な能力と大きな責務境界が見える |
| Shape | Capabilityの目的・利用者・入出力、主要Behavior、方式を左右するQuality | 主要能力の振る舞いと入出力を説明でき、重要な品質条件が見える |
| Depth | 優先Behaviorのtrigger・preconditions・outcomes・主要失敗、代表Scenario、外部Contract | 重要な振る舞いの代表例と重要な外部I/Fが説明できる |
| Realization | Behavior/Quality/Policyを満たすComponent、Contract、Decision、Realization、関係 | 重要要求に実現経路があり、主要な方式判断が記録される |
| Assurance | Verificationの方法とレベル、Evidence、要求のカバレッジ、孤立と未決事項 | 重要Scenario/Quality/Policyに検証方針があり、criticalな未解決事項がない |

最初の目安はCapabilityが3〜7、主要CapabilityごとのBehaviorが2〜7。
小さなシステムに数合わせを強制しない。最初のScenarioは原則として正常系・主要失敗・高リスク境界の3系統まで。
Landscapeで製品選定、RTO/RPO詳細、DBカラム、全Scenario、ディレクトリ構成を要求しない。
全Qualityを全Capabilityへ割り当てない。Realizationでは責務の収束を優先し、1 Behavior = 1 Componentにしない。

フェーズは一方通行ではない。ユーザーの「このCapabilityを深掘り」「方式設計へ進む」を尊重する。
その際、先送りする上位の不確実性を短く明示し、局所作業の後で全体バランスを見直す。
完成は全フィールドの充填ではなく上記の理解・経路・保証で判定する。

## 質問の選択

不足ごとに以下を選ぶ。

- **Ask**: 利用者の価値判断や未知の事実を聞く。
- **Infer**: 回答から高確度で導ける内容をDraftへ反映し、補完したことを伝える。
- **Suggest**: 方式などの選択肢を少数に絞り、利点と負担を提示する。
- **Defer**: 現段階で細かすぎることを後回しにする。警告自体を削除・隠蔽しない。

候補は設計価値、リスク削減、依存先への影響、不確実性削減、カバレッジ、方式への影響で比べる。
粒度が細かすぎる質問、早すぎる深掘り、ユーザーの負担、繰り返しにはペナルティを付ける。
候補の数値順位と保留はplanNextQuestionsを使う。設定は[rules/conversation.json](../rules/conversation.json)。
自然言語からの意味抽出と、人への選択肢・トレードオフの具体的な説明はAgent側が行う。

**Breadth Guard**: Product価値・scopeが不明、主要Capabilityが出ていない、一つだけ詳細で他が空、
技術詳細がBehavior/Qualityへつながらない場合は、局所のScenarioやVerificationより全体像を優先する。
**Risk Override**: 重大Security、法令、データ消失、Safety、高可用性、不可逆な方式制約、
破壊的な外部Contract制約はフェーズを跨いで扱える。何のリスクのためかを説明し、必要な範囲を確認して戻る。

1ターンは1テーマ、主質問1つ、関連小質問は最大2つ。質問数を満たすために追加しない。
「actorは？ inputsは？ outputsは？」ではなく、
「この能力は誰が使い、何を渡すと、何を受け取れるものですか？」と聞き、回答を複数フィールドへ分解する。
すでに回答された内容は再質問しない。相反する回答は勝手に上書きせず、矛盾点を一つの質問にまとめる。

## 各回答後の継続

1. 回答を意味単位に分解し、複数の要素・関係へ対応付ける。
2. 既存YAMLとの差分を作り、根拠のある変更を反映する。人の採用が必要な案はproposedに留める。
3. parse/validateし、構造エラー・参照切れは修正する。不足warningは設計途中の状態として保持する。
4. 解決済み事項、新しい不足、矛盾、リスクを把握する。
5. 現フェーズと全体の偏りを再評価する。
6. 最も価値の高い未解決質問を一つ選ぶ。planNextQuestionsへphase・focusIds・recentQuestionTypesを渡し、primary / related / deferredを参照する。
   recentQuestionTypesには直近に提示したcodeまたはcode:targetIdを記録し、回答・状況が変われば更新する。
   既存nextQuestionだけを使う環境では、候補が早すぎる場合は理由を持って保留できる。
7. 「反映したこと」「未確定の案」「次の質問」を必要な範囲だけ短く伝える。毎ターンYAML全文を出さない。全体要約は節目や依頼時に示す。

ユーザーが終了を求めた場合や、希望範囲の目安に達した場合は質問を止める。
保存先、到達した設計範囲、重要な保留事項と検証の実施状況を伝える。未実施のテストを成功にしない。

## 複数の入口

- Top-down: Product → Capability → Behaviorから具体化する。
- Bottom-up: 既存Realizationを受け入れ、Component → Behavior/Quality → Capability → Productへ存在理由を補う。製品を先に言ったことを誤りにしない。
- Quality-first: 99.99%などの条件を記録し、対象能力・測定条件・根拠を確認して方式と検証へつなぐ。
- Problem-first: 「APIが遅い」を観測された問題として受け止め、対象Behavior、期待するQuality、Component、Realizationを辿る。原因を推測で断定しない。

会話の成果は意味付きグラフに残す。レーン配置・会話順序・担当する職種をモデルの所有関係と混同しない。

## 各観点を検討した記録

レビューする対象をreview_scopesで明示し、reviewsに適用要否を残します。未記入はunreviewed、確認中はin_reviewです。applicableはrationale・ownerと設計要素へのaddresses、not_applicableはrationale・owner・assumptions・revisit_when、deferredはrationale・owner・residual_risk・revisit_whenを記録します。根拠を捏造して全観点を対象外にしないでください。合意前の除外案はin_reviewとして扱います。保留は解決済みにせず、親の除外を子へ継承しません。必要な観点だけ実際のQuality等へ具体化し、カタログ全件を設計要素として生成しません。独自観点はreview_catalogへ追加できます。観点の判断完了を実装・検証完了と混同せず、変更時には前提と再検討条件を確認してください。
