import type { DiagramSample } from './types.js';
export const DIAGRAM_SAMPLES: DiagramSample[] = [
{id:'system',title:'システム構成図',subtitle:'Mermaidのsubgraphとアイコンで、入口からデータ層まで。',source:`---
title: 注文プラットフォーム
---
%% archmap: {"nodes":{"users":{"icon":"user","at":[1,2]},"cdn":{"icon":"aws/cloudfront","at":[2,2]},"web":{"icon":"browser","at":[3,2]},"api":{"icon":"gcp/cloud_run","at":[4,2]},"auth":{"icon":"shield","at":[4,1]},"db":{"icon":"database","at":[5,2],"color":"green"},"queue":{"icon":"queue","at":[4,3],"color":"orange"},"worker":{"icon":"server","at":[5,3]},"mail":{"icon":"globe","at":[6,3]}}}
flowchart LR
  users[利用者] --> cdn[CloudFront]
  subgraph cloud[Cloud / Tokyo]
    subgraph frontend[フロントエンド]
      cdn --> web[Web アプリ]
    end
    subgraph services[サービス]
      auth[認証] --> api[Orders API]
      web -->|注文| api
      api -->|読み書き| db[(注文データ)]
      api -.->|イベント| queue[注文キュー]
      queue --> worker[通知ワーカー]
    end
  end
  worker --> mail[メール配信]`},
{id:'layers',title:'レイヤースタック図',subtitle:'共通のMermaid入力を、責務ごとの層に配置。',source:`---
title: アプリケーションのレイヤー
---
%% archmap: {"view":"layers","nodes":{"web":{"icon":"browser"},"mobile":{"icon":"phone"},"orders":{"icon":"code"},"billing":{"icon":"code"},"db":{"icon":"database","color":"green"},"events":{"icon":"queue","color":"orange"}}}
flowchart TB
  subgraph presentation[Presentation]
    web[Web UI]
    mobile[Mobile UI]
  end
  subgraph domain[Domain]
    orders[Orders]
    billing[Billing]
  end
  subgraph infrastructure[Infrastructure]
    db[(Database)]
    events[Events]
  end
  web --> orders
  mobile --> billing
  orders --> db
  billing --> events`},
{id:'sequence',title:'シーケンス図',subtitle:'小さな参加者、活性区間、入れ子の分岐と並列処理。',source:`---
title: 注文の確定
---
sequenceDiagram
  actor user as お客様
  participant web as Web アプリ
  participant api as Orders API
  participant db as Database
  user->>web: 注文を確定
  web->>+api: POST /orders
  alt 在庫あり
    par 注文保存
      api->>+db: 注文を保存
      db-->>-api: 注文 ID
    and 通知予約
      api->>api: 通知イベントを作成
    end
    api-->>web: 201 Created
  else 在庫なし
    api-->>web: 409 Conflict
  end
  deactivate api
  web-->>user: 結果を表示`},
{id:'screens',title:'画面遷移図',subtitle:'遷移をアクション行に。モーダルや画面内操作も区別。',source:`---
title: ショッピングの画面遷移
---
%% archmap: {"view":"screens","nodes":{"home":{"icon":"browser","at":[1,1]},"detail":{"icon":"browser","at":[2,1]},"cart":{"icon":"browser","at":[3,1]},"confirm":{"shape":"modal","at":[3,2]},"done":{"at":[4,2]}},"actions":[{"node":"detail","label":"サイズを選ぶ","state":"選択済み"},{"node":"cart","label":"クーポンを適用","effect":"金額を再計算"},{"node":"confirm","label":"閉じる","close":true}]}
stateDiagram-v2
  state "ホーム" as home
  state "商品詳細" as detail
  state "カート" as cart
  state "購入の確認" as confirm
  state "注文完了" as done
  home --> detail: 商品を選ぶ
  detail --> cart: カートに追加
  cart --> detail: 買い物を続ける
  cart --> confirm: 購入に進む
  confirm --> done: 注文を確定`},
{id:'activity',title:'アクティビティ図',subtitle:'条件分岐とfork / joinで、業務の流れと並列処理を表現。',source:`---
title: 注文の処理
---
%% archmap: {"view":"activity"}
stateDiagram-v2
  direction TB
  state stock <<choice>>
  stock : 在庫あり？
  state parallel <<fork>>
  state complete <<join>>
  state "決済" as payment
  state "梱包" as packing
  state "出荷" as ship
  state "入荷を案内" as wait
  [*] --> stock
  stock --> parallel: はい
  stock --> wait: いいえ
  parallel --> payment
  parallel --> packing
  payment --> complete
  packing --> complete
  complete --> ship
  ship --> [*]
  wait --> [*]`},
];
