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
    width: 30,
    height: 40,
    color: "#333333",
  },

  // ジャンプ
  jumpPower: 12,
  gravity: 0.6,

  // 障害物
  obstacle: {
    width: 20,
    height: 30,
    color: "#555555",
    minInterval: 60, // フレーム数(最短出現間隔)
    maxInterval: 110, // フレーム数(最長出現間隔)
  },

  // 距離表示
  metersPerFrame: 0.1, // scrollSpeed に応じた見かけ上の距離換算
};
