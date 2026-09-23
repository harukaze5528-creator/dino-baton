// 調整用の数値をまとめる設定ファイル
const CONFIG = {
  canvasWidth: 800,
  canvasHeight: 300,
  groundHeight: 40,

  // スクロール
  scrollSpeed: 5, // 1フレームあたりの移動px
  speedUpPerMeter: 0.0015, // 距離に応じて少しずつ速くなる

  // キャラクター(四角形)
  player: {
    x: 80,
  },
  gravity: 0.6,

  // 成長段階: EGG → CHICK → JUVENILE → ADULT
  // jumpPower が大きいほど高く跳べる。foodToGrow は次の段階に育つ(ADULTは産卵する)までに必要なエサの数
  // EGGだけは isEgg:true で、エサではなく hatchFrames 経過で自動的にCHICKへ孵化する
  // foodToGrow の合計(6+9+12=27)とエサの出現間隔(平均90フレーム=1.5秒)から、
  // うまく拾えた場合で1世代あたり約45秒、実際のプレイでは障害物を避けつつなので1分前後になる想定
  // (テストプレイして体感が合わなければここを調整する)
  stages: [
    { name: "EGG", isEgg: true, width: 14, height: 14, color: "#cccccc", hatchFrames: 90 },
    { name: "CHICK", width: 20, height: 24, jumpPower: 14, color: "#333333", foodToGrow: 6 },
    { name: "JUVENILE", width: 28, height: 34, jumpPower: 11, color: "#333333", foodToGrow: 9 },
    { name: "ADULT", width: 38, height: 48, jumpPower: 8, color: "#333333", foodToGrow: 12 },
  ],

  // 障害物に当たってから次の当たり判定が発生するまでの無敵フレーム数(若返り直後の連続ヒットを防ぐ)
  invulnFramesAfterHit: 90,

  // 産卵演出: ADULTが立ち止まる時間(フレーム数)。この間は無敵・操作不能
  layDurationFrames: 45,

  // 障害物
  obstacle: {
    width: 20,
    height: 30,
    color: "#555555",
    minInterval: 60, // フレーム数(最短出現間隔)
    maxInterval: 110, // フレーム数(最長出現間隔)
  },

  // エサ
  food: {
    width: 10,
    height: 10,
    color: "#999999",
    minInterval: 70,
    maxInterval: 110,
    heightAboveGround: [0, 70], // 地面すれすれ〜ジャンプで届く高さの範囲でランダム配置
  },

  // 距離表示
  metersPerFrame: 0.1, // scrollSpeed に応じた見かけ上の距離換算
};
