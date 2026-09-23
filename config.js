// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,
  backgroundParallax: 0.4, // 背景の飾り(木・岩・草・ビルなど)がスクロールに対してどれくらいの速さで流れるか

  // キャラクター(四角形)
  player: {
    x: 80, // 初期位置
    minX: 20, // 左右移動できる範囲
    maxX: 380, // 右端(canvasWidth)ぎりぎりまで行けると障害物の反応時間がなくなるため、少し余裕を残す
    moveSpeed: 4, // 左右キー/スワイプでの移動速度(px/フレーム)
  },
  gravity: 0.6,

  // ジャンプ: ↑/スペース/クリックを押した瞬間に基本の高さで跳び、押し続けるとさらに高く跳べる
  jump: {
    holdBoostPerFrame: 0.35, // 押し続けている間、1フレームごとに追加される上向きの力
    holdMaxFrames: 18, // 追加の力が効く最大フレーム数(これ以上長く押しても変わらない)
  },

  // しゃがみ: ↓を押すと地上ではしゃがみ、空中では急降下する
  crouch: {
    heightRatio: 0.5, // しゃがみ中の高さ(通常時の何倍か。足元基準で低くなる)
    fastFallBoost: 1.2, // 空中で↓を押したときに追加される下向きの力(1フレームごと)
    swipePulseFrames: 20, // スマホの下スワイプでしゃがむ/急降下する時間(フレーム数)
  },

  // スマホのスワイプ操作
  touch: {
    swipeThreshold: 24, // これ以上動かしたらタップではなくスワイプとみなす(px)
    moveNudge: 40, // 左右スワイプ1回で移動する量(px)
  },

  // 成長段階: EGG → CHICK → JUVENILE → ADULT
  // jumpPower が大きいほど高く跳べる。foodToGrow は次の段階に育つ(ADULTは産卵する)までに必要なエサの数
  // (全世代で共通。世代ごとに変えず統一する)
  // EGGだけは isEgg:true で、エサではなく hatchFrames 経過で自動的にCHICKへ孵化する
  // speedMultiplier はスクロール速度の段階別の倍率。ヒナが最も遅く、大人が最も速い
  // (実際の速度 = difficulty.baseSpeed の世代ごとの値 × speedMultiplier。時間経過では加速しない)
  stages: [
    { name: "EGG", isEgg: true, width: 14, height: 14, color: "#cccccc", hatchFrames: 90, speedMultiplier: 0.5 },
    { name: "CHICK", width: 16, height: 20, jumpPower: 14, color: "#333333", foodToGrow: 3, speedMultiplier: 0.7 },
    { name: "JUVENILE", width: 22, height: 27, jumpPower: 11, color: "#333333", foodToGrow: 4, speedMultiplier: 1.0 },
    { name: "ADULT", width: 30, height: 38, jumpPower: 8, color: "#333333", foodToGrow: 5, speedMultiplier: 1.3 },
  ],

  // 世代ごとの難易度カーブ。成長に必要なエサ数(stages[].foodToGrow)は全世代で統一し、
  // その代わりに世代が進むごとにベース速度と障害物密度を上げ、エサの出現頻度を下げていく
  difficulty: {
    // ベース速度(このあと段階ごとの speedMultiplier を掛けたものが実際のスクロール速度になる)
    baseSpeed: {
      start: 5, // 世代1のベース速度(遅すぎるとジャンプの滞空時間に対して障害物が不自然に遅く見え、逆にタイミングが取りづらくなるため、ある程度の速さを確保する)
      perGeneration: 0.3, // 世代が1つ進むごとに増える量
      max: 9, // 上限
    },
    // 障害物の出現間隔(フレーム数)。短いほど密度が高い
    obstacleInterval: {
      minStart: 90,
      maxStart: 140,
      decreasePerGeneration: 5,
      floor: 40, // これより短くはしない
    },
    // エサの出現間隔(フレーム数)。長いほどエサが少ない
    foodInterval: {
      minStart: 60,
      maxStart: 100,
      increasePerGeneration: 4,
      ceiling: 160, // これより長くはしない
    },
    generationsPerSpecies: 4, // 何世代ごとに次の種へ移るか
  },

  // 種の移り変わり(年代順)。ティラノサウルス→…→ニワトリで一周し、以降はまた最初から
  // (先祖返りのループそのものはステップ4で実装。ここでは種ごとのパラメータのみ定義する)
  // jumpMultiplier/sizeMultiplier/speedMultiplier は成長段階側の値にさらに掛けて種ごとの個性を出す
  // yearsAgoStart/yearsAgoEnd はその種の間に「n YEARS AGO」表示が動く範囲(世代が進むにつれて線形に減っていく)
  // decor は背景に流れる簡単な図形(木・岩・草・ビルなど)のサイズと出現間隔
  // obstacleVisuals は障害物の種類ごとの見た目の上書き(仕組みは共通、見た目だけ時代で変える)
  species: [
    {
      name: "TYRANNOSAURUS",
      color: "#3a2f2f",
      jumpMultiplier: 0.9,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.95,
      yearsAgoStart: 68000000,
      yearsAgoEnd: 66000000,
      bgColor: "#dfe8d0",
      decor: { color: "#7a9c6a", width: 12, height: 50, minInterval: 100, maxInterval: 160 },
      obstacleVisuals: {
        spike: { color: "#4a6a2a", width: 14, height: 28 }, // トゲのある植物
      },
    },
    {
      name: "ASTERIORNIS",
      color: "#4a3f2a",
      jumpMultiplier: 1.3,
      sizeMultiplier: 0.6,
      speedMultiplier: 1.0,
      yearsAgoStart: 66000000,
      yearsAgoEnd: 60000000,
      bgColor: "#e8dcc8",
      decor: { color: "#a68a6a", width: 24, height: 18, minInterval: 130, maxInterval: 200 },
      obstacleVisuals: {
        spike: { color: "#7a6a52", width: 16, height: 22 }, // 枯れた棘の茂み
      },
    },
    {
      name: "GASTORNIS",
      color: "#2f3a2f",
      jumpMultiplier: 0.85,
      sizeMultiplier: 1.05,
      speedMultiplier: 0.9,
      yearsAgoStart: 56000000,
      yearsAgoEnd: 40000000,
      bgColor: "#dbe8d5",
      decor: { color: "#6a8c5a", width: 14, height: 45, minInterval: 100, maxInterval: 160 },
      obstacleVisuals: {
        spike: { color: "#3a5a2a", width: 14, height: 28 }, // トゲの茂み
      },
    },
    {
      name: "PHORUSRHACOS",
      color: "#3a3a2a",
      jumpMultiplier: 1.0,
      sizeMultiplier: 1.0,
      speedMultiplier: 1.25,
      yearsAgoStart: 25000000,
      yearsAgoEnd: 2000000,
      bgColor: "#eef0c8",
      decor: { color: "#b8c46a", width: 8, height: 14, minInterval: 60, maxInterval: 110 },
      obstacleVisuals: {
        spike: { color: "#a68a4a", width: 16, height: 20 }, // 乾いた棘の茂み
      },
    },
    {
      name: "CHICKEN",
      color: "#4a4a4a",
      jumpMultiplier: 1.0,
      sizeMultiplier: 0.5,
      speedMultiplier: 1.0,
      yearsAgoStart: 8000,
      yearsAgoEnd: 0,
      bgColor: "#dfe3e8",
      decor: { color: "#8a94a0", width: 30, height: 70, minInterval: 140, maxInterval: 220 },
      obstacleVisuals: {
        spike: { color: "#4a8a4a", width: 20, height: 20 }, // サボテン
      },
    },
  ],

  // 障害物の種類。generationsPerSpecies(=4世代で次の種へ)に合わせて、最初の種の中で
  // 全種類が出そろうよう世代1→4で解禁する(unlockGeneration)。世代1:木の台のみ、
  // 世代2:+トゲ・転がる岩、世代3:+飛ぶ敵・穴、世代4:+群れ。
  // 解禁後は、解禁済みの種類の中から weight(重み)に応じてランダムに選ばれて出現する
  // behavior:
  //   "platform" 上に乗れる。ダメージなし(足場としてground面を一時的に持ち上げる)
  //   "jumpable" 通常の障害物。ジャンプで避ける
  //   "overhead" 頭上の障害物。しゃがんで避ける(低い枝・天井と飛ぶ敵は仕組みが同じなので統一した)
  //   "pit"      地上にいる時だけダメージ。ジャンプで飛び越える
  //   "chaser"   後ろ(画面左)から追いついてくる。追いつかれるとダメージ
  //   "flock"    飛ぶ敵(flyer)が何羽も壁のように連なって出現するが、一番下(地面際)は
  //              gapHeightの高さだけ必ず開けておく。しゃがめばどの種・成長段階でも通り抜けられる
  // 見た目(width/height/color)は種ごとの obstacleVisuals で上書きできる。追加の順番・出現頻度・
  // 組み合わせ方はこの配列とdifficulty.obstacleIntervalで調整する
  obstacleKinds: [
    { id: "platform", behavior: "platform", unlockGeneration: 1, weight: 1, width: 26, height: 14, color: "#8a6a3a" },
    { id: "spike", behavior: "jumpable", unlockGeneration: 2, weight: 1.4, width: 16, height: 24, color: "#555555" },
    { id: "boulder", behavior: "chaser", unlockGeneration: 2, weight: 0.8, width: 22, height: 22, color: "#6a6a6a", approachSpeedMultiplier: 1.5 },
    { id: "flyer", behavior: "overhead", unlockGeneration: 3, weight: 1.2, width: 20, height: 14, heightAboveGround: 18, color: "#4a4a6a" },
    { id: "pit", behavior: "pit", unlockGeneration: 3, weight: 0.8, width: 40, color: "#000000" },
    // segmentKind: 群れを構成する1羽あたりの見た目をどのkindから借りるか(flyerと共通にする)
    { id: "flock", behavior: "flock", unlockGeneration: 4, weight: 0.7, segmentKind: "flyer", gapHeight: 28, topMargin: 30 },
  ],

  // 障害物に当たってから次の当たり判定が発生するまでの無敵フレーム数(若返り直後の連続ヒットを防ぐ)
  invulnFramesAfterHit: 90,

  // 産卵演出: 減速して完全停止 → 世代の結果を表示 → 孵化して加速再開、の3段階(単位はすべてフレーム数)
  // 合計(decelFrames+holdFrames+accelFrames)が演出全体の長さ。60fpsなら210フレームで約3.5秒
  layAnimation: {
    decelFrames: 40, // スクロールが今の速度から0まで減速する時間
    holdFrames: 120, // 完全停止して世代の結果を表示している時間(この間に障害物・エサを消し、孵化する)
    accelFrames: 50, // 0から次の世代のヒナの速度まで加速する時間
  },

  // エサ
  food: {
    width: 10,
    height: 10,
    color: "#999999",
    heightAboveGround: [0, 70], // 地面すれすれ〜ジャンプで届く高さの範囲でランダム配置
  },

  // 距離表示
  metersPerFrame: 0.1, // スクロール速度(px/フレーム)に応じた見かけ上の距離換算
};
