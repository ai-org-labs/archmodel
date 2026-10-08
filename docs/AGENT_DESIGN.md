# ArchModel Conversational Design Agent

対象: ai-org-labs/archmodel / @archmodel/core 0.1.1。文書ステータス: Draft。
実装範囲: Phase A〜C（文書・入口・Planner・CLI）。Playgroundにはマップ内の観点展開と対象・観点への絞り込みを実装。Phase DのLLM接続・会話パネルは未実装。npmへの新バージョン公開は未実施。

## 目的と境界

自然言語で広く浅く全体像を作り、重要な領域から深める設計進行プロトコルを追加する。
成果は会話ログではなくArchModelの意味付きグラフへ残す。

```text
Human → Conversational Agent → ArchModel Design Graph
                                ├─ Design Map
                                ├─ Requirements / Architecture
                                └─ Verification / Why / Impact
```

Schema / Validation / questioning / traceWhy / Design Mapを置き換えない。
LLMベンダー固有APIをcoreへ組み込まず、UI内LLM接続も初期導入に含めない。
高影響判断の無断確定、全Scenarioの網羅的展開、全Capabilityへの全Quality強制、
会話・一時状態のモデル混入、外部クラウドやJiraの自律変更は対象外。

## 正本と責任

| ファイル | 責任・状態 |
| --- | --- |
| schema/archmodel.schema.json | DSL構造・型の正本（既存） |
| syntax/reference.md | 人間向けDSL仕様（既存） |
| prompts/system.md | 基本思想と安全原則（既存、対話への参照を追加） |
| prompts/conversational-design.md | Broad→Deep、質問量、判断権限、継続・終了の正本（A） |
| rules/questioning.json | 質問テンプレート・概念優先度（既存） |
| rules/conversation.json | フェーズ・深さ・量の実行設定（B実装済み） |
| AGENTS.md | 正本を読む入口（A） |
| .github/agents/archmodel-designer.md | GitHub / VS Codeの薄いアダプタ（A） |
| docs/AGENT_USAGE.md | 実行手順と手動評価（A） |
| src/model/analysis.ts | 現行nextQuestions / nextQuestion実装 |
| src/model/questioning.ts | Planner実装（B） |

設計手順をアダプタへコピーしない。対話アルゴリズムの詳細は
[対話プロトコル](../prompts/conversational-design.md)を参照する。
Aでは人とAgentがプロトコルを評価し、実利用で粒度を調整してからBの数値設定を固定する。

## Phase B: Question Planner

`validateModel`は客観的な不足・孤立・未検証・参照不正・policy gapを返す。
Plannerはその不足を今聞くべきか判断する。LandscapeでUNCOVEREDをdeferしても検証結果は変えない。
初期入力が構造エラーを含む場合は、フェーズ進行より先に構造を修正する。

FQA的な方針は「今選べる質問から価値の高い未解決質問を選ぶ」こと。
特定の外部実装・論文の厳密な再現や、完成した数式モデルを意味しない。

```text
QuestionScore = DesignValue + RiskReduction + DependencyImpact
              + UncertaintyReduction + CoverageGain + ArchitectureImpact
              - GranularityPenalty - PrematureDepthPenalty
              - UserFatiguePenalty - RepetitionPenalty
```

Breadth GuardとRisk Overrideの意味は対話プロトコルを参照。
実装のスコアは概念priority × フェーズ重みを基準に、同フェーズ+40、focus、risk、Why、breadthを加点し、早すぎる詳細・overview時の粒度・繰り返しを減点する。
値はrules/conversation.jsonに集約し、未指定概念の重みは0。同点はcode:targetIdの辞書順。
情報価値や疲労をLLMで測定する実装ではなく、観測可能な診断・contextを使った参考実装である。
フェーズ未指定ならProductの価値・scope・主要能力の有無、Shapeの不足、Depthの不足、実現の不足の順で推定する。
明示phaseを尊重する。overviewは詳細を保留し、deepとfocusの組み合わせはDepthを選ぶ。
focusはhas関係の子孫に加点し、全体リスクを除外しない。
高リスクはPUBLIC_AUTH、risk high/critical、Quality.level high、availability target >= 99.99で検知する。
法令・Safety・不可逆な制約の自然言語による検知はAgent側が担い、必要なphaseを指定する。
同一codeまたはcode:targetIdが直近に2回出た場合、非リスク質問を保留する。
同一対象・同一質問フェーズを1テーマとし、関連質問を2件まで返す。
品質が全くない場合の品質探索、proposed Decisionの採否確認も候補にするが、validateModelの結果は変更しない。

### API

ソースで利用可能なAPI。DSLのversionとは分離する。

```ts
type ConversationPhase =
  | 'landscape' | 'shape' | 'depth' | 'realization' | 'assurance';
type ConversationContext = {
  phase?: ConversationPhase;
  focusIds?: string[];
  recentQuestionTypes?: string[];
  userRequestedDepth?: 'overview' | 'normal' | 'deep';
  locale?: string;
};
type DesignQuestion = {
  code: string;
  targetId?: string;
  concept: 'product' | 'capability' | 'behavior' | 'scenario' | 'quality'
    | 'policy' | 'decision' | 'contract' | 'component' | 'realization'
    | 'verification' | 'evidence';
  message: string;
  priority: number;
  score: number;
  phase: ConversationPhase;
  strategy: 'ask' | 'infer' | 'suggest' | 'defer';
};
type QuestionPlan = {
  phase: ConversationPhase;
  primary: DesignQuestion | null;
  related: DesignQuestion[];
  deferred: DesignQuestion[];
  rationaleCodes: string[];
};
// Modelはcoreからimportする。
declare function planNextQuestions(model: Model, context?: ConversationContext): QuestionPlan;
```

