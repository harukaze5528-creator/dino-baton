// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,

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
    { name: "CHICK", width: 20, height: 24, jumpPower: 14, color: "#333333", foodToGrow: 6, speedMultiplier: 0.7 },
    { name: "JUVENILE", width: 28, height: 34, jumpPower: 11, color: "#333333", foodToGrow: 9, speedMultiplier: 1.0 },
    { name: "ADULT", width: 38, height: 48, jumpPower: 8, color: "#333333", foodToGrow: 12, speedMultiplier: 1.3 },
  ],

  // 世代ごとの難易度カーブ。世代1は特別に短く・簡単にし、以降は世代が進むごとに
  // ベース速度と障害物密度を上げ、エサの出現頻度を下げる(必要エサ数は変えないことで、
  // 1世代の長さ=ゴールまでのエサの量そのものは大きく変えない)
  difficulty: {
    // ベース速度(このあと段階ごとの speedMultiplier を掛けたものが実際のスクロール速度になる)
    baseSpeed: {
      start: 3.5, // 世代1のベース速度
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
  },

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
    width: 20,
    height: 30,
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
