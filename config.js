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

  // 成長段階: 卵 → ヒナ → 若い恐竜 → 大人
  // jumpPower が大きいほど高く跳べる。foodToGrow は次の段階に育つ(大人は産卵する)までに必要なエサの数
  // 卵だけは isEgg:true で、エサではなく hatchFrames 経過で自動的にヒナへ孵化する
  stages: [
    { name: "卵", isEgg: true, width: 14, height: 14, color: "#cccccc", hatchFrames: 90 },
    { name: "ヒナ", width: 20, height: 24, jumpPower: 14, color: "#333333", foodToGrow: 3 },
    { name: "若い恐竜", width: 28, height: 34, jumpPower: 11, color: "#333333", foodToGrow: 5 },
    { name: "大人", width: 38, height: 48, jumpPower: 8, color: "#333333", foodToGrow: 6 },
  ],

  // 障害物に当たってから次の当たり判定が発生するまでの無敵フレーム数(若返り直後の連続ヒットを防ぐ)
  invulnFramesAfterHit: 90,

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
    minInterval: 50,
    maxInterval: 90,
    heightAboveGround: [0, 70], // 地面すれすれ〜ジャンプで届く高さの範囲でランダム配置
  },

  // 距離表示
  metersPerFrame: 0.1, // scrollSpeed に応じた見かけ上の距離換算
};