Planner自体はモデルを書き換えない。infer/suggestは戦略の提案であり、自然言語の理解やパッチ生成を保証しない。
回答を複数ノードへ分解して更新する責務はAgent/adapter側にある。
`related`は同一テーマの最大2件。保留項目を質問文へ連結して質問数制限を回避しない。
`rationaleCodes`は判断理由を示す安定コードとし、内部推論の保存には使わない。

### 互換性の注意

現行`nextQuestion(model, options?)`は`Question | null`を返す。
`Question`の公開フィールドは`id / entityId / field / priority / text / reason`。
`options`には`locale / messages / priorities`があり、`nextQuestions`も公開されている。

新しいDesignQuestionをそのまま返すwrapperでは互換性を満たさないため、
既存nextQuestion / nextQuestionsの実装・順位・optionsを維持し、planNextQuestionsを追加APIとした。
旧APIを新Plannerへ委譲する変更は行っていない。

### 実行設定

[rules/conversation.json](../rules/conversation.json)が正本。versionはDSLのversionとは独立。
能力数・振る舞い数・代表Scenario数はAgentの初回目安であり、Plannerが数合わせを強制する閾値ではない。
relationは概念に追加せず、関係不足を接続先のcomponent / realization / verification等の概念へ対応付ける。

## Phase C: CLI

既存question / why / matrix / viewを維持する。

```sh
archmodel question model.yaml --phase landscape
archmodel question model.yaml --focus file-analysis
archmodel question model.yaml --depth overview
archmodel plan model.yaml
```

planはprimary / related / deferredと理由コードをJSONまたはMarkdownで返す。
未知のオプション・ID・値・構造エラーは終了1、null primaryを含む正常な計画は終了0。
現在利用できるコマンドは[利用ガイド](AGENT_USAGE.md)を参照。

## Phase D: UI（必要性確認後）

Design Map横のAgent panelにphase、次質問、回答欄、Draft提案、差分適用を置く案。
LLM接続は別adapterとし、coreへベンダーAPI・APIキー・会話履歴を入れない。
会話の編集も既存のUndo/Redoとモデル更新経路へ統合する。今回のA〜Cには含めない。

## 検証と受入基準

Aは正本・参照・DSL例を検証し、実環境の会話品質は手動評価する。
Bのunit testではphase推定、breadth/risk、scoring、overview、repetition、戦略、focus、非変更、互換性を確認する。
Cの統合確認はtools/verify-questioning-cli.mjsで行い、npm run verifyに含める。
自然言語からの抽出はPlannerのunit testと分けてadapterのシナリオ評価にする。

| ID | 受入条件 | 主な確認段階 |
| --- | --- | --- |
| AC-A01 | 新規設計では技術選定よりProduct/Capabilityを先に形成 | A対話評価、B順位テスト |
| AC-A02 | 主要能力未定時にScenario/Verificationの細部を連続質問しない | A対話評価、B breadthテスト |
| AC-A03 | 1テーマ、主質問1、関連小質問2以下 | A対話評価、B件数/関連性テスト |
| AC-A04 | 一回答を複数項目へ分解・更新 | A/adapterシナリオ評価 |
| AC-A05 | 高影響Decisionを推論だけでacceptedにしない | A/adapterシナリオ評価 |
| AC-A06 | 技術起点を受理し上位の価値へ補完 | A対話評価、B逆引き質問テスト |
| AC-A07 | 利用者の深掘り・方式設計への指示を反映 | A対話評価、B contextテスト |
| AC-A08 | validationと今の質問を分離 | A方針確認、B非変更/保留テスト |
| AC-A09 | ScenarioをすべてE2Eへ変換しない | A/adapterシナリオ評価 |
| AC-A10 | 有効なv0.1 YAMLを生成 | A例の検証、adapter各シナリオ終了時 |
| AC-A11 | nextQuestionの互換性維持 | A API変更なし、B回帰テスト |
| AC-A12 | ノウハウがLLMベンダー非依存 | A正本/adapter分離、B依存検査 |

手動のシナリオ入力と期待結果は[利用ガイド](AGENT_USAGE.md)に集約する。
B/CではnextQuestion、validateModel、Design Map、CLI、Schema、既存AC-01〜10の回帰も確認する。
受入条件を文書化したことと、実際のAgentで合格したことを区別する。

## 観点カバレッジの統合

未開始のProduct/CapabilityもPlannerの未検討候補に含める。旧nextQuestionとvalidateModelの既存文書互換性は維持する。designCoverageとcoverage CLIは全対象の未結論・結論あり・解決済みを集計する。designFocusとfocus CLIは局所設計と境界接続を返す。Playgroundは全体マップを入口にし、対象別の結論数と未結論を表示する。対象を選ぶと同じモデルの局所マップへ絞れ、範囲外への接続を残す。属性・関係・観点・判断根拠・文書情報を同じマップ上で展開・編集する。エージェントの判断品質そのものと決定論的ツールのテストは区別する。
