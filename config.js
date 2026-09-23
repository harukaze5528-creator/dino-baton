// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,
  backgroundParallax: 0.4, // 背景の飾り(木・岩・草・ビルなど)がスクロールに対してどれくらいの速さで流れるか

  // キャラクター(四角形)
  player: {
    x: 80,
  },
  gravity: 0.6,

  // 成長段階: EGG → CHICK → JUVENILE → ADULT
  // jumpPower が大きいほど高く跳べる。foodToGrow は次の段階に育つ(ADULTは産卵する)までに必要なエサの数
  // (世代1だけは difficulty.firstGeneration.foodToGrowMultiplier で全体的に少なくなる)
  // EGGだけは isEgg:true で、エサではなく hatchFrames 経過で自動的にCHICKへ孵化する
  // speedMultiplier はスクロール速度の段階別の倍率。ヒナが最も遅く、大人が最も速い
  // (実際の速度 = difficulty.baseSpeed の世代ごとの値 × speedMultiplier。時間経過では加速しない)
  stages: [
    { name: "EGG", isEgg: true, width: 14, height: 14, color: "#cccccc", hatchFrames: 90, speedMultiplier: 0.5 },
    { name: "CHICK", width: 16, height: 20, jumpPower: 14, color: "#333333", foodToGrow: 6, speedMultiplier: 0.7 },
    { name: "JUVENILE", width: 22, height: 27, jumpPower: 11, color: "#333333", foodToGrow: 9, speedMultiplier: 1.0 },
    { name: "ADULT", width: 30, height: 38, jumpPower: 8, color: "#333333", foodToGrow: 12, speedMultiplier: 1.3 },
  ],

  // 世代ごとの難易度カーブ。世代1は特別に短く・簡単にし、以降は世代が進むごとに
  // ベース速度と障害物密度を上げ、エサの出現頻度を下げる(必要エサ数は変えないことで、
  // 1世代の長さ=ゴールまでのエサの量そのものは大きく変えない)
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
    // 世代1だけの特別調整(短く・簡単に)
    firstGeneration: {
      foodToGrowMultiplier: 0.45, // 成長に必要なエサ数を半分弱にして、すぐ一周できるようにする
    },

    generationsPerSpecies: 4, // 何世代ごとに次の種へ移るか
  },

  // 種の移り変わり(年代順)。ティラノサウルス→…→ニワトリで一周し、以降はまた最初から
  // (先祖返りのループそのものはステップ4で実装。ここでは種ごとのパラメータのみ定義する)
  // jumpMultiplier/sizeMultiplier/speedMultiplier は成長段階側の値にさらに掛けて種ごとの個性を出す
  // yearsAgoStart/yearsAgoEnd はその種の間に「n YEARS AGO」表示が動く範囲(世代が進むにつれて線形に減っていく)
  // decor は背景に流れる簡単な図形(木・岩・草・ビルなど)のサイズと出現間隔
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
    },
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

  // 障害物
  obstacle: {
    width: 16,
    height: 24,
    color: "#555555",
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
