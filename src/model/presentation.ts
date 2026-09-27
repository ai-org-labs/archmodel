/** Shared labels for the map, editor and inspector. */
export const fieldLabels:Record<string,string>={type:'type（記述形式）',name:'name（名称）',owner:'owner（担当）',status:'status（状態）',purpose:'purpose（目的）',primary_users:'primary_users（利用者）',user_value:'user_value（価値）',scope:'scope（対象範囲）',out_of_scope:'out_of_scope（対象外）',actor:'actor（利用者）',inputs:'inputs（入力）',outputs:'outputs（出力）',trigger:'trigger（きっかけ）',outcomes:'outcomes（結果）',specification:'specification（内容）',kind:'kind（種類）',responsibilities:'responsibilities（責務）',service:'service（サービス）',location:'location（場所）',attribute:'attribute（品質属性）',requirement:'requirement（品質要求）',target:'target（目標）',unit:'unit（単位）',rules:'rules（ルール）',method:'method（検証方法）',level:'level（検証レベル）',use_cases:'use_cases（ユースケース）',commands:'commands（コマンド）',events:'events（イベント）',guarantees:'guarantees（保証）',constraints:'constraints（制約）',category:'category（分類）',context:'context（背景）',decision:'decision（決定）',reason:'reason（理由）',trade_off:'trade_off（トレードオフ）',provider:'provider（提供元）',result:'result（結果）'};
export const relationLabels:Record<string,string>={has:'配下に含める',realizedBy:'実現先',implementedBy:'実装先',verifiedBy:'検証先',appliesTo:'適用する',affects:'影響する',evidencedBy:'証跡',uses:'利用する',provides:'提供する',consumes:'受け取る'};

export const scenarioFormats:Record<string,string>={gherkin:'Gherkin',state_transition:'状態遷移',timing:'タイミング',example:'データ例',batch:'バッチ',iot:'IoT',async_event:'非同期イベント',text:'自由記述'};

export const qualityCategories:Record<string,string>={reliability:'信頼性',performance:'性能・拡張性',security:'セキュリティ・プライバシー',operability:'運用性',maintainability:'保守性',usability:'使用性・アクセシビリティ',compatibility:'互換性・相互運用性',portability:'移行・配備・移植性',safety:'安全性'};
export const qualityAttributeCategory:Record<string,string>={availability:'reliability',resilience:'reliability',recoverability:'reliability',scalability:'performance',privacy:'security',observability:'operability',audit:'operability',testability:'maintainability',accessibility:'usability',interoperability:'compatibility',migration:'portability',deployment:'portability'};
export const decisionCategories:Record<string,string>={quality:'品質',cost:'コスト',delivery:'デリバリー',ownership:'責任分担',runtime:'実行構成'};
export const qualityCategory=(attribute:unknown)=>typeof attribute==='string'?(qualityAttributeCategory[attribute]??attribute):'unspecified';

export const policyCategories:Record<string,string>={security_baseline:'Security Baseline',logging_standard:'Logging Standard',iam_policy:'IAM Policy',naming_tagging:'Naming / Tagging',data_protection:'Data Protection',compliance_rules:'Compliance Rules'};

Object.assign(fieldLabels,{description:'description（説明）',extensions:'extensions（拡張情報）',preconditions:'preconditions（事前条件）',failure_behaviors:'failure_behaviors（失敗時の振る舞い）',side_effects:'side_effects（副作用）',sli:'sli（品質指標）',rto:'rto（復旧時間目標）',rpo:'rpo（復旧時点目標）',risk:'risk（リスク）',title:'title（見出し）',alternatives:'alternatives（代替案）',decision_status:'decision_status（判断の状態）',interfaces:'interfaces（インターフェース）',data:'data（データ）',template:'template（構成パターン）',environment:'environment（環境）',public:'public（外部公開）',authentication:'authentication（認証方式）',deployment_strategy:'deployment_strategy（配備方式）',observability:'observability（監視・可観測性）',collected_at:'collected_at（取得日時）'});

// Always expose the literal DSL key; translations describe it without renaming it.
Object.assign(fieldLabels, {provides:'provides（提供する契約）', consumes:'consumes（消費する契約）'});
export function fieldLabel(key:string, kind?:string):string {
 if (key === 'level' && kind === 'quality') return 'level（要求レベル）';
 if (key === 'specification' && kind === 'contract') return 'specification（仕様への参照）';
 return fieldLabels[key] ?? key;
}
export const qualityAttributes:Record<string,string>={reliability:'信頼性',availability:'可用性',resilience:'耐障害性',recoverability:'復旧性',performance:'性能',scalability:'拡張性',security:'セキュリティ',privacy:'プライバシー',operability:'運用性',observability:'可観測性',audit:'監査',maintainability:'保守性',testability:'テスト容易性',usability:'使用性',accessibility:'アクセシビリティ',compatibility:'互換性',interoperability:'相互運用性',portability:'移植性',migration:'移行',deployment:'配備',safety:'安全性'};
export function enumLabel(kind:string,key:string,value:unknown):string {
 const raw=String(value);
 const description=kind==='scenario'&&key==='type'?scenarioFormats[raw]:kind==='quality'&&key==='attribute'?qualityAttributes[raw]:undefined;
 return description ? `${raw}（${description}）` : raw;
}
const relationKeys:Record<string,string>={realizedBy:'realized_by',implementedBy:'implemented_by',verifiedBy:'verified_by',appliesTo:'applies_to',evidencedBy:'evidenced_by'};
for(const [key,label] of Object.entries(relationLabels)) relationLabels[key]=`${relationKeys[key]??key}（${label}）`;
